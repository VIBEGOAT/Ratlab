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

const TITLES = ["Life in motion", "Beneath the surface", "A network of signals"];
const DESCRIPTIONS = ["A running rat in a sunlit meadow", "Beating heart · breathing lungs · digestive motion", "Illustrative neural pathways · signals travel outward"];
const COLORS = ["#67e8f9", "#ff83c8", "#a6ff72", "#ffd36c", "#b29aff"];
const ORGAN_TOUR = [
  { name: "Heart", center: [1.02, .82, .04] as Vec3, function: "Pumps blood through the body", unit: "beats/min" },
  { name: "Stomach", center: [.2, .8, -.22] as Vec3, function: "Mixes food and moves it toward the intestine", unit: "cycles/min" },
  { name: "Lungs", center: [.98, .98, 0] as Vec3, function: "Exchange oxygen and carbon dioxide", unit: "breaths/min" },
];
type Clock = React.MutableRefObject<number>;
type StoryRoute = "heart" | "food" | "breath";
const ROUTES: Array<{ id: StoryRoute; label: string; note: string; start: number }> = [
  { id: "heart", label: "Follow the heartbeat", note: "Circulation and cardiac exposure", start: 8.05 },
  { id: "food", label: "Follow the food", note: "Stomach, gut, and liver", start: 12.05 },
  { id: "breath", label: "Follow the breath", note: "Lungs and oxygen exchange", start: 16.05 },
];

function DetailedHeart({ clock, focus, heartRate, reduced }: { clock: Clock; focus: React.MutableRefObject<string | null>; heartRate: number; reduced: boolean }) {
  const root = useRef<THREE.Group>(null);
  const vessels = useMemo(() => {
    const paths = [
      [[0.02, .18, .02], [.08, .38, .02], [.02, .55, .02], [-.04, .68, .02]],
      [[-.02, .04, .02], [-.18, -.08, .04], [-.28, -.24, .02]],
      [[.02, .02, -.02], [.2, -.08, -.04], [.3, -.22, -.02]],
    ];
    return paths.map((points, i) => ({ i, geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p as [number, number, number]))), 20, i === 0 ? .025 : .012, 6, false) }));
  }, []);
  useEffect(() => () => vessels.forEach((v) => v.geometry.dispose()), [vessels]);
  useFrame(() => {
    const group = root.current;
    if (!group) return;
    const active = focus.current === "heart";
    group.visible = active;
    if (!active) return;
    const beat = reduced ? 0 : Math.pow(Math.max(0, Math.sin((clock.current * heartRate / 60) * Math.PI * 2)), 8);
    group.scale.setScalar(1.55 + beat * .1);
  });
  return <group ref={root} position={[1.02, .82, .23]} scale={1.55}>
    <mesh position={[-.09, .02, 0]} scale={[.19, .25, .15]} rotation={[0, 0, -.18]}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshStandardMaterial color="#b9344a" roughness={.34} metalness={.04} emissive="#3b0712" emissiveIntensity={.28} depthTest={false} />
    </mesh>
    <mesh position={[.09, .02, 0]} scale={[.19, .25, .15]} rotation={[0, 0, .18]}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshStandardMaterial color="#a92b43" roughness={.34} metalness={.04} emissive="#3b0712" emissiveIntensity={.28} depthTest={false} />
    </mesh>
    <mesh position={[0, -.18, 0]} rotation={[0, 0, Math.PI]} scale={[.1, .24, .1]}>
      <coneGeometry args={[1, 1, 24]} />
      <meshStandardMaterial color="#8e2039" roughness={.38} emissive="#2a0610" emissiveIntensity={.25} depthTest={false} />
    </mesh>
    {vessels.map(({ i, geometry }) => <mesh key={i} geometry={geometry}>
      <meshStandardMaterial color={i === 0 ? "#e04d59" : "#5d78d8"} roughness={.28} emissive={i === 0 ? "#4b0b15" : "#111d55"} emissiveIntensity={.5} depthTest={false} />
    </mesh>)}
  </group>;
}

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
  useEffect(() => () => geometry.forEach((g) => g.dispose()), [geometry]);
  useFrame(() => {
    if (!group.current || !pulses.current) return;
    group.current.visible = opacity.current > .001;
    group.current.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) node.material.opacity = opacity.current * .85;
    });
    curves.forEach((curve, i) => {
      for (let j = 0; j < 3; j++) {
        dummy.position.copy(curve.getPointAt((clock.current * .72 + j / 3) % 1));
        dummy.scale.setScalar(i < 43 ? .017 : .008);
        dummy.updateMatrix();
        pulses.current!.setMatrixAt(i * 3 + j, dummy.matrix);
        pulses.current!.setColorAt(i * 3 + j, new THREE.Color(COLORS[i % COLORS.length]!).multiplyScalar(2));
      }
    });
    pulses.current.instanceMatrix.needsUpdate = true;
    if (pulses.current.instanceColor) pulses.current.instanceColor.needsUpdate = true;
  });
  return <group ref={group}>
    {geometry.map((g, i) => <mesh key={i} geometry={g}><meshBasicMaterial color={COLORS[i % COLORS.length]} transparent depthWrite={false} toneMapped={false} /></mesh>)}
    <instancedMesh ref={pulses} args={[undefined, undefined, curves.length * 3]} frustumCulled={false}><sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="white" transparent depthWrite={false} toneMapped={false} /></instancedMesh>
    <mesh position={[1.88, 1.08, 0]} scale={[.28, .17, .2]}><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color="#91dfff" transparent wireframe depthWrite={false} /></mesh>
  </group>;
}

