import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Quality } from '../three/RatModel';
type Clock = React.MutableRefObject<number>;
type V = [number, number, number];
function Vessel({ points, radius = .015, color = '#c43b49', opacity = 1 }: { points: V[]; radius?: number; color?: string; opacity?: number }) {
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 8, false), [points, radius]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo}><meshPhysicalMaterial color={color} roughness={.36} clearcoat={.7} emissive={color} emissiveIntensity={.06} transparent={opacity < 1} opacity={opacity} depthWrite={opacity === 1} /></mesh>;
}
const aorta: V[] = [[1,.91,.12],[1,1.15,.1],[1.16,1.24,.08],[1.32,1.12,.04],[.75,1.17,0],[-.8,1.18,0]];
const coronaries: V[][] = Array.from({length: 12}, (_, i) => {
  const a = i * 2.399;
  return [[1.02,.94,.12],[1.02+Math.cos(a)*.14,.86,.12+Math.sin(a)*.12],[1.02+Math.cos(a)*.2,.73,.1+Math.sin(a)*.13],[1.04+Math.cos(a)*.08,.57,.09]];
});
const bronchial: V[][] = [];
function branch(p: V, d: V, depth: number) {
  if (!depth) return;
  const q = p.map((v,i)=>v+d[i]!) as V;
  bronchial.push([p, [(p[0]+q[0])/2,p[1]+.02,(p[2]+q[2])/2],q]);
  for (const s of [-1,1]) branch(q,[d[0]*.68-.025,d[1]*.65+s*.024,d[2]*.6+s*.045],depth-1);
}
for(const side of [-1,1]) branch([1.27,1.12,0],[-.13,-.04,.15*side],5);
function cortexGeometry() {
  const g = new THREE.SphereGeometry(1,64,48), p=g.attributes.position!;
  for(let i=0;i<p.count;i++) { const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const ridge=1+.035*Math.sin(26*x+5*Math.sin(10*z))*Math.sin(20*y+4*z);p.setXYZ(i,x*ridge,y*ridge,z*ridge); }
  g.computeVertexNormals();return g;
}
export const MacroAnatomy = memo(function MacroAnatomy({clock, organs, nerves, quality}: {clock: Clock; organs: Clock; nerves: Clock; quality: Quality}) {
  const heart=useRef<THREE.Group>(null), lungs=useRef<THREE.Group>(null), brain=useRef<THREE.Group>(null), root=useRef<THREE.Group>(null), blood=useRef<THREE.InstancedMesh>(null);
  const cortex=useMemo(cortexGeometry,[]), curve=useMemo(()=>new THREE.CatmullRomCurve3(aorta.map(p=>new THREE.Vector3(...p))),[]), dummy=useMemo(()=>new THREE.Object3D(),[]);
  useEffect(()=>()=>cortex.dispose(),[cortex]);
  useFrame(()=>{
    const t=clock.current;
    if(root.current) { root.current.visible=organs.current+nerves.current>.01; if(!root.current.visible) return; }
    if(heart.current) heart.current.children.forEach((c,i)=>{const phase=t*5.5-i*.06;const beat=Math.exp(-Math.pow(((phase%1)-.16)*12,2))+.45*Math.exp(-Math.pow(((phase%1)-.38)*15,2));c.scale.setScalar(1-.07*beat);});
    if(lungs.current) lungs.current.scale.set(1,1+.045*Math.sin(t*2*Math.PI*1.5),1+.065*Math.sin(t*2*Math.PI*1.5));
    if(brain.current) brain.current.scale.setScalar(1+.008*Math.sin(t*5));
    if(blood.current) {for(let i=0;i<32;i++){curve.getPointAt((t*.4+i/32)%1,dummy.position);dummy.scale.setScalar(.012);dummy.updateMatrix();blood.current.setMatrixAt(i,dummy.matrix);}blood.current.instanceMatrix.needsUpdate=true;}
  });
  return <group ref={root}>
    <group ref={heart} position={[1.02,.82,.04]}>
      {[[.07,-.055,.04,.15,.23,.14],[-.1,-.025,0,.13,.19,.13],[.1,.15,.01,.11,.1,.1],[-.1,.13,-.02,.095,.105,.1]].map((p,i)=><group key={i}><mesh position={p.slice(0,3) as V} scale={p.slice(3) as V} rotation={[0,0,i===0?-.2:.15]}><sphereGeometry args={[1,40,32]}/><meshPhysicalMaterial color={i<2?'#8c141d':'#a73946'} roughness={.27} clearcoat={.9} emissive='#65101a' emissiveIntensity={.16}/></mesh></group>)}
    </group>
    <Vessel points={aorta} radius={.038}/>
    <Vessel points={[[.92,.96,.04],[.88,1.15,.12],[1.1,1.22,.18],[1.28,1.05,.25]]} radius={.032} color='#668bab'/>
    {coronaries.map((p,i)=><Vessel key={i} points={p} radius={.007}/>)}
    <group ref={lungs}>
      {[-1,1].map(side=><mesh key={side} position={[.88,.98,side*.26]} scale={[.35,.28,.15]} rotation={[0,side*.16,-.22]}><sphereGeometry args={[1,40,32]}/><meshPhysicalMaterial color='#f28b94' transmission={quality === "high" ? .65 : 0} thickness={.25} roughness={.28} transparent opacity={.48} depthWrite={false} clearcoat={.4}/></mesh>)}
      {bronchial.map((p,i)=><Vessel key={i} points={p} radius={Math.max(.003,.016-i*.00015)} color='#ffd7bd'/>)}
    </group>
    <group ref={brain} position={[1.88,1.08,0]}>
      {[-1,1].map(s=><mesh key={s} geometry={cortex} position={[0,0,s*.105]} scale={[.25,.16,.1]}><meshPhysicalMaterial color='#e7a4a5' roughness={.42} clearcoat={.45} emissive='#963849' emissiveIntensity={.14}/></mesh>)}
      <mesh geometry={cortex} position={[-.22,-.06,0]} scale={[.12,.09,.14]}><meshPhysicalMaterial color='#c48592' roughness={.5}/></mesh>
    </group>
    <Vessel points={[[1.74,1.05,0],[1.4,1.2,0],[.6,1.22,0],[-1.2,1.05,0]]} radius={.025} color='#82dfdd'/>
    {Array.from({length:9},(_,i)=><Vessel key={i} points={Array.from({length:17},(_,j)=>{const a=j/16*Math.PI*1.7;return [1.2-i*.18,.95+Math.cos(a)*.3,Math.sin(a)*.39] as V;})} radius={.009} color='#b4cbd1' opacity={.22}/>)}
    <instancedMesh ref={blood} args={[undefined,undefined,32]} frustumCulled={false}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color='#ff4d55' toneMapped={false}/></instancedMesh>
  </group>;
});
