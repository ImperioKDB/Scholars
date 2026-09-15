"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { track } from "@/lib/analytics";

const MAX_MESSAGE_LENGTH = 180;

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
    onCLS(reportVital);
    onFCP(reportVital);
    onINP(reportVital);
    onLCP(reportVital);
    onTTFB(reportVital);
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
