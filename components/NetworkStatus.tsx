"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchWithTimeout } from "@/lib/fetch";
import { clearFailedOutbox, getOutboxCounts, syncPendingOutbox, type OfflineSyncProgress } from "@/lib/offline/outbox";
import { LogoMark } from "@/components/Logo";

type ConnectionState = "unknown" | "online" | "offline" | "checking" | "unavailable" | "restored";

type LoaderPhase = "checking" | "sending" | "success";

// Timing for the centered status. These only shape what is drawn; they never
// delay or change when the connection check or the sync itself runs.
const LOADER_SHOW_DELAY_MS = 600; // a quick background check never flashes the loader
const LOADER_FADE_MS = 320;
const LOADER_MIN_HOLD_MS: Record<LoaderPhase, number> = { checking: 900, sending: 1100, success: 2600 };

// Ring geometry, in the 100 x 100 viewBox the SVG uses.
const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Decides which centered status is on screen. Each phase stays long enough to
// be read before the next one replaces it, and a bare connectivity probe that
// finishes within LOADER_SHOW_DELAY_MS is never shown at all.
function useLoaderPhase(want: LoaderPhase | null, immediate: boolean) {
  const [shown, setShown] = useState<{ phase: LoaderPhase; since: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [successDone, setSuccessDone] = useState(false);

  useEffect(() => {
    if (want !== "success") setSuccessDone(false);
  }, [want]);

  // A success message that has already been shown is not replayed while the
  // connection state stays "restored".
  const target = want === "success" && successDone ? null : want;

  useEffect(() => {
    let timer: number | undefined;
    const later = (ms: number, run: () => void) => {
      timer = window.setTimeout(run, ms);
    };
    const present = (phase: LoaderPhase) => {
      setLeaving(false);
      setShown({ phase, since: Date.now() });
    };

    if (!shown) {
      if (target) later(target === "checking" && !immediate ? LOADER_SHOW_DELAY_MS : 0, () => present(target));
    } else if (leaving) {
      if (target) later(0, () => present(target));
      else later(LOADER_FADE_MS, () => { setShown(null); setLeaving(false); });
    } else if (target !== shown.phase) {
      const remaining = Math.max(0, LOADER_MIN_HOLD_MS[shown.phase] - (Date.now() - shown.since));
      later(remaining, () => (target ? present(target) : setLeaving(true)));
    } else if (shown.phase === "success") {
      const remaining = Math.max(0, LOADER_MIN_HOLD_MS.success - (Date.now() - shown.since));
      later(remaining, () => { setSuccessDone(true); setLeaving(true); });
    }
    return () => window.clearTimeout(timer);
  }, [target, immediate, shown, leaving]);

  return { phase: shown?.phase ?? null, leaving };
}

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

  const sending = state === "checking" && Boolean(syncProgress?.total);
  const want: LoaderPhase | null = state === "checking"
    ? sending ? "sending" : "checking"
    : state === "restored" && counts.pending === 0 ? "success" : null;
  // Queued updates make the centered status worth showing straight away; a bare
  // connectivity probe only earns it when the check turns out to be slow.
  const loader = useLoaderPhase(want, counts.pending > 0 || sending);

  // The last progress event can land in the same render as the end of a sync, so
  // it is remembered as it arrives and read back while the final status shows.
  const lastProgressRef = useRef<OfflineSyncProgress | null>(null);
  useEffect(() => {
    const remember = (event: Event) => {
      lastProgressRef.current = (event as CustomEvent<OfflineSyncProgress>).detail;
    };
    window.addEventListener("scholars:offline-sync-progress", remember);
    return () => window.removeEventListener("scholars:offline-sync-progress", remember);
  }, []);
  useEffect(() => {
    if (!loader.phase && state !== "checking") lastProgressRef.current = null;
  }, [loader.phase, state]);
  const progress = lastProgressRef.current ?? syncProgress;

  // Everything below comes from real sync results: `synced` counts updates the
  // server accepted, so the ring never moves ahead of confirmed work.
  const total = progress?.total ?? 0;
  const sent = progress ? Math.min(progress.synced, total) : 0;
  const step = progress ? Math.min(progress.current, total) : 0;
  const fraction = total > 0 ? sent / total : loader.phase === "success" ? 1 : 0;
  const percent = Math.round(fraction * 100);
  const plural = total === 1 ? "" : "s";
  const needsReview = `${counts.failed} update${counts.failed === 1 ? " needs" : "s need"} review`;

  const loaderHeadline = loader.phase === "checking"
    ? "Checking your connection…"
    : loader.phase === "sending"
      ? step > 0 ? `Sending update ${step} of ${total}` : `Syncing ${total} update${plural}…`
      : loader.phase === "success" ? "You’re back in sync" : "";
  const loaderDetail = loader.phase === "checking"
    ? "Making sure Scholars is ready to sync."
    : loader.phase === "sending"
      ? "Your saved updates are being synced…"
      : loader.phase === "success"
        ? counts.failed > 0 ? `${needsReview}.` : "Your saved updates have been sent."
        : "";
  const loaderLabel = loader.phase === "checking" || total === 0 ? "" : `${sent} of ${total} sent`;
  // Screen readers hear one message per phase, not every progress tick.
  const announcement = loader.phase === "checking"
    ? "Checking your connection."
    : loader.phase === "sending"
      ? total > 0 ? `Sending ${total} saved update${plural}.` : "Sending your saved updates."
      : loader.phase === "success"
        ? counts.failed > 0 ? `Sync finished. ${needsReview}.` : "You’re back in sync. Your saved updates have been sent."
        : "";
  const ringLabel = loader.phase === "checking"
    ? "Checking your connection"
    : loader.phase === "success" ? "Sync finished" : "Syncing saved updates";
  // Checking is indeterminate, so it exposes no value at all.
  const ringValue = loader.phase === "checking" ? {} : {
    "aria-valuenow": percent,
    ...(total > 0 ? { "aria-valuetext": `${sent} of ${total} update${plural} sent` } : {}),
  };

  // The centered status owns the screen while it is up, or about to be for queued updates.
  const overlayOwnsScreen = (loader.phase !== null && !loader.leaving) || (state === "checking" && counts.pending > 0);
  // While a check runs the dock keeps describing the queue, so it never flickers.
  const idle = state === "checking" ? "online" : state;
  // Waiting updates only get the dock once the first check has settled; before that the centered status takes over.
  const showDock = !overlayOwnsScreen && (idle === "offline" || idle === "unavailable" || (counts.pending > 0 && idle !== "unknown") || counts.failed > 0);
  const headline = idle === "offline"
    ? "Your updates are safe on this device"
    : idle === "unavailable"
      ? "Scholars is taking a moment to respond"
      : idle === "restored" && counts.pending === 0
        ? "You’re back in sync"
        : counts.pending > 0
          ? `${counts.pending} update${counts.pending === 1 ? " is" : "s are"} ready to sync`
          : "Connection restored";
  const detail = idle === "offline"
    ? "Saved items and application status changes will sync when you reconnect."
    : idle === "unavailable"
      ? "Your queued changes are still here. Try again when your connection is ready."
      : counts.pending > 0
        ? "They’re stored locally and ready whenever the connection is stable."
        : idle === "restored"
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
    <>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

      {loader.phase && (
        <div
          className="network-loader"
          data-phase={loader.phase}
          data-leaving={loader.leaving ? "true" : undefined}
          style={{ "--nl-fade": `${LOADER_FADE_MS}ms` } as CSSProperties}
        >
          <div className="network-loader__content">
            <div
              className="network-loader__ring"
              data-mode={loader.phase === "checking" ? "indeterminate" : "determinate"}
              role="progressbar"
              aria-label={ringLabel}
              aria-valuemin={0}
              aria-valuemax={100}
              {...ringValue}
            >
              <svg className="network-loader__svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <circle className="network-loader__track" cx="50" cy="50" r={RING_RADIUS} />
                <circle
                  className="network-loader__arc"
                  cx="50"
                  cy="50"
                  r={RING_RADIUS}
                  transform="rotate(-90 50 50)"
                  data-empty={fraction > 0 ? undefined : "true"}
                  style={{ strokeDasharray: RING_CIRCUMFERENCE, strokeDashoffset: RING_CIRCUMFERENCE * (1 - fraction) }}
                />
              </svg>
              <svg className="network-loader__svg network-loader__sweep" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <circle className="network-loader__sweep-arc" cx="50" cy="50" r={RING_RADIUS} />
              </svg>
              <LogoMark className="network-loader__mark" />
            </div>
            <div className="network-loader__text">
              <p key={loaderHeadline} className="network-loader__fade flex min-h-6 items-center justify-center gap-1.5 text-balance font-display text-[17px] font-semibold leading-6 text-navy">
                {loader.phase === "success" && (
                  <svg className="network-loader__check h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="M5 12.5l4.2 4.2L19 7" />
                  </svg>
                )}
                <span>{loaderHeadline}</span>
              </p>
              <p key={loaderDetail} className="network-loader__fade min-h-5 text-balance text-[13px] leading-5 text-navy-light">{loaderDetail}</p>
              <p className="min-h-4 text-[11px] font-semibold leading-4 tracking-wide text-navy-light tabular-nums">{loaderLabel}</p>
            </div>
          </div>
        </div>
      )}

      {showDock && (
        <div
          className="network-dock fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] z-[100] mx-auto max-w-2xl"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-navy/15 bg-white px-4 py-4 text-sm text-navy shadow-[0_8px_28px_rgba(11,30,61,0.18)]">
            <div className="flex items-center gap-3">
              <div className="network-dock__mark shrink-0" aria-hidden="true">
                <LogoMark className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-5">{headline}</p>
                <p className="mt-0.5 text-xs leading-5 text-navy-light">{detail}</p>
              </div>
              {(state === "offline" || state === "unavailable" || counts.pending > 0) && (
                <button type="button" onClick={() => void checkConnection()} className="min-h-9 shrink-0 rounded-seal bg-navy px-4 text-xs font-semibold text-white hover:bg-navy-light">
                  {counts.pending > 0 && state === "online" ? "Sync now" : "Retry"}
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
      )}
    </>
  );
}
