import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import type { AnimalBundle } from "@eliminate/sim-core";
import { DEFAULT_LAYERS, RatModel, type Quality } from "../three/RatModel";
import { ratVisualState } from "../three/ratState";
import { gutPath, type Vec3 } from "../three/anatomy";
import { HERO_STARTS, heroCycle, organShot } from "./heroCycle";
import { useBodyGeometry } from "../three/bodyGeometry";
import "./cinematic.css";
import { Meadow, Signals, FLOOR_FRAGMENT } from "./LivingEnvironment";

const TITLES = ["Life in motion", "Beneath the surface", "A network of signals"];
const DESCRIPTIONS = ["A running rat in a sunlit meadow", "Beating heart · breathing lungs · digestive motion", "Illustrative neural pathways · signals travel outward"];
const ORGAN_TOUR = [
  { name: "Heart", center: [1.02, .82, .04] as Vec3, function: "Pumps blood through the body", unit: "beats/min" },
  { name: "Stomach", center: [.2, .8, -.22] as Vec3, function: "Mixes food and moves it toward the intestine", unit: "cycles/min" },
  { name: "Lungs", center: [.98, .98, 0] as Vec3, function: "Exchange oxygen and carbon dioxide", unit: "breaths/min" },
];
type Clock = React.MutableRefObject<number>;

function Scene({ animal, clock, playing, reduced, quality, onStage, onShot, onReady }: {
  animal: AnimalBundle; clock: Clock; playing: boolean; reduced: boolean; quality: Quality; onStage: (stage: number) => void; onShot: (shot: number) => void; onReady: () => void;
}) {
  const natural = useRef(1), nerves = useRef(0), organs = useRef(0), sweep = useRef(99);
  const cinematicFocus = useRef<string | null>(null);
  const rat = useRef<THREE.Group>(null), scan = useRef<THREE.Mesh>(null), gutPulse = useRef<THREE.Mesh>(null);
  const ground = useRef<THREE.ShaderMaterial>(null);
  const body = useBodyGeometry();
  const visual = useMemo(() => ({ ...ratVisualState(animal, 0), size: 1, tumorRadius: 0, hunch: 0, wasting: 0, ataxia: 0 }), [animal]);
  const floorUniforms = useMemo(() => ({ natural: { value: 1 }, time: { value: 0 } }), []);
  const gutCurve = useMemo(() => new THREE.CatmullRomCurve3(gutPath().map((p) => new THREE.Vector3(...p))), []);
  const previous = useRef(-1);
  const previousShot = useRef(-1);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const focusPoint = useMemo(() => new THREE.Vector3(), []);
  const resumed = useRef(true);
  useEffect(() => { resumed.current = true; }, [playing]);
  useEffect(() => { if (body) onReady(); }, [body, onReady]);
  useFrame(({ camera, size, scene }, dt) => {
    if (playing && !reduced && !resumed.current) clock.current += dt;
    resumed.current = false;
    const state = heroCycle(clock.current);
    natural.current = state.natural; nerves.current = state.nerves; organs.current = state.organs;
    sweep.current = state.natural >= .999 ? 99 : state.natural <= .001 ? -99 : -1.9 + state.natural * 5.1;
    if (previous.current !== state.stage) { previous.current = state.stage; onStage(state.stage); }
    const bg = new THREE.Color("#02050c").lerp(new THREE.Color("#637254"), state.natural);
    scene.background = bg;
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(bg);
    if (ground.current) { ground.current.uniforms.natural!.value = state.natural; ground.current.uniforms.time!.value = clock.current; }
    const shot = state.stage === 1 ? organShot(state.localTime) : { index: -1, zoom: 0 };
    cinematicFocus.current = shot.zoom > .15 ? ["heart", "gut", "lungs"][shot.index]! : null;
    if (previousShot.current !== shot.index) { previousShot.current = shot.index; onShot(shot.index); }
    const angle = reduced ? .35 : .35 + clock.current * .22;
    const distance = Math.max(11, 12 / Math.max(.55, size.width / size.height));
    camera.position.set(-.65 + Math.sin(angle) * distance, 2.6 + Math.sin(clock.current * .17) * .3, Math.cos(angle) * distance);
    lookAt.set(-.65, .65, 0);
    if (shot.index >= 0 && !reduced) {
      const target = ORGAN_TOUR[shot.index]!;
      focusPoint.set(...target.center);
      const closeDistance = Math.max(1.25, 1.4 / (size.width / size.height));
      const side = shot.index === 1 ? -1 : 1;
      const closePosition = new THREE.Vector3(focusPoint.x + .45 + Math.sin(state.localTime * 1.1) * .12, focusPoint.y + .42, focusPoint.z + closeDistance * side);
      camera.position.lerp(closePosition, shot.zoom);
      lookAt.lerp(focusPoint, shot.zoom);
    }
    camera.lookAt(lookAt);
    if (rat.current) { const movement = 1 - shot.zoom; rat.current.position.y = reduced ? 0 : (.035 + Math.abs(Math.sin(clock.current * 16)) * .07) * movement; rat.current.rotation.z = reduced ? 0 : Math.sin(clock.current * 16) * .02 * movement; }
    if (scan.current) {
      scan.current.visible = state.progress > 0;
      scan.current.position.set(state.stage === 0 ? 3.2 - state.progress * 8.3 : -.4, state.stage === 2 ? .08 : .85, 0);
      scan.current.rotation.set(state.stage === 2 ? Math.PI / 2 : 0, state.stage === 1 ? clock.current * 2 : state.stage === 0 ? Math.PI / 2 : 0, 0);
      scan.current.scale.setScalar(state.stage === 1 ? .7 + state.progress * 2 : state.stage === 2 ? .3 + state.progress * 7 : 1);
      (scan.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(state.progress * Math.PI) * .5;
    }
    if (gutPulse.current) { gutPulse.current.visible = state.organs > .1; gutPulse.current.position.copy(gutCurve.getPointAt((clock.current * .17) % 1)); }
  });
  return <>
    <fog attach="fog" args={["#637254", 13, 32]} />
    <hemisphereLight args={["#fff8e6", "#35492e", 1.8]} />
    <directionalLight position={[4, 7, 3]} intensity={2.5} color="#fff0d1" />
    <directionalLight position={[-4, 3, -5]} intensity={1.7} color="#9cceff" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.04, 0]}><planeGeometry args={[100, 100]} /><shaderMaterial ref={ground} uniforms={floorUniforms} vertexShader="varying vec2 p; void main(){p=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader={FLOOR_FRAGMENT} /></mesh>
    <Meadow clock={clock} natural={natural} quality={quality} />
    <group ref={rat} visible={!!body}>
      <RatModel v={visual} layers={{ ...DEFAULT_LAYERS, xray: false, labels: false, tumor: false }} quality={quality} walk={reduced ? 0 : 3.2} gaitSpeed={3.4} animate={playing && !reduced} sweepRef={sweep} organOpacity={organs} cinematicFocus={cinematicFocus} />
      <Signals clock={clock} opacity={nerves} />
      <mesh ref={gutPulse}><sphereGeometry args={[.055, 12, 8]} /><meshBasicMaterial color="#ffc875" toneMapped={false} /></mesh>
    </group>
    <mesh ref={scan} position={[0, .85, 0]}><torusGeometry args={[1.05, .012, 8, 80]} /><meshBasicMaterial color="#61dfff" transparent depthWrite={false} toneMapped={false} /></mesh>
    {body && <ContactShadows position={[0, -.025, 0]} opacity={.45} scale={15} blur={2.5} far={2.5} resolution={256} frames={1} />}
  </>;
}

