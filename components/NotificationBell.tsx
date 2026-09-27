"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      setItems(payload.notifications ?? []);
      setUnread(payload.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
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
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function openNotifications() {
    const next = !open;
    setOpen(next);
    if (!next) triggerRef.current?.focus();
    if (next) {
      await load();
      if (unread > 0) {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        }).catch(() => {});
        setUnread(0);
        setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
      }
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
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-navy-light hover:bg-navy-50 hover:text-navy"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m9-3V10a6 6 0 0 0-12 0v4l-1.5 2h15L18 14Zm-4 7a2.2 2.2 0 0 1-4 0" />
        </svg>
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose" aria-hidden="true" />}
      </button>
      {open && (
        <div id="notification-panel" ref={panelRef} role="region" aria-labelledby="notification-heading" tabIndex={-1} className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-hairline bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <div>
              <p id="notification-heading" className="font-display text-base font-semibold text-navy">Notifications</p>
              <p className="text-[11px] text-navy-light">Replies and helpful reactions from the community.</p>
            </div>
            <span className="text-xs font-mono text-navy-light">{unread} new</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-5 text-sm text-navy-light">Checking for updates…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-5 text-sm text-navy-light">You’re all caught up.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="border-b border-hairline px-4 py-3 last:border-0">
                  <p className="text-sm leading-relaxed text-ink">{item.message}</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-navy-light">{relativeDate(item.created_at)}</span>
                    {item.scholarship_id && <Link href={`/scholarships/${item.scholarship_id}`} onClick={() => setOpen(false)} className="text-[11px] font-medium text-emerald hover:underline">View discussion →</Link>}
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
