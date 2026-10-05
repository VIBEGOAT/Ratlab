import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, ContactShadows, Environment, Html, Lightformer, MeshReflectorMaterial, OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { AnimalBundle, Organ } from "@eliminate/sim-core";
import { ORGAN_FOCUS, RatModel, type Layers, type Quality } from "./RatModel";
import { ratVisualState } from "./ratState";

export function webglAvailable(): boolean {
  try {
    // an explicit opt-out for very slow graphics (and for tests that do not need 3D)
    if (localStorage.getItem("no3d") === "1") return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

/** Some browsers do not report the first layout of a freshly mounted canvas. Ask for one more measurement. */
export function useKickResize(dep: unknown): void {
  useEffect(() => {
    const ids = [60, 300, 900].map((ms) => window.setTimeout(() => window.dispatchEvent(new Event("resize")), ms));
    return () => ids.forEach((i) => window.clearTimeout(i));
  }, [dep]);
}

export class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(e: unknown) { console.error("3D scene failed", e); }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export type QualitySetting = "auto" | "low" | "high";

export interface RatSceneProps {
  treated: AnimalBundle;
  untreated: AnimalBundle;
  day: number;
  layers: Layers;
  selected: Organ | null;
  onSelect: (o: Organ | null) => void;
  twins: boolean;
  resetKey: number;
  animate: boolean;
  quality: QualitySetting;
  palette: "standard" | "cb";
  onQualityChange?: (q: Quality) => void;
}

/** Theme background read from CSS, so WebGL matches the page in both themes. */
function useThemeBackground(): string {
  const [bg, setBg] = useState("#0d1213");
  useEffect(() => {
    const read = () => setBg(getComputedStyle(document.documentElement).getPropertyValue("--surface-2").trim() || "#0d1213");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", read);
    return () => { mo.disconnect(); mq.removeEventListener("change", read); };
  }, []);
  return bg;
}

/** Flies the camera to the selected organ, then hands control back to the user. */
function CameraRig({ focus, home }: { focus: THREE.Vector3 | null; home: { pos: THREE.Vector3; target: THREE.Vector3 } }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void } | null;
  const camera = useThree((s) => s.camera);
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (focus) {
      const dir = camera.position.clone().sub(controls?.target ?? new THREE.Vector3()).normalize();
      goal.current = { pos: focus.clone().add(dir.multiplyScalar(3.1)), target: focus.clone() };
    } else goal.current = { pos: home.pos.clone(), target: home.target.clone() };
  }, [focus, home, camera, controls]);
  useEffect(() => {
    if (!controls) return;
    const stop = () => { goal.current = null; };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);
  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-dt * 4);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.pos) < 0.01 && controls.target.distanceTo(g.target) < 0.01) goal.current = null;
  });
  return null;
}

function Tag({ text, color, x }: { text: string; color: string; x: number }) {
  return <Html center position={[x, 1.1, 0]} distanceFactor={9} style={{ pointerEvents: "none" }}><div style={{ font: "600 12px 'Geist', sans-serif", padding: "3px 10px", borderRadius: 999, background: "rgba(8,12,13,0.78)", color, border: `1px solid ${color}`, whiteSpace: "nowrap", backdropFilter: "blur(6px)" }}>{text}</div></Html>;
}

export function RatScene(p: RatSceneProps) {
  const vt = ratVisualState(p.treated, p.day);
  const vu = ratVisualState(p.untreated, p.day);
  const [autoQ, setAutoQ] = useState<Quality>("high");
  const q: Quality = p.quality === "auto" ? autoQ : p.quality;
  useEffect(() => { p.onQualityChange?.(q); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const bg = useThemeBackground();
  const z = p.twins ? 1.7 : 0;
  const home = useMemo(() => ({ pos: new THREE.Vector3(2.2, p.twins ? 5.2 : 3.6, p.twins ? 10.5 : 8.6), target: new THREE.Vector3(-0.4, 0.8, 0) }), [p.twins]);
  const focus = useMemo(() => (p.selected ? new THREE.Vector3(...ORGAN_FOCUS[p.selected]).multiplyScalar(vt.size).add(new THREE.Vector3(0, 0, -z)) : null), [p.selected, vt.size, z]);
  const reduceMotion = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Canvas key={p.resetKey} camera={{ position: home.pos.toArray(), fov: 34, near: 0.05, far: 100 }} dpr={q === "high" ? [1, 2] : [1, 1.25]} gl={{ antialias: true, powerPreference: "high-performance" }} style={{ touchAction: "none" }}
      onPointerMissed={() => p.onSelect(null)}>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 14, 30]} />
      {p.quality === "auto" && <PerformanceMonitor onDecline={() => setAutoQ("low")} flipflops={2} onFallback={() => setAutoQ("low")} />}
      <AdaptiveDpr pixelated={false} />
      <hemisphereLight args={["#dfefff", "#2a2420", 0.55]} />
      <directionalLight position={[4, 7, 5]} intensity={1.6} color="#fff6ea" />
      <directionalLight position={[-6, 3, -4]} intensity={0.9} color="#9fe8ff" />
      <Environment resolution={q === "high" ? 256 : 64}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 3]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-6, 2, -3]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#bff3ff" />
        <Lightformer form="ring" intensity={1.5} position={[5, 3, -5]} scale={3} color="#ffe2c0" />
      </Environment>

      <group position={[0, 0, -z]}>
        <RatModel v={vt} layers={p.layers} selected={p.selected} onSelect={p.onSelect} animate={p.animate && !reduceMotion} quality={q} palette={p.palette} />
        {p.twins && <Tag text="Treated" color="#39d3bb" x={-3.2} />}
      </group>
      {p.twins && (
        <group position={[0, 0, z]}>
          <RatModel v={vu} layers={p.layers} selected={p.selected} onSelect={p.onSelect} animate={p.animate && !reduceMotion} quality={q} palette={p.palette} />
          <Tag text="Untreated twin" color="#a9b8b6" x={-3.2} />
        </group>
      )}

      <ContactShadows position={[-0.4, 0.002, 0]} opacity={0.6} scale={16} blur={2.6} far={2.5} resolution={q === "high" ? 1024 : 256} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.4, 0, 0]}>
        <circleGeometry args={[9, 64]} />
        {q === "high"
          ? <MeshReflectorMaterial resolution={512} mirror={0.35} mixBlur={6} mixStrength={0.6} blur={[300, 80]} roughness={0.9} color={bg} metalness={0.2} depthScale={0.8} minDepthThreshold={0.4} maxDepthThreshold={1.2} transparent opacity={0.92} />
          : <meshStandardMaterial color={bg} roughness={1} />}
      </mesh>

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={home.target.toArray()} minDistance={2} maxDistance={22} maxPolarAngle={Math.PI * 0.49} />
      <CameraRig focus={focus} home={home} />
      {q === "high" && (
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.55} luminanceThreshold={0.55} luminanceSmoothing={0.3} mipmapBlur />
          {p.selected ? <DepthOfField focusDistance={0.02} focalLength={0.05} bokehScale={2.2} /> : <></>}
          <Vignette eskil={false} offset={0.25} darkness={0.45} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
