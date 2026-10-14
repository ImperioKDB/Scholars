"use client";

import { useEffect, useRef, type HTMLAttributes } from "react";

/**
 * Reveals one content group once when it enters view. The server-rendered
 * markup is visible by default; enhancement is enabled only after a working
 * IntersectionObserver is attached, so unsupported/failed JS never hides it.
 */
export function ScrollReveal({
  children,
  className = "",
  ...attributes
}: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    let revealListener: ((event: TransitionEvent) => void) | null = null;
    const clearRevealStyles = () => {
      if (revealListener) {
        element.removeEventListener("transitionend", revealListener);
        element.removeEventListener("transitioncancel", revealListener);
        revealListener = null;
      }
      delete element.dataset.revealEnhanced;
      delete element.dataset.revealVisible;
    };
    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          if (entry.isIntersecting) {
            if (element.dataset.revealEnhanced === "true") {
              element.dataset.revealVisible = "true";
              revealListener = (event) => {
                if (event.target !== element) return;
                if (
                  event.type === "transitionend" &&
                  (event as TransitionEvent).propertyName !== "opacity"
                ) return;
                clearRevealStyles();
              };
              element.addEventListener("transitionend", revealListener);
              element.addEventListener("transitioncancel", revealListener);
            }
            observer?.unobserve(element);
          } else {
            element.dataset.revealEnhanced = "true";
          }
        },
        { threshold: 0, rootMargin: "0px 0px -32px 0px" }
      );
      observer.observe(element);
    } catch {
      observer?.disconnect();
      delete element.dataset.revealEnhanced;
      delete element.dataset.revealVisible;
      return;
    }

    return () => {
      observer?.disconnect();
      clearRevealStyles();
    };
  }, []);

  return (
    <div ref={ref} className={className} {...attributes}>
      {children}
    </div>
  );
}
