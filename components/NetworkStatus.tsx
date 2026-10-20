"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchWithTimeout } from "@/lib/fetch";
import { clearFailedOutbox, getOutboxCounts, syncPendingOutbox } from "@/lib/offline/outbox";

type ConnectionState = "unknown" | "online" | "offline" | "checking" | "unavailable" | "restored";

export function NetworkStatus() {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<ConnectionState>("unknown");
  const [userId, setUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, failed: 0 });
  const probingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const refreshQueueCount = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const activeUserId = session?.user.id ?? null;
      setUserId(activeUserId);
      if (!activeUserId) {
        setCounts({ pending: 0, failed: 0 });
        return null;
      }
      setCounts(await getOutboxCounts(activeUserId));
      return activeUserId;
    } catch {
      setUserId(null);
      setCounts({ pending: 0, failed: 0 });
      return null;
    }
  }, [supabase]);

  const checkConnection = useCallback(async () => {
    if (probingRef.current) return;
    if (!navigator.onLine) {
      setState("offline");
      await refreshQueueCount();
      return;
    }

    probingRef.current = true;
    setState("checking");
    try {
      const response = await fetchWithTimeout("/api/health", {
        cache: "no-store",
        timeoutMs: 5_000,
        retries: 1,
      });
      if (!response.ok) throw new Error("Scholars health check failed");

      let synced = 0;
      const activeUserId = await refreshQueueCount();
      if (activeUserId) {
        const currentCounts = await getOutboxCounts(activeUserId);
        if (currentCounts.pending > 0) {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (!error && user?.id === activeUserId) {
            const result = await syncPendingOutbox(user.id);
            synced = result.synced;
            setCounts({ pending: result.pending, failed: result.failed });
            window.dispatchEvent(new CustomEvent("scholars:offline-sync-complete", {
              detail: { userId: user.id, synced },
            }));
          }
        }
      }

      if (synced > 0) {
        setState("restored");
        window.setTimeout(() => {
          setState((current) => current === "restored" ? "online" : current);
        }, 5_000);
      } else {
        setState("online");
      }
    } catch {
      setState(navigator.onLine ? "unavailable" : "offline");
      await refreshQueueCount();
    } finally {
      probingRef.current = false;
    }
  }, [refreshQueueCount, supabase]);

  useEffect(() => {
    const onOffline = () => setState("offline");
    const onOnline = () => { void checkConnection(); };
    const onNetworkIssue = () => {
      if (stateRef.current !== "checking") void checkConnection();
    };
    const onOutboxUpdated = () => { void refreshQueueCount(); };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void refreshQueueCount().then((activeUserId) => {
        if (activeUserId && navigator.onLine) void checkConnection();
      });
    });

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("scholars:network-issue", onNetworkIssue);
    window.addEventListener("scholars:outbox-updated", onOutboxUpdated);

    if (!navigator.onLine) setState("offline");
    void refreshQueueCount().then(async (activeUserId) => {
      if (!navigator.onLine) setState("offline");
      else if (activeUserId && (await getOutboxCounts(activeUserId)).pending > 0) void checkConnection();
    });

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("scholars:network-issue", onNetworkIssue);
      window.removeEventListener("scholars:outbox-updated", onOutboxUpdated);
      subscription.unsubscribe();
    };
  }, [checkConnection, refreshQueueCount, supabase]);

  const visible = state === "offline" || state === "checking" || state === "unavailable" || state === "restored" || counts.pending > 0 || counts.failed > 0;
  if (!visible) return null;

  const message = state === "offline"
    ? "You’re offline. Fresh listings and online actions are unavailable."
    : state === "checking"
      ? "Checking your connection to Scholars…"
      : state === "unavailable"
        ? "We can’t reach Scholars right now. Check your connection and retry."
        : state === "restored" && counts.pending === 0
          ? "Connection restored. Your queued updates have synced."
          : counts.pending > 0
            ? `${counts.pending} update${counts.pending === 1 ? " is" : "s are"} waiting to sync from this device.`
            : "Connection restored.";

  async function dismissFailed() {
    if (!userId || !window.confirm("Remove failed updates stored on this device? This only clears the local retry queue; it does not change server data.")) return;
    try {
      await clearFailedOutbox(userId);
      await refreshQueueCount();
    } catch {
      // Keep the error visible if local storage is unavailable.
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl" role="status" aria-live="polite">
      <div className="rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy shadow-[0_8px_28px_rgba(11,30,61,0.18)]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="min-w-0 flex-1 leading-5">{message}</p>
          {(state === "offline" || state === "unavailable" || counts.pending > 0) && (
            <button type="button" onClick={() => void checkConnection()} disabled={state === "checking"} className="min-h-9 shrink-0 rounded-seal bg-navy px-4 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-60">
              {state === "checking" ? "Checking…" : counts.pending > 0 && state === "online" ? "Sync now" : "Retry"}
            </button>
          )}
        </div>
        {counts.pending > 0 && <p className="mt-1 text-xs text-navy-light">Only saved scholarship/opportunity states and application status updates are queued; other actions need a connection.</p>}
        {counts.failed > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-rose">
            <span>{counts.failed} queued update{counts.failed === 1 ? " needs" : "s need"} review and was not applied.</span>
            <button type="button" onClick={() => void dismissFailed()} className="font-semibold underline">Dismiss local retry</button>
          </div>
        )}
      </div>
    </div>
  );
}
