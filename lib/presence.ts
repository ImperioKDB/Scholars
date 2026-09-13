// lib/presence.ts
// Client presence heartbeat hook (Push E). Pings POST /api/presence/
// heartbeat on mount, every 5 minutes, and on window focus (throttled by
// the in-flight guard so refocus spam can't stack requests). Best-effort:
// a failed ping is swallowed, presence is a nicety not a gate.
//
// Mounted once in components/Sidebar.tsx so every authenticated surface
// that renders the shell reports presence without each page opting in.
"use client";
import { useEffect } from "react";
import { fetchWithTimeout } from "@/lib/fetch";
const HEARTBEAT_MS = 5 * 60_000;
export function usePresenceHeartbeat() {
  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function ping() {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        await fetchWithTimeout("/api/presence/heartbeat", { method: "POST", timeoutMs: 5000 });
      } catch {
        // presence is best-effort
      }
      inFlight = false;
      if (!stopped) timer = setTimeout(ping, HEARTBEAT_MS);
    }
    ping();
    function onFocus() { ping(); }
    window.addEventListener("focus", onFocus);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}
