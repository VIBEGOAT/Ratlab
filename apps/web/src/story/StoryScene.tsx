import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, ContactShadows, Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { AnimalBundle, Organ } from "@eliminate/sim-core";
import { fastShaders } from "../three/webgl";
import { DEFAULT_LAYERS, RatModel, type Layers, type Quality } from "../three/RatModel";
import { ratVisualState } from "../three/ratState";
import { ORGAN_SHAPES, VESSELS, gutPath, type Vec3 } from "../three/anatomy";
import type { StoryPos } from "./useStoryScroll";

/** Camera pose for each chapter: position and look-at target. */
const SHOTS: Array<{ pos: Vec3; target: Vec3 }> = [
  { pos: [3.2, 2.4, 9.6], target: [-0.8, 0.75, 0] },   // 0 hero (turntable)
  { pos: [0.6, 1.5, 6.4], target: [0.2, 0.9, 0] },    // 1 meet the rat (side view for the X-ray sweep)
  { pos: [4.6, 2.6, 6.2], target: [-0.2, 0.8, 0] },   // 2 choose a compound
  { pos: [1.2, 1.8, 5.0], target: [0.5, 0.85, 0] },   // 3 dose day (follow the flow)
  { pos: [3.6, 2.6, 8.0], target: [-0.6, 0.8, 0] },  // 4 damage unfolds (slow orbit)
  { pos: [2.6, 3.2, 9.5], target: [-0.4, 0.7, 0] },   // 5 the moment (pull back)
  { pos: [0.4, 1.7, 9.4], target: [-0.7, 0.8, 0] },   // 6 untreated twin (side view for the split)
  { pos: [3.2, 2.4, 9.6], target: [-0.8, 0.75, 0] },  // 7 forecast (covered by the dot field)
  { pos: [3.2, 2.4, 9.6], target: [-0.8, 0.75, 0] },  // 8 behaviour (covered by the arena)
  { pos: [3.2, 2.4, 9.6], target: [-0.8, 0.75, 0] },  // 9 humans (covered by the scale-up)
  { pos: [3.6, 2.2, 9.8], target: [-0.8, 0.8, 0] },   // 10 trust
  { pos: [3.6, 2.2, 9.8], target: [-0.8, 0.8, 0] },   // 11 finale
];

export interface StorySceneProps {
  /** scroll position, read every frame */
  posRef: React.MutableRefObject<StoryPos>;
  chapter: number;
  treated: AnimalBundle | null;
  untreated: AnimalBundle | null;
  /** the day shown during "damage unfolds" */
  day: number;
  /** which animal and day the moment chapter shows */
  moment: { who: "treated" | "untreated"; day: number } | null;
  /** organ exposure during dose day, 0 to 1 */
  exposure: Partial<Record<Organ, number>>;
  /** plasma level during dose day, 0 to 1 */
  plasmaRef: React.MutableRefObject<number>;
  reduceMotion: boolean;
  palette: "standard" | "cb";
  quality: Quality;
  onDecline: () => void;
  /** steady frames: the page may raise quality again */
  onIncline?: () => void;
  background: string;
  /** a full-stage overlay covers the canvas, so stop rendering */
  paused: boolean;
  /** treated / untreated split, 0 to 1, read every frame in chapter 6 */
  splitRef: React.MutableRefObject<number>;
  twinDay: number;
}

function CameraChoreo({ posRef, reduceMotion }: { posRef: React.MutableRefObject<StoryPos>; reduceMotion: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const target = useRef(new THREE.Vector3(...SHOTS[0]!.target));
  useFrame((state, dt) => {
    const { chapter, progress } = posRef.current;
    const shot = SHOTS[Math.min(chapter, SHOTS.length - 1)]!;
    const p = new THREE.Vector3(...shot.pos);
    const tg = new THREE.Vector3(...shot.target);
    if (chapter === 0 && !reduceMotion) { const a = state.clock.elapsedTime * 0.12; p.set(Math.sin(a) * 9.8 - 0.8, 2.4, Math.cos(a) * 9.8); }
    if (chapter === 4) { const a = 0.55 + progress * 0.9; p.set(Math.sin(a) * 8.6 - 0.4, 2.6, Math.cos(a) * 8.6); }
    if (chapter === 5) p.multiplyScalar(1 + progress * 0.12);
    // the rat is long and low: on narrow or square stages, back off so the whole body stays in frame
    const fit = Math.max(1, 1.45 / Math.max(0.3, size.width / Math.max(1, size.height)));
    p.sub(tg).multiplyScalar(fit).add(tg);
    const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 2.2);
    camera.position.lerp(p, k);
    target.current.lerp(tg, k);
    camera.lookAt(target.current);
  });
  return null;
}

