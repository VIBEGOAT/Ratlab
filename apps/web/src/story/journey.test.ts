import { describe, expect, it } from 'vitest';
import { chapterProgress, concentration, injury, journeyState, sectionProgress } from './journey';

describe('scroll journey contract', () => {
  it('lands chapter navigation at the matching stationary path point', () => {
    for (let chapter = 0; chapter < 6; chapter++) {
      const state = journeyState(chapterProgress(chapter));
      expect(state.chapter).toBe(chapter);
      expect(state.pathProgress).toBeCloseTo(chapter / 5);
      expect(state.pose).not.toBe('walk');
    }
  });
  it('is reversible and continuous at every chapter boundary', () => {
    for (let chapter = 1; chapter < 6; chapter++) {
      const before = journeyState(chapter / 6 - .000001), after = journeyState(chapter / 6 + .000001);
      expect(Math.abs(after.pathProgress - before.pathProgress)).toBeLessThan(.0001);
    }
    const positions = [.12, .45, .95, .45, .12].map(p => journeyState(p));
    expect(positions[0]).toEqual(positions[4]);
    expect(positions[1]).toEqual(positions[3]);
    expect(journeyState(1)).toMatchObject({ chapter: 5, local: 1, pathProgress: 1 });
  });
  it('clamps overscroll and uses actual sticky viewport height', () => {
    expect(sectionProgress(50, 6000, 1000)).toBe(0);
    expect(sectionProgress(-2500, 6000, 1000)).toBe(.5);
    expect(sectionProgress(-9000, 6000, 1000)).toBe(1);
  });
});
describe('illustrative teaching models', () => {
  it('starts at zero concentration and scales linearly with dose', () => {
    expect(concentration(0, 100, .2)).toBe(0);
    expect(concentration(2, 100, .2)).toBeCloseTo(2 * concentration(2, 50, .2));
    expect(concentration(24, 60, .1)).toBeGreaterThan(concentration(24, 60, .2));
  });
  it('defines the midpoint as a response index, with bounded monotonic response', () => {
    expect(injury(80, 80)).toBe(.5);
    expect(injury(0, 80)).toBe(0);
    expect(injury(200, 80)).toBeGreaterThan(injury(60, 80));
    expect(injury(200, 80)).toBeLessThan(1);
  });
});
