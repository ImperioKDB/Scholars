// lib/scrollRestore.ts
//
// Return-scroll restore. Authenticated desktop layouts scroll inside #main,
// while mobile and public routes scroll the window. Keep all position reads and
// writes on the same owner so returning from a detail page is consistent.
const KEY = "scholars:return-scroll";

type Saved = { from: string; y: number };
type ScrollOwner = HTMLElement | Window;

function getScrollOwner(): ScrollOwner {
  if (typeof document !== "undefined") {
    const main = document.getElementById("main");
    if (main) return main;
  }
  return window;
}

function getScrollTop(owner: ScrollOwner): number {
  return owner instanceof HTMLElement ? owner.scrollTop : owner.scrollY;
}

export function scrollAppTo(top: number, behavior: ScrollBehavior = "auto") {
  const owner = getScrollOwner();
  owner.scrollTo({ top, left: 0, behavior });
}

export function saveReturnScroll() {
  try {
    const owner = getScrollOwner();
    const saved: Saved = { from: window.location.pathname, y: getScrollTop(owner) };
    sessionStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // storage or DOM access blocked -- degrade to current behavior (land at top)
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
