import { EditorialStudio } from "./EditorialStudio";
import { OralAdministration, OrganBridge, BehaviorEntry, type BridgeOrgan } from "./StoryDetails";
import CinematicHero from "./CinematicHero";
import { OpenField } from "../three/ArenaScene";
import { MolecularAura, HumanHologram } from "./ScientificStage";
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
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
  { pos: [1.2, 3.0, 11.0], target: [0, 1.4, 0] },         // 9 translation
  { pos: [3.6, 2.2, 9.8], target: [-0.8, 0.8, 0] },   // 10 trust
  { pos: [3.6, 2.2, 9.8], target: [-0.8, 0.8, 0] },   // 11 finale
];

export interface StorySceneProps {
  /** scroll position, read every frame */
  posRef: React.MutableRefObject<StoryPos>;
  chapter: number;
  targetOrgan?: Organ;
  bridgeOrgan?: BridgeOrgan;
  doseReplay?:number;
  onBridgeOrgan?: (organ:BridgeOrgan)=>void;
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
  const position=useMemo(()=>new THREE.Vector3(),[]),look=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((state, dt) => {
    const { chapter, progress } = posRef.current;
    const shot = SHOTS[Math.min(chapter, SHOTS.length - 1)]!;
    const p = position.set(...shot.pos);
    const tg = look.set(...shot.target);
    if (chapter <= 1) {
      const reveal = reduceMotion ? .6 : THREE.MathUtils.smoothstep(chapter === 0 ? 0 : progress, 0, .7);
      p.set(2.1 - reveal * 1.5, 2.4 - reveal * .65, 10 - reveal * 1.2);
      tg.set(-.55,.8,0);
    }
    if (chapter === 4) { const a = 0.55 + progress * 0.9; p.set(Math.sin(a) * 8.6 - 0.4, 2.6, Math.cos(a) * 8.6); }
    if (chapter === 5) p.multiplyScalar(1 + progress * 0.12);
    // the rat is long and low: on narrow or square stages, back off so the whole body stays in frame
    const fit = Math.max(1, 1.45 / Math.max(0.3, size.width / Math.max(1, size.height)));
    p.sub(tg).multiplyScalar(fit).add(tg);
    const k = reduceMotion ? 1 : 1 - Math.pow(.92,Math.min(dt,.1)*60);
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
    const pts: Vec3[] = [ORGAN_SHAPES.stomach[0]!.center, ...gut, ...portal, ORGAN_SHAPES.liver[0]!.center, [0.6, 0.95, -0.03], ...vena.slice(3), ORGAN_SHAPES.heart[0]!.center, [1.15,1.05,-.25], [1,1.2,.25], ORGAN_SHAPES.heart[0]!.center, ...aorta.slice(0, 4), [-0.22, 1.08, 0.2]];
    return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const m = inst.current;
    if (!m) return;
    m.visible=visible; if(!visible)return;
    const level = plasmaRef.current;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < N; i++) {
      const on = i / N < Math.max(0.05, level);
      const u = (i / N + t * 0.08) % 1;
      curve.getPointAt(u,dummy.position);
      const fade=Math.sin(u*Math.PI);
      dummy.scale.setScalar(on ? .026*fade*fade : .0001);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={inst} args={[undefined, undefined, N]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color="#e8a855" toneMapped={false} />
    </instancedMesh>
  );
}

/** Independent viewports preserve the whole silhouette on both sides of the divider. */
function SplitRenderer({ splitRef, a, b }: { splitRef: React.MutableRefObject<number>; a: React.RefObject<THREE.Group>; b: React.RefObject<THREE.Group> }) {
  const camera = useMemo(() => new THREE.PerspectiveCamera(36, 1, .05, 450), []);
  useFrame(({ gl, scene, size }) => {
    if (!a.current || !b.current) return;
    const divider = Math.round(size.width * splitRef.current);
    const renderHalf = (x: number, width: number, control: boolean) => {
      a.current!.visible = control; b.current!.visible = !control;
      camera.aspect = width / size.height;
      const distance = Math.max(8.6, 4.4 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
      camera.position.set(.2, .8 + distance * .1, distance);
      camera.lookAt(-.65, .8, 0);
      camera.updateProjectionMatrix();
      gl.setViewport(x, 0, width, size.height);
      gl.setScissor(x, 0, width, size.height);
      gl.render(scene, camera);
    };
    gl.setScissorTest(true);
    renderHalf(0, divider, true);
    renderHalf(divider, size.width - divider, false);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    a.current.visible = true; b.current.visible = false;
  }, 1);
  return null;
}

function TwinPulse({ color, clock, amount = 1 }: { color: string; clock: React.MutableRefObject<number>; amount?: number }) {
  const points = useRef<THREE.InstancedMesh>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(VESSELS.find(v=>v.id==='aorta')!.path.map(p=>new THREE.Vector3(...p))), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!points.current) return;
    for (let i=0;i<24;i++) { const phase=(i/24+clock.current*.18)%1; curve.getPointAt(phase,dummy.position);dummy.scale.setScalar(.012*amount*Math.sin(phase*Math.PI));dummy.updateMatrix();points.current.setMatrixAt(i,dummy.matrix); }
    points.current.instanceMatrix.needsUpdate=true;
  });
  return <instancedMesh ref={points} args={[undefined,undefined,24]} frustumCulled={false}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color={color}/></instancedMesh>;
}

