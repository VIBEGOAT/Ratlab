import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { AnimalBundle, Organ } from "@eliminate/sim-core";
import { RatModel, DEFAULT_LAYERS, ORGAN_FOCUS } from "../three/RatModel";
import { ratVisualState } from "../three/ratState";
import { useBodyGeometry } from "../three/bodyGeometry";
import { fastShaders } from "../three/webgl";

export interface ViewportProps {
  animal: AnimalBundle;
  day: number;
  selected: Organ;
  inside: boolean;
  animate: boolean;
  active: boolean;
  angle: number;
  focus: boolean;
  resetKey: number;
  palette: "standard" | "cb";
  onSelect: (organ: Organ) => void;
  onReady: () => void;
  onFailure: () => void;
}

function Camera({ angle, focus, resetKey }: { angle: number; focus: THREE.Vector3 | null; resetKey: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void; domElement?: HTMLElement } | null;
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  useEffect(() => {
    // OrbitControls sets touch-action:none when connecting. Let one-finger page scrolling through.
    if (controls?.domElement) controls.domElement.style.touchAction = "pan-y";
    const target = focus ?? new THREE.Vector3(-0.65, 0.8, 0);
    const distance = focus ? Math.max(2.4, 6 / (size.width / size.height)) : Math.max(6.4, 15 / (size.width / size.height));
    camera.position.set(target.x + Math.sin(angle) * distance, target.y + distance * 0.38, target.z + Math.cos(angle) * distance);
    controls?.target.copy(target);
    controls?.update();
    invalidate();
  }, [angle, camera, controls, invalidate, size.width, size.height, focus, resetKey]);
  return null;
}

/** A deliberately small studio scene: no remote assets, postprocessing, or scroll capture. */
export default function RatViewport(p: ViewportProps) {
  const { onReady } = p;
  const body = useBodyGeometry();
  const visual = useMemo(() => ratVisualState(p.animal, p.day), [p.animal, p.day]);
  const focus = useMemo(() => p.focus && p.inside ? new THREE.Vector3(...ORGAN_FOCUS[p.selected]).multiplyScalar(visual.size) : null, [p.focus, p.inside, p.selected, visual.size]);
  const layers = useMemo(() => ({ ...DEFAULT_LAYERS, xray: p.inside, vessels: false, lungs: false, labels: false, tumor: false }), [p.inside]);
  const narrow = typeof matchMedia !== "undefined" && matchMedia("(max-width: 700px)").matches;
  useEffect(() => () => { document.body.style.cursor = ""; }, []);
  useEffect(() => {
    if (body) onReady();
  }, [body, onReady]);
  return <Canvas camera={{ position: [2.2, 4.5, 10.8], fov: 32 }} dpr={[1, narrow ? 1.25 : 1.5]}
    frameloop={p.active && p.animate ? "always" : "demand"}
    gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    onCreated={(state) => {
      fastShaders(state);
      state.gl.domElement.addEventListener("webglcontextlost", p.onFailure, { once: true });
    }} style={{ touchAction: "pan-y" }}>
    <hemisphereLight args={["#ffffff", "#a6a8b1", 2.4]} />
    <directionalLight position={[3, 7, 5]} intensity={3} color="#fff8f2" />
    <directionalLight position={[-4, 3, -4]} intensity={2} color="#d2e4ff" />
    <RatModel v={visual} layers={layers} selected={p.inside ? p.selected : null} onSelect={p.onSelect}
      animate={p.animate && p.active} quality={narrow ? "low" : "high"} palette={p.palette} />
    {body && <ContactShadows key={`${p.day}-${p.inside}`} position={[0, 0, 0]} frames={1} opacity={0.22} scale={13} blur={2.5} far={2} resolution={256} color="#57627b" />}
    <OrbitControls makeDefault target={[-0.4, 0.8, 0]} enableZoom={false} enablePan={false} enableDamping={false}
      minPolarAngle={0.25} maxPolarAngle={Math.PI * 0.48} touches={{ ONE: undefined, TWO: THREE.TOUCH.DOLLY_ROTATE }} />
    <Camera angle={p.angle} focus={focus} resetKey={p.resetKey} />
  </Canvas>;
}