function Meadow({ clock, natural, quality }: { clock: Clock; natural: Clock; quality: Quality }) {
  const grass = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const count = quality === "high" ? 8000 : 2400;
  const bladeGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 4);
    const positions = geometry.attributes.position!;
    for (let i = 0; i < positions.count; i++) {
      const height = positions.getY(i) + .5;
      positions.setX(i, positions.getX(i) * (1 - height * .95) + height * height * .3);
    }
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useEffect(() => () => bladeGeometry.dispose(), [bladeGeometry]);
  const blades = useMemo(() => Array.from({ length: count }, (_, i) => {
    const random = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    return { x: random(i + 1) * 26 - 13, z: random(i + 7000) * 24 - 12, h: .13 + random(i + 9000) * .38, a: random(i + 3000) * Math.PI };
  }), [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!grass.current || !material.current) return;
    grass.current.visible = natural.current > .005;
    material.current.opacity = natural.current;
    blades.forEach((b, i) => {
      const x = ((b.x - clock.current * 4.8 + 13000) % 26) - 13;
      const lane = Math.abs(b.z) < .8 ? .22 : 1;
      dummy.position.set(x, b.h * lane * .5 - .035, b.z);
      dummy.rotation.set(.12 * Math.sin(clock.current * 2 + b.x), b.a, .15 * Math.sin(clock.current * 1.8 + b.z));
      dummy.scale.set(.07, b.h * lane, 1);
      dummy.updateMatrix();
      grass.current!.setMatrixAt(i, dummy.matrix);
      grass.current!.setColorAt(i, new THREE.Color().setHSL(.22 + (i % 9) * .009, .48, .19 + (i % 7) * .035));
    });
    grass.current.instanceMatrix.needsUpdate = true;
    if (grass.current.instanceColor) grass.current.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={grass} args={[bladeGeometry, undefined, count]} frustumCulled={false}><meshStandardMaterial ref={material} side={THREE.DoubleSide} transparent alphaTest={.02} roughness={.9} /></instancedMesh>;
}

const FLOOR_FRAGMENT = `
uniform float natural; uniform float time; varying vec2 p;
void main(){
 vec2 q=p+vec2(time*4.8,0.);
 vec2 cell=abs(fract(q)-.5); vec2 aa=fwidth(q);
 float line=1.-min(smoothstep(.012,.012+aa.x,cell.x),smoothstep(.012,.012+aa.y,cell.y));
 float noise=.5+.25*sin(q.x*2.1+sin(q.y*1.3))+.25*cos(q.y*2.7+sin(q.x));
 vec3 meadow=mix(vec3(.06,.085,.025),vec3(.12,.16,.05),noise);
 meadow=mix(meadow,vec3(.39,.45,.33),smoothstep(10.,34.,length(p)));
 float halo=exp(-length(p)*.08);
 vec3 lab=vec3(.003,.008,.019)+vec3(.015,.28,.8)*line*halo;
 gl_FragColor=vec4(mix(lab,meadow,natural),1.);
}`;

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
    <group renderOrder={80}>
      <DetailedHeart clock={clock} focus={cinematicFocus} heartRate={visual.heartRateBpm} reduced={reduced} />
    </group>
    <mesh ref={scan} position={[0, .85, 0]}><torusGeometry args={[1.05, .012, 8, 80]} /><meshBasicMaterial color="#61dfff" transparent depthWrite={false} toneMapped={false} /></mesh>
    {body && <ContactShadows position={[0, -.025, 0]} opacity={.45} scale={15} blur={2.5} far={2.5} resolution={256} frames={1} />}
  </>;
}

