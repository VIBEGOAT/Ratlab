import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
export function MolecularAura(){
 const group=useRef<THREE.Group>(null);
 useFrame((_,dt)=>{if(group.current)group.current.rotation.y+=Math.min(dt,.1)*.12;});
 const nodes=useMemo(()=>Array.from({length:12},(_,i)=>new THREE.Vector3(Math.cos(i*Math.PI/6)*3.9,.7+Math.sin(i*1.7)*.35,Math.sin(i*Math.PI/6)*3.9)),[]);
 return <group ref={group}>{nodes.map((p,i)=><group key={i}><mesh position={p} scale={.055}><sphereGeometry args={[1,10,8]}/><meshBasicMaterial color={i%3?'#79bdd5':'#eac994'}/></mesh><mesh position={p.clone().add(nodes[(i+1)%12]!).multiplyScalar(.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),nodes[(i+1)%12]!.clone().sub(p).normalize())}><cylinderGeometry args={[.007,.007,p.distanceTo(nodes[(i+1)%12]!),5]}/><meshBasicMaterial color="#466c80" transparent opacity={.45}/></mesh></group>)}</group>;
}
export function HumanHologram(){
 const material=useMemo(()=>new THREE.MeshBasicMaterial({color:'#80cddd',wireframe:true,transparent:true,opacity:.32}),[]);
 useEffect(()=>()=>material.dispose(),[material]);
 return <group position={[2.1,0,0]} scale={1.1}>
  <mesh position={[0,3.2,0]} material={material}><sphereGeometry args={[.24,20,14]}/></mesh>
  <mesh position={[0,2.25,0]} material={material}><cylinderGeometry args={[.42,.25,1.3,20,12]}/></mesh>
  {[-1,1].map(s=><group key={s}><mesh position={[s*.6,2.2,0]} rotation={[0,0,s*.17]} material={material}><capsuleGeometry args={[.1,1.05,6,12]}/></mesh><mesh position={[s*.2,.85,0]} rotation={[0,0,s*.04]} material={material}><capsuleGeometry args={[.13,1.3,6,12]}/></mesh></group>)}
  {Array.from({length:7},(_,i)=><mesh key={i} position={[-1.5,1.2+i*.18,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.004,.004,2,4]}/><meshBasicMaterial color="#68a5bd" transparent opacity={.25}/></mesh>)}
 </group>;
}

export function PedestalTicks(){
 const ref=useRef<THREE.InstancedMesh>(null);
 useEffect(()=>{const d=new THREE.Object3D();for(let i=0;i<72;i++){const a=i/72*Math.PI*2;d.position.set(-.4+Math.cos(a)*4.05,-.03,Math.sin(a)*4.05);d.rotation.y=-a;d.scale.set(i%6===0?.14:.06,.007,.012);d.updateMatrix();ref.current?.setMatrixAt(i,d.matrix);}if(ref.current)ref.current.instanceMatrix.needsUpdate=true;},[]);
 return <instancedMesh ref={ref} args={[undefined,undefined,72]}><boxGeometry/><meshBasicMaterial color="#8ebcc9" transparent opacity={.45}/></instancedMesh>;
}
export function AdministrationPortal(){return <group position={[2.9,.9,0]} rotation={[0,0,-Math.PI/2]}><mesh><cylinderGeometry args={[.035,.035,.55,16]}/><meshPhysicalMaterial color="#a8d8e6" transparent opacity={.35} roughness={.15}/></mesh>{Array.from({length:5},(_,i)=><mesh key={i} position={[0,-.2+i*.1,0]}><torusGeometry args={[.037,.003,4,20]}/><meshBasicMaterial color="#b2e3ed"/></mesh>)}</group>;}
