import { describe, expect, it } from 'vitest';
import { ratAgility } from './ratAgility';
describe('meadow agility cycle', () => {
 it('follows the requested scurry, bound, sniff and pivot durations', () => {
  expect(ratAgility(.6).state).toBe('scurry');
  expect(ratAgility(1.5).state).toBe('bound');
  expect(ratAgility(2.2).state).toBe('sniff');
  expect(ratAgility(2.8).state).toBe('pivot');
  expect(ratAgility(3.1).state).toBe('scurry');
  expect(ratAgility(1.5).lift).toBeGreaterThan(.8);
  expect(ratAgility(2.2).walk).toBe(0);
 });
 it('changes direction without teleporting at cycle boundaries', () => {
  for (const t of [1.2,1.308,1.692,1.8,2.6,3,6,9]) {
   const before=ratAgility(t-.0001),after=ratAgility(t+.0001);
   expect(Math.abs(before.x-after.x)).toBeLessThan(.01);
   expect(Math.abs(before.lift-after.lift)).toBeLessThan(.03);
  }
  expect(ratAgility(3.5).x).toBeLessThan(ratAgility(3.1).x);
 });
});
