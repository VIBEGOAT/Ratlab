import { Html } from "@react-three/drei";
import { advanceStride, getTerrainHeight } from "./locomotion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import type { AnimalBundle } from "@eliminate/sim-core";
import { DEFAULT_LAYERS, RatModel, type Quality } from "../three/RatModel";
import { ratVisualState } from "../three/ratState";
import { gutPath, type Vec3 } from "../three/anatomy";
import { HERO_STARTS, heroCycle, organShot } from "./heroCycle";
import { useBodyGeometry } from "../three/bodyGeometry";
import "./cinematic.css";
import { MacroAnatomy } from "./MacroAnatomy";
import { ShaderMeadow, MeadowDetails } from "./ShaderMeadow";
import { MeadowAtmosphere } from "./MeadowAtmosphere";
import { ratAgility } from "./ratAgility";

const TITLES = ["Life in motion", "Beneath the surface", "A network of signals"];
const DESCRIPTIONS = ["A running rat in a sunlit meadow", "Cardiac & pulmonary physiology · illustrative animation", "Central nervous system · illustrative signal propagation"];
const COLORS = ["#78c679", "#c6df73", "#a6cf83", "#e8a855", "#f4f0ea"];
const ORGAN_TOUR = [
  { name: "Heart", center: [1.02, .82, .04] as Vec3, function: "Pumps blood through the body", unit: "beats/min" },
  { name: "Stomach", center: [.2, .8, -.22] as Vec3, function: "Mixes food and moves it toward the intestine", unit: "cycles/min" },
  { name: "Lungs", center: [.98, .98, 0] as Vec3, function: "Exchange oxygen and carbon dioxide", unit: "breaths/min" },
];
type Clock = React.MutableRefObject<number>;

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

function Signals({ clock, opacity }: { clock: Clock; opacity: Clock }) {
  const group = useRef<THREE.Group>(null);
  const pulses = useRef<THREE.InstancedMesh>(null);
  const curves = useMemo(neuralPaths, []);
  const geometry = useMemo(() => curves.map((curve, i) => new THREE.TubeGeometry(curve, 32, i < 43 ? .006 : .0025, 4, false)), [curves]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => COLORS.map(c => new THREE.Color(c).multiplyScalar(2)), []);
  const lastTime = useRef(-1), lastOpacity = useRef(-1);
  useEffect(() => {
    if (!pulses.current) return;
    curves.forEach((_, i) => { for (let j = 0; j < 3; j++) pulses.current!.setColorAt(i * 3 + j, colors[i % colors.length]!); });
    if (pulses.current.instanceColor) pulses.current.instanceColor.needsUpdate = true;
  }, [curves, colors]);
  useEffect(() => () => geometry.forEach((g) => g.dispose()), [geometry]);
  useFrame(() => {
    if (!group.current || !pulses.current) return;
    group.current.visible = opacity.current > .001;
    if (!group.current.visible) return;
    if (lastTime.current === clock.current && lastOpacity.current === opacity.current) return;
    lastTime.current = clock.current; lastOpacity.current = opacity.current;
    group.current.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) node.material.opacity = opacity.current * .85;
    });
    curves.forEach((curve, i) => {
      for (let j = 0; j < 3; j++) {
        curve.getPointAt((clock.current * .72 + j / 3) % 1, dummy.position);
        dummy.scale.setScalar(i < 43 ? .017 : .008);
        dummy.updateMatrix();
        pulses.current!.setMatrixAt(i * 3 + j, dummy.matrix);
      }
    });
    pulses.current.instanceMatrix.needsUpdate = true;
  });
  return <group ref={group}>
    {geometry.map((g, i) => <mesh key={i} geometry={g}><meshBasicMaterial color={COLORS[i % COLORS.length]} transparent depthWrite={false} toneMapped={false} /></mesh>)}
    <instancedMesh ref={pulses} args={[undefined, undefined, curves.length * 3]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="white" transparent depthWrite={false} toneMapped={false} /></instancedMesh>
    <mesh position={[1.88, 1.08, 0]} scale={[.28, .17, .2]}><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color="#78c679" transparent wireframe depthWrite={false} /></mesh>
  </group>;
}

