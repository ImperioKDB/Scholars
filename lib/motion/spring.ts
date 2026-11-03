export type SpringConfig = {
  stiffness: number;
  damping: number;
  mass: number;
  restSpeed: number;
  restDelta: number;
};

export const MOTION_SPRINGS = {
  gentle: { stiffness: 260, damping: 28, mass: 1, restSpeed: 0.01, restDelta: 0.01 },
  responsive: { stiffness: 360, damping: 30, mass: 0.8, restSpeed: 0.01, restDelta: 0.01 },
  reduced: { stiffness: 1000, damping: 100, mass: 1, restSpeed: 0.01, restDelta: 0.01 },
} satisfies Record<string, SpringConfig>;

export type SpringState = { value: number; velocity: number };

export function springStep(
  state: SpringState,
  target: number,
  dt: number,
  config: SpringConfig,
): SpringState {
  const safeDt = Math.min(Math.max(dt, 0), 0.032);
  const acceleration = (config.stiffness * (target - state.value) - config.damping * state.velocity) / config.mass;
  const velocity = state.velocity + acceleration * safeDt;
  return { value: state.value + velocity * safeDt, velocity };
}

export function isSpringAtRest(state: SpringState, target: number, config: SpringConfig): boolean {
  return Math.abs(state.velocity) <= config.restSpeed && Math.abs(target - state.value) <= config.restDelta;
}

export function settleSpring(target: number): SpringState {
  return { value: target, velocity: 0 };
}

export function hasReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
