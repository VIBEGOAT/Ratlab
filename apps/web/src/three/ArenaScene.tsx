import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { AnimalBundle } from "@eliminate/sim-core";
import { RatModel, DEFAULT_LAYERS } from "./RatModel";
import { ratVisualState } from "./ratState";

export type ArenaMode = "open" | "maze" | "home";

const LAYERS = { ...DEFAULT_LAYERS, xray: false, labels: false, tumor: true };
const RAT_SCALE = 0.3;

interface Pose { x: number; z: number; heading: number; speed: number }

/** A rat that follows a pose function every frame, and swings its legs in proportion to speed. */
function ArenaRat({ bundle, day, pose, color, label }: { bundle: AnimalBundle; day: number; pose: (t: number) => Pose; color: string; label: string }) {
  const g = useRef<THREE.Group>(null);
  const walk = useRef(0);
  const v = useMemo(() => ratVisualState(bundle, day), [bundle, day]);
  useFrame(({ clock }) => {
    const p = pose(clock.elapsedTime);
    if (g.current) { g.current.position.set(p.x, 0, p.z); g.current.rotation.y = p.heading; }
    walk.current = Math.min(1, p.speed);
  });
  return (
    <group ref={g}>
      <RatModel v={v} layers={LAYERS} walk={walk} scale={RAT_SCALE} />
      <Html center position={[0, 1.1, 0]} distanceFactor={9} style={{ pointerEvents: "none" }}><div style={{ font: "600 11px 'IBM Plex Sans', sans-serif", padding: "1px 6px", borderRadius: 4, background: "rgba(10,20,19,0.8)", color, border: `1px solid ${color}`, whiteSpace: "nowrap" }}>{label}</div></Html>
    </group>
  );
}

function headingOf(dx: number, dz: number, fallback = 0) { return Math.abs(dx) + Math.abs(dz) < 1e-6 ? fallback : Math.atan2(-dz, dx); }

function trackPose(b: AnimalBundle, speedUp: number, size: number): (t: number) => Pose {
  const n = b.track.x.length;
  let last = 0;
  return (t) => {
    const f = (t * b.track.hz * speedUp) % (n - 1);
    const i = Math.floor(f), k = f - i;
    const x0 = (b.track.x[i]! - 0.5) * size, z0 = (b.track.y[i]! - 0.5) * size, x1 = (b.track.x[i + 1]! - 0.5) * size, z1 = (b.track.y[i + 1]! - 0.5) * size;
    const dx = x1 - x0, dz = z1 - z0;
    last = headingOf(dx, dz, last);
    return { x: x0 + dx * k, z: z0 + dz * k, heading: last, speed: Math.hypot(dx, dz) * b.track.hz * speedUp * 0.8 };
  };
}

function routePose(b: AnimalBundle, size: number, cellsPerSec: number): (t: number) => Pose {
  const route = b.waterMaze.lastRoute, G = 8;
  let last = 0;
  return (t) => {
    const f = Math.min(route.length - 1.001, (t * cellsPerSec) % (route.length + 4));
    const i = Math.max(0, Math.floor(f)), k = Math.max(0, f - i);
    const a = route[i]!, c = route[Math.min(route.length - 1, i + 1)]!;
    const px = (v: number) => ((v + 0.5) / G - 0.5) * size;
    const x = px(a[0]) + (px(c[0]) - px(a[0])) * k, z = px(a[1]) + (px(c[1]) - px(a[1])) * k;
    last = headingOf(px(c[0]) - px(a[0]), px(c[1]) - px(a[1]), last);
    return { x, z, heading: last, speed: i >= route.length - 1 ? 0 : 0.8 };
  };
}

/** Home cage: wanders between food, water, nest and the middle. Speed and rest follow the day's activity profile. */
function homePose(b: AnimalBundle, day: number, clockHoursAt: (t: number) => number, seedOffset: number): (t: number) => Pose {
  const targets: Array<[number, number]> = [[-2.4, -1.0], [2.4, -1.0], [0.0, 1.1], [-0.6, 0.0], [1.4, 0.4]]; // food, water, nest, middle, other
  const act = b.homeCage[Math.min(day, b.days)]!.activity;
  let x = 0, z = 1.1, heading = 0, lastT = 0;
  return (t) => {
    const dt = Math.min(0.1, t - lastT);
    lastT = t;
    const h = clockHoursAt(t);
    const bin = Math.min(95, Math.floor(h * 4));
    const level = Math.min(1, (act[bin] ?? 0) / 25);
    const slot = Math.floor(t / 2.5) + seedOffset;
    const hash = Math.abs(Math.sin(slot * 12.9898) * 43758.5453) % 1;
    const resting = level < 0.12 || hash > 0.4 + 0.6 * level;
    const tgt = resting ? targets[2]! : targets[Math.floor(hash * 5) % 5]!;
    const dx = tgt[0] - x, dz = tgt[1] - z, d = Math.hypot(dx, dz);
    const sp = resting ? 0.5 : 0.8 + 1.2 * level;
    if (d > 0.08) { x += (dx / d) * sp * dt; z += (dz / d) * sp * dt; heading = headingOf(dx, dz, heading); }
    return { x, z, heading, speed: d > 0.08 ? sp / 1.6 : 0 };
  };
}

