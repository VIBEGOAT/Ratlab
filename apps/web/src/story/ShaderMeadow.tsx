import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Quality } from '../three/RatModel';
import { MEADOW_NOISE, meadowRandom as rand } from './meadowNoise';
type Clock=React.MutableRefObject<number>;
const vertex=`${MEADOW_NOISE} varying float h;varying float clumpTint;varying float haze;uniform float time;uniform vec3 ratPosition;
void main(){h=uv.y;vec3 p=position;vec3 origin=instanceMatrix[3].xyz;clumpTint=fbm(origin.xz*.26);
float wind=sin(origin.x*.6+time*1.8+sin(origin.z*.5))+.45*sin(origin.z*1.3-time*2.2);
vec2 delta=origin.xz-ratPosition.xz;float part=exp(-dot(delta*vec2(.38,1.5),delta*vec2(.38,1.5)));
p.x+=wind*.16*h*h;p.z+=(sign(delta.y)*part*.85+sin(origin.x+time)*.06)*h*h;p.y*=1.-part*.42;
vec4 world=instanceMatrix*vec4(p,1.);world.y+=terrain(origin.xz);haze=smoothstep(20.,60.,distance(cameraPosition,(modelMatrix*world).xyz));gl_Position=projectionMatrix*modelViewMatrix*world;}`;
const fragment=`varying float h;varying float clumpTint;varying float haze;uniform float natural;
void main(){vec3 lush=vec3(.176,.353,.118),olive=vec3(.31,.49,.173),straw=vec3(.76,.698,.333);
vec3 c=mix(lush,olive,smoothstep(.25,.55,clumpTint));c=mix(c,straw,smoothstep(.53,.78,clumpTint));
c=mix(vec3(.039,.071,.027),c,smoothstep(0.,.35,h));c+=vec3(.15,.12,.025)*pow(h,3.);
c=mix(c,vec3(.79,.75,.62),haze*.65);float alpha=natural*(1.-haze);if(alpha<.025)discard;gl_FragColor=vec4(pow(c,vec3(2.2)),alpha);
#include <colorspace_fragment>
}`;
export function ShaderMeadow({clock,natural,quality,ratPosition}:{clock:Clock;natural:Clock;quality:Quality;ratPosition:React.MutableRefObject<THREE.Vector3>}) {
 const count=quality==='high'?64000:18000, mesh=useRef<THREE.InstancedMesh>(null);
 const uniforms=useMemo(()=>({time:{value:0},natural:{value:1},ratPosition:{value:new THREE.Vector3()}}),[]);
 const geometry=useMemo(()=>{const g=new THREE.PlaneGeometry(.065,.5,1,5),p=g.attributes.position!;for(let i=0;i<p.count;i++){const h=p.getY(i)+.25;p.setXYZ(i,p.getX(i)*(1-h*1.9)+h*h*.28,h,p.getZ(i));}return g;},[]);
 useEffect(()=>{if(!mesh.current)return;const d=new THREE.Object3D();for(let i=0;i<count;i++){const far=i>count*.78;const x=(rand(i+1)-.5)*(far?90:36),z=(rand(i+823)-.5)*(far?90:32);const clump=.5+.5*Math.sin(x*.65+Math.sin(z*.42))*Math.cos(z*.36);d.position.set(x,0,z);d.rotation.y=rand(i+77)*Math.PI;d.scale.set(.8+rand(i+91)*.5,.55+1.65*clump*rand(i+44),1);d.updateMatrix();mesh.current.setMatrixAt(i,d.matrix);}mesh.current.instanceMatrix.needsUpdate=true;},[count]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useFrame(()=>{uniforms.time.value=clock.current;uniforms.natural.value=natural.current;uniforms.ratPosition.value.copy(ratPosition.current);if(mesh.current)mesh.current.visible=natural.current>.005;});
 return <instancedMesh ref={mesh} args={[geometry,undefined,count]} frustumCulled={false}><shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment} side={THREE.DoubleSide} transparent depthWrite alphaTest={.03}/></instancedMesh>;
}
const flowerVertex=`${MEADOW_NOISE} uniform float time;varying float species;varying float haze;void main(){vec3 p=position;vec3 o=instanceMatrix[3].xyz;species=floor(hash21(o.xz)*4.);vec4 w=instanceMatrix*vec4(p,1.);w.x+=.12*sin(time*1.6+o.x*.5+o.z*.3)*w.y;w.y+=terrain(o.xz);haze=smoothstep(12.,23.,distance(cameraPosition,(modelMatrix*w).xyz));gl_Position=projectionMatrix*modelViewMatrix*w;}`;
export function MeadowDetails({clock,natural,quality}:{clock:Clock;natural:Clock;quality:Quality}){
 const stems=useRef<THREE.InstancedMesh>(null),heads=useRef<THREE.InstancedMesh>(null),group=useRef<THREE.Group>(null);
 const count=quality==='high'?1800:600;
 const uniforms=useMemo(()=>({time:{value:0},natural:{value:1}}),[]);
 useEffect(()=>{const d=new THREE.Object3D();for(let i=0;i<count;i++){const x=rand(i+98000)*32-16,z=rand(i+44000)*28-14;const lane=Math.abs(z)<.8&&Math.abs(x)<3;const height=(.4+rand(i+71)*.55)*(lane?.4:1);d.position.set(x,height*.5,z);d.scale.set(.018,height,.018);d.updateMatrix();stems.current?.setMatrixAt(i,d.matrix);d.position.y=height;const kind=rand(i+29);d.scale.set(kind>.75?.028:.045,kind>.75?.14:.035,.045);d.updateMatrix();heads.current?.setMatrixAt(i,d.matrix);}if(stems.current)stems.current.instanceMatrix.needsUpdate=true;if(heads.current)heads.current.instanceMatrix.needsUpdate=true;},[count]);
 const pollen=useMemo(()=>{const p=new Float32Array(600);for(let i=0;i<200;i++){p[i*3]=rand(i+783)*20-10;p[i*3+1]=rand(i+459)*4+.3;p[i*3+2]=rand(i+123)*14-7;}return p;},[]);
 useFrame(()=>{uniforms.time.value=clock.current;uniforms.natural.value=natural.current;if(group.current)group.current.visible=natural.current>.005;});
 return <group ref={group}>
  <instancedMesh ref={stems} args={[undefined,undefined,count]} frustumCulled={false}><cylinderGeometry args={[.65,1,1,3,1,false,0,Math.PI*2]}/><shaderMaterial uniforms={uniforms} vertexShader={flowerVertex} fragmentShader="uniform float natural;varying float haze;void main(){gl_FragColor=vec4(.21,.29,.07,natural*(1.-haze));}" transparent/></instancedMesh>
  <instancedMesh ref={heads} args={[undefined,undefined,count]} frustumCulled={false}><sphereGeometry args={[1,6,4]}/><shaderMaterial uniforms={uniforms} vertexShader={flowerVertex} fragmentShader="uniform float natural;varying float species;varying float haze;void main(){vec3 c=species<1.?vec3(1.,.94,.8):species<2.?vec3(1.,.73,.12):species<3.?vec3(.62,.35,.72):vec3(.76,.62,.31);float alpha=natural*(1.-haze);if(alpha<.025)discard;gl_FragColor=vec4(pow(c,vec3(2.2)),alpha);}" transparent/></instancedMesh>
  <points><bufferGeometry><bufferAttribute attach="attributes-position" array={pollen} count={200} itemSize={3}/></bufferGeometry><shaderMaterial uniforms={uniforms} transparent depthWrite={false} vertexShader="uniform float time;void main(){vec3 p=position;p.x+=.3*sin(time*.25+p.z);p.y+=.16*sin(time*.4+p.x);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(18./max(1.,-mv.z),1.,3.);}" fragmentShader="uniform float natural;void main(){float a=1.-smoothstep(.1,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(1.,.9,.6,a*natural*.45);}"/></points>
 </group>;
}
