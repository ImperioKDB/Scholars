"use client";

import React from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function ResourceMobileNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Closes the menu and returns focus to the trigger (Escape / link activation).
  const closeAndFocusTrigger = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  }, []);

  // Closes the menu without moving focus (outside click). The element the user
  // actually tapped receives focus naturally; we do not steal it back to the
  // trigger, which would disrupt touch interaction.
  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  // Escape closes the menu and returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAndFocusTrigger();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeAndFocusTrigger]);

  // Outside-click dismissal: only fires when the pointer lands outside both the
  // trigger and the menu panel, so keyboard and in-menu touch are undisturbed.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!open) return;
      const target = event.target as Node | null;
      if (
        target &&
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        close();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="resource-mobile-menu"
        onClick={toggle}
        className="rounded-seal border border-hairline px-3 py-2 text-sm font-semibold text-navy"
        style={{ touchAction: "manipulation" }}
      >
        {open ? "Close" : "Menu"}
      </button>
      {/* Always in the DOM so aria-controls resolves in both states. Hidden
          visually and from the accessibility tree when closed. */}
      <div
        ref={menuRef}
        id="resource-mobile-menu"
        hidden={!open}
        className="absolute inset-x-0 z-20 border-b border-hairline bg-white px-6 py-4 shadow-card"
      >
        <nav aria-label="Mobile Resource Center navigation" className="grid gap-1 text-sm font-medium text-navy-light">
          <Link
            href="/resources"
            onClick={closeAndFocusTrigger}
            className="rounded-lg px-3 py-3 hover:bg-navy-50"
            style={{ touchAction: "manipulation" }}
          >
            Resource desk
          </Link>
          <Link
            href="/scholarships-in-nigeria"
            onClick={closeAndFocusTrigger}
            className="rounded-lg px-3 py-3 hover:bg-navy-50"
            style={{ touchAction: "manipulation" }}
          >
            Find scholarships
          </Link>
          <Link
            href="/opportunities-for-students"
            onClick={closeAndFocusTrigger}
            className="rounded-lg px-3 py-3 hover:bg-navy-50"
            style={{ touchAction: "manipulation" }}
          >
            Opportunities
          </Link>
        </nav>
      </div>
    </div>
  );
}

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  return <div aria-hidden="true" className="fixed inset-x-0 top-0 z-30 h-1 bg-transparent"><div className="h-full origin-left bg-emerald transition-[width] duration-100" style={{ width: `${progress}%` }} /></div>;
}

export function ArticleTableOfContents({ headings }: { headings: { id: string; text: string; level: 2 | 3 }[] }) {
  const [open, setOpen] = useState(false);
  if (headings.length < 2) return null;
  return (
    <div className="rounded-2xl border border-hairline bg-white p-5">
      <button type="button" className="flex w-full items-center justify-between text-left font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-light" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        On this page <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <nav aria-label="Table of contents" className={`${open ? "mt-4 block" : "hidden"} lg:mt-4 lg:block`}>
        <ol className="space-y-2 text-sm text-navy-light">
          {headings.map((heading) => <li key={heading.id} className={heading.level === 3 ? "pl-3" : ""}><a href={`#${heading.id}`} className="hover:text-navy hover:underline">{heading.text}</a></li>)}
        </ol>
      </nav>
    </div>
  );
}

export function ShareArticle({ title }: { title: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setNotice("Link copied"); }
    } catch {
      setNotice(null);
    }
  };
  return <div className="flex items-center gap-3"><button type="button" onClick={share} className="rounded-seal border border-hairline px-3 py-2 text-xs font-semibold text-navy hover:border-navy">Share guide</button>{notice && <span role="status" className="text-xs text-emerald">{notice}</span>}</div>;
}

export function useHeadingIds(content: string) {
  return useMemo(() => content.split(/\n+/).flatMap((line) => {
    const match = line.match(/^#{2,3}\s+(.+)$/);
    if (!match) return [];
    const text = match[1].replace(/[*_`]/g, "").trim();
    return [{ id: slugify(text), text, level: line.startsWith("###") ? 3 as const : 2 as const }];
  }), [content]);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}