export default function CinematicHero({ animal, reduced, quality }: { animal: AnimalBundle; reduced: boolean; quality: Quality }) {
  // Keep one visual profile for the whole hero. Adaptive quality can change between
  // frames on different GPUs; letting it toggle here makes bloom and rat shading pop.
  const stableQuality = useRef<Quality>(quality).current;
  const clock = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [stage, setStage] = useState(0);
  const [shot, setShot] = useState(-1);
  const [route, setRoute] = useState<StoryRoute | null>(null);
  const visual = useMemo(() => ratVisualState(animal, 0), [animal]);
  const rates = [Math.round(visual.heartRateBpm), 12, Math.round(visual.respirationBpm)];
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const chooseRoute = (next: StoryRoute) => {
    const selected = ROUTES.find((item) => item.id === next)!;
    clock.current = selected.start;
    setRoute(next);
    setStage(1);
    setPlaying(true);
  };
  return <div className="cinematic-hero" data-testid="cinematic-hero" data-stage={stage}>
    <Canvas frameloop={playing && visible ? "always" : "demand"} camera={{ position: [3, 3, 10], fov: 40, near: .05, far: 110 }} dpr={[1, stableQuality === "high" ? 1.5 : 1]} gl={{ antialias: true, powerPreference: "high-performance" }} style={{ touchAction: "pan-y" }}>
      <Scene animal={animal} clock={clock} playing={playing && visible} reduced={reduced} quality={stableQuality} onStage={setStage} onShot={setShot} onReady={() => setReady(true)} />
      {stableQuality === "high" && <EffectComposer multisampling={0}><Bloom intensity={.4} luminanceThreshold={.85} luminanceSmoothing={.25} mipmapBlur /></EffectComposer>}
    </Canvas>
    <div className="cinematic-top"><span>VAST / LIVING SYSTEMS</span><span>0{stage + 1} — 03</span></div>
    {!ready && <div className="cinematic-loading" role="status">Growing a little world…</div>}
    {!route && ready && <div className="cinematic-route-layer" aria-label="Choose a biological route">
      <div className="cinematic-route-card">
        <span className="eyebrow">A living system, one path at a time</span>
        <h2>What do you want to follow?</h2>
        <p>Choose one signal and let the camera carry you inside.</p>
        <div className="cinematic-route-options">
          {ROUTES.map((item) => <button key={item.id} type="button" onClick={() => chooseRoute(item.id)}>
            <strong>{item.label}</strong><small>{item.note}</small><span aria-hidden="true">↗</span>
          </button>)}
        </div>
      </div>
    </div>}
    <div className="cinematic-caption" data-organ={shot >= 0 ? ORGAN_TOUR[shot]!.name : undefined}><p>{shot >= 0 ? ORGAN_TOUR[shot]!.name : TITLES[stage]}</p><span>{shot >= 0 ? ORGAN_TOUR[shot]!.function : DESCRIPTIONS[stage]}</span>{shot >= 0 && <div className="cinematic-rate"><strong>{rates[shot]}</strong> {ORGAN_TOUR[shot]!.unit}<small>{shot === 1 ? "Illustrative animation rate" : "Simulated baseline · animation stylized"}</small></div>}</div>
    <div className="cinematic-controls" role="group" aria-label="Cinematic rat views">
      {["Meadow", "Organs", "Nerves"].map((label, i) => <button key={label} aria-pressed={stage === i} onClick={() => { clock.current = HERO_STARTS[i]!; setStage(i); }}>{label}</button>)}
      {!reduced && <button onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause cinematic scene" : "Play cinematic scene"}>{playing ? "Pause" : "Play"}</button>}
    </div>
    <small className="cinematic-note">Illustrative anatomy · simulated physiology</small>
  </div>;
}
