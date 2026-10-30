import type { AnimalBundle } from '@eliminate/sim-core';
/** Rendering calibration: a 50 cm open field. Track coordinates are normalized. */
export function behaviorTelemetry(b:AnimalBundle){
 const {x,y,hz}=b.track;let distance=0,rest=0,entries=0;
 const center=(i:number)=>Math.abs(x[i]!-.5)<.25&&Math.abs(y[i]!-.5)<.25;
 for(let i=1;i<x.length;i++){const d=Math.hypot(x[i]!-x[i-1]!,y[i]!-y[i-1]!);distance+=d;if(d*hz<.005)rest++;if(center(i)&&!center(i-1))entries++;}
 const seconds=Math.max(1,(x.length-1)/hz);
 return {velocity:distance*50/seconds,exploration:entries*60/seconds,rest:rest/Math.max(1,x.length-1)};
}
