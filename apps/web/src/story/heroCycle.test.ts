import { describe, expect, it } from 'vitest';
import { HERO_CYCLE, heroCycle } from './heroCycle';
describe('cinematic director',()=>{
 it('holds the meadow, dives, explores organs and nerves, then returns',()=>{
  expect(heroCycle(6)).toMatchObject({stage:0,natural:1});
  expect(heroCycle(8)).toMatchObject({stage:1,natural:.5});
  expect(heroCycle(10)).toMatchObject({stage:1,organs:1,timeScale:.35});
  expect(heroCycle(16)).toMatchObject({stage:2,nerves:1});
  expect(heroCycle(19)).toMatchObject({stage:0,natural:.5});
  expect(heroCycle(HERO_CYCLE)).toEqual(heroCycle(0));
 });
 it('keeps layers normalized and continuous at every boundary',()=>{
  for(let t=0;t<40;t+=.01){const a=heroCycle(t),b=heroCycle(t+.001);expect(a.natural+a.organs+a.nerves).toBeCloseTo(1);for(const k of ['natural','organs','nerves'] as const) expect(Math.abs(a[k]-b[k])).toBeLessThan(.004);}
 });
});
