import { Neoplasm } from "./Neoplasm";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Organ } from "@eliminate/sim-core";
import { type RatVisualState } from "./ratState";
import { LEGS, MARROW_SITES, ORGAN_SHAPES, SPINE_PATH, TAIL_BASE, TAIL_PATH, TAIL_TIP, VESSELS, features, gutPath, type OrganShape, type Vec3 } from "./anatomy";
import { useBodyGeometry } from "./bodyGeometry";
import { makeBodyUniforms, makeFurMaterial, makeXrayMaterial } from "./materials";
import { GRADE_HEX } from "../design/damage";

/**
 * Procedural rat with one continuous body. The component reads a RatVisualState only, so a glTF model
 * can replace it later with the same props.
 */

export interface Layers {
  xray: boolean; skeleton: boolean; vessels: boolean; brain: boolean; heart: boolean; lungs: boolean;
  liver: boolean; kidneys: boolean; gut: boolean; marrow: boolean; tumor: boolean; labels: boolean;
}
export const DEFAULT_LAYERS: Layers = { xray: true, skeleton: false, vessels: true, brain: true, heart: true, lungs: true, liver: true, kidneys: true, gut: true, marrow: true, tumor: true, labels: true };

export type Quality = "low" | "high";

export interface RatModelProps {
  v: RatVisualState;
  layers: Layers;
  selected?: Organ | null;
  onSelect?: (o: Organ) => void;
  walk?: number | React.MutableRefObject<number>;
  scale?: number;
  animate?: boolean;
  quality?: Quality;
  /** organ exposure 0 to 1, shown as a teal glow (used by the dose-day sequence) */
  exposure?: Partial<Record<Organ, number>>;
  palette?: "standard" | "cb";
  /** X-ray sweep position along the body (head is about +3, tail root -1.6); undefined means no sweep */
  sweep?: number;
  /** live sweep position read every frame (overrides `sweep`) */
  sweepRef?: React.MutableRefObject<number>;
  /** "grade" shows injured organs, "names" labels every organ (anatomy tour) */
  labelMode?: "grade" | "names";
  /** animation speed, 1 normal, 0 still */
  tempo?: number;
  gaitSpeed?: number;
  /** Cinematic hero only: fade organ anatomy while revealing neural paths. */
  organOpacity?: React.MutableRefObject<number>;
  agility?: React.MutableRefObject<number>;
  spineFlex?: React.MutableRefObject<number>;
  surfacePhysical?: boolean;
  xrayProgress?: React.MutableRefObject<number>;
  animationClock?: React.MutableRefObject<number>;
  cinematicFocus?: React.MutableRefObject<string | null>;
}

// ---------- geometry built once and shared by every rat on the page

function taperedTube(path: Vec3[], r0: number, r1: number, segments = 64, radial = 10): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const frames = curve.computeFrenetFrames(segments, false);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const c = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * Math.pow(t, 0.8);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      const v = new THREE.Vector3().fromBufferAttribute(pos, idx).sub(c).normalize().multiplyScalar(r).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  void frames;
  g.computeVertexNormals();
  return g;
}

const SPHERE = new THREE.SphereGeometry(1, 28, 18);
const SPHERE_LO = new THREE.SphereGeometry(1, 14, 10);

function organColour(organ: Organ, damage: number): THREE.Color {
  // each organ shows injury its own way: liver goes pale yellow-brown, kidney pale, heart dark, gut dusky
  const base: Record<Organ, [string, string]> = {
    liver: ["#7a2e2a", "#b9924a"], kidney: ["#7d3530", "#d9c4b8"], heart: ["#a8303a", "#4a1220"],
    brain: ["#e1b3bd", "#f08aa6"], gut: ["#d6ab92", "#7a3b37"], marrow: ["#c96a6a", "#f0e6d8"],
  };
  const [a, b] = base[organ];
  return new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, damage * 1.1));
}