function Scene({ animal, clock, playing, reduced, quality, manual, exitProgress, onStage, onShot, onReady }: {
  animal: AnimalBundle; clock: Clock; manual: number | null; exitProgress:number; playing: boolean; reduced: boolean; quality: Quality; onStage: (stage: number) => void; onShot: (shot: number) => void; onReady: () => void;
}) {
  const environment=useRef(1);
  const motionClock = useRef(0);
  const stride=useRef(0),lastX=useRef<number | null>(null),walkAmount=useRef(0);
  const walk = useRef(2);
  const natural = useRef(1), nerves = useRef(0), organs = useRef(0), sweep = useRef(99);
  const cinematicFocus = useRef<string | null>(null);
  const rat = useRef<THREE.Group>(null), scan = useRef<THREE.Mesh>(null), gutPulse = useRef<THREE.Mesh>(null);
  const ratPosition = useRef(new THREE.Vector3());
  const ratDirection = useRef(new THREE.Vector3(1,0,0));
  const rim = useRef<THREE.DirectionalLight>(null);
  const rimColors = useMemo(() => [new THREE.Color("#e8a855"),new THREE.Color("#e05a47"),new THREE.Color("#78c679")], []);
  const rimColor = useMemo(() => new THREE.Color(), []);
  const poseRotation = useMemo(() => new THREE.Quaternion(), []);
  const poseEuler = useMemo(() => new THREE.Euler(), []);
  const restRotation = useMemo(() => new THREE.Quaternion(), []);
  const agility = useRef(0), spineFlex = useRef(0);
  const body = useBodyGeometry();
  const visual = useMemo(() => ({ ...ratVisualState(animal, 0), size: 1, tumorRadius: 0, hunch: 0, wasting: 0, ataxia: 0 }), [animal]);
  const gutCurve = useMemo(() => new THREE.CatmullRomCurve3(gutPath().map((p) => new THREE.Vector3(...p))), []);
  const previous = useRef(-1);
  const previousShot = useRef(-1);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const focusPoint = useMemo(() => new THREE.Vector3(), []);
  const closePosition = useMemo(() => new THREE.Vector3(), []);
  const backdrop = useMemo(() => ({ current: new THREE.Color(), meadow: new THREE.Color("#e8dec3"), inside: new THREE.Color("#0b0a09") }), []);
  const resumed = useRef(true);
  useEffect(() => { resumed.current = true; }, [playing, body]);
  useEffect(() => { if (body) onReady(); }, [body, onReady]);
  useFrame(({ camera, size, scene }, delta) => {
    // R3F already advances its shared clock. Never call getDelta() a second time.
    const dt = Math.min(Math.max(delta, 0), .05);
    // Director time follows wall time; only physical motion is capped during slow frames.
    if (playing && !reduced && body && !resumed.current) clock.current += delta;
    resumed.current = false;
    const targetState = heroCycle(manual === null ? clock.current : HERO_STARTS[manual]! + .5);
    const blend = reduced || manual === null ? 1 : 1 - Math.exp(-delta * 12);
    const state = { ...targetState, natural: THREE.MathUtils.lerp(natural.current,targetState.natural,blend), organs: THREE.MathUtils.lerp(organs.current,targetState.organs,blend), nerves: THREE.MathUtils.lerp(nerves.current,targetState.nerves,blend) };
    if (playing && !reduced) motionClock.current += dt * (1 - .65 * (1-state.natural));
    const pose = ratAgility(motionClock.current);
    agility.current = reduced ? 0 : state.natural;
    spineFlex.current = pose.flex * state.natural * .35;
    const distanceMoved=lastX.current===null?0:Math.abs(pose.x-lastX.current);
    lastX.current=pose.x;
    if(playing&&!reduced)stride.current=advanceStride(stride.current,distanceMoved,dt);
    walkAmount.current=THREE.MathUtils.damp(walkAmount.current,pose.state==="scurry"?Math.min(1,distanceMoved/Math.max(dt,.001)):0,12,dt);
    walk.current=walkAmount.current*state.natural;
    environment.current=state.natural*(1-exitProgress);
    natural.current = state.natural; nerves.current = state.nerves; organs.current = state.organs;
    sweep.current = state.natural >= .999 ? 99 : state.natural <= .001 ? -99 : -1.9 + state.natural * 5.1;
    if (previous.current !== state.stage) { previous.current = state.stage; onStage(state.stage); }
    const bg = backdrop.current.copy(backdrop.inside).lerp(backdrop.meadow, environment.current);
    scene.background = bg;
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(bg);
    if (rim.current) {
      rimColor.setRGB(...(["r","g","b"] as const).map(c => rimColors[0]![c]*state.natural + rimColors[1]![c]*state.organs + rimColors[2]![c]*state.nerves) as [number,number,number]);
      rim.current.color.copy(rimColor);
    }
    const shot = state.stage === 1 ? organShot(state.localTime) : { index: -1, zoom: 0 };
    cinematicFocus.current = "macro";
    if (previousShot.current !== shot.index) { previousShot.current = shot.index; onShot(shot.index); }
    const angle = reduced ? .35 : .35 + Math.sin(clock.current * .17) * .25;
    const distance = Math.max(11, 12 / Math.max(.55, size.width / size.height));
    camera.position.set(-.65 + Math.sin(angle) * distance, 2.6 + Math.sin(clock.current * .17) * .3, Math.cos(angle) * distance);
    lookAt.set(-.65, .65, 0);
    const interior = 1 - state.natural;
    if (interior > .001) {
      focusPoint.set(1.02 + state.nerves * .76, .9 + state.nerves * .2, .02);
      const distance = Math.max(1.65, 1.8 / (size.width / size.height));
      closePosition.set(focusPoint.x + .35 * Math.sin(clock.current*.3), focusPoint.y+.48, distance);
      camera.position.lerp(closePosition, interior);
      lookAt.lerp(focusPoint, interior);
    }
    camera.lookAt(lookAt);
    if (rat.current) {
      const movement = reduced ? 0 : state.natural * state.natural;
      const x=pose.x*movement;
      rat.current.position.set(x,getTerrainHeight(x,0)+.06+Math.max(0,pose.lift)*movement,0);
      poseEuler.set(0, pose.yaw, pose.pitch);
      poseRotation.setFromEuler(poseEuler).slerp(restRotation, 1-movement);
      rat.current.quaternion.slerp(poseRotation, reduced ? 1 : 1-Math.exp(-dt*14));
      ratPosition.current.copy(rat.current.position);
      ratDirection.current.set(1,0,0).applyQuaternion(rat.current.quaternion);
    }
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
    <fog attach="fog" args={["#e8dec3", 20, 90]} />
    <hemisphereLight args={["#fff8e6", "#35492e", 1.8]} />
    <directionalLight position={[-6, 2.3, -6.5]} intensity={2.5} color="#fff0d1" />
    <directionalLight position={[2, 4, 6]} intensity={1.2} color="#fff3db" />
    <directionalLight ref={rim} position={[-4, 3, -5]} intensity={1.7} color="#e8a855" />
    <MeadowAtmosphere clock={motionClock} natural={environment}/>
    <ShaderMeadow clock={motionClock} natural={environment} quality={quality} ratPosition={ratPosition} ratDirection={ratDirection}/>
    <MeadowDetails clock={motionClock} natural={environment} quality={quality} ratPosition={ratPosition} ratDirection={ratDirection}/>
    <group ref={rat} visible={!!body}>
      <RatModel v={visual} layers={{ ...DEFAULT_LAYERS, xray: false, labels: false, tumor: false }} quality={quality} xrayProgress={natural} walk={reduced ? 0 : walk} gaitSpeed={1} stridePhase={stride} agility={agility} spineFlex={spineFlex} animationClock={motionClock} animate={playing && !reduced} sweepRef={sweep} organOpacity={organs} cinematicFocus={cinematicFocus} />
      <Signals clock={motionClock} opacity={nerves} />
      <MacroAnatomy clock={motionClock} organs={organs} nerves={nerves} quality={quality} />
      <mesh ref={gutPulse}><sphereGeometry args={[.055, 12, 8]} /><meshBasicMaterial color="#ffc875" toneMapped={false} /></mesh>
    </group>
    <mesh ref={scan} position={[0, .85, 0]}><torusGeometry args={[1.05, .012, 8, 80]} /><meshBasicMaterial color="#e8a855" transparent depthWrite={false} toneMapped={false} /></mesh>
  </>;
}

export default function CinematicHero({ animal, reduced, quality, embedded = false, clockRef, storyExit = 0 }: { animal: AnimalBundle; reduced: boolean; quality: Quality; embedded?: boolean; clockRef?: Clock; storyExit?:number }) {
  // Keep one visual profile for the whole hero. Adaptive quality can change between
  // frames on different GPUs; letting it toggle here makes bloom and rat shading pop.
  const stableQuality = useRef<Quality>(reduced ? "low" : quality).current;
  const localClock = useRef(0);
  const clock=clockRef??localClock;
  const [playing, setPlaying] = useState(true);
  const [manual, setManual] = useState<number | null>(null);
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
  const sceneContent = <>      <Scene animal={animal} clock={clock} playing={playing && visible} reduced={reduced} quality={stableQuality} manual={manual} exitProgress={storyExit} onStage={setStage} onShot={setShot} onReady={() => setReady(true)} />
      {stableQuality === "high" && <EffectComposer multisampling={0}><Bloom intensity={.4} luminanceThreshold={.85} luminanceSmoothing={.25} mipmapBlur /></EffectComposer>}
</>;
  const controls = <>    <div className="cinematic-top"><span>VAST / LIVING SYSTEMS</span><span>0{stage + 1} — 03</span></div>
    {!ready && <div className="cinematic-loading" role="status">Growing a little world…</div>}
    <div className="cinematic-caption" data-organ={shot >= 0 ? ORGAN_TOUR[shot]!.name : undefined}><p>{shot >= 0 ? ORGAN_TOUR[shot]!.name : TITLES[stage]}</p><span>{shot >= 0 ? ORGAN_TOUR[shot]!.function : DESCRIPTIONS[stage]}</span>{shot >= 0 && <div className="cinematic-rate"><strong>{rates[shot]}</strong> {ORGAN_TOUR[shot]!.unit}<small>{shot === 1 ? "Illustrative animation rate" : "Simulated baseline · animation stylized"}</small></div>}</div>
    <div className="cinematic-controls" role="group" aria-label="Cinematic rat views">
      {["Meadow", "Organs", "Nerves"].map((label, i) => <button key={label} aria-pressed={stage === i} onClick={() => { setManual(i); setStage(i); }}>{label}</button>)}
      {manual !== null && <button onClick={() => { clock.current = HERO_STARTS[manual]!; setManual(null); }}>Auto</button>}
      {!reduced && <button onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause cinematic scene" : "Play cinematic scene"}>{playing ? "Pause" : "Play"}</button>}
    </div>
    <small className="cinematic-note">Illustrative anatomy · simulated physiology</small>
  </>;
  if(embedded)return <>{sceneContent}<Html fullscreen calculatePosition={(_,__,size)=>[size.width/2,size.height/2]} style={{pointerEvents:"none"}}><div className="cinematic-hero cinematic-controls-only" data-testid="cinematic-hero" data-stage={stage}>{controls}</div></Html></>;
  return <div className="cinematic-hero" data-testid="cinematic-hero" data-stage={stage}><Canvas frameloop={visible?"always":"demand"} camera={{position:[3,3,10],fov:40,near:.05,far:450}} dpr={[1,1.25]}>{sceneContent}</Canvas>{controls}</div>;
}
