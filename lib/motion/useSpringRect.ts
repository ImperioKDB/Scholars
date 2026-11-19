"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  isSpringAtRest,
  MOTION_SPRINGS,
  settleSpring,
  springStep,
  type SpringState,
} from "./spring";

export type SpringRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type SpringRectState = {
  top: SpringState;
  left: SpringState;
  width: SpringState;
  height: SpringState;
};

type UseSpringRectOptions = {
  target?: string;
  spotlightRef: RefObject<HTMLElement | null>;
  tooltipRef: RefObject<HTMLElement | null>;
  onAvailabilityChange?: (available: boolean) => void;
};

type TooltipSize = {
  width: number;
  height: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type TooltipPosition = {
  top: number;
  left: number;
  maxHeight: number;
};

/**
 * These values preserve the existing tour geometry.
 * Tooltip dimensions are measured from the rendered element,
 * not estimated from a fixed card height.
 */
const SPOTLIGHT_PADDING = 8;
const TOOLTIP_GUTTER = 18;
const VIEWPORT_GUTTER = 16;
const TOOLTIP_MAX_WIDTH = 380;

function getTargetElement(target?: string): Element | null {
  if (!target || typeof document === "undefined") return null;

  return document.querySelector(
    `[data-tour="${CSS.escape(target)}"]`
  );
}

function getTargetRectFromElement(element: Element | null): SpringRect | null {
  if (!element || !element.isConnected) return null;

  const computedStyle = window.getComputedStyle(element);

  if (
    computedStyle.display === "none" ||
    computedStyle.visibility === "hidden"
  ) {
    return null;
  }

  const rect = element.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) return null;

  return {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
}

/**
 * Pure geometry calculation.
 *
 * Preference:
 * 1. Below the highlighted target, if the card fits.
 * 2. Above the target, if the card fits.
 * 3. The side with more available space, with its top clamped
 *    to the viewport.
 *
 * A card taller than the available viewport receives a bounded
 * max-height and internal scrolling.
 */
export function calculateTooltipPosition(
  target: SpringRect,
  tooltip: TooltipSize,
  viewport: ViewportSize
): TooltipPosition {
  const gutter = VIEWPORT_GUTTER;
  const gap = TOOLTIP_GUTTER;

  const viewportWidth = Math.max(0, viewport.width);
  const viewportHeight = Math.max(0, viewport.height);

  const naturalHeight = Math.max(0, tooltip.height);
  const cardWidth = Math.min(
    Math.max(0, tooltip.width),
    Math.max(0, viewportWidth - gutter * 2)
  );

  const targetBottom = target.top + target.height;
  const belowTop = targetBottom + gap;

  const availableBelow = Math.max(
    0,
    viewportHeight - gutter - belowTop
  );

  const availableAbove = Math.max(
    0,
    target.top - gap - gutter
  );

  let top: number;
  let availableHeight: number;

  if (availableBelow >= naturalHeight) {
    top = belowTop;
    availableHeight = availableBelow;
  } else if (availableAbove >= naturalHeight) {
    availableHeight = availableAbove;
    top = target.top - gap - Math.min(naturalHeight, availableHeight);
  } else if (availableBelow >= availableAbove) {
    top = belowTop;
    availableHeight = availableBelow;
  } else {
    availableHeight = availableAbove;
    top = target.top - gap - Math.min(naturalHeight, availableHeight);
  }

  // The tooltip may scroll internally, but it must not exceed
  // the space available on its selected side of the target.
  const maxHeight = Math.max(0, availableHeight);
  const renderedHeight = Math.min(naturalHeight, maxHeight);

  top = Math.min(
    Math.max(gutter, top),
    Math.max(gutter, viewportHeight - gutter - renderedHeight)
  );

  const left = Math.min(
    Math.max(gutter, target.left),
    Math.max(gutter, viewportWidth - gutter - cardWidth)
  );

  return {
    top,
    left,
    maxHeight,
  };
}
function stateFor(rect: SpringRect): SpringRectState {
  return {
    top: settleSpring(rect.top),
    left: settleSpring(rect.left),
    width: settleSpring(rect.width),
    height: settleSpring(rect.height),
  };
}

function settledState(target: SpringRect): SpringRectState {
  return {
    top: settleSpring(target.top),
    left: settleSpring(target.left),
    width: settleSpring(target.width),
    height: settleSpring(target.height),
  };
}

export function useSpringRect({
  target,
  spotlightRef,
  tooltipRef,
  onAvailabilityChange,
}: UseSpringRectOptions) {
  const targetRef = useRef<SpringRect | null>(null);
  const stateRef = useRef<SpringRectState | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const measurementFrameRef = useRef<number | null>(null);

  const reducedMotionRef = useRef(false);
  const availableRef = useRef(false);

  const tooltipSizeRef = useRef<TooltipSize | null>(null);

  const onAvailabilityChangeRef = useRef(onAvailabilityChange);
  onAvailabilityChangeRef.current = onAvailabilityChange;

  const activeElementRef = useRef<Element | null>(null);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const targetMutationObserverRef = useRef<MutationObserver | null>(null);
  const parentMutationObserverRef = useRef<MutationObserver | null>(null);
  const discoveryObserverRef = useRef<MutationObserver | null>(null);

  const setAvailability = (available: boolean) => {
    if (availableRef.current === available) return;

    availableRef.current = available;
    onAvailabilityChangeRef.current?.(available);
  };

  const cancelAnimation = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const writeFrameRef = useRef<(state: SpringRectState) => void>(() => {});
  const positionTooltipRef = useRef<() => void>(() => {});

  /**
   * Update spotlight CSS variables.
   *
   * Tooltip positioning uses cached dimensions. No DOM geometry
   * reads occur inside the spring animation loop.
   */
  writeFrameRef.current = (state) => {
    const spotlight = spotlightRef.current;

    const rect = {
      top: state.top.value,
      left: state.left.value,
      width: state.width.value,
      height: state.height.value,
    };

    if (spotlight) {
      spotlight.style.setProperty("--tour-top", `${rect.top}px`);
      spotlight.style.setProperty("--tour-left", `${rect.left}px`);
      spotlight.style.setProperty("--tour-width", `${rect.width}px`);
      spotlight.style.setProperty("--tour-height", `${rect.height}px`);
    }

    positionTooltipRef.current();
  };

  /**
   * Uses the current spring rectangle and the last measured
   * tooltip dimensions. This avoids getBoundingClientRect()
   * on every animation frame.
   */
  positionTooltipRef.current = () => {
    const tooltip = tooltipRef.current;
    const state = stateRef.current;
    const tooltipSize = tooltipSizeRef.current;

    if (!tooltip || !state || !tooltipSize) return;

    const targetRect = {
      top: state.top.value + SPOTLIGHT_PADDING,
      left: state.left.value + SPOTLIGHT_PADDING,
      width: Math.max(
        0,
        state.width.value - SPOTLIGHT_PADDING * 2
      ),
      height: Math.max(
        0,
        state.height.value - SPOTLIGHT_PADDING * 2
      ),
    };

    const position = calculateTooltipPosition(
      targetRect,
      tooltipSize,
      {
        width: window.innerWidth,
        height: window.innerHeight,
      }
    );

    tooltip.style.setProperty(
      "--tour-card-top",
      `${position.top}px`
    );

    tooltip.style.setProperty(
      "--tour-card-left",
      `${position.left}px`
    );

    tooltip.style.maxHeight = `${position.maxHeight}px`;
    tooltip.style.overflowY = "auto";
    tooltip.style.overflowX = "hidden";
  };

  /**
   * Measure tooltip dimensions outside the spring loop.
   * ResizeObserver triggers this when content or available width
   * changes.
   */
  const measureTooltip = () => {
    const tooltip = tooltipRef.current;

    if (!tooltip || !tooltip.isConnected) return;

    const rect = tooltip.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) return;

    tooltipSizeRef.current = {
      width: rect.width,
      // scrollHeight retains the natural content height even when
      // the tooltip is currently constrained by a previous viewport.
      height: Math.max(rect.height, tooltip.scrollHeight),
    };

    positionTooltipRef.current();
  };

  const startAnimationRef = useRef<() => void>(() => {});

  startAnimationRef.current = () => {
    const targetRect = targetRef.current;

    if (!targetRect) return;

    if (reducedMotionRef.current) {
      stateRef.current = settledState(targetRect);
      writeFrameRef.current(stateRef.current);
      return;
    }

    if (animationFrameRef.current !== null) return;

    let previous = performance.now();

    const tick = (now: number) => {
      const currentTarget = targetRef.current;
      const currentState = stateRef.current;

      if (!currentTarget || !currentState) {
        animationFrameRef.current = null;
        return;
      }

      const delta = (now - previous) / 1000;
      previous = now;

      const config = MOTION_SPRINGS.responsive;

      const nextState: SpringRectState = {
        top: springStep(
          currentState.top,
          currentTarget.top,
          delta,
          config
        ),
        left: springStep(
          currentState.left,
          currentTarget.left,
          delta,
          config
        ),
        width: springStep(
          currentState.width,
          currentTarget.width,
          delta,
          config
        ),
        height: springStep(
          currentState.height,
          currentTarget.height,
          delta,
          config
        ),
      };

      stateRef.current = nextState;
      writeFrameRef.current(nextState);

      const atRest = (
        isSpringAtRest(nextState.top, currentTarget.top, config) &&
        isSpringAtRest(nextState.left, currentTarget.left, config) &&
        isSpringAtRest(nextState.width, currentTarget.width, config) &&
        isSpringAtRest(nextState.height, currentTarget.height, config)
      );

      if (atRest) {
        stateRef.current = settledState(currentTarget);
        writeFrameRef.current(stateRef.current);
        animationFrameRef.current = null;
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  /**
   * Re-measure the active target once per animation frame.
   */
  const scheduleMeasurementRef = useRef<() => void>(() => {});

  scheduleMeasurementRef.current = () => {
    if (measurementFrameRef.current !== null) return;

    measurementFrameRef.current = requestAnimationFrame(() => {
      measurementFrameRef.current = null;

      const element = getTargetElement(target);

      if (!element) {
        targetRef.current = null;
        activeElementRef.current = null;
        setAvailability(false);
        cancelAnimation();
        return;
      }

      if (activeElementRef.current !== element) {
        activeElementRef.current = element;
        targetRef.current = null;
        stateRef.current = null;
      }

      const nextTarget = getTargetRectFromElement(element);

      if (!nextTarget) {
        targetRef.current = null;
        setAvailability(false);
        cancelAnimation();
        return;
      }

      targetRef.current = nextTarget;

      if (!stateRef.current) {
        stateRef.current = stateFor(nextTarget);
      }

      setAvailability(true);
      startAnimationRef.current();
      measureTooltip();
    });
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const updateReducedMotion = () => {
      reducedMotionRef.current = mediaQuery.matches;

      if (mediaQuery.matches) {
        cancelAnimation();
        startAnimationRef.current();
      } else {
        startAnimationRef.current();
      }
    };

    updateReducedMotion();

    mediaQuery.addEventListener?.("change", updateReducedMotion);

    return () => {
      mediaQuery.removeEventListener?.(
        "change",
        updateReducedMotion
      );
    };
  }, []);

  useEffect(() => {
    if (!target) {
      targetRef.current = null;
      stateRef.current = null;
      activeElementRef.current = null;
      setAvailability(false);
      cancelAnimation();
      return;
    }

    let disposed = false;

    const disconnectTargetObservers = () => {
      resizeObserverRef.current?.disconnect();
      targetMutationObserverRef.current?.disconnect();
      parentMutationObserverRef.current?.disconnect();

      resizeObserverRef.current = null;
      targetMutationObserverRef.current = null;
      parentMutationObserverRef.current = null;
    };

    const attachTargetObservers = (element: Element) => {
      disconnectTargetObservers();

      if (typeof ResizeObserver !== "undefined") {
        const resizeObserver = new ResizeObserver(() => {
          scheduleMeasurementRef.current();
          measureTooltip();
        });

        resizeObserver.observe(element);
        resizeObserverRef.current = resizeObserver;
      }

      if (typeof MutationObserver !== "undefined") {
        const targetObserver = new MutationObserver(() => {
          scheduleMeasurementRef.current();
        });

        targetObserver.observe(element, {
          attributes: true,
          attributeFilter: ["class", "hidden", "style"],
        });

        targetMutationObserverRef.current = targetObserver;

        /**
         * Observe only the target's immediate parent for direct
         * replacement/removal. Do not observe the entire document
         * after the target has been discovered.
         */
        const parent = element.parentElement;

        if (parent) {
          const parentObserver = new MutationObserver(() => {
            const currentElement = getTargetElement(target);

            // The active target was removed or replaced.
            // Re-discover immediately and attach observers to the
            // replacement instead of continuing to observe the old node.
            if (!element.isConnected || currentElement !== element) {
              discoverTarget();

              // If the target no longer exists, temporarily resume
              // document discovery until it appears again.
              if (!activeElementRef.current) {
                beginDiscovery();
              }

              return;
            }

            scheduleMeasurementRef.current();
          });

          parentObserver.observe(parent, {
            childList: true,
            subtree: false,
          });

          parentMutationObserverRef.current = parentObserver;
        }
      }
    };

    const discoverTarget = () => {
      if (disposed) return;

      const element = getTargetElement(target);

      if (!element) {
        // The target has disappeared. Release observers attached to
        // the old node before waiting for a replacement.
        disconnectTargetObservers();
        activeElementRef.current = null;
        targetRef.current = null;
        setAvailability(false);
        return;
      }

      if (activeElementRef.current !== element) {
        activeElementRef.current = element;
        attachTargetObservers(element);
      }

      scheduleMeasurementRef.current();

      /**
       * Once found, stop observing the whole document.
       */
      discoveryObserverRef.current?.disconnect();
      discoveryObserverRef.current = null;
    };

    const beginDiscovery = () => {
      if (disposed) return;

      discoverTarget();

      if (activeElementRef.current) return;

      if (
        typeof MutationObserver !== "undefined" &&
        !discoveryObserverRef.current
      ) {
        const observer = new MutationObserver(() => {
          discoverTarget();
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        });

        discoveryObserverRef.current = observer;
      }
    };

    const handleViewportChange = () => {
      scheduleMeasurementRef.current();
      measureTooltip();
    };

    const handleScroll = () => {
      scheduleMeasurementRef.current();
    };

    beginDiscovery();

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleScroll, true);

    let tooltipResizeObserver: ResizeObserver | null = null;

    if (
      typeof ResizeObserver !== "undefined" &&
      tooltipRef.current
    ) {
      tooltipResizeObserver = new ResizeObserver(() => {
        measureTooltip();
      });

      tooltipResizeObserver.observe(tooltipRef.current);
    }

    return () => {
      disposed = true;

      if (measurementFrameRef.current !== null) {
        cancelAnimationFrame(measurementFrameRef.current);
        measurementFrameRef.current = null;
      }

      cancelAnimation();

      disconnectTargetObservers();

      discoveryObserverRef.current?.disconnect();
      discoveryObserverRef.current = null;

      tooltipResizeObserver?.disconnect();

      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleScroll, true);

      tooltipSizeRef.current = null;
      activeElementRef.current = null;
    };
  }, [target]);

  useEffect(() => {
    measureTooltip();
  });
}
