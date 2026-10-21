import { describe, expect, it } from "vitest";
import { HERO_CYCLE, heroCycle, organShot } from "./heroCycle";

describe("cinematic cycle", () => {
  it("blends for four seconds and reserves twelve seconds for the organ tour", () => {
    expect(heroCycle(4)).toMatchObject({ natural: 1, organs: 0, nerves: 0 });
    expect(heroCycle(6)).toMatchObject({ natural: .5, organs: .5, nerves: 0 });
    expect(heroCycle(20)).toMatchObject({ natural: 0, organs: 1, nerves: 0 });
    expect(heroCycle(22)).toMatchObject({ natural: 0, organs: .5, nerves: .5 });
    expect(heroCycle(28)).toMatchObject({ natural: 0, organs: 0, nerves: 1 });
    expect(heroCycle(30)).toMatchObject({ natural: .5, organs: 0, nerves: .5 });
    expect(heroCycle(HERO_CYCLE)).toEqual(heroCycle(0));
  });
  it("pulls back completely between close-ups without discontinuities", () => {
    for (let i = 0; i < 3; i++) {
      expect(organShot(i * 4)).toEqual({ index: i, zoom: 0 });
      expect(organShot(i * 4 + 1.5)).toEqual({ index: i, zoom: 1 });
      expect(organShot(i * 4 + 3.999).zoom).toBeLessThan(.001);
    }
    expect(organShot(12)).toEqual({ index: -1, zoom: 0 });
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
