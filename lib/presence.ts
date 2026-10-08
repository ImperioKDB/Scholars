"use client";
import { useEffect } from "react";
import { fetchWithTimeout } from "@/lib/fetch";
const HEARTBEAT_MS = 5 * 60_000;
type PresenceTransition = () => void;
export function usePresenceHeartbeat(onOnlineTransition?: PresenceTransition) {
  useEffect(() => { let stopped = false; let inFlight = false; let timer: ReturnType<typeof setTimeout> | null = null; let online = false; let lastSuccessAt = 0; async function ping() { if (stopped || inFlight) return; inFlight = true; try { const response = await fetchWithTimeout("/api/presence/heartbeat", { method: "POST", timeoutMs: 5000 }); const successful = response.ok; const stale = lastSuccessAt > 0 && Date.now() - lastSuccessAt > HEARTBEAT_MS * 2.5; if (successful && (!online || stale)) onOnlineTransition?.(); if (successful) { online = true; lastSuccessAt = Date.now(); } else online = false; } catch { online = false; } finally { inFlight = false; if (!stopped) timer = setTimeout(ping, HEARTBEAT_MS); } } void ping(); function onFocus() { void ping(); } function onVisibilityChange() { if (document.visibilityState === "visible") void ping(); } window.addEventListener("focus", onFocus); document.addEventListener("visibilitychange", onVisibilityChange); return () => { stopped = true; if (timer) clearTimeout(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisibilityChange); }; }, [onOnlineTransition]);
}
