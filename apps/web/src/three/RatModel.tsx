import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Organ } from "@eliminate/sim-core";
import { mixRgb, rgbToHex, type RatVisualState } from "./ratState";

/**
 * Procedural low-poly rat. The component only reads a RatVisualState, so a glTF model can replace
 * it later by implementing the same props. Rat axis is +x (head) to -x (tail), +y up.
 */

export interface Layers {
  xray: boolean;
  skeleton: boolean;
  brain: boolean;
  heart: boolean;
  lungs: boolean;
  liver: boolean;
  kidneys: boolean;
  gut: boolean;
  marrow: boolean;
  tumor: boolean;
  labels: boolean;
}

export const DEFAULT_LAYERS: Layers = { xray: true, skeleton: false, brain: true, heart: true, lungs: true, liver: true, kidneys: true, gut: true, marrow: true, tumor: true, labels: true };

export interface RatModelProps {
  v: RatVisualState;
  layers: Layers;
  selected?: Organ | null;
  onSelect?: (o: Organ) => void;
  /** locomotion speed, 0 to 1, drives the leg swing. A ref lets a parent change it every frame. */
  walk?: number | React.MutableRefObject<number>;
  scale?: number;
  /** pause the idle motion, for example while scrubbing */
  animate?: boolean;
}

const HP: [number, number, number] = [1.8, 0.98, 0];
const rel = (x: number, y: number, z: number): [number, number, number] => [x - HP[0], y - HP[1], z - HP[2]];
const NECROTIC = "#2b1a14";

function OrganMesh(p: {
  organ: Organ; position: [number, number, number]; scale: [number, number, number]; base: string; damage: number; grade: number; selected: boolean;
  visible: boolean; label: string; showLabel: boolean; onSelect?: (o: Organ) => void; pulseRef?: React.MutableRefObject<number>; rotation?: [number, number, number]; geometry: THREE.BufferGeometry; meshRef?: React.Ref<THREE.Mesh>;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const color = rgbToHex(mixRgb(p.base, NECROTIC, p.damage * 0.9));
  useFrame(({ clock }) => {
    const m = mat.current;
    if (!m) return;
    const pulse = p.grade >= 2 ? (0.2 + 0.1 * p.grade) * (0.6 + 0.4 * Math.sin(clock.elapsedTime * 5)) : 0;
    m.emissiveIntensity = p.selected ? 0.6 : pulse;
    m.emissive.set(p.selected ? "#3fd0b8" : "#ff3b2f");
  });
  if (!p.visible) return null;
  return (
    <mesh ref={p.meshRef} position={p.position} scale={p.scale} rotation={p.rotation} geometry={p.geometry}
      onClick={(e) => { e.stopPropagation(); p.onSelect?.(p.organ); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}>
      <meshStandardMaterial ref={mat} color={color} roughness={0.55} emissive="#ff3b2f" emissiveIntensity={0} />
      {p.showLabel && p.grade >= 1 && (
        <Html center distanceFactor={10} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ font: "500 11px 'IBM Plex Mono', monospace", padding: "1px 6px", borderRadius: 4, background: "rgba(10,20,19,0.85)", color: p.grade >= 3 ? "#ff8a80" : "#e0a050", border: "1px solid currentColor", whiteSpace: "nowrap", transform: "translateY(-18px)" }}>{p.label} G{p.grade}</div>
        </Html>
      )}
    </mesh>
  );
}

