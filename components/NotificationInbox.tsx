"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";

type NotificationItem = {
  id: string;
  message: string;
  created_at: string;
  read_at: string | null;
  scholarship_id: string | null;
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function NotificationInboxSkeleton() {
  return (
    <div aria-label="Loading notifications" aria-busy="true" className="overflow-hidden rounded-2xl border border-hairline bg-white">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="border-b border-hairline p-4 last:border-0">
          <div className="flex items-start gap-3">
            <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-2.5 w-32" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationInbox() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("notifications_load_failed");
      const payload = await response.json();
      setItems(payload.notifications ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function markAllRead() {
    if (markingRead) return;
    setMarkingRead(true);
    setActionError(false);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!response.ok) throw new Error("notifications_mark_read_failed");
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    } catch {
      setActionError(true);
    } finally {
      setMarkingRead(false);
    }
  }

  const hasUnread = items.some((item) => !item.read_at);

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald">Community updates</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-navy">Notifications</h1>
          <p className="mt-1 text-sm text-navy-light">Replies and helpful reactions on your scholarship discussions.</p>
        </div>
        {hasUnread && (
          <button type="button" onClick={() => void markAllRead()} disabled={markingRead} aria-busy={markingRead} className="text-sm font-medium text-navy hover:underline disabled:cursor-wait disabled:opacity-60">
            {markingRead ? "Marking as read…" : "Mark all as read"}
          </button>
        )}
      </div>
      {actionError && <p role="alert" className="mb-4 rounded-xl border border-rose-light bg-rose-light/40 px-4 py-3 text-sm text-navy">We couldn’t update your notifications. Please try again.</p>}
      {loading ? (
        <NotificationInboxSkeleton />
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-rose-light bg-rose-light/40 p-6 text-sm text-navy">
          <p className="font-medium">We couldn’t load your notifications.</p>
          <p className="mt-1 text-navy-light">Check your connection and try again.</p>
          <button type="button" onClick={() => void load()} className="mt-4 rounded-seal bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/90">Try again</button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-white p-8 text-center"><p className="font-medium text-navy">You’re all caught up.</p><p className="mt-1 text-sm text-navy-light">When someone replies to your discussion, it will appear here.</p></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-white">
          {items.map((item) => (
            <div key={item.id} className={`border-b border-hairline p-4 last:border-0 ${item.read_at ? "" : "bg-navy-50/50"}`}>
              <div className="flex items-start gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? "bg-hairline" : "bg-rose"}`} aria-hidden="true" /><div className="min-w-0"><p className="text-sm leading-relaxed text-ink">{item.message}</p><p className="mt-1 text-xs text-navy-light">{dateLabel(item.created_at)}</p>{item.scholarship_id && <Link href={`/scholarships/${item.scholarship_id}`} className="mt-2 inline-block text-xs font-medium text-emerald hover:underline">Open discussion →</Link>}</div></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