function TwinRats({ splitRef, treated, untreated, day, palette, quality, target, reduced }: { splitRef: React.MutableRefObject<number>; treated: AnimalBundle; untreated: AnimalBundle; day: number; palette: "standard" | "cb"; quality: Quality; target: Organ; reduced: boolean }) {
  const a = useRef<THREE.Group>(null), b = useRef<THREE.Group>(null), time = useRef(0);
  const vt = useMemo(() => ratVisualState(treated, day), [treated, day]);
  const vu = useMemo(() => ratVisualState(untreated, day), [untreated, day]);
  useFrame((_,delta)=>{if(!reduced)time.current+=Math.min(delta,.05);});
  return <>
    <group ref={a} name="untreated-twin"><RatModel v={vu} layers={{...DEFAULT_LAYERS,xray:false,labels:false}} animationClock={time} animate={!reduced} physiologyTiming palette={palette} quality={quality} highlightColor="#78c679"/><TwinPulse color="#78c679" clock={time}/></group>
    <group ref={b} name="dosed-twin" visible={false}><RatModel v={vt} layers={{...DEFAULT_LAYERS,xray:true,skeleton:true,labels:false}} cutaway selected={target} exposure={{[target]:.75}} animationClock={time} animate={!reduced} physiologyTiming palette={palette} quality={quality} highlightColor="#e05a47"/><TwinPulse color="#e05a47" clock={time} amount={1.7}/></group>
    <SplitRenderer splitRef={splitRef} a={a} b={b}/>
  </>;
}

function Turntable({ chapter, reduceMotion, children, posRef }: { chapter: number; reduceMotion: boolean; children: React.ReactNode; posRef: React.MutableRefObject<StoryPos> }) {
  const root=useRef<THREE.Group>(null),phase=useRef(0),manualUntil=useRef(0),time=useRef(0);
  useFrame((_,dt)=>{
    const delta=Math.min(dt,.1);time.current+=delta;
    const active=chapter===1||chapter===11;
    if(active&&!reduceMotion&&time.current>manualUntil.current)phase.current=(phase.current+delta*.15)%(Math.PI*2);
    const target=chapter===2?posRef.current.progress*Math.PI*2:active?phase.current:0;
    if(root.current){const current=root.current.rotation.y;const shortest=current+Math.atan2(Math.sin(target-current),Math.cos(target-current));const damped=THREE.MathUtils.damp(current,shortest,4,delta);root.current.rotation.y=current+THREE.MathUtils.clamp(damped-current,-1.2*delta,1.2*delta);}
  });
  return <group ref={root} onPointerMove={e=>{if(e.buttons===1&&(chapter===1||chapter===11)){phase.current+=e.movementX*.01;manualUntil.current=time.current+8;}}}>{children}</group>;
}

