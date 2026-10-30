import { describe, expect, it } from 'vitest';
import { HERO_CYCLE, HERO_HOLD, HERO_STARTS, HERO_TRANSITION, heroCycle } from './heroCycle';

describe('cinematic director', () => {
  it('holds each mode for 2.5 seconds and transitions in .75 seconds', () => {
    const layers = ['natural', 'organs', 'nerves'] as const;
    HERO_STARTS.forEach((start, i) => {
      expect(heroCycle(start + HERO_HOLD - .001)[layers[i]!]).toBe(1);
      const transition = heroCycle(start + HERO_HOLD + HERO_TRANSITION / 2);
      expect(transition.stage).toBe((i + 1) % 3);
      expect(transition[layers[(i + 1) % 3]!]).toBeGreaterThan(.9);
      expect(heroCycle(start + HERO_HOLD + HERO_TRANSITION)[layers[(i + 1) % 3]!]).toBe(1);
    });
    expect(heroCycle(HERO_CYCLE)).toEqual(heroCycle(0));
  });
  it('keeps the visible layers normalized and continuous, including wraparound', () => {
    for (let t = 0; t < HERO_CYCLE * 2; t += .01) {
      const a = heroCycle(t), b = heroCycle(t + .0001);
      expect(a.natural + a.organs + a.nerves).toBeCloseTo(1);
      for (const key of ['natural', 'organs', 'nerves'] as const) {
        expect(a[key]).toBeGreaterThanOrEqual(0);
        expect(Math.abs(a[key] - b[key])).toBeLessThan(.002);
      }
    }
  });
});
