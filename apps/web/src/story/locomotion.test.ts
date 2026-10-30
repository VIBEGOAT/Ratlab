import { describe,it,expect } from 'vitest';
import { advanceStride,getTerrainHeight } from './locomotion';
describe('grounded distance-driven stride',()=>{
 it('plants feet when stopped and caps cadence at 4.5 cycles per second',()=>{expect(advanceStride(2,0,.1)).toBe(2);expect(advanceStride(0,1,1)).toBeCloseTo(3.2);expect(advanceStride(0,100,.1)).toBeCloseTo(4.5*Math.PI*2*.1);});
 it('gives the same stride at different frame rates for equal uncapped distance',()=>{let a=0,b=0;for(let i=0;i<60;i++)a=advanceStride(a,1/60,1/60);for(let i=0;i<30;i++)b=advanceStride(b,1/30,1/30);expect(a).toBeCloseTo(b);});
 it('keeps the near-field paw surface flat and transitions continuously onto hills',()=>{expect(getTerrainHeight(0,0)).toBe(-.06);expect(getTerrainHeight(.75,0)).toBe(-.06);expect(Math.abs(getTerrainHeight(9.001,0)-getTerrainHeight(8.999,0))).toBeLessThan(.001);});
});
