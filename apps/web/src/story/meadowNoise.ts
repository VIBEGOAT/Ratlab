/** Shared deterministic world-space value noise, with smooth interpolation and FBM. */
export const MEADOW_NOISE = `
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise2(p);p=p*2.03+vec2(13.1,7.7);a*=.5;}return v;}
float terrain(vec2 p){float farMask=smoothstep(9.,32.,length(p));return -.06+farMask*(1.5*sin(p.x*.055)+2.4*sin(p.y*.065+.8)+1.2*sin((p.x+p.y)*.045));}
`;
export const meadowRandom = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
