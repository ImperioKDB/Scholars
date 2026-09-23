"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { Metric } from "web-vitals";
import { track } from "@/lib/analytics";

const MAX_MESSAGE_LENGTH = 180;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function clean(value: unknown): string {
  return String(value ?? "unknown").slice(0, MAX_MESSAGE_LENGTH);
}

function reportVital(metric: Metric) {
  track("web_vital", {
    name: metric.name,
    value: Number(metric.value.toFixed(2)),
    rating: metric.rating,
    navigation_type: metric.navigationType,
  });
}

export function Monitoring() {
  const pathname = usePathname();
  const errorListenersReady = useRef(false);

  useEffect(() => {
    track("page_viewed", { path: pathname || "/" });
  }, [pathname]);

  useEffect(() => {
    // Performance telemetry must never compete with the page's critical path.
    // Keep web-vitals out of the initial layout chunk and load it after the
    // browser has had a chance to render and become interactive.
    const idleWindow = window as IdleWindow;
    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    const loadVitals = async () => {
      if (cancelled) return;
      const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals");
      if (cancelled) return;
      onCLS(reportVital);
      onFCP(reportVital);
      onINP(reportVital);
      onLCP(reportVital);
      onTTFB(reportVital);
    };

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(() => void loadVitals(), { timeout: 3000 });
    } else {
      timeoutHandle = window.setTimeout(() => void loadVitals(), 1500);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, []);

  useEffect(() => {
    if (errorListenersReady.current) return;
    errorListenersReady.current = true;

    function onError(event: ErrorEvent) {
      track("client_error", {
        kind: "runtime_error",
        message: clean(event.message),
        source: clean(event.filename),
        line: event.lineno || 0,
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason instanceof Error ? event.reason.message : event.reason;
      track("client_error", {
        kind: "unhandled_rejection",
        message: clean(reason),
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
