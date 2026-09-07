// lib/scrollRestore.ts
//
// Return-scroll restore. Next.js Link navigation always scrolls to top
// (scroll={true} default), and the dashboard re-renders from the server
// behind a skeleton, so the position a student left is lost by the time
// they tap "Back to matches". We record the offset at the moment a
// scholarship card is tapped and replay it once the real dashboard
// content mounts (after the skeleton), then consume the record so a
// later sidebar visit still lands at the top.
const KEY = "scholars:return-scroll";

type Saved = { from: string; y: number };

export function saveReturnScroll() {
  try {
    const saved: Saved = { from: window.location.pathname, y: window.scrollY };
    sessionStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // storage blocked -- degrade to current behavior (land at top)
  }
}

// Returns the saved offset only if it was recorded from `route`, and
// removes it either way so it can never replay twice.
export function consumeReturnScroll(route: string): number | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<Saved>;
    if (parsed.from !== route || typeof parsed.y !== "number") return null;
    return parsed.y;
  } catch {
    return null;
  }
}