export function RatModel({ v, layers, selected = null, onSelect, walk = 0, scale = 1, animate = true }: RatModelProps) {
  const root = useRef<THREE.Group>(null);
  const breath = useRef<THREE.Group>(null);
  const headG = useRef<THREE.Group>(null);
  const heart = useRef<THREE.Mesh>(null);
  const legs = [useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null), useRef<THREE.Group>(null)];

  const sphere = useMemo(() => new THREE.SphereGeometry(1, 18, 12), []);
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 10), []);
  const cone = useMemo(() => new THREE.ConeGeometry(1, 1, 10), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const tail = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([[-1.6, 0.8, 0], [-2.4, 0.6, 0.1], [-3.2, 0.45, -0.1], [-4.0, 0.4, 0.15], [-4.6, 0.5, 0]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    return new THREE.TubeGeometry(curve, 28, 0.065, 6, false);
  }, []);
  const whiskers = useMemo(() => {
    const pts: number[] = [];
    for (const z of [-1, 1]) for (const dy of [-0.08, 0, 0.08]) pts.push(3.1, 0.92, 0.08 * z, 3.45, 0.92 + dy * 3, 0.5 * z);
    return new Float32Array(pts);
  }, []);

  const fur = rgbToHex(mixRgb("#dcd5ca", "#9c9084", v.piloerection * 0.8));
  const skin = rgbToHex(mixRgb("#e7b4ad", "#e0cf55", v.jaundice));
  const slim = 1 - 0.45 * v.wasting;
  const bodyScale: [number, number, number] = [1.7, 0.7 * slim, 0.7 * slim];
  const bodyOpacity = layers.xray ? 0.2 : 1;
  const shellProps = { transparent: layers.xray, opacity: bodyOpacity, depthWrite: !layers.xray } as const;
  const squint = 1 - 0.55 * v.grimace - 0.3 * v.lethargy - 0.15 * v.dehydration;

  useFrame(({ clock }, dt) => {
    if (!animate) return;
    const t = clock.elapsedTime;
    const slow = 1 - 0.5 * v.lethargy;
    if (breath.current) {
      const k = 1 + 0.03 * Math.sin(2 * Math.PI * (v.respirationBpm / 60) * t * 0.4);
      breath.current.scale.set(1, k, 1);
    }
    if (heart.current) {
      const f = (v.heartRateBpm / 360) * 1.3;
      const beat = Math.max(0, Math.sin(2 * Math.PI * f * t));
      const s = 1 + 0.14 * beat * beat;
      heart.current.scale.set(0.2 * s, 0.2 * s, 0.2 * s);
    }
    if (root.current) {
      const amp = v.tremor * 0.012 + v.convulsion * 0.05;
      root.current.position.set(amp * Math.sin(t * 61), amp * Math.sin(t * 73 + 1), amp * Math.sin(t * 53 + 2));
      root.current.rotation.y = Math.sin(t * 1.2) * 0.1 * v.ataxia;
      root.current.rotation.z = Math.sin(t * 1.7) * 0.05 * v.ataxia + v.convulsion * 0.1 * Math.sin(t * 40);
    }
    if (headG.current) {
      headG.current.rotation.z = -0.4 * v.hunch - 0.15 * v.lethargy;
      headG.current.rotation.y = Math.sin(t * 0.8 * slow) * 0.15 * slow;
    }
    const w = typeof walk === "number" ? walk : walk.current;
    legs.forEach((r, i) => { if (r.current) r.current.rotation.z = Math.sin(t * 9 * Math.max(w, 0.0001) + (i % 2 ? Math.PI : 0)) * 0.55 * Math.min(1, w); });
    void dt;
  });

  const O = (organ: Organ, pos: [number, number, number], sc: [number, number, number], base: string, visible: boolean, label: string, extra: Record<string, unknown> = {}) => (
    <OrganMesh key={`${organ}-${pos.join()}`} organ={organ} position={pos} scale={sc} base={base} damage={v.organs[organ].damage} grade={v.organs[organ].grade} selected={selected === organ}
      visible={visible} label={label} showLabel={layers.labels} onSelect={onSelect} geometry={sphere} {...extra} />
  );

  return (
    <group ref={root} scale={v.size * scale}>
      <group ref={breath}>
        <mesh geometry={sphere} position={[0, 0.95, 0]} scale={bodyScale}><meshStandardMaterial color={fur} roughness={v.piloerection > 0.3 ? 1 : 0.8} {...shellProps} /></mesh>
        {/* ruffled fur spikes along the back */}
        {v.piloerection > 0.25 && Array.from({ length: 36 }, (_, i) => {
          const x = -1.45 + (i / 35) * 2.9;
          const top = 0.95 + 0.7 * slim * Math.sqrt(Math.max(0, 1 - (x / 1.7) ** 2));
          return <mesh key={i} geometry={cone} position={[x, top + 0.02, (i % 3 - 1) * 0.12]} rotation={[(i % 3 - 1) * 0.3, 0, -0.35]} scale={[0.04, 0.14 * v.piloerection, 0.04]}><meshStandardMaterial color={fur} /></mesh>;
        })}

        {/* legs */}
        {([[1.1, 0.5, 0.45], [1.1, 0.5, -0.45], [-1.0, 0.5, 0.5], [-1.0, 0.5, -0.5]] as const).map(([x, y, z], i) => (
          <group key={i} ref={legs[i]} position={[x, y, z]}>
            <mesh geometry={cyl} position={[0, -0.2, 0]} scale={[i > 1 ? 0.12 : 0.085, 0.42, i > 1 ? 0.12 : 0.085]}><meshStandardMaterial color={skin} roughness={0.8} /></mesh>
            <mesh geometry={sphere} position={[0.06, -0.46, 0]} scale={[0.17, 0.07, 0.12]}><meshStandardMaterial color={skin} roughness={0.7} /></mesh>
          </group>
        ))}
        <mesh geometry={tail}><meshStandardMaterial color={skin} roughness={0.7} /></mesh>

        {/* tumor */}
        {layers.tumor && v.tumorRadius > 0 && (
          <mesh geometry={sphere} position={[-0.2, 0.95 + 0.05, 0.62 * slim + 0.02]} scale={[v.tumorRadius, v.tumorRadius, v.tumorRadius]}><meshStandardMaterial color="#9a4f8f" roughness={0.6} /></mesh>
        )}

        {/* organs */}
        {O("liver", [0.45, 0.8, 0.1], [0.42, 0.3 * slim, 0.5 * slim], "#8a3b3b", layers.liver, "Liver")}
        {O("kidney", [-0.45, 1.05, 0.3], [0.18, 0.13, 0.13], "#7b3a3a", layers.kidneys, "Kidneys", { rotation: [0, 0, 0.5] })}
        {O("kidney", [-0.45, 1.05, -0.3], [0.18, 0.13, 0.13], "#7b3a3a", layers.kidneys, "", { rotation: [0, 0, 0.5] })}
        {O("gut", [-0.05, 0.55, 0], [0.55, 0.2 * slim, 0.4 * slim], "#d9b9a0", layers.gut, "Gut")}
        {O("heart", [0.95, 0.95, 0.05], [0.2, 0.2, 0.2], "#b3363f", layers.heart, "Heart", { meshRef: heart })}
        <mesh geometry={sphere} position={[0.95, 1.12, 0.3]} scale={[0.3, 0.26, 0.18]} visible={layers.lungs}><meshStandardMaterial color="#e8a3ab" roughness={0.6} transparent opacity={0.85} /></mesh>
        <mesh geometry={sphere} position={[0.95, 1.12, -0.3]} scale={[0.3, 0.26, 0.18]} visible={layers.lungs}><meshStandardMaterial color="#e8a3ab" roughness={0.6} transparent opacity={0.85} /></mesh>
        <mesh geometry={sphere} position={[0.2, 0.55, -0.4]} scale={[0.22, 0.07, 0.1]}><meshStandardMaterial color="#5a2f4d" /></mesh>

        {/* bone marrow in the femurs */}
        {O("marrow", [-1.0, 0.62, 0.48], [0.07, 0.05, 0.05], "#d98a8a", layers.marrow, "Marrow", { geometry: cyl, rotation: [0, 0, 1.2] })}
        {O("marrow", [-1.0, 0.62, -0.48], [0.07, 0.05, 0.05], "#d98a8a", layers.marrow, "", { geometry: cyl, rotation: [0, 0, 1.2] })}

        {/* skeleton */}
        {layers.skeleton && (
          <group>
            {Array.from({ length: 16 }, (_, i) => <mesh key={i} geometry={box} position={[1.65 - (i / 15) * 3.2, 1.1 * slim + 0.12 * Math.sin(Math.PI * (i / 15)) + 0.05, 0]} scale={[0.14, 0.09, 0.09]}><meshStandardMaterial color="#e9e4d4" /></mesh>)}
            {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[1.3 - i * 0.14, 0.95, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.55 * slim, 0.6 * slim, 1]}><torusGeometry args={[0.5, 0.018, 6, 20, Math.PI * 1.4]} /><meshStandardMaterial color="#e9e4d4" /></mesh>)}
            <mesh geometry={box} position={[-1.3, 0.9, 0]} scale={[0.3, 0.2, 0.5]}><meshStandardMaterial color="#e9e4d4" /></mesh>
          </group>
        )}
      </group>

      {/* head */}
      <group ref={headG} position={HP}>
        <mesh geometry={sphere} position={rel(2.1, 0.98, 0)} scale={[0.72, 0.55 * (1 - 0.1 * v.wasting), 0.5]}><meshStandardMaterial color={fur} roughness={0.8} {...shellProps} /></mesh>
        <mesh geometry={cone} position={rel(2.95, 0.9, 0)} rotation={[0, 0, -Math.PI / 2]} scale={[0.3, 0.75, 0.3]}><meshStandardMaterial color={fur} roughness={0.8} {...shellProps} /></mesh>
        <mesh geometry={sphere} position={rel(3.33, 0.9, 0)} scale={[0.09, 0.09, 0.09]}><meshStandardMaterial color={skin} /></mesh>
        {([1, -1] as const).map((z) => (
          <group key={z}>
            <mesh geometry={sphere} position={rel(1.95, 1.55, 0.42 * z)} rotation={[0.35 * z + 0.5 * v.grimace * z, 0, 0]} scale={[0.22, 0.28, 0.07]}><meshStandardMaterial color={skin} roughness={0.7} /></mesh>
            <mesh geometry={sphere} position={rel(2.5, 1.12, 0.4 * z)} scale={[0.075, 0.075 * squint, 0.075]}><meshStandardMaterial color="#111111" roughness={0.2} /></mesh>
            {v.cataract > 0.05 && <mesh geometry={sphere} position={rel(2.52, 1.12, 0.41 * z)} scale={[0.082, 0.082 * squint, 0.082]}><meshStandardMaterial color="#d8e6f0" transparent opacity={0.85 * v.cataract} /></mesh>}
            {v.tears > 0.1 && <mesh geometry={sphere} position={rel(2.5, 1.0, 0.43 * z)} scale={[0.05, 0.08, 0.04]}><meshStandardMaterial color="#b3262e" transparent opacity={Math.min(1, 0.4 + v.tears)} /></mesh>}
          </group>
        ))}
        {layers.brain && <OrganMesh organ="brain" position={rel(2.0, 1.1, 0)} scale={[0.29, 0.22, 0.23]} base="#e0a6b4" damage={v.organs.brain.damage} grade={v.organs.brain.grade} selected={selected === "brain"} visible label="Brain" showLabel={layers.labels} onSelect={onSelect} geometry={sphere} />}
        {layers.skeleton && <mesh geometry={sphere} position={rel(2.1, 0.98, 0)} scale={[0.6, 0.45, 0.38]}><meshStandardMaterial color="#e9e4d4" wireframe /></mesh>}
        <lineSegments position={rel(0, 0, 0)}>
          <bufferGeometry><bufferAttribute attach="attributes-position" array={whiskers} count={whiskers.length / 3} itemSize={3} /></bufferGeometry>
          <lineBasicMaterial color="#b0a89c" />
        </lineSegments>
      </group>
    </group>
  );
}
