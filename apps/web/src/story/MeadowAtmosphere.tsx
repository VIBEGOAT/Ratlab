import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MEADOW_NOISE } from './meadowNoise';
type Clock = React.MutableRefObject<number>;
const skyFragment = `${MEADOW_NOISE}
uniform float time; uniform float natural; varying vec3 direction;
void main(){vec3 d=normalize(direction);float altitude=max(0.,d.y);
vec3 horizon=vec3(1.,.89,.68),cyan=vec3(.47,.69,.91),azure=vec3(.17,.37,.66);
vec3 sky=mix(horizon,cyan,smoothstep(-.03,.16,d.y));sky=mix(sky,azure,pow(altitude,.65));
vec3 sun=normalize(vec3(-.6,.23,-.65));float mu=max(0.,dot(d,sun));
sky+=vec3(1.,.74,.38)*pow(mu,24.)*.32+vec3(1.,.91,.68)*smoothstep(.9991,.9997,mu)*2.;
vec2 cloudUV=d.xz/max(.12,d.y+.18)*1.6+vec2(time*.006,0.);
float cloud=smoothstep(.38,.64,fbm(cloudUV));float mask=smoothstep(.04,.18,d.y)*(1.-smoothstep(.8,1.,d.y));
vec3 cloudColor=mix(vec3(.77,.8,.83),vec3(1.,.96,.86),fbm(cloudUV+vec2(.1,.3)));
sky=mix(sky,cloudColor,cloud*mask*.88);
gl_FragColor=vec4(pow(mix(vec3(.043,.039,.035),sky,natural),vec3(2.2)),1.);
#include <colorspace_fragment>
}`;
export function MeadowAtmosphere({ clock, natural }: {clock:Clock;natural:Clock}) {
 const uniforms=useMemo(()=>({time:{value:0},natural:{value:1}}),[]);
 useFrame(()=>{uniforms.time.value=clock.current;uniforms.natural.value=natural.current;});
 return <group>
  <mesh renderOrder={-100}><sphereGeometry args={[200,40,24]}/><shaderMaterial side={THREE.BackSide} depthWrite={false} uniforms={uniforms} vertexShader="varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader={skyFragment}/></mesh>
  <mesh name="meadow-ground" rotation={[-Math.PI/2,0,0]}><planeGeometry args={[150,150,120,120]}/><shaderMaterial uniforms={uniforms} depthWrite polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1}
   vertexShader={`${MEADOW_NOISE} varying vec3 world;void main(){vec3 p=position;p.z=terrain(p.xy*vec2(1.,-1.));vec4 w=modelMatrix*vec4(p,1.);world=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`}
   fragmentShader={`${MEADOW_NOISE} uniform float natural;varying vec3 world;void main(){float clumpTint=fbm(world.xz*.22);vec3 ground=mix(vec3(.06,.12,.025),vec3(.3,.35,.09),clumpTint);float shade=1.-.7*exp(-dot(world.xz*vec2(.4,1.2),world.xz*vec2(.4,1.2)));ground*=shade;float haze=smoothstep(25.,90.,distance(cameraPosition,world))*.65;ground=mix(ground,vec3(.79,.75,.62),haze);gl_FragColor=vec4(pow(mix(vec3(.043,.039,.035),ground,natural),vec3(2.2)),1.);
#include <colorspace_fragment>
}`}/></mesh>
 </group>;
}
