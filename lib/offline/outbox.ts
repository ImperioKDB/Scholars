import { fetchWithTimeout } from "@/lib/fetch";

const DB_NAME = "scholars-offline-v1";
const STORE_NAME = "outbox";

type SavedKind = "scholarship-save" | "opportunity-save";
export type OfflineOutboxRecord = {
  key: string;
  userId: string;
  kind: SavedKind | "application-status";
  entityId: string;
  saved?: boolean;
  status?: "in_progress" | "submitted" | "accepted" | "rejected" | "not_applied";
  createdAt: number;
  state: "pending" | "failed";
};

let databasePromise: Promise<IDBDatabase> | null = null;
let syncInFlight: Promise<{ synced: number; pending: number; failed: number }> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Offline storage is unavailable"));
  if (!databasePromise) {
    const opening: Promise<IDBDatabase> = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Couldn't open offline storage"));
      request.onblocked = () => reject(new Error("Offline storage is busy"));
    });
    databasePromise = opening.catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise!;
}

function emitOutboxUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("scholars:outbox-updated"));
}

async function readAll(): Promise<OfflineOutboxRecord[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as OfflineOutboxRecord[]);
    request.onerror = () => reject(request.error ?? new Error("Couldn't read offline updates"));
  });
}

async function writeRecord(record: OfflineOutboxRecord): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Couldn't save offline update"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline update was not saved"));
  });
}

async function deleteRecord(key: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Couldn't remove offline update"));
  });
}

async function enqueue(record: OfflineOutboxRecord): Promise<boolean> {
  try {
    await writeRecord(record);
    emitOutboxUpdated();
    return true;
  } catch {
    return false;
  }
}

export function queueScholarshipSavedState(userId: string, scholarshipId: string, saved: boolean) {
  return enqueue({
    key: `${userId}:scholarship-save:${scholarshipId}`,
    userId,
    kind: "scholarship-save",
    entityId: scholarshipId,
    saved,
    createdAt: Date.now(),
    state: "pending",
  });
}

export function queueOpportunitySavedState(userId: string, opportunityId: string, saved: boolean) {
  return enqueue({
    key: `${userId}:opportunity-save:${opportunityId}`,
    userId,
    kind: "opportunity-save",
    entityId: opportunityId,
    saved,
    createdAt: Date.now(),
    state: "pending",
  });
}

export function queueApplicationStatus(userId: string, applicationId: string, status: OfflineOutboxRecord["status"]) {
  if (!status) return Promise.resolve(false);
  return enqueue({
    key: `${userId}:application-status:${applicationId}`,
    userId,
    kind: "application-status",
    entityId: applicationId,
    status,
    createdAt: Date.now(),
    state: "pending",
  });
}

export async function getOutboxCounts(userId: string): Promise<{ pending: number; failed: number }> {
  try {
    const records = (await readAll()).filter((record) => record.userId === userId);
    return {
      pending: records.filter((record) => record.state === "pending").length,
      failed: records.filter((record) => record.state === "failed").length,
    };
  } catch {
    return { pending: 0, failed: 0 };
  }
}

export async function clearFailedOutbox(userId: string): Promise<void> {
  const failed = (await readAll()).filter((record) => record.userId === userId && record.state === "failed");
  for (const record of failed) await deleteRecord(record.key);
  emitOutboxUpdated();
}

async function replay(record: OfflineOutboxRecord): Promise<Response> {
  if (record.kind === "application-status") {
    return fetchWithTimeout(`/api/applications/${encodeURIComponent(record.entityId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: record.status }),
    });
  }

  const isOpportunity = record.kind === "opportunity-save";
  const field = isOpportunity ? "opportunity_id" : "scholarship_id";
  const base = isOpportunity ? "/api/opportunities/save" : "/api/scholarships/save";
  if (record.saved) {
    return fetchWithTimeout(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: record.entityId }),
    });
  }
  return fetchWithTimeout(`${base}?${field}=${encodeURIComponent(record.entityId)}`, { method: "DELETE" });
}

export async function syncPendingOutbox(userId: string): Promise<{ synced: number; pending: number; failed: number }> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    let synced = 0;
    const records = (await readAll())
      .filter((record) => record.userId === userId && record.state === "pending")
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const record of records) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      try {
        const response = await replay(record);
        if (response.ok) {
          await deleteRecord(record.key);
          synced += 1;
          continue;
        }
        if (response.status === 401 || response.status === 408 || response.status === 429 || response.status >= 500) break;
        await writeRecord({ ...record, state: "failed" });
      } catch {
        // The server may have received the request even if the response was lost.
        // Replaying desired-state writes is safe; keep it pending for the next connection.
        break;
      }
    }

    const counts = await getOutboxCounts(userId);
    emitOutboxUpdated();
    return { synced, ...counts };
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}
