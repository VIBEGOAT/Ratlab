import { describe, expect, it } from "vitest";
import { HERO_CYCLE, heroCycle } from "./heroCycle";

describe("cinematic cycle", () => {
  it("holds each view for 5.5 seconds and blends for 5.5 seconds", () => {
    expect(heroCycle(5.5)).toMatchObject({ natural: 1, organs: 0, nerves: 0 });
    expect(heroCycle(8.25)).toMatchObject({ natural: .5, organs: .5, nerves: 0 });
    expect(heroCycle(16.5)).toMatchObject({ natural: 0, organs: 1, nerves: 0 });
    expect(heroCycle(19.25)).toMatchObject({ natural: 0, organs: .5, nerves: .5 });
    expect(heroCycle(27.5)).toMatchObject({ natural: 0, organs: 0, nerves: 1 });
    expect(heroCycle(30.25)).toMatchObject({ natural: .5, organs: 0, nerves: .5 });
    expect(heroCycle(HERO_CYCLE)).toEqual(heroCycle(0));
  });
  it("keeps layer weights continuous and normalized across repeated loops", () => {
    for (let t = 0; t < HERO_CYCLE * 2; t += .03) {
      const state = heroCycle(t), next = heroCycle(t + .001);
      expect(state.natural + state.organs + state.nerves).toBeCloseTo(1);
      for (const key of ["natural", "organs", "nerves"] as const) {
        expect(Math.abs(state[key] - next[key])).toBeLessThan(.001);
      }
    }
  });
});