function OrganPart({ organ, shapes, damage, grade, selected, hovered, setHovered, onSelect, showLabel, label, exposure, palette, quality, meshRef, labelMode = "grade" }: {
  labelMode?: "grade" | "names";
  organ: Organ; shapes: OrganShape[]; damage: number; grade: number; selected: boolean; hovered: boolean; setHovered: (o: Organ | null) => void;
  onSelect?: (o: Organ) => void; showLabel: boolean; label: string; exposure: number; palette: "standard" | "cb"; quality: Quality; meshRef?: React.MutableRefObject<THREE.Group | null>;
}) {
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const color = useMemo(() => organColour(organ, damage), [organ, damage]);
  const gradeColor = useMemo(() => new THREE.Color(GRADE_HEX[palette][Math.min(5, grade)]!), [grade, palette]);
  const teal=useMemo(()=>new THREE.Color("#39d3bb"),[]);
  useFrame(({ clock },dt) => {
    const t=clock.elapsedTime;
    for(const m of mats.current){
      if(!m)continue;
      const active=selected||hovered||exposure>.02;
      const pulse=.8+.2*Math.sin(t*2.2);
      const target=selected?.55:hovered?.3:exposure>.02?(.15+1.2*exposure)*pulse:grade>=2?(.15+.12*grade)*(.8+.2*Math.sin(t*2.2)):organ==="marrow"&&grade>=1?.3:0;
      m.emissive.lerp(active?teal:gradeColor,1-Math.exp(-Math.min(dt,.1)*8));
      m.emissiveIntensity=THREE.MathUtils.damp(m.emissiveIntensity,target,8,Math.min(dt,.1));
    }
  });
  return (
    <group name={organ} ref={meshRef ?? undefined} position={meshRef ? shapes[0]!.center : undefined}>
      {shapes.map((s, i) => (
        <mesh key={i} geometry={quality === "high" ? SPHERE : SPHERE_LO} position={meshRef ? [s.center[0] - shapes[0]!.center[0], s.center[1] - shapes[0]!.center[1], s.center[2] - shapes[0]!.center[2]] : s.center} scale={s.radii} rotation={s.rot ?? [0, 0, 0]}
          onClick={(e) => { e.stopPropagation(); onSelect?.(organ); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(organ); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { setHovered(null); document.body.style.cursor = ""; }}>
          <meshStandardMaterial ref={(m) => { if (m) mats.current[i] = m; }} color={color} roughness={0.42} metalness={0.02} />
        </mesh>
      ))}
      {showLabel && label && (grade >= 1 || labelMode === "names") && (
        <Html center position={meshRef ? [0, shapes[0]!.radii[1] + .12, 0] : [shapes[0]!.center[0], shapes[0]!.center[1] + shapes[0]!.radii[1] + 0.12, shapes[0]!.center[2]]} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ font: "600 11px 'Geist Mono', monospace", padding: "2px 7px", borderRadius: 999, background: "rgba(8,12,13,0.82)", color: GRADE_HEX[palette][Math.min(5, grade)], border: "1px solid currentColor", whiteSpace: "nowrap", backdropFilter: "blur(4px)" }}>{grade >= 1 ? `${label} · G${grade}` : label}</div>
        </Html>
      )}
    </group>
  );
}

