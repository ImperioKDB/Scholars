"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoLoader } from "@/components/LogoLoader";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  created_at: string;
  read_at: string | null;
  scholarship_id: string | null;
  discussion_id: string | null;
};

function relativeDate(value: string) {
  const age = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(age / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationListLoading() {
  return <LogoLoader variant="section" label="Loading notifications…" />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef<Promise<number> | null>(null);
  const mutationVersionRef = useRef(0);
  const nextPanelSessionRef = useRef(0);
  const activePanelSessionRef = useRef<number | null>(null);
  const markAllReadInFlightRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  async function load(
    sessionId?: number,
    guardSession = false,
  ): Promise<number> {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const requestMutationVersion = mutationVersionRef.current;
    const request = (async () => {
      if (mountedRef.current) {
        setLoading(true);
        setError(false);
      }

      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("notifications_load_failed");
        }

        const payload = await response.json();
        const nextItems = payload.notifications ?? [];
        const nextUnread = Number.isFinite(payload.unreadCount)
          ? payload.unreadCount
          : 0;

        if (
          mountedRef.current &&
          requestMutationVersion === mutationVersionRef.current &&
          (!guardSession || activePanelSessionRef.current === sessionId)
        ) {
          setItems(nextItems);
          setUnread(nextUnread);
          return nextUnread;
        }

        return -1;
      } catch {
        if (
          mountedRef.current &&
          (!guardSession || activePanelSessionRef.current === sessionId)
        ) {
          setError(true);
        }
        return -1;
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    inFlightRef.current = request;

    try {
      return await request;
    } finally {
      if (inFlightRef.current === request) {
        inFlightRef.current = null;
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    refreshIfVisible();

    const interval = window.setInterval(
      refreshIfVisible,
      60_000
    );

    document.addEventListener(
      "visibilitychange",
      refreshIfVisible
    );

    window.addEventListener("focus", refreshIfVisible);

    return () => {
      mountedRef.current = false;
      activePanelSessionRef.current = null;
      window.clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        refreshIfVisible
      );
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        closePanel();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
  }, [open]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) closePanel();
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function closePanel() {
    activePanelSessionRef.current = null;
    setOpen(false);
  }

  async function reloadAfterMutation(sessionId: number): Promise<number> {
    while (inFlightRef.current) {
      const pending = inFlightRef.current;
      await pending;
      await Promise.resolve();
    }
    return load(sessionId, true);
  }

  async function markAllRead(sessionId: number) {
    if (markAllReadInFlightRef.current) {
      return markAllReadInFlightRef.current;
    }

    const request = (async () => {
      try {
        const response = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        });

        if (!response.ok) {
          throw new Error("notifications_mark_read_failed");
        }

        // The PATCH response does not identify the rows it changed. Bump the
        // version first, then reconcile from a fresh authoritative GET so a
        // notification created during the mutation remains unread locally.
        mutationVersionRef.current += 1;
        const activeSessionId = activePanelSessionRef.current;
        if (!mountedRef.current || activeSessionId === null) return;
        await reloadAfterMutation(activeSessionId);
      } catch {
        // Keep unread state intact; the next successful refresh reconciles it.
        if (
          mountedRef.current &&
          activePanelSessionRef.current !== null
        ) {
          setError(true);
        }
      }
    })();

    markAllReadInFlightRef.current = request;
    try {
      await request;
    } finally {
      if (markAllReadInFlightRef.current === request) {
        markAllReadInFlightRef.current = null;
      }
    }
  }

  async function openNotifications() {
    if (open) {
      closePanel();
      triggerRef.current?.focus();
      return;
    }

    const sessionId = ++nextPanelSessionRef.current;
    activePanelSessionRef.current = sessionId;
    setOpen(true);

    const latestUnread = await load(sessionId);
    if (
      activePanelSessionRef.current === sessionId &&
      latestUnread > 0
    ) {
      await markAllRead(sessionId);
    }
  }

  async function retryNotifications() {
    const sessionId = activePanelSessionRef.current;
    if (sessionId === null) return;

    const latestUnread = await load(sessionId);
    if (
      activePanelSessionRef.current === sessionId &&
      latestUnread > 0
    ) {
      await markAllRead(sessionId);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={openNotifications}
        aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
        ref={triggerRef}
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-busy={loading}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-navy-light hover:bg-navy-50 hover:text-navy disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m9-3V10a6 6 0 0 0-12 0v4l-1.5 2h15L18 14Zm-4 7a2.2 2.2 0 0 1-4 0" />
        </svg>
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose" aria-hidden="true" />}
      </button>
      {open && (
        <div id="notification-panel" ref={panelRef} role="region" aria-labelledby="notification-heading" tabIndex={-1} className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-hairline bg-white shadow-card md:left-0 md:right-auto">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <div>
              <p id="notification-heading" className="font-display text-base font-semibold text-navy">Notifications</p>
              <p className="text-[11px] text-navy-light">Replies and helpful reactions from the community.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-navy-light">{unread} new</span>
              <button type="button" onClick={() => { closePanel(); triggerRef.current?.focus(); }} aria-label="Close notifications" className="text-navy-light hover:text-navy">×</button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <NotificationListLoading />
            ) : error ? (
              <div role="alert" className="px-4 py-5 text-sm text-navy-light">
                <p>Notifications are temporarily unavailable.</p>
                <button type="button" onClick={() => void retryNotifications()} className="mt-2 font-medium text-emerald hover:underline">Try again</button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-5 text-sm text-navy-light">You’re all caught up.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="border-b border-hairline px-4 py-3 last:border-0">
                  <p className="text-sm leading-relaxed text-ink">{item.message}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-navy-light">{relativeDate(item.created_at)}</span>
                    {item.scholarship_id && <Link href={`/scholarships/${item.scholarship_id}`} onClick={closePanel} className="text-[11px] font-medium text-emerald hover:underline">View discussion →</Link>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
