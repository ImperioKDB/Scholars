"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export function NotificationInbox() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("load_failed")))
      .then((payload) => setItems(payload.notifications ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => {});
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald">Community updates</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-navy">Notifications</h1>
          <p className="mt-1 text-sm text-navy-light">Replies and helpful reactions on your scholarship discussions.</p>
        </div>
        {items.some((item) => !item.read_at) && <button type="button" onClick={markAllRead} className="text-sm font-medium text-navy hover:underline">Mark all as read</button>}
      </div>
      {loading ? <div className="rounded-2xl border border-hairline bg-white p-5 text-sm text-navy-light">Loading notifications…</div> : items.length === 0 ? (
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