export default function CinematicHero({ animal, reduced, quality }: { animal: AnimalBundle; reduced: boolean; quality: Quality }) {
  const clock = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [stage, setStage] = useState(0);
  const [shot, setShot] = useState(-1);
  const visual = useMemo(() => ratVisualState(animal, 0), [animal]);
  const rates = [Math.round(visual.heartRateBpm), 12, Math.round(visual.respirationBpm)];
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return <div className="cinematic-hero" data-testid="cinematic-hero" data-stage={stage}>
    <Canvas frameloop={playing && visible && !reduced ? "always" : "demand"} camera={{ position: [3, 3, 10], fov: 40, near: .05, far: 110 }} dpr={[1, quality === "high" ? 1.5 : 1]} gl={{ antialias: true, powerPreference: "high-performance" }} style={{ touchAction: "pan-y" }}>
      <Scene animal={animal} clock={clock} playing={playing && visible} reduced={reduced} quality={quality} onStage={setStage} onShot={setShot} onReady={() => setReady(true)} />
      {quality === "high" && <EffectComposer multisampling={0}><Bloom intensity={.4} luminanceThreshold={.85} luminanceSmoothing={.25} mipmapBlur /></EffectComposer>}
    </Canvas>
    <div className="cinematic-top"><span>VAST / LIVING SYSTEMS</span><span>0{stage + 1} — 03</span></div>
    {!ready && <div className="cinematic-loading" role="status">Growing a little world…</div>}
    <div className="cinematic-caption" data-organ={shot >= 0 ? ORGAN_TOUR[shot]!.name : undefined}><p>{shot >= 0 ? ORGAN_TOUR[shot]!.name : TITLES[stage]}</p><span>{shot >= 0 ? ORGAN_TOUR[shot]!.function : DESCRIPTIONS[stage]}</span>{shot >= 0 && <div className="cinematic-rate"><strong>{rates[shot]}</strong> {ORGAN_TOUR[shot]!.unit}<small>{shot === 1 ? "Illustrative animation rate" : "Simulated baseline · animation stylized"}</small></div>}</div>
    <div className="cinematic-controls" role="group" aria-label="Cinematic rat views">
      {["Meadow", "Organs", "Nerves"].map((label, i) => <button key={label} aria-pressed={stage === i} onClick={() => { clock.current = HERO_STARTS[i]!; setStage(i); }}>{label}</button>)}
      {!reduced && <button onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause cinematic scene" : "Play cinematic scene"}>{playing ? "Pause" : "Play"}</button>}
    </div>
    <small className="cinematic-note">Illustrative anatomy · simulated physiology</small>
  </div>;
}
