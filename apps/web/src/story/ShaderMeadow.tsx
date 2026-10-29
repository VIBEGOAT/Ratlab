import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Quality } from '../three/RatModel';
const vertex=`varying float h; varying float shade; uniform float time;
void main(){ h=uv.y; vec3 p=position; vec3 origin=instanceMatrix[3].xyz;
float wind=sin(origin.x*.6+time*1.8+sin(origin.z*.5))+ .45*sin(origin.z*1.3-time*2.2);
float lane=exp(-pow(origin.z/.9,2.))*exp(-pow(origin.x/3.,2.));
p.x+=(wind*.16+lane*.65)*h*h; p.z+=sin(origin.x+time)*.08*h*h; p.y*=1.-lane*.68;
vec4 world=instanceMatrix*vec4(p,1.); world.y+=.09*sin(origin.x*.3)*sin(origin.z*.4);
shade=.8+.2*sin(origin.x*7.3+origin.z*4.2);gl_Position=projectionMatrix*modelViewMatrix*world;}`;
const fragment=`varying float h; varying float shade; uniform float natural;
void main(){vec3 root=vec3(.07,.13,.055), mid=vec3(.23,.43,.15), tip=vec3(.64,.81,.32);
vec3 c=mix(root,mid,smoothstep(0.,.55,h));c=mix(c,tip,pow(h,3.)*.7); gl_FragColor=vec4(c*shade*mix(.08,1.,natural),natural);}`;
export function ShaderMeadow({clock,natural,quality}:{clock:React.MutableRefObject<number>;natural:React.MutableRefObject<number>;quality:Quality}) {
 const count=quality==='high'?64000:18000, mesh=useRef<THREE.InstancedMesh>(null);
 const uniforms=useMemo(()=>({time:{value:0},natural:{value:1}}),[]);
 const geometry=useMemo(()=>{const g=new THREE.PlaneGeometry(.065,.5,1,5),p=g.attributes.position!;for(let i=0;i<p.count;i++){const h=p.getY(i)+.25;p.setXYZ(i,p.getX(i)*(1-h*1.9)+h*h*.28,h,p.getZ(i));}return g;},[]);
 useEffect(()=>{if(!mesh.current)return; const d=new THREE.Object3D();const rand=(i:number)=>{const x=Math.sin(i*127.1)*43758.54;return x-Math.floor(x);};for(let i=0;i<count;i++){d.position.set(rand(i+1)*28-14,0,rand(i+823)*24-12);d.rotation.y=rand(i+77)*Math.PI;d.scale.setScalar(.45+rand(i+91)*.8);d.updateMatrix();mesh.current.setMatrixAt(i,d.matrix);}mesh.current.instanceMatrix.needsUpdate=true;},[count]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useFrame(()=>{uniforms.time.value=clock.current;uniforms.natural.value=natural.current;if(mesh.current)mesh.current.visible=natural.current>.005;});
 return <instancedMesh ref={mesh} args={[geometry,undefined,count]} frustumCulled={false}><shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment} side={THREE.DoubleSide} transparent depthWrite={true}/></instancedMesh>;
}