function OpenField({ t, u, day }: { t: AnimalBundle; u: AnimalBundle; day: number }) {
  const S = 5.6;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><planeGeometry args={[S, S]} /><meshStandardMaterial color="#2c3a3a" /></mesh>
      <Line points={[[-S / 4, 0.01, -S / 4], [S / 4, 0.01, -S / 4], [S / 4, 0.01, S / 4], [-S / 4, 0.01, S / 4], [-S / 4, 0.01, -S / 4]]} color="#7a8b8a" dashed dashSize={0.15} gapSize={0.1} lineWidth={1} />
      {[[0, -S / 2, S, 0.2], [0, S / 2, S, 0.2], [-S / 2, 0, 0.2, S], [S / 2, 0, 0.2, S]].map(([x, z, w, d], i) => <mesh key={i} position={[x!, 0.15, z!]}><boxGeometry args={[w!, 0.3, d!]} /><meshStandardMaterial color="#445555" /></mesh>)}
      <ArenaRat bundle={t} day={day} pose={trackPose(t, 4, S - 0.6)} color="#3fd0b8" label="Treated" />
      <ArenaRat bundle={u} day={day} pose={trackPose(u, 4, S - 0.6)} color="#8a9bad" label="Untreated twin" />
    </>
  );
}

function Maze({ t, u, day }: { t: AnimalBundle; u: AnimalBundle; day: number }) {
  const S = 6, G = 8, c = S / G;
  const goal = t.waterMaze.platform;
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><planeGeometry args={[S, S]} /><meshStandardMaterial color="#27465a" /></mesh>
      {Array.from({ length: G + 1 }, (_, i) => <Line key={`a${i}`} points={[[-S / 2 + i * c, 0.005, -S / 2], [-S / 2 + i * c, 0.005, S / 2]]} color="#4f7a96" lineWidth={1} />)}
      {Array.from({ length: G + 1 }, (_, i) => <Line key={`b${i}`} points={[[-S / 2, 0.005, -S / 2 + i * c], [S / 2, 0.005, -S / 2 + i * c]]} color="#4f7a96" lineWidth={1} />)}
      <mesh position={[((goal[0] + 0.5) / G - 0.5) * S, 0.03, ((goal[1] + 0.5) / G - 0.5) * S]}><cylinderGeometry args={[c * 0.35, c * 0.35, 0.06, 20]} /><meshStandardMaterial color="#e0a050" /></mesh>
      <ArenaRat bundle={t} day={day} pose={routePose(t, S, 3)} color="#3fd0b8" label="Treated" />
      <ArenaRat bundle={u} day={day} pose={routePose(u, S, 3)} color="#8a9bad" label="Untreated twin" />
    </>
  );
}

function HomeCage({ t, u, day, hoursPerSec }: { t: AnimalBundle; u: AnimalBundle; day: number; hoursPerSec: number }) {
  const clock = (time: number) => (time * hoursPerSec) % 24;
  const dark = useRef<THREE.AmbientLight>(null);
  const label = useRef<HTMLDivElement>(null);
  useFrame(({ clock: c }) => {
    const h = clock(c.elapsedTime);
    if (dark.current) dark.current.intensity = h >= 12 ? 0.35 : 0.85;
    if (label.current) label.current.textContent = `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")} · ${h >= 12 ? "lights off" : "lights on"}`;
  });
  return (
    <>
      <ambientLight ref={dark} intensity={0.85} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><planeGeometry args={[6.4, 3.8]} /><meshStandardMaterial color="#8a7355" /></mesh>
      {[[0, -1.9, 6.4, 0.1], [0, 1.9, 6.4, 0.1], [-3.2, 0, 0.1, 3.8], [3.2, 0, 0.1, 3.8]].map(([x, z, w, d], i) => <mesh key={i} position={[x!, 0.4, z!]}><boxGeometry args={[w!, 0.8, d!]} /><meshStandardMaterial color="#9fb3b1" transparent opacity={0.25} /></mesh>)}
      <mesh position={[-2.6, 0.15, -1.2]}><boxGeometry args={[0.7, 0.3, 0.5]} /><meshStandardMaterial color="#a0522d" /></mesh>
      <mesh position={[2.6, 0.35, -1.2]}><cylinderGeometry args={[0.15, 0.15, 0.7, 12]} /><meshStandardMaterial color="#6db3ff" transparent opacity={0.7} /></mesh>
      <mesh position={[0, 0.1, 1.3]}><torusGeometry args={[0.6, 0.15, 8, 20]} /><meshStandardMaterial color="#c9b98a" /></mesh>
      <Html position={[0, 1.6, -1.8]} center><div ref={label} style={{ font: "500 12px 'IBM Plex Mono', monospace", padding: "2px 8px", background: "rgba(10,20,19,0.85)", color: "#e3efed", borderRadius: 4, whiteSpace: "nowrap" }}>00:00</div></Html>
      <ArenaRat bundle={t} day={day} pose={homePose(t, day, clock, 0)} color="#3fd0b8" label="Treated" />
      <ArenaRat bundle={u} day={day} pose={homePose(u, day, clock, 7)} color="#8a9bad" label="Untreated twin" />
    </>
  );
}

export function ArenaScene({ mode, treated, untreated, day, hoursPerSec }: { mode: ArenaMode; treated: AnimalBundle; untreated: AnimalBundle; day: number; hoursPerSec: number }) {
  return (
    <Canvas key={mode} camera={{ position: [0, 6.5, 6.5], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ touchAction: "none" }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 8, 4]} intensity={0.9} />
      {mode === "open" && <OpenField t={treated} u={untreated} day={day} />}
      {mode === "maze" && <Maze t={treated} u={untreated} day={day} />}
      {mode === "home" && <HomeCage t={treated} u={untreated} day={day} hoursPerSec={hoursPerSec} />}
      <OrbitControls makeDefault enableDamping target={[0, 0, 0]} minDistance={3} maxDistance={16} maxPolarAngle={Math.PI * 0.49} />
    </Canvas>
  );
}
