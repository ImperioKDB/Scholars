"use client";

import { useEffect, useRef } from "react";
import { hasReducedMotion, isSpringAtRest, MOTION_SPRINGS, settleSpring, springStep, type SpringConfig, type SpringState } from "./spring";

type SpringValueOptions = Partial<SpringConfig> & { immediate?: boolean };

export function useSpringValue(
  target: number,
  onUpdate: (value: number) => void,
  options: SpringValueOptions = {},
) {
  const targetRef = useRef(target);
  const stateRef = useRef<SpringState>({ value: target, velocity: 0 });
  const frameRef = useRef<number | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  targetRef.current = target;

  useEffect(() => {
    const config = { ...MOTION_SPRINGS.responsive, ...options };
    const reduced = options.immediate || hasReducedMotion();
    if (reduced) {
      stateRef.current = settleSpring(target);
      onUpdateRef.current(target);
      return;
    }

    const start = performance.now();
    let previous = start;
    const tick = (now: number) => {
      const next = springStep(stateRef.current, targetRef.current, (now - previous) / 1000, config);
      previous = now;
      stateRef.current = next;
      onUpdateRef.current(next.value);
      if (isSpringAtRest(next, targetRef.current, config)) {
        stateRef.current = settleSpring(targetRef.current);
        onUpdateRef.current(targetRef.current);
        frameRef.current = null;
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [target, options.immediate, options.stiffness, options.damping, options.mass, options.restSpeed, options.restDelta]);

  return stateRef;
}

export function useReducedMotion(): boolean {
  const reducedRef = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedRef.current = query.matches; };
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return reducedRef.current;
}