function Skeleton({ quality }: { quality: Quality }) {
  const geo = useMemo(() => {
    const spine = new THREE.CatmullRomCurve3(SPINE_PATH.map((p) => new THREE.Vector3(...p)));
    const vertebrae = Array.from({ length: 26 }, (_, i) => spine.getPointAt(i / 25));
    const bones = LEGS.map((l) => taperedTube([l.upper[0], l.upper[1]], 0.035, 0.025, 6, 6));
    return { vertebrae, bones };
  }, []);
  useEffect(() => () => { geo.bones.forEach((b) => b.dispose()); }, [geo]);
  return (
    <group>
      {geo.vertebrae.map((p, i) => <mesh key={i} geometry={quality === "high" ? SPHERE : SPHERE_LO} position={p} scale={[0.045, 0.04, 0.05]}><meshStandardMaterial color="#efe9dc" roughness={0.6} /></mesh>)}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={`r${i}`} position={[1.35 - i * 0.13, 0.95, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.92 - i * 0.02, 0.86, 1]}>
          <torusGeometry args={[0.44, 0.012, 6, 28, Math.PI * 1.25]} /><meshStandardMaterial color="#efe9dc" roughness={0.6} />
        </mesh>
      ))}
      {geo.bones.map((g, i) => <mesh key={`b${i}`} geometry={g}><meshStandardMaterial color="#efe9dc" roughness={0.6} /></mesh>)}
      <mesh position={[1.95, 1.02, 0]} scale={[0.5, 0.36, 0.32]} geometry={SPHERE_LO}><meshStandardMaterial color="#efe9dc" wireframe transparent opacity={0.6} /></mesh>
      <mesh position={[-1.2, 0.98, 0]} scale={[0.26, 0.14, 0.3]} geometry={SPHERE_LO}><meshStandardMaterial color="#efe9dc" roughness={0.6} /></mesh>
    </group>
  );
}

function Vessels() {
  const geo = useMemo(() => VESSELS.map((v) => ({ v, g: taperedTube(v.path, v.radius, v.radius * 0.8, 24, 8) })), []);
  useEffect(() => () => geo.forEach((x) => x.g.dispose()), [geo]);
  return <group>{geo.map(({ v, g }) => <mesh key={v.id} geometry={g}><meshStandardMaterial color={v.kind === "artery" ? "#c8323c" : v.kind === "portal" ? "#8a4fb0" : "#4a6fc8"} roughness={0.5} emissive={v.kind === "artery" ? "#4a0c10" : "#101a40"} /></mesh>)}</group>;
}