/** The PK showpiece: glowing particles carry the dose from stomach through gut, portal vein and liver into the blood and kidneys. */
function DoseFlow({ plasmaRef, visible }: { plasmaRef: React.MutableRefObject<number>; visible: boolean }) {
  const N = 180;
  const inst = useRef<THREE.InstancedMesh>(null);
  const curve = useMemo(() => {
    const vena = VESSELS.find((v) => v.id === "vena-cava")!.path;
    const aorta = VESSELS.find((v) => v.id === "aorta")!.path;
    const portal = VESSELS.find((v) => v.id === "portal")!.path;
    const gut = gutPath().filter((_, i) => i % 6 === 0);
    const pts: Vec3[] = [ORGAN_SHAPES.stomach[0]!.center, ...gut, ...portal, ORGAN_SHAPES.liver[0]!.center, [0.6, 0.95, -0.03], ...vena.slice(3), ORGAN_SHAPES.heart[0]!.center, ...aorta.slice(0, 4), [-0.22, 1.08, 0.2]];
    return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const m = inst.current;
    if (!m) return;
    const level = visible ? plasmaRef.current : 0;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const on = i / N < Math.max(0.05, level);
      const u = (i / N + t * 0.08) % 1;
      const p = curve.getPointAt(u);
      dummy.position.copy(p);
      dummy.scale.setScalar(on && visible ? 0.022 + 0.012 * Math.sin(t * 6 + i) : 0.0001);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={inst} args={[undefined, undefined, N]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color="#5ff5dc" toneMapped={false} />
    </instancedMesh>
  );
}

/** The dose itself: a small capsule travelling from the mouth down to the stomach. */
function Pill({ posRef }: { posRef: React.MutableRefObject<StoryPos> }) {
  const ref = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3([[3.6, 0.92, 0], [2.95, 0.86, 0], [2.2, 0.9, 0], [1.4, 0.92, -0.05], [0.6, 0.85, -0.15], ORGAN_SHAPES.stomach[0]!.center].map((p) => new THREE.Vector3(...(p as Vec3)))), []);
  useFrame(() => {
    const { chapter, progress } = posRef.current;
    const m = ref.current;
    if (!m) return;
    const show = chapter === 3 && progress < 0.22;
    m.visible = show;
    if (show) m.position.copy(curve.getPointAt(Math.min(1, progress / 0.2)));
  });
  return <mesh ref={ref} rotation={[0, 0, Math.PI / 2]}><capsuleGeometry args={[0.035, 0.08, 6, 12]} /><meshStandardMaterial color="#f2b14c" emissive="#f2b14c" emissiveIntensity={0.8} toneMapped={false} /></mesh>;
}

/** Renders the same scene twice with a scissor: the treated rat left of the divider, its untreated twin right of it. */
function SplitRenderer({ splitRef, a, b }: { splitRef: React.MutableRefObject<number>; a: React.RefObject<THREE.Group>; b: React.RefObject<THREE.Group> }) {
  useFrame(({ gl, scene, camera, size }) => {
    const ga = a.current, gb = b.current;
    if (!ga || !gb) return;
    const split = splitRef.current;
    gl.setScissorTest(true);
    gl.setViewport(0, 0, size.width, size.height);
    ga.visible = true; gb.visible = false;
    gl.setScissor(0, 0, Math.round(size.width * split), size.height);
    gl.render(scene, camera);
    ga.visible = false; gb.visible = true;
    gl.setScissor(Math.round(size.width * split), 0, size.width - Math.round(size.width * split), size.height);
    gl.render(scene, camera);
    gl.setScissorTest(false);
    ga.visible = true; gb.visible = false;
  }, 1);
  return null;
}

function TwinRats({ splitRef, treated, untreated, day, palette, quality }: { splitRef: React.MutableRefObject<number>; treated: AnimalBundle; untreated: AnimalBundle; day: number; palette: "standard" | "cb"; quality: Quality }) {
  const a = useRef<THREE.Group>(null), b = useRef<THREE.Group>(null);
  const vt = useMemo(() => ratVisualState(treated, day), [treated, day]);
  const vu = useMemo(() => ratVisualState(untreated, day), [untreated, day]);
  const layers: Layers = { ...DEFAULT_LAYERS, xray: false, labels: false };
  return (
    <>
      <group ref={a}><RatModel v={vt} layers={layers} palette={palette} quality={quality} /></group>
      <group ref={b} visible={false}><RatModel v={vu} layers={layers} palette={palette} quality={quality} /></group>
      <SplitRenderer splitRef={splitRef} a={a} b={b} />
    </>
  );
}

function Turntable({ chapter, reduceMotion, children }: { chapter: number; reduceMotion: boolean; children: React.ReactNode }) {
  return <group rotation={[0, chapter === 0 && reduceMotion ? -0.5 : 0, 0]}>{children}</group>;
}

function SweepRat({ posRef, v, layers, palette, quality, chapter, exposure, tempo }: {
  posRef: React.MutableRefObject<StoryPos>; v: ReturnType<typeof ratVisualState>; layers: Layers; palette: "standard" | "cb"; quality: Quality; chapter: number; exposure: Partial<Record<Organ, number>>; tempo: number;
}) {
  // fur below the sweep line, X-ray above it; the line runs head to tail as the reader scrolls chapter 1
  const sweepRef = useRef(99);
  useFrame(() => {
    const { chapter: c, progress } = posRef.current;
    sweepRef.current = c === 1 ? 3.3 - Math.min(1, progress / 0.6) * 5.2 : c >= 3 ? -99 : 99;
  });
  return <RatModel v={v} layers={layers} palette={palette} quality={quality} sweepRef={sweepRef} labelMode={chapter === 1 ? "names" : "grade"} exposure={exposure} tempo={tempo} />;
}

/**
 * Compiles every shader in parallel before the first frame. The browser compiles on its own threads, so the page stays
 * responsive, where compiling inside the first render would stall the main thread for about a second.
 */
function CompileGate({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let live = true;
    const done = () => { if (live) onReady(); };
    const timer = window.setTimeout(done, 4000);
    const r = gl as unknown as { compileAsync?: (s: unknown, c: unknown) => Promise<unknown> };
    if (r.compileAsync) r.compileAsync(scene, camera).then(done, done); else done();
    return () => { live = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function StoryScene(p: StorySceneProps) {
  const [compiled, setCompiled] = useState(false);
  const momentBundle = p.moment?.who === "untreated" ? p.untreated : p.treated;
  const bundle = p.chapter === 5 && p.moment ? momentBundle : p.treated;
  const day = p.chapter === 5 && p.moment ? p.moment.day : p.chapter === 4 ? p.day : p.chapter >= 3 ? 0 : 0;
  const v = useMemo(() => (bundle ? ratVisualState(bundle, day) : null), [bundle, day]);
  const layers: Layers = { ...DEFAULT_LAYERS, xray: p.chapter >= 3 && p.chapter <= 5, labels: p.chapter === 1 || p.chapter === 4, vessels: p.chapter >= 1, tumor: p.chapter >= 4 && p.chapter <= 6 };
  const split = p.chapter === 6 && p.treated && p.untreated;
  const tempo = p.chapter === 5 ? 0.25 : 1;
  return (
    <Canvas onCreated={fastShaders} frameloop={p.paused || !compiled ? "never" : "always"} camera={{ position: SHOTS[0]!.pos, fov: 34, near: 0.05, far: 100 }} dpr={p.quality === "high" ? [1, 2] : [1, 1.25]} gl={{ antialias: true, powerPreference: "high-performance" }} style={{ touchAction: "pan-y" }}>
      <color attach="background" args={[p.background]} />
      <fog attach="fog" args={[p.background, 12, 26]} />
      <CompileGate onReady={() => setCompiled(true)} />
      <PerformanceMonitor bounds={() => [38, 50]} onIncline={p.onIncline} onDecline={p.onDecline} flipflops={2} onFallback={p.onDecline} />
      <AdaptiveDpr pixelated={false} />
      <hemisphereLight args={["#dfefff", "#2a2420", 0.55]} />
      <directionalLight position={[4, 7, 5]} intensity={1.6} color="#fff6ea" />
      <directionalLight position={[-6, 3, -4]} intensity={1.0} color="#9fe8ff" />
      <Environment resolution={p.quality === "high" ? 256 : 64}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 3]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-6, 2, -3]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#bff3ff" />
      </Environment>
      <CameraChoreo posRef={p.posRef} reduceMotion={p.reduceMotion} />
      {split && p.treated && p.untreated && <TwinRats splitRef={p.splitRef} treated={p.treated} untreated={p.untreated} day={p.twinDay} palette={p.palette} quality={p.quality} />}
      {v && !split && (
        <Turntable chapter={p.chapter} reduceMotion={p.reduceMotion}>
          <SweepRat posRef={p.posRef} v={v} layers={layers} palette={p.palette} quality={p.quality} chapter={p.chapter} exposure={p.chapter === 3 ? p.exposure : {}} tempo={tempo} />
          <DoseFlow plasmaRef={p.plasmaRef} visible={p.chapter === 3} />
          <Pill posRef={p.posRef} />
        </Turntable>
      )}
      <ContactShadows position={[-0.4, 0.002, 0]} opacity={0.6} scale={16} blur={2.6} far={2.5} resolution={p.quality === "high" ? 1024 : 256} />
      {p.quality === "high" && !split && (
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.42} luminanceThreshold={0.72} luminanceSmoothing={0.35} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.5} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
