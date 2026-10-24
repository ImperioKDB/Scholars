"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchWithTimeout } from "@/lib/fetch";
import { clearFailedOutbox, getOutboxCounts, syncPendingOutbox, type OfflineSyncProgress } from "@/lib/offline/outbox";

type ConnectionState = "unknown" | "online" | "offline" | "checking" | "unavailable" | "restored";

export function NetworkStatus() {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<ConnectionState>("unknown");
  const [userId, setUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, failed: 0 });
  const [syncProgress, setSyncProgress] = useState<OfflineSyncProgress | null>(null);
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
      setSyncProgress(null);
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
    const onSyncProgress = (event: Event) => {
      setSyncProgress((event as CustomEvent<OfflineSyncProgress>).detail);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void refreshQueueCount().then((activeUserId) => {
        if (activeUserId && navigator.onLine) void checkConnection();
      });
    });

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("scholars:network-issue", onNetworkIssue);
    window.addEventListener("scholars:outbox-updated", onOutboxUpdated);
    window.addEventListener("scholars:offline-sync-progress", onSyncProgress);

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
      window.removeEventListener("scholars:offline-sync-progress", onSyncProgress);
      subscription.unsubscribe();
    };
  }, [checkConnection, refreshQueueCount, supabase]);

  const visible = state === "offline" || state === "checking" || state === "unavailable" || state === "restored" || counts.pending > 0 || counts.failed > 0;
  if (!visible) return null;

  const sending = state === "checking" && Boolean(syncProgress?.total);
  const currentStep = syncProgress ? Math.min(syncProgress.current, syncProgress.total) : 0;
  const progressPercent = syncProgress?.total
    ? Math.round((syncProgress.synced / syncProgress.total) * 100)
    : null;
  const headline = state === "offline"
    ? "Your updates are safe on this device"
    : state === "checking"
      ? sending
        ? currentStep > 0
          ? `Sending update ${currentStep} of ${syncProgress!.total}`
          : `Syncing ${syncProgress!.total} updates…`
        : "Finding your signal…"
      : state === "unavailable"
        ? "Scholars is taking a moment to respond"
        : state === "restored" && counts.pending === 0
          ? "You’re back in sync"
          : counts.pending > 0
            ? `${counts.pending} update${counts.pending === 1 ? " is" : "s are"} ready to sync`
            : "Connection restored";
  const detail = state === "offline"
    ? "Saved items and application status changes will sync when you reconnect."
    : state === "checking"
      ? sending
        ? currentStep > 0
          ? `${syncProgress!.synced} of ${syncProgress!.total} update${syncProgress!.total === 1 ? "" : "s"} sent successfully.`
          : "Getting your queued changes ready to send."
        : "Checking the connection before we send your queued changes."
      : state === "unavailable"
        ? "Your queued changes are still here. Try again when your connection is ready."
        : counts.pending > 0
          ? "They’re stored locally and ready whenever the connection is stable."
          : state === "restored"
            ? "Your queued changes have been sent."
            : "Your connection is available again.";

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
      <div className={`network-status-card rounded-2xl border border-navy/15 bg-white px-4 py-4 text-sm text-navy shadow-[0_8px_28px_rgba(11,30,61,0.18)] ${state === "checking" ? "network-status-card--busy" : ""}`}>
        <div className="flex items-center gap-3">
          <div className={`network-status-mark shrink-0 ${state === "checking" ? "network-status-mark--busy" : ""}`} aria-hidden="true">
            <span /><span /><span />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-5">{headline}</p>
            <p className="mt-0.5 text-xs leading-5 text-navy-light">{detail}</p>
          </div>
          {(state === "offline" || state === "unavailable" || counts.pending > 0) && (
            <button type="button" onClick={() => void checkConnection()} disabled={state === "checking"} className="min-h-9 shrink-0 rounded-seal bg-navy px-4 text-xs font-semibold text-white hover:bg-navy-light disabled:opacity-60">
              {state === "checking" ? "Working…" : counts.pending > 0 && state === "online" ? "Sync now" : "Retry"}
            </button>
          )}
        </div>
        {state === "checking" && (
          <div className="mt-3 pl-12">
            <div
              className="network-sync-track"
              role="progressbar"
              aria-label={sending ? "Syncing queued updates" : "Checking your connection"}
              aria-valuemin={0}
              aria-valuemax={100}
              {...(progressPercent === null ? {} : { "aria-valuenow": progressPercent })}
            >
              <span
                className={`network-sync-fill ${progressPercent === null ? "network-sync-fill--indeterminate" : ""}`}
                style={progressPercent === null ? undefined : { width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-navy-light">
              <span>{sending ? "Applying your saved changes" : "Checking connection"}</span>
              <span>{sending ? currentStep > 0 ? `${currentStep}/${syncProgress!.total}` : `${syncProgress!.total} queued` : "Almost there"}</span>
            </div>
          </div>
        )}
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