export function RatModel({ v, layers, selected = null, onSelect, walk = 0, scale = 1, animate = true, quality = "high", exposure = {}, palette = "standard", sweep, sweepRef, labelMode = "grade", tempo = 1, gaitSpeed = 1, organOpacity, cinematicFocus, animationClock, xrayProgress, surfacePhysical = false, agility, spineFlex }: RatModelProps) {
  const surfaceOpacity = useMemo(() => new Map<THREE.Material, { opacity: number; transparent: boolean }>(), []);
  const whiskerRef = useRef<THREE.LineSegments>(null);
  const ears = useRef<Array<THREE.Group | null>>([]);
  const noseRef = useRef<THREE.Mesh>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const anatomyRef = useRef<THREE.Group>(null);
  const digestionRef = useRef<THREE.Group>(null);
  const lungsRef = useRef<THREE.Group>(null);
  const clockT = useRef(0);
  const root = useRef<THREE.Group>(null);
  const heartRef = useRef<THREE.Group | null>(null);
  const [hovered, setHovered] = useState<Organ | null>(null);
  const body = useBodyGeometry();
  // until the real body arrives from the worker, a degenerate triangle lets the fur and X-ray shaders compile early
  const placeholder = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    g.setAttribute("skinW", new THREE.BufferAttribute(new Float32Array(3), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    return g;
  }, []);
  const feat = useMemo(() => features(0), []);
  const tail = useMemo(() => taperedTube(TAIL_PATH, TAIL_BASE, TAIL_TIP, quality === "high" ? 72 : 36, quality === "high" ? 12 : 6), [quality]);
  const gut = useMemo(() => taperedTube(gutPath(), 0.042, 0.038, quality === "high" ? 220 : 110, quality === "high" ? 10 : 6), [quality]);
  const marrowGeo = useMemo(() => MARROW_SITES.map((m) => taperedTube([m.a, m.b], m.r, m.r * 0.85, 8, 8)), []);
  const uniforms = useMemo(makeBodyUniforms, []);
  const furColor = useMemo(() => new THREE.Color("#efe8dd"), []);
  // A few close shells read as short laboratory-rat fur without the moiré shimmer of a deep shell stack.
  const shells = quality === "high" ? 7 : 0;
  const furMats = useMemo(() => Array.from({ length: shells + 1 }, (_, i) => makeFurMaterial(uniforms, furColor, i === 0 ? 0 : i / shells, 0.028, !!animationClock || surfacePhysical)), [uniforms, furColor, shells, animationClock, surfacePhysical]);
  const whiskers = useMemo(() => new Float32Array([1, -1].flatMap((z) => [-0.08, 0, 0.08].flatMap((dy) => [feat.nose[0] - 0.08, feat.nose[1] - 0.01, 0.05 * z, feat.nose[0] + 0.35, feat.nose[1] + dy * 2.5, 0.42 * z]))), [feat]);
  const xray = useMemo(() => makeXrayMaterial(uniforms, new THREE.Color("#7fe6d6")), [uniforms]);
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8a9a2", roughness: 0.55 }), []);
  const eyeMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#4a0713", roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }), []);
  const noseMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#b96870", roughness: 0.32, clearcoat: 0.25 }), []);

  useEffect(() => () => { tail.dispose(); }, [tail]);
  useEffect(() => () => { gut.dispose(); }, [gut]);
  useEffect(() => () => { marrowGeo.forEach((g) => g.dispose()); }, [marrowGeo]);
  useEffect(() => () => { furMats.forEach((m) => m.dispose()); }, [furMats]);
  useEffect(() => () => { xray.dispose(); skinMat.dispose(); eyeMat.dispose(); noseMat.dispose(); }, [xray, skinMat, eyeMat, noseMat]);

  // state-driven appearance
  const skin = useMemo(() => new THREE.Color("#e8a9a2").lerp(new THREE.Color("#d9c23f"), v.jaundice * 0.85), [v.jaundice]);
  const fur = useMemo(() => new THREE.Color("#efe8dd").lerp(new THREE.Color("#b8ad98"), v.piloerection * 0.55).lerp(new THREE.Color("#e6d76a"), v.jaundice * 0.25), [v.piloerection, v.jaundice]);
  useEffect(() => {
    uniforms.uSkinColor.value.copy(skin);
    skinMat.color.copy(skin);
    for (const m of furMats) m.color.copy(fur);
  }, [skin, fur, furMats, skinMat, uniforms]);

  useFrame((_, dt) => {
    if (animate) clockT.current += Math.min(dt, 0.1) * tempo;
    const t = animationClock ? animationClock.current : clockT.current;
    if (animationClock) {
      if (whiskerRef.current) whiskerRef.current.scale.z = 1 + .16 * Math.sin(t*Math.PI*28);
      if (noseRef.current) noseRef.current.scale.y = .055*(1+.12*Math.sin(t*50));
      ears.current.forEach((ear,i)=>{ if(ear) ear.rotation.z=.1 + .14*Math.pow(Math.max(0,Math.sin(t*2.7+i*2)),10); });
      if (tailRef.current) tailRef.current.rotation.y=.055*Math.sin(t*5)+.025*Math.sin(t*9-.7);
    }
    if (organOpacity && anatomyRef.current) {
      anatomyRef.current.visible = !animationClock && organOpacity.current > 0.005;
      anatomyRef.current.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
          object.material.transparent = true;
          let parent: THREE.Object3D | null = object;
          let focused = !cinematicFocus?.current;
          while (parent && parent !== anatomyRef.current) {
            if (parent.name === cinematicFocus?.current) focused = true;
            parent = parent.parent;
          }
          const alpha = organOpacity.current * (focused ? 1 : .06);
          object.material.opacity += (alpha - object.material.opacity) * (1 - Math.exp(-Math.min(dt, .1) * 16));
          object.material.depthWrite = alpha > 0.95;
        }
      });
      if (digestionRef.current) digestionRef.current.scale.set(1, 1 + Math.sin(t * Math.PI * .4) * 0.045, 1 + Math.cos(t * Math.PI * .4) * 0.035);
      if (lungsRef.current) lungsRef.current.scale.set(1, 1 + Math.sin(t * 4) * .065, 1 + Math.sin(t * 4) * .065);
    }
    if (xrayProgress && root.current) root.current.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
      for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) if (ancestor === anatomyRef.current) return;
      const mat = object.material;
      if (Array.isArray(mat) || furMats.includes(mat as THREE.MeshStandardMaterial) || mat === xray) return;
      if (!surfaceOpacity.has(mat)) surfaceOpacity.set(mat, { opacity: mat.opacity, transparent: mat.transparent });
      if (!mat.transparent) { mat.transparent = true; mat.needsUpdate = true; }
      mat.opacity = surfaceOpacity.get(mat)!.opacity * xrayProgress.current;
    });
    if (!xrayProgress && surfaceOpacity.size) {
      surfaceOpacity.forEach((original, mat) => { mat.opacity = original.opacity; mat.transparent = original.transparent; mat.needsUpdate = true; });
      surfaceOpacity.clear();
    }
    uniforms.uDissolve.value = xrayProgress ? 1-xrayProgress.current : -1;
    uniforms.uAgility.value = agility?.current ?? 0;
    uniforms.uFlex.value = spineFlex?.current ?? 0;
    uniforms.uTime.value = t * gaitSpeed;
    uniforms.uSweep.value = sweepRef ? sweepRef.current : sweep !== undefined ? sweep : layers.xray ? -99 : 99;
    uniforms.uBreath.value = (v.respirationBpm / 60) * 0.45 * (1 - 0.4 * v.lethargy);
    uniforms.uHunch.value = THREE.MathUtils.damp(uniforms.uHunch.value,v.hunch,6,Math.min(dt,.1));
    uniforms.uWaste.value = THREE.MathUtils.damp(uniforms.uWaste.value,v.wasting,6,Math.min(dt,.1));
    uniforms.uTremor.value = 0; // Clinical signs remain in telemetry; never shake the geometry.
    uniforms.uRuffle.value = v.piloerection;
    uniforms.uWalk.value = typeof walk === "number" ? walk : walk.current;
    if (root.current && animate) {
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y,0,8,dt);
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x,0,8,dt);
    }
    if (heartRef.current && animate) {
      const f = (v.heartRateBpm / 360) * 1.25;
      const beat = Math.pow(Math.max(0, Math.sin(2 * Math.PI * f * t)), 2);
      const s = 1 + 0.12 * beat;
      heartRef.current.scale.setScalar(s);
    }
  });

  const squint = Math.max(0.25, 1 - 0.6 * v.grimace - 0.25 * v.lethargy - 0.15 * v.dehydration);
  const earBack = 0.55 * v.grimace;
  const organThin = 1 - 0.3 * v.wasting;
  const og = (o: Organ) => v.organs[o];
  const common = (o: Organ) => ({ organ: o, damage: og(o).damage, grade: og(o).grade, selected: selected === o, hovered: hovered === o, setHovered, onSelect, showLabel: layers.labels && (labelMode === "names" || layers.xray || selected === o), labelMode, exposure: exposure[o] ?? 0, palette, quality });

  return (
    <group ref={root} scale={v.size * scale}>
      {/* skin and fur */}
      {(sweepRef || sweep !== undefined || layers.xray) && <mesh geometry={body ?? placeholder} material={xray} renderOrder={20} />}
      {(sweepRef || sweep !== undefined || !layers.xray) && furMats.map((m, i) => <mesh key={i} geometry={body ?? placeholder} material={m} renderOrder={i} castShadow={i === 0} />)}
      <mesh ref={tailRef} geometry={tail} material={skinMat} />

      {/* ears, seated on the skull (base sunk into the skin), flattening back with a grimace */}
      {[feat.earL, feat.earR].map((p, i) => {
        const side = i === 0 ? 1 : -1;
        return (
          <group ref={node=>{ears.current[i]=node;}} key={i} position={p} rotation={[side * (0.5 + earBack), side * -0.35, 0.1 + earBack * 0.9]}>
            <mesh geometry={SPHERE} position={[0, 0.13, 0]} scale={[0.2, 0.22, 0.03]}><meshStandardMaterial color={skin} roughness={0.55} transparent={layers.xray} opacity={layers.xray ? 0.45 : 1} /></mesh>
            <mesh geometry={SPHERE} position={[0, 0.13, 0.012 * side]} scale={[0.15, 0.17, 0.02]}><meshStandardMaterial color={new THREE.Color("#d98c8a").lerp(new THREE.Color("#cdb33c"), v.jaundice * 0.8)} roughness={0.6} transparent={layers.xray} opacity={layers.xray ? 0.45 : 1} /></mesh>
          </group>
        );
      })}

      {/* eyes: albino lab rats have ruby eyes; squint with grimace and lethargy; cataract and red tears as overlays */}
      {[feat.eyeL, feat.eyeR].map((p, i) => (
        <group key={i} position={p}>
          <mesh geometry={SPHERE} scale={[0.068, 0.068 * squint, 0.068]} material={eyeMat} />
          <mesh geometry={SPHERE} position={[0.018, 0.02, i === 0 ? 0.052 : -0.052]} scale={0.014}><meshBasicMaterial color="#fff6ec" /></mesh>
          {v.cataract > 0.05 && <mesh geometry={SPHERE} scale={[0.066, 0.066 * squint, 0.066]}><meshStandardMaterial color="#dfe9f2" transparent opacity={0.85 * v.cataract} roughness={0.2} /></mesh>}
        </group>
      ))}
      {v.tears > 0.08 && [feat.tearL, feat.tearR].map((p, i) => (
        <mesh key={i} geometry={SPHERE} position={p} scale={[0.07, 0.035 + 0.04 * v.tears, 0.02]}><meshStandardMaterial color="#9e1c22" roughness={0.3} transparent opacity={Math.min(1, 0.45 + v.tears)} /></mesh>
      ))}
      {/* muzzle details keep the exterior readable at close range */}
      <mesh geometry={SPHERE} position={[feat.nose[0] - 0.16, feat.nose[1] - 0.015, 0.105]} scale={[0.2, 0.13, 0.12]}><meshStandardMaterial color={fur} roughness={0.92} /></mesh>
      <mesh geometry={SPHERE} position={[feat.nose[0] - 0.16, feat.nose[1] - 0.015, -0.105]} scale={[0.2, 0.13, 0.12]}><meshStandardMaterial color={fur} roughness={0.92} /></mesh>
      <mesh ref={noseRef} geometry={SPHERE} position={feat.nose} scale={[0.07, 0.055, 0.065]} material={noseMat} />
      <mesh geometry={SPHERE} position={[feat.nose[0] + 0.05, feat.nose[1] + 0.008, 0.035]} scale={0.012}><meshBasicMaterial color="#4c2630" /></mesh>
      <mesh geometry={SPHERE} position={[feat.nose[0] + 0.05, feat.nose[1] + 0.008, -0.035]} scale={0.012}><meshBasicMaterial color="#4c2630" /></mesh>
      <lineSegments ref={whiskerRef} position={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={12} itemSize={3} array={whiskers} />
        </bufferGeometry>
        <lineBasicMaterial color="#cfc6b6" transparent opacity={0.7} />
      </lineSegments>

      {/* separated toes give the procedural silhouette a grounded, anatomical finish */}
      {!organOpacity && LEGS.flatMap((leg, legIndex) => [-1, 0, 1].map((toe) => (
        <mesh key={`toe-${legIndex}-${toe}`} geometry={SPHERE} position={[leg.paw.c[0] + leg.paw.r[0] * 0.7, 0.042, leg.paw.c[2] + toe * leg.paw.r[2] * 0.55]} scale={[0.085, 0.028, 0.022]}>
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>
      )))}

      {/* tumour on the flank */}
      {layers.tumor && v.tumorRadius > 0 && (
        <Neoplasm radius={v.tumorRadius} position={feat.tumour} />
      )}

      {/* internal anatomy */}
      <group ref={anatomyRef} scale={[1, organThin, organThin]} position={[0, 0.92 * (1 - organThin), 0]}>
        {layers.skeleton && <Skeleton quality={quality} />}
        {layers.vessels && <Vessels />}
        {layers.brain && <OrganPart {...common("brain")} shapes={ORGAN_SHAPES.brain} label="Brain" />}
        {layers.lungs && <group name="lungs" ref={lungsRef} position={[.98, .98, 0]}>{ORGAN_SHAPES.lungs.map((s, i) => <mesh key={i} geometry={SPHERE} position={[s.center[0] - .98, s.center[1] - .98, s.center[2]]} scale={s.radii}><meshStandardMaterial color="#efb0b6" roughness={0.6} transparent opacity={0.6} depthWrite={false} /></mesh>)}</group>}
        {layers.heart && <OrganPart {...common("heart")} shapes={ORGAN_SHAPES.heart} label="Heart" meshRef={heartRef} />}
        {layers.liver && <OrganPart {...common("liver")} shapes={ORGAN_SHAPES.liver} label="Liver" />}
        {layers.kidneys && <OrganPart {...common("kidney")} shapes={ORGAN_SHAPES.kidney} label="Kidneys" />}
        {layers.gut && (
          <group ref={digestionRef}>
            <OrganPart {...common("gut")} shapes={ORGAN_SHAPES.stomach} label="Gut" />
            <mesh geometry={gut} onClick={(e) => { e.stopPropagation(); onSelect?.("gut"); }}><meshStandardMaterial color={organColour("gut", og("gut").damage)} roughness={0.5} emissive={selected === "gut" ? "#39d3bb" : "#000000"} emissiveIntensity={selected === "gut" ? 0.4 : 0} /></mesh>
            {ORGAN_SHAPES.spleen.map((s, i) => <mesh key={i} geometry={SPHERE_LO} position={s.center} scale={s.radii} rotation={s.rot}><meshStandardMaterial color="#5a2a48" roughness={0.5} /></mesh>)}
          </group>
        )}
        {layers.marrow && (
          <group onClick={(e) => { e.stopPropagation(); onSelect?.("marrow"); }}>
            {marrowGeo.map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial color={organColour("marrow", og("marrow").damage)} emissive={selected === "marrow" ? "#39d3bb" : new THREE.Color(GRADE_HEX[palette][og("marrow").grade]!)} emissiveIntensity={selected === "marrow" ? 0.5 : og("marrow").grade >= 1 ? 0.35 : 0} roughness={0.5} /></mesh>)}
            {layers.labels && layers.xray && og("marrow").grade >= 1 && (
              <Html center position={[-1.0, 0.75, 0.6]} style={{ pointerEvents: "none" }}><div style={{ font: "600 11px 'Geist Mono', monospace", padding: "2px 7px", borderRadius: 999, background: "rgba(8,12,13,0.82)", color: GRADE_HEX[palette][og("marrow").grade], border: "1px solid currentColor", whiteSpace: "nowrap" }}>Marrow · G{og("marrow").grade}</div></Html>
            )}
          </group>
        )}
        {ORGAN_SHAPES.bladder.map((s, i) => <mesh key={`bl${i}`} geometry={SPHERE_LO} position={s.center} scale={s.radii}><meshStandardMaterial color="#e6d38a" roughness={0.4} transparent opacity={0.7} /></mesh>)}
      </group>
    </group>
  );
}

/** Organ centres in model space, used by the camera rig to fly to an organ. */
export const ORGAN_FOCUS: Record<Organ, Vec3> = {
  liver: ORGAN_SHAPES.liver[0]!.center, kidney: [-0.22, 1.07, 0], heart: ORGAN_SHAPES.heart[0]!.center,
  brain: ORGAN_SHAPES.brain[0]!.center, gut: [-0.4, 0.68, 0], marrow: [-1.0, 0.42, 0.45],
};
