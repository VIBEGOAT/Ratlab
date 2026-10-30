/** Same terrain function and near-field mask as meadowNoise.ts GLSL. */
export function getTerrainHeight(x:number,z:number){const r=Math.hypot(x,z);let t=Math.max(0,Math.min(1,(r-9)/23));t=t*t*(3-2*t);return -.06+t*(1.5*Math.sin(x*.055)+2.4*Math.sin(z*.065+.8)+1.2*Math.sin((x+z)*.045));}
export function advanceStride(phase:number,distance:number,dt:number){return phase+Math.min(Math.abs(distance)*3.2,Math.max(0,dt)*4.5*Math.PI*2);}
