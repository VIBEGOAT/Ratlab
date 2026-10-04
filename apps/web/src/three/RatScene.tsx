import { Component, useEffect, useRef, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { AnimalBundle, Organ } from "@eliminate/sim-core";
import { RatModel, type Layers } from "./RatModel";
import { ratVisualState } from "./ratState";

export function webglAvailable(): boolean {
  try {
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

export interface RatSceneProps {
  treated: AnimalBundle;
  untreated: AnimalBundle;
  day: number;
  layers: Layers;
  selected: Organ | null;
  onSelect: (o: Organ) => void;
  twins: boolean;
  resetKey: number;
  animate: boolean;
}

function Tag({ text, color }: { text: string; color: string }) {
  return <Html center position={[-0.5, 2.6, 0]} distanceFactor={7} style={{ pointerEvents: "none" }}><div style={{ font: "600 12px 'IBM Plex Sans', sans-serif", padding: "2px 8px", borderRadius: 4, background: "rgba(10,20,19,0.8)", color, border: `1px solid ${color}`, whiteSpace: "nowrap" }}>{text}</div></Html>;
}

export function RatScene(p: RatSceneProps) {
  const vt = ratVisualState(p.treated, p.day);
  const vu = ratVisualState(p.untreated, p.day);
  const controls = useRef(null);
  const z = p.twins ? 2.6 : 0;
  return (
    <Canvas key={p.resetKey} camera={{ position: [2.5, p.twins ? 8 : 4, p.twins ? 12 : 10.5], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ touchAction: "none" }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 8, 6]} intensity={0.9} />
      <directionalLight position={[-5, 3, -4]} intensity={0.3} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.6, 0, 0]}><circleGeometry args={[p.twins ? 7 : 5.5, 48]} /><meshBasicMaterial color="#6c7b8c" transparent opacity={0.18} /></mesh>
      <group position={[0, 0, -z]}>
        <RatModel v={vt} layers={p.layers} selected={p.selected} onSelect={p.onSelect} animate={p.animate} />
        {p.twins && <Tag text="Treated" color="#3fd0b8" />}
      </group>
      {p.twins && (
        <group position={[0, 0, z]}>
          <RatModel v={vu} layers={p.layers} selected={p.selected} onSelect={p.onSelect} animate={p.animate} />
          <Tag text="Untreated twin" color="#8a9bad" />
        </group>
      )}
      <OrbitControls ref={controls} makeDefault enableDamping target={[-0.6, 1, 0]} minDistance={4} maxDistance={22} maxPolarAngle={Math.PI * 0.52} />
    </Canvas>
  );
}
