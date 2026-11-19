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

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_CARD_HEIGHT = 220;
const TOOLTIP_GUTTER = 18;
const VIEWPORT_GUTTER = 16;
const TOOLTIP_MAX_WIDTH = 380;

function getTargetElement(target?: string): Element | null {
  if (!target || typeof document === "undefined") return null;
  return document.querySelector(`[data-tour="${target}"]`);
}

function getTargetRect(target?: string): SpringRect | null {
  const element = getTargetElement(target);
  if (!element || !element.isConnected) return null;
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.display === "none" || computedStyle.visibility === "hidden") return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
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
  const onAvailabilityChangeRef = useRef(onAvailabilityChange);
  onAvailabilityChangeRef.current = onAvailabilityChange;

  const setAvailability = (available: boolean) => {
    if (availableRef.current === available) return;
    availableRef.current = available;
    onAvailabilityChangeRef.current?.(available);
  };

  const writeFrameRef = useRef<(state: SpringRectState) => void>(() => {});
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

    const tooltip = tooltipRef.current;
    if (!tooltip || typeof window === "undefined") return;

    const targetRect = {
      top: rect.top + SPOTLIGHT_PADDING,
      left: rect.left + SPOTLIGHT_PADDING,
      width: Math.max(0, rect.width - SPOTLIGHT_PADDING * 2),
      height: Math.max(0, rect.height - SPOTLIGHT_PADDING * 2),
    };
    const top = targetRect.top + targetRect.height + TOOLTIP_GUTTER + TOOLTIP_CARD_HEIGHT < window.innerHeight
      ? targetRect.top + targetRect.height + TOOLTIP_GUTTER
      : Math.max(TOOLTIP_GUTTER, targetRect.top - TOOLTIP_CARD_HEIGHT - TOOLTIP_GUTTER);
    const left = Math.min(
      Math.max(VIEWPORT_GUTTER, targetRect.left),
      Math.max(VIEWPORT_GUTTER, window.innerWidth - TOOLTIP_MAX_WIDTH),
    );
    tooltip.style.setProperty("--tour-card-top", `${top}px`);
    tooltip.style.setProperty("--tour-card-left", `${left}px`);
  };

  const cancelAnimation = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
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
        top: springStep(currentState.top, currentTarget.top, delta, config),
        left: springStep(currentState.left, currentTarget.left, delta, config),
        width: springStep(currentState.width, currentTarget.width, delta, config),
        height: springStep(currentState.height, currentTarget.height, delta, config),
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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
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
    return () => mediaQuery.removeEventListener?.("change", updateReducedMotion);
  }, []);

  useEffect(() => {
    const scheduleMeasurement = () => {
      if (measurementFrameRef.current !== null) return;
      measurementFrameRef.current = requestAnimationFrame(() => {
        measurementFrameRef.current = null;
        const nextTarget = getTargetRect(target);
        if (!nextTarget) {
          targetRef.current = null;
          setAvailability(false);
          cancelAnimation();
          return;
        }

        targetRef.current = nextTarget;
        if (!stateRef.current) stateRef.current = stateFor(nextTarget);
        setAvailability(true);
        startAnimationRef.current();
      });
    };

    if (!target) {
      targetRef.current = null;
      setAvailability(false);
      cancelAnimation();
      return;
    }

    scheduleMeasurement();
    const targetElement = getTargetElement(target);
    const resizeObserver = typeof ResizeObserver === "undefined" || !targetElement
      ? null
      : new ResizeObserver(scheduleMeasurement);
    if (resizeObserver && targetElement) resizeObserver.observe(targetElement);

    window.addEventListener("resize", scheduleMeasurement);
    window.addEventListener("scroll", scheduleMeasurement, true);

    const mutationObserver = typeof MutationObserver === "undefined" || !document.body
      ? null
      : new MutationObserver(scheduleMeasurement);
    mutationObserver?.observe(document.body, {
      childList: true,
      subtree: true,
    });
    if (mutationObserver && targetElement) {
      mutationObserver.observe(targetElement, {
        attributes: true,
        attributeFilter: ["class", "hidden", "style"],
      });
    }

    return () => {
      if (measurementFrameRef.current !== null) {
        cancelAnimationFrame(measurementFrameRef.current);
        measurementFrameRef.current = null;
      }
      cancelAnimation();
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasurement);
      window.removeEventListener("scroll", scheduleMeasurement, true);
    };
  }, [target]);
}
