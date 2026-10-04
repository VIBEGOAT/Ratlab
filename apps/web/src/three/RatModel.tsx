import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Organ } from "@eliminate/sim-core";
import { type RatVisualState } from "./ratState";
import { BODY_BOUNDS, LEGS, MARROW_SITES, ORGAN_SHAPES, SPINE_PATH, TAIL_BASE, TAIL_PATH, TAIL_TIP, VESSELS, features, gutPath, ratSdf, type OrganShape, type Vec3 } from "./anatomy";
import { surfaceNets } from "./surfaceNets";
import { makeBodyUniforms, makeFurMaterial, makeXrayMaterial, skinWeights } from "./materials";
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
}

// ---------- geometry built once and shared by every rat on the page

let bodyGeometry: THREE.BufferGeometry | null = null;
function getBodyGeometry(): THREE.BufferGeometry {
  if (bodyGeometry) return bodyGeometry;
  const m = surfaceNets((p) => ratSdf(p), BODY_BOUNDS.min, BODY_BOUNDS.max, 0.035);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute("skinW", new THREE.BufferAttribute(skinWeights(m.positions), 1));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  bodyGeometry = g;
  return g;
}

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

function OrganPart({ organ, shapes, damage, grade, selected, hovered, setHovered, onSelect, showLabel, label, exposure, palette, quality, meshRef }: {
  organ: Organ; shapes: OrganShape[]; damage: number; grade: number; selected: boolean; hovered: boolean; setHovered: (o: Organ | null) => void;
  onSelect?: (o: Organ) => void; showLabel: boolean; label: string; exposure: number; palette: "standard" | "cb"; quality: Quality; meshRef?: React.MutableRefObject<THREE.Group | null>;
}) {
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const color = useMemo(() => organColour(organ, damage), [organ, damage]);
  const gradeColor = useMemo(() => new THREE.Color(GRADE_HEX[palette][Math.min(5, grade)]!), [grade, palette]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const m of mats.current) {
      if (!m) continue;
      if (selected || hovered) { m.emissive.set("#39d3bb"); m.emissiveIntensity = selected ? 0.55 : 0.3; continue; }
      if (exposure > 0.02) { m.emissive.set("#39d3bb"); m.emissiveIntensity = 0.15 + 1.2 * exposure; continue; }
      const shimmer = organ === "brain" ? 0.5 + 0.5 * Math.sin(t * 9 + Math.sin(t * 3.1) * 2) : 0.6 + 0.4 * Math.sin(t * 4);
      const glow = organ === "marrow" && grade >= 1 ? 0.3 : 0;
      m.emissive.copy(gradeColor);
      m.emissiveIntensity = grade >= 2 ? (0.15 + 0.12 * grade) * shimmer : glow;
    }
  });
  return (
    <group ref={meshRef ?? undefined}>
      {shapes.map((s, i) => (
        <mesh key={i} geometry={quality === "high" ? SPHERE : SPHERE_LO} position={s.center} scale={s.radii} rotation={s.rot ?? [0, 0, 0]}
          onClick={(e) => { e.stopPropagation(); onSelect?.(organ); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(organ); document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { setHovered(null); document.body.style.cursor = ""; }}>
          <meshStandardMaterial ref={(m) => { if (m) mats.current[i] = m; }} color={color} roughness={0.42} metalness={0.02} />
        </mesh>
      ))}
      {showLabel && grade >= 1 && (
        <Html center position={[shapes[0]!.center[0], shapes[0]!.center[1] + shapes[0]!.radii[1] + 0.12, shapes[0]!.center[2]]} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ font: "600 11px 'Geist Mono', monospace", padding: "2px 7px", borderRadius: 999, background: "rgba(8,12,13,0.82)", color: GRADE_HEX[palette][Math.min(5, grade)], border: "1px solid currentColor", whiteSpace: "nowrap", backdropFilter: "blur(4px)" }}>{label} · G{grade}</div>
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

export function RatModel({ v, layers, selected = null, onSelect, walk = 0, scale = 1, animate = true, quality = "high", exposure = {}, palette = "standard" }: RatModelProps) {
  const root = useRef<THREE.Group>(null);
  const heartRef = useRef<THREE.Group | null>(null);
  const [hovered, setHovered] = useState<Organ | null>(null);
  const body = useMemo(getBodyGeometry, []);
  const feat = useMemo(() => features(0), []);
  const tail = useMemo(() => taperedTube(TAIL_PATH, TAIL_BASE, TAIL_TIP, quality === "high" ? 72 : 36, quality === "high" ? 12 : 6), [quality]);
  const gut = useMemo(() => taperedTube(gutPath(), 0.042, 0.038, quality === "high" ? 220 : 110, quality === "high" ? 10 : 6), [quality]);
  const marrowGeo = useMemo(() => MARROW_SITES.map((m) => taperedTube([m.a, m.b], m.r, m.r * 0.85, 8, 8)), []);
  const uniforms = useMemo(makeBodyUniforms, []);
  const furColor = useMemo(() => new THREE.Color("#efe8dd"), []);
  const shells = quality === "high" ? 12 : 0;
  const furMats = useMemo(() => Array.from({ length: shells + 1 }, (_, i) => makeFurMaterial(uniforms, furColor, i === 0 ? 0 : i / shells, 0.045)), [uniforms, furColor, shells]);
  const whiskers = useMemo(() => new Float32Array([1, -1].flatMap((z) => [-0.08, 0, 0.08].flatMap((dy) => [feat.nose[0] - 0.08, feat.nose[1] - 0.01, 0.05 * z, feat.nose[0] + 0.35, feat.nose[1] + dy * 2.5, 0.42 * z]))), [feat]);
  const xray = useMemo(() => makeXrayMaterial(uniforms, new THREE.Color("#7fe6d6")), [uniforms]);
  const skinMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8a9a2", roughness: 0.55 }), []);
  const eyeMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#5a0d18", roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 }), []);

  useEffect(() => () => { tail.dispose(); }, [tail]);
  useEffect(() => () => { gut.dispose(); }, [gut]);
  useEffect(() => () => { marrowGeo.forEach((g) => g.dispose()); }, [marrowGeo]);
  useEffect(() => () => { furMats.forEach((m) => m.dispose()); }, [furMats]);
  useEffect(() => () => { xray.dispose(); skinMat.dispose(); eyeMat.dispose(); }, [xray, skinMat, eyeMat]);

  // state-driven appearance
  const skin = useMemo(() => new THREE.Color("#e8a9a2").lerp(new THREE.Color("#d9c23f"), v.jaundice * 0.85), [v.jaundice]);
  const fur = useMemo(() => new THREE.Color("#efe8dd").lerp(new THREE.Color("#b8ad98"), v.piloerection * 0.55).lerp(new THREE.Color("#e6d76a"), v.jaundice * 0.25), [v.piloerection, v.jaundice]);
  useEffect(() => {
    uniforms.uSkinColor.value.copy(skin);
    skinMat.color.copy(skin);
    for (const m of furMats) m.color.copy(fur);
  }, [skin, fur, furMats, skinMat, uniforms]);

  useFrame(({ clock }) => {
    const t = animate ? clock.elapsedTime : 0;
    uniforms.uTime.value = t;
    uniforms.uBreath.value = (v.respirationBpm / 60) * 0.45 * (1 - 0.4 * v.lethargy);
    uniforms.uHunch.value = v.hunch;
    uniforms.uWaste.value = v.wasting;
    uniforms.uTremor.value = v.tremor + 3 * v.convulsion;
    uniforms.uRuffle.value = v.piloerection;
    uniforms.uWalk.value = typeof walk === "number" ? walk : walk.current;
    if (root.current && animate) {
      root.current.rotation.y = Math.sin(t * 1.2) * 0.08 * v.ataxia;
      root.current.rotation.x = Math.sin(t * 1.7) * 0.05 * v.ataxia + v.convulsion * 0.06 * Math.sin(t * 38);
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
  const common = (o: Organ) => ({ organ: o, damage: og(o).damage, grade: og(o).grade, selected: selected === o, hovered: hovered === o, setHovered, onSelect, showLabel: layers.labels && (layers.xray || selected === o), exposure: exposure[o] ?? 0, palette, quality });

  return (
    <group ref={root} scale={v.size * scale}>
      {/* skin and fur */}
      {layers.xray
        ? <mesh geometry={body} material={xray} renderOrder={10} />
        : furMats.map((m, i) => <mesh key={i} geometry={body} material={m} renderOrder={i} castShadow={i === 0} />)}
      <mesh geometry={tail} material={skinMat} />

      {/* ears, seated on the skull (base sunk into the skin), flattening back with a grimace */}
      {[feat.earL, feat.earR].map((p, i) => {
        const side = i === 0 ? 1 : -1;
        return (
          <group key={i} position={p} rotation={[side * (0.5 + earBack), side * -0.35, 0.1 + earBack * 0.9]}>
            <mesh geometry={SPHERE} position={[0, 0.13, 0]} scale={[0.2, 0.22, 0.03]}><meshStandardMaterial color={skin} roughness={0.55} transparent={layers.xray} opacity={layers.xray ? 0.45 : 1} /></mesh>
            <mesh geometry={SPHERE} position={[0, 0.13, 0.012 * side]} scale={[0.15, 0.17, 0.02]}><meshStandardMaterial color={new THREE.Color("#d98c8a").lerp(new THREE.Color("#cdb33c"), v.jaundice * 0.8)} roughness={0.6} transparent={layers.xray} opacity={layers.xray ? 0.45 : 1} /></mesh>
          </group>
        );
      })}

      {/* eyes: albino lab rats have ruby eyes; squint with grimace and lethargy; cataract and red tears as overlays */}
      {[feat.eyeL, feat.eyeR].map((p, i) => (
        <group key={i} position={p}>
          <mesh geometry={SPHERE} scale={[0.062, 0.062 * squint, 0.062]} material={eyeMat} />
          {v.cataract > 0.05 && <mesh geometry={SPHERE} scale={[0.066, 0.066 * squint, 0.066]}><meshStandardMaterial color="#dfe9f2" transparent opacity={0.85 * v.cataract} roughness={0.2} /></mesh>}
        </group>
      ))}
      {v.tears > 0.08 && [feat.tearL, feat.tearR].map((p, i) => (
        <mesh key={i} geometry={SPHERE} position={p} scale={[0.07, 0.035 + 0.04 * v.tears, 0.02]}><meshStandardMaterial color="#9e1c22" roughness={0.3} transparent opacity={Math.min(1, 0.45 + v.tears)} /></mesh>
      ))}
      <mesh geometry={SPHERE} position={feat.nose} scale={0.05}><meshStandardMaterial color={skin} roughness={0.35} /></mesh>
      <lineSegments position={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={12} itemSize={3} array={whiskers} />
        </bufferGeometry>
        <lineBasicMaterial color="#cfc6b6" transparent opacity={0.7} />
      </lineSegments>

      {/* tumour on the flank */}
      {layers.tumor && v.tumorRadius > 0 && (
        <mesh geometry={SPHERE} position={feat.tumour} scale={[v.tumorRadius, v.tumorRadius * 0.85, v.tumorRadius * 0.9]}><meshStandardMaterial color="#9b5a86" roughness={0.6} /></mesh>
      )}

      {/* internal anatomy */}
      <group scale={[1, organThin, organThin]} position={[0, 0.92 * (1 - organThin), 0]}>
        {layers.skeleton && <Skeleton quality={quality} />}
        {layers.vessels && <Vessels />}
        {layers.brain && <OrganPart {...common("brain")} shapes={ORGAN_SHAPES.brain} label="Brain" />}
        {layers.lungs && ORGAN_SHAPES.lungs.map((s, i) => <mesh key={i} geometry={SPHERE} position={s.center} scale={s.radii}><meshStandardMaterial color="#efb0b6" roughness={0.6} transparent opacity={0.6} depthWrite={false} /></mesh>)}
        {layers.heart && <OrganPart {...common("heart")} shapes={ORGAN_SHAPES.heart} label="Heart" meshRef={heartRef} />}
        {layers.liver && <OrganPart {...common("liver")} shapes={ORGAN_SHAPES.liver} label="Liver" />}
        {layers.kidneys && <OrganPart {...common("kidney")} shapes={ORGAN_SHAPES.kidney} label="Kidneys" />}
        {layers.gut && (
          <group>
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