function SweepRat({ posRef, v, layers, palette, quality, chapter, exposure, tempo, reduceMotion, onSelect, selected, onLungSelect }: {
  posRef: React.MutableRefObject<StoryPos>; v: ReturnType<typeof ratVisualState>; layers: Layers; palette: "standard" | "cb"; quality: Quality; chapter: number; exposure: Partial<Record<Organ, number>>; tempo: number; reduceMotion: boolean; onSelect?: (organ:Organ)=>void; selected?: Organ; onLungSelect?:()=>void;
}) {
  // fur below the sweep line, X-ray above it; the line runs head to tail as the reader scrolls chapter 1
  const sweepRef = useRef(99);
  const scanTime=useRef(0);
  const entrance = useRef<THREE.Group>(null);
  const scanPlane=useRef<THREE.Mesh>(null);
  useFrame((_,dt) => {
    if(!reduceMotion) scanTime.current+=Math.min(dt,.1);
    const slice=.55+2.6*Math.cos(scanTime.current*.5);
    if(scanPlane.current)scanPlane.current.position.x=slice;
    const { chapter: c, progress } = posRef.current;
    const reveal = THREE.MathUtils.smoothstep(progress, 0, .7);
    if (entrance.current) { entrance.current.scale.setScalar(c === 1 ? .94 + .06 * reveal : 1); entrance.current.position.y = c === 1 ? .1 * (1-reveal) : 0; }
    sweepRef.current = c === 1 ? slice : c >= 2 ? -99 : 99;
  });
  return <group ref={entrance}>{chapter===1&&<mesh ref={scanPlane} position={[3.1,1,0]}><boxGeometry args={[.018,2.4,1.5]}/><meshBasicMaterial color="#e8a855" transparent opacity={.15} depthWrite={false}/></mesh>}<RatModel v={v} layers={layers} surfacePhysical={true} onLungSelect={onLungSelect} onSelect={onSelect} selected={selected??null} animate={!reduceMotion} palette={palette} quality={quality} sweepRef={sweepRef} labelMode={chapter === 1 ? "names" : "grade"} exposure={exposure} tempo={tempo} /></group>;
}

