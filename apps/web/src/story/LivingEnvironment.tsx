import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Quality } from '../three/RatModel';
import type { Vec3 } from '../three/anatomy';
type Clock = React.MutableRefObject<number>;
const COLORS = ["#67e8f9", "#ff83c8", "#a6ff72", "#ffd36c", "#b29aff"];

/** Brain-to-spine-to-periphery paths: illustrative, not a complete nerve atlas. */
function neuralPaths() {
  const brain: Vec3 = [1.88, 1.08, 0];
  const paths: Vec3[][] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const x = 1.15 - i * 0.28;
      paths.push([brain, [1.4, 1.19, 0], [x, 1.22, 0], [x - .1, .95, side * .24], [x + .04, .7, side * .43]]);
      paths.push([brain, [1.4, 1.19, 0], [x, 1.22, 0], [x, 1.34, side * .24], [x - .1, 1.25, side * .43]]);
    }
    paths.push([brain, [1.3, 1.2, 0], [1.08, .8, side * .28], [1.18, .4, side * .34], [1.35, .09, side * .37]]);
    paths.push([brain, [.6, 1.25, 0], [-.9, 1.17, 0], [-1.03, .62, side * .4], [-1.1, .15, side * .46], [-.8, .06, side * .47]]);
    paths.push([brain, [2.13, 1.1, side * .16], [2.5, .98, side * .18], [2.92, .88, side * .06]]);
  }
  paths.push([brain, [.8, 1.24, 0], [-1.35, 1, 0], [-2.1, .62, .05], [-2.9, .42, -.12], [-4.4, .24, 0]]);
  // Fine peripheral arborisation shares a proximal trunk, then fans into skin and muscle.
  const trunks = [...paths];
  for (const [i, trunk] of trunks.entries()) {
    if (i === trunks.length - 1) continue;
    const end = trunk[trunk.length - 1]!;
    for (let branch = 0; branch < 4; branch++) {
      const angle = (branch / 4) * Math.PI * 2 + i * .7;
      const side = end[2] >= 0 ? 1 : -1;
      const tip: Vec3 = [end[0] + Math.cos(angle) * .12, Math.max(.055, end[1] + Math.sin(angle) * .085), end[2] + side * .035];
      paths.push([...trunk.slice(0, -1), end, [(end[0] + tip[0]) / 2, (end[1] + tip[1]) / 2 + .025, end[2] + side * .015], tip]);
    }
  }
  return paths.map((points) => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))));
}

export function Signals({ clock, opacity }: { clock: Clock; opacity: Clock }) {
  const group = useRef<THREE.Group>(null);
  const pulses = useRef<THREE.InstancedMesh>(null);
  const curves = useMemo(neuralPaths, []);
  const geometry = useMemo(() => curves.map((curve, i) => new THREE.TubeGeometry(curve, 32, i < 43 ? .006 : .0025, 4, false)), [curves]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => geometry.forEach((g) => g.dispose()), [geometry]);
  useFrame(() => {
    if (!group.current || !pulses.current) return;
    group.current.visible = opacity.current > .001;
    group.current.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) node.material.opacity = opacity.current * .85;
    });
    curves.forEach((curve, i) => {
      for (let j = 0; j < 3; j++) {
        dummy.position.copy(curve.getPointAt((clock.current * .72 + j / 3) % 1));
        dummy.scale.setScalar(i < 43 ? .017 : .008);
        dummy.updateMatrix();
        pulses.current!.setMatrixAt(i * 3 + j, dummy.matrix);
        pulses.current!.setColorAt(i * 3 + j, new THREE.Color(COLORS[i % COLORS.length]!).multiplyScalar(2));
      }
    });
    pulses.current.instanceMatrix.needsUpdate = true;
    if (pulses.current.instanceColor) pulses.current.instanceColor.needsUpdate = true;
  });
  return <group ref={group}>
    {geometry.map((g, i) => <mesh key={i} geometry={g}><meshBasicMaterial color={COLORS[i % COLORS.length]} transparent depthWrite={false} toneMapped={false} /></mesh>)}
    <instancedMesh ref={pulses} args={[undefined, undefined, curves.length * 3]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="white" transparent depthWrite={false} toneMapped={false} /></instancedMesh>
    <mesh position={[1.88, 1.08, 0]} scale={[.28, .17, .2]}><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color="#91dfff" transparent wireframe depthWrite={false} /></mesh>
  </group>;
}

export function Meadow({ clock, natural, quality }: { clock: Clock; natural: Clock; quality: Quality }) {
  const grass = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const count = quality === "high" ? 8000 : 2400;
  const bladeGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 4);
    const positions = geometry.attributes.position!;
    for (let i = 0; i < positions.count; i++) {
      const height = positions.getY(i) + .5;
      positions.setX(i, positions.getX(i) * (1 - height * .95) + height * height * .3);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => bladeGeometry.dispose(), [bladeGeometry]);
  const blades = useMemo(() => Array.from({ length: count }, (_, i) => {
    const random = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    return { x: random(i + 1) * 26 - 13, z: random(i + 7000) * 24 - 12, h: .13 + random(i + 9000) * .38, a: random(i + 3000) * Math.PI };
  }), [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!grass.current || !material.current) return;
    grass.current.visible = natural.current > .005;
    material.current.opacity = natural.current;
    blades.forEach((b, i) => {
      const x = ((b.x - clock.current * 4.8 + 13000) % 26) - 13;
      const lane = Math.abs(b.z) < .8 ? .22 : 1;
      dummy.position.set(x, b.h * lane * .5 - .035, b.z);
      dummy.rotation.set(.12 * Math.sin(clock.current * 2 + b.x), b.a, .15 * Math.sin(clock.current * 1.8 + b.z));
      dummy.scale.set(.07, b.h * lane, 1);
      dummy.updateMatrix();
      grass.current!.setMatrixAt(i, dummy.matrix);
      grass.current!.setColorAt(i, new THREE.Color().setHSL(.22 + (i % 9) * .009, .48, .19 + (i % 7) * .035));
    });
    grass.current.instanceMatrix.needsUpdate = true;
    if (grass.current.instanceColor) grass.current.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={grass} args={[bladeGeometry, undefined, count]} frustumCulled={false}><meshStandardMaterial ref={material} side={THREE.DoubleSide} transparent alphaTest={.02} roughness={.9} /></instancedMesh>;
}

export const FLOOR_FRAGMENT = `
uniform float natural; uniform float time; varying vec2 p;
void main(){
 vec2 q=p+vec2(time*4.8,0.);
 vec2 cell=abs(fract(q)-.5); vec2 aa=fwidth(q);
 float line=1.-min(smoothstep(.012,.012+aa.x,cell.x),smoothstep(.012,.012+aa.y,cell.y));
 float noise=.5+.25*sin(q.x*2.1+sin(q.y*1.3))+.25*cos(q.y*2.7+sin(q.x));
 vec3 meadow=mix(vec3(.06,.085,.025),vec3(.12,.16,.05),noise);
 meadow=mix(meadow,vec3(.39,.45,.33),smoothstep(10.,34.,length(p)));
 float halo=exp(-length(p)*.08);
 vec3 lab=vec3(.003,.008,.019)+vec3(.015,.28,.8)*line*halo;
 gl_FragColor=vec4(mix(lab,meadow,natural),1.);
}`;
