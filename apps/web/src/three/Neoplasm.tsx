import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
/** Illustrative morphology, not a histology reconstruction. Size follows simulated volume. */
export function Neoplasm({radius,position}:{radius:number;position:[number,number,number]}){
 const root=useRef<THREE.Group>(null);
 const geometry=useMemo(()=>{const g=new THREE.IcosahedronGeometry(1,4),p=g.attributes.position!,colors=[];for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);const lobes=.11*Math.sin(x*9+y*3)*Math.sin(z*8)+.055*Math.sin(y*23+z*17)*Math.cos(x*19);const s=.88+lobes;p.setXYZ(i,x*s,y*s*.72,z*s*.55);const c=new THREE.Color('#8d5749').lerp(new THREE.Color('#482e2b'),Math.max(0,-lobes*4+.15));colors.push(c.r,c.g,c.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;},[]);
 const vessels=useMemo(()=>Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({length:8},(_,j)=>{const t=j/7;return new THREE.Vector3(Math.cos(a)*(1-t*.7),Math.sin(a)*(.65-t*.3),.13+.32*Math.sin(t*Math.PI)+.03*Math.sin(j*2+i));})),24,.012,5,false);}),[]);
 useEffect(()=>()=>{geometry.dispose();vessels.forEach(g=>g.dispose());},[geometry,vessels]);
 useFrame((_,dt)=>{if(root.current)root.current.scale.setScalar(THREE.MathUtils.damp(root.current.scale.x,radius,7,Math.min(dt,.1)));});
 return <group ref={root} position={position} scale={.001}><mesh geometry={geometry}><meshPhysicalMaterial vertexColors roughness={.65} clearcoat={.18}/></mesh>{vessels.map((g,i)=><mesh geometry={g} key={i}><meshStandardMaterial color={i%3?'#7e2828':'#647580'} roughness={.5}/></mesh>)}</group>;
}
