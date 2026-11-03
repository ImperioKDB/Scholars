import { describe, expect, it } from "vitest";
import { isSpringAtRest, MOTION_SPRINGS, settleSpring, springStep } from "./spring";

describe("spring motion", () => {
  it("moves toward a target without becoming unstable", () => {
    let state = { value: 0, velocity: 0 };
    let maximum = 0;
    for (let i = 0; i < 240; i += 1) {
      state = springStep(state, 100, 1 / 60, MOTION_SPRINGS.responsive);
      maximum = Math.max(maximum, state.value);
    }
    expect(state.value).toBeCloseTo(100, 1);
    expect(maximum).toBeLessThan(115);
  });

  it("recognises a settled spring", () => {
    const config = MOTION_SPRINGS.gentle;
    expect(isSpringAtRest(settleSpring(42), 42, config)).toBe(true);
    expect(isSpringAtRest({ value: 41.5, velocity: 0.02 }, 42, config)).toBe(false);
  });

  it("clamps large frame gaps for tab-switch stability", () => {
    const next = springStep({ value: 0, velocity: 0 }, 100, 1, MOTION_SPRINGS.responsive);
    expect(next.value).toBeLessThan(100);
    expect(Number.isFinite(next.velocity)).toBe(true);
  });
});
