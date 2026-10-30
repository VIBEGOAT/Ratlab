import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PedestalTicks } from './ScientificStage';

/** Only the studio rim changes temperature. The canvas and material palette stay stable. */
export function EditorialStudio({ chapter, neural = false }: { chapter: number; neural?: boolean }) {
  const rim = useRef<THREE.PointLight>(null);
  const hue = chapter === 9 ? '#f4f0ea' : neural ? '#78c679' : chapter >= 3 && chapter <= 6 ? '#e05a47' : '#e8a855';
  const target = useMemo(() => new THREE.Color(hue), [hue]);
  const uniforms = useMemo(() => ({ tint: { value: new THREE.Color('#e8a855') } }), []);
  const motes = useMemo(() => {
    const points = new Float32Array(144);
    for (let i = 0; i < 48; i++) { points[i*3] = Math.sin(i*31.4)*8; points[i*3+1] = .3+(i%19)*.22; points[i*3+2] = Math.cos(i*14.1)*5-1; }
    return points;
  }, []);
  useFrame((_, delta) => {
    uniforms.tint.value.lerp(target, 1 - Math.exp(-Math.min(delta, .05)*5));
    rim.current?.color.copy(uniforms.tint.value);
  });
  return <group>
    <PedestalTicks />
    <points><bufferGeometry><bufferAttribute attach="attributes-position" array={motes} count={48} itemSize={3}/></bufferGeometry><pointsMaterial size={.012} color="#f4f0ea" transparent opacity={.18} depthWrite={false}/></points>
    <mesh position={[0,1,-5]}>
      <planeGeometry args={[60,35]}/>
      <shaderMaterial uniforms={uniforms} depthWrite={false} vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader={`
        uniform vec3 tint;varying vec2 vUv;
        void main(){
          vec2 p=(vUv-.5)*vec2(2.,1.);
          float rim=exp(-dot(p,p)*44.);
          vec3 base=pow(vec3(.043,.039,.035),vec3(2.2));
          gl_FragColor=vec4(base+tint*rim*.014,1.);
          #include <colorspace_fragment>
        }`}/>
    </mesh>
    {[3.8,4.2].map((radius,i)=><mesh key={radius} rotation={[-Math.PI/2,0,0]} position={[-.4,-.035-i*.005,0]}><ringGeometry args={[radius,radius+.008,128]}/><meshBasicMaterial color={i===0?'#e8a855':'#f4f0ea'} transparent opacity={i===0?.22:.07} depthWrite={false}/></mesh>)}
    <mesh position={[-.4,-.16,0]}><cylinderGeometry args={[4.3,4.4,.22,96]}/><meshStandardMaterial color="#201d17" metalness={.5} roughness={.65}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[-.4,-.038,0]}><planeGeometry args={[32,32]}/><shaderMaterial transparent depthWrite={false} vertexShader="varying vec2 uvp;void main(){uvp=uv*32.-16.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader="varying vec2 uvp;void main(){vec2 edge=abs(fract(uvp)-.5);float grid=1.-smoothstep(.003,.015,min(edge.x,edge.y));float fade=exp(-length(uvp)*.3);gl_FragColor=vec4(.96,.94,.9,grid*fade*.07);}"/></mesh>
    <pointLight ref={rim} position={[-2,2,-2]} color="#e8a855" intensity={2.2} distance={9}/>
  </group>;
}
