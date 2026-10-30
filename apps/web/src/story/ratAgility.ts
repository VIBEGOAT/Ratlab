const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function ratAgility(seconds:number){
 const time=Math.max(0,seconds),cycle=Math.floor(time/3),t=time%3,sign=cycle%2===0?1:-1;
 let travel=0,lift=0,flex=0,walk=0,pitch=0,yaw=sign===1?0:Math.PI;
 let state:'scurry'|'bound'|'sniff'|'pivot'='scurry';
 if(t<1.2){travel=.95*smooth(t/1.2);walk=2.8*Math.sin(Math.min(1,t/.12)*Math.PI/2);flex=.08*Math.sin(t*Math.PI*22);lift=.025*Math.abs(Math.sin(t*Math.PI*22));}
 else if(t<1.8){state='bound';const p=(t-1.2)/.6;travel=.95+.55*smooth(p);walk=.35;if(p<.18){flex=.3*Math.sin(p/.18*Math.PI/2);lift=-.08*smooth(p/.18);}else if(p<.82){const a=(p-.18)/.64;lift=.95*4*a*(1-a)-.08*(1-a);flex=.3*(1-smooth(a/.18))-.15*Math.sin(a*Math.PI);pitch=-.1*Math.sin(a*Math.PI*2);}else {flex=.25*Math.sin((p-.82)/.18*Math.PI);lift=-.06*Math.sin((p-.82)/.18*Math.PI);}}
 else if(t<2.6){state='sniff';travel=1.5;const p=(t-1.8)/.8;lift=.06*Math.sin(p*Math.PI);flex=.1*Math.sin(p*Math.PI);pitch=.04*Math.sin(p*Math.PI);}
 else {state='pivot';travel=1.5;const p=(t-2.6)/.4;lift=.14*Math.sin(p*Math.PI);yaw+=Math.PI*smooth(p);}
 return {state,walk,flex,lift,pitch,yaw,x:sign*(travel-.75)};
}
