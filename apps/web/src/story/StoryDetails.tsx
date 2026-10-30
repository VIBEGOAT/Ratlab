import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { StoryPos } from './useStoryScroll';
export type BridgeOrgan='heart'|'liver'|'brain'|'kidney'|'lungs';
export const HUMAN_ORGANS:Record<BridgeOrgan,[number,number,number]>={heart:[-.08,2.45,.2],liver:[-.18,1.95,.2],brain:[0,3.2,0],kidney:[.22,1.65,.1],lungs:[.13,2.5,.15]};
export function OrganBridge({organ}:{organ:BridgeOrgan}){
 const point=useRef<THREE.Mesh>(null),time=useRef(0);
 const end=new THREE.Vector3(...HUMAN_ORGANS[organ]).multiplyScalar(1.1).add(new THREE.Vector3(2.1,0,0));
 const curve=useMemo(()=>new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.6,.65,0),new THREE.Vector3(0,3,.3),end),[organ]);
 const geo=useMemo(()=>new THREE.TubeGeometry(curve,48,.012,6,false),[curve]);
 useEffect(()=>()=>geo.dispose(),[geo]);
 useFrame((_,dt)=>{time.current+=Math.min(dt,.1);if(point.current)curve.getPoint(time.current*.4%1,point.current.position);});
 return <group><mesh geometry={geo}><meshBasicMaterial color="#75dce2" transparent opacity={.4}/></mesh><mesh ref={point} scale={.055}><sphereGeometry args={[1,12,8]}/><meshBasicMaterial color="#d8fff6"/></mesh></group>;
}
export function OralAdministration({posRef}:{posRef:React.MutableRefObject<StoryPos>}){
 const tip=useRef<THREE.Group>(null),bolus=useRef<THREE.Mesh>(null),jaw=useRef<THREE.Mesh>(null),elapsed=useRef(0);
 const path=useMemo(()=>new THREE.CatmullRomCurve3([[3.4,.91,0],[2.93,.88,0],[2.1,.9,0],[1.2,.9,-.04],[.2,.8,-.22]].map(p=>new THREE.Vector3(...p as [number,number,number]))),[]);
 useFrame((_,dt)=>{elapsed.current+=Math.min(dt,.1);const t=Math.min(1,elapsed.current/2.4);if(jaw.current)jaw.current.position.y=.76-.06*Math.sin(t*Math.PI);if(tip.current){tip.current.position.x=3.55-.5*Math.sin(t*Math.PI);tip.current.visible=t<1;}if(bolus.current){path.getPointAt(t,bolus.current.position);bolus.current.visible=t<.98;}});
 return <group><mesh ref={jaw} position={[2.65,.76,0]} scale={[.23,.045,.1]}><sphereGeometry args={[1,20,12]}/><meshPhysicalMaterial color="#e8d5d2" transparent opacity={.25} roughness={.4}/></mesh><group ref={tip} position={[3.55,.92,0]} rotation={[0,0,Math.PI/2]}><mesh><cylinderGeometry args={[.027,.05,.65,16]}/><meshPhysicalMaterial color="#9cd9e5" transparent opacity={.55} roughness={.2}/></mesh>{[0,1,2,3].map(i=><mesh key={i} position={[0,i*.12-.2,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.045,.004,4,16]}/><meshBasicMaterial color="#d4f0f5"/></mesh>)}</group><mesh ref={bolus} scale={[.07,.03,.03]}><sphereGeometry args={[1,16,10]}/><meshBasicMaterial color="#adfff3"/></mesh></group>;
}
export function PathologyHUD({day,days,volume}:{day:number;days:number;volume:number}){
 const phase=day<=5?'Initiation':day<=14?'Angiogenesis':day<=21?'Proliferation':'Burden / response';
 const copy=day<=5?'Illustrative stage: early neoplastic seeding.':day<=14?'Illustrative stage: hypoxic signalling and vascular recruitment.':day<=21?'Illustrative stage: cellular proliferation and stromal involvement.':'Illustrative stage: burden, necrosis or treatment-associated regression.';
 return <div className="pathology-hud"><span className="eyebrow">Pathology timeline · {phase}</span><strong>Day {day} / {days} · {volume.toFixed(0)} mm³</strong><p>{copy}</p><progress value={day} max={days}/><small>Stage descriptions are explanatory; mutations, VEGF and histology are not measured by this model.</small></div>;
}

export function BehaviorEntry({posRef,reduced,children}:{posRef:React.MutableRefObject<StoryPos>;reduced:boolean;children:React.ReactNode}){
 const group=useRef<THREE.Group>(null),alpha=useRef(0),original=useMemo(()=>new Map<THREE.Material,number>(),[]);
 useFrame((_,dt)=>{const p=posRef.current.progress;const target=reduced?1:Math.min(1,p/.12,(1-p)/.12);alpha.current=THREE.MathUtils.damp(alpha.current,Math.max(0,target),8,Math.min(dt,.1));if(group.current){group.current.scale.setScalar(.92+.08*alpha.current);group.current.position.y=(1-alpha.current)*.15;group.current.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){const m=o.material;if(Array.isArray(m))return;if(!original.has(m))original.set(m,m.opacity);if(!m.transparent){m.transparent=true;m.needsUpdate=true;}m.opacity=original.get(m)!*alpha.current;}});}});
 return <group ref={group}>{children}</group>;
}