function StudioContent(p: StorySceneProps) {
  const momentBundle = p.moment?.who === "untreated" ? p.untreated : p.treated;
  const bundle = p.chapter === 5 && p.moment ? momentBundle : p.treated;
  const day = p.chapter === 5 && p.moment ? p.moment.day : p.chapter === 4 ? p.day : p.chapter >= 3 ? 0 : 0;
  const v = useMemo(() => (bundle ? ratVisualState(bundle, day) : null), [bundle, day]);
  const layers: Layers = { ...DEFAULT_LAYERS, xray: p.chapter >= 2 && p.chapter <= 5, labels: p.chapter===2 || (p.chapter === 1 && p.posRef.current.progress > .28) || p.chapter === 4, vessels: p.chapter >= 1, tumor: p.chapter >= 4 && p.chapter <= 6 };
  const split = p.chapter === 6 && p.treated && p.untreated;
  const tempo = p.chapter === 5 ? 0.25 : 1;
  const background = "#0b0a09";
  return (
    <>
      <color attach="background" args={[background]} />
      {!split && <fog attach="fog" args={[background, 12, 26]} />}
      <hemisphereLight args={["#f4f0ea", "#2a2420", 0.55]} />
      <directionalLight position={[4, 7, 5]} intensity={1.6} color="#fff6ea" />
      <directionalLight position={[-6, 3, -4]} intensity={1.0} color="#e8a855" />
      <Environment resolution={p.quality === "high" ? 256 : 64}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 3]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-6, 2, -3]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#e9dfca" />
      </Environment>
      <EditorialStudio chapter={p.chapter} neural={p.targetOrgan === "brain" && p.chapter === 2} />
      {p.chapter === 2 && <MolecularAura />}
      {p.chapter === 9 && <><HumanHologram selected={p.bridgeOrgan} onSelect={p.onBridgeOrgan}/><OrganBridge organ={p.bridgeOrgan??"heart"}/></>}
      {p.chapter === 3 && <OralAdministration key={p.doseReplay}/>}
      <CameraChoreo posRef={p.posRef} reduceMotion={p.reduceMotion} />
      {split && p.treated && p.untreated && <TwinRats splitRef={p.splitRef} treated={p.treated} untreated={p.untreated} day={p.twinDay} palette={p.palette} quality={p.quality} target={p.targetOrgan??"heart"} reduced={p.reduceMotion} />}
      {v && !split && p.chapter!==7 && (
        <group position={p.chapter===9?[-2,0,0]:[0,0,0]} scale={p.chapter===9?.55:1}><Turntable chapter={p.chapter} reduceMotion={p.reduceMotion} posRef={p.posRef}>
          <SweepRat posRef={p.posRef} v={v} layers={layers} palette={p.palette} quality={p.quality} chapter={p.chapter} exposure={p.chapter === 3 ? p.exposure : p.chapter === 2 && p.targetOrgan ? {[p.targetOrgan]:.65} : {}} tempo={tempo} reduceMotion={p.reduceMotion} onLungSelect={p.chapter===9?()=>p.onBridgeOrgan?.("lungs"):undefined} selected={p.chapter===9&&p.bridgeOrgan!=="lungs"?p.bridgeOrgan:p.targetOrgan} onSelect={p.chapter===9?o=>{if(o!=="gut"&&o!=="marrow")p.onBridgeOrgan?.(o);}:undefined} />
          <DoseFlow plasmaRef={p.plasmaRef} visible={p.chapter === 3} />

        </Turntable></group>
      )}
      <ContactShadows position={[-0.4, 0.002, 0]} opacity={0.6} scale={16} blur={2.6} far={2.5} resolution={p.quality === "high" ? 1024 : 256} />
      {p.quality === "high" && !split && (
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.42} luminanceThreshold={0.72} luminanceSmoothing={0.35} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.5} />
        </EffectComposer>
      )}
    </>
  );
}

function ArenaCamera(){const target=useMemo(()=>new THREE.Vector3(0,6.5,6.5),[]);useFrame(({camera},dt)=>{camera.position.lerp(target,1-Math.exp(-Math.min(dt,.05)*5));camera.lookAt(0,0,0);});return null;}
export function StoryScene(p:StorySceneProps){
 const heroClock=useRef(0);
 return <Canvas onCreated={fastShaders} camera={{position:[3,3,10],fov:40,near:.05,far:450}} dpr={[1,1.25]} gl={{antialias:true,powerPreference:"high-performance"}} style={{touchAction:"pan-y"}}>
  {p.chapter===0&&p.treated?<CinematicHero animal={p.treated} reduced={p.reduceMotion} quality={p.quality} storyExit={THREE.MathUtils.smoothstep(p.posRef.current.progress,.8,1)} embedded clockRef={heroClock}/>:p.chapter===8&&p.treated&&p.untreated?<><color attach="background" args={["#0b0a09"]}/><ambientLight intensity={.8}/><directionalLight position={[3,8,4]}/><ArenaCamera/><BehaviorEntry posRef={p.posRef} reduced={p.reduceMotion}><OpenField t={p.treated} u={p.untreated} day={p.day}/></BehaviorEntry></>:<StudioContent {...p}/>}
 </Canvas>;
}
