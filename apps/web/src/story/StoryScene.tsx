import { MolecularAura, HumanHologram, PedestalTicks, AdministrationPortal } from "./ScientificStage";
import { useEffect, useMemo, useRef } from "react";
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
  { pos: [3.2, 2.4, 9.6], target: [-0.8, 0.75, 0] },  // 9 humans (covered by the scale-up)
  { pos: [3.6, 2.2, 9.8], target: [-0.8, 0.8, 0] },   // 10 trust
  { pos: [3.6, 2.2, 9.8], target: [-0.8, 0.8, 0] },   // 11 finale
];

export interface StorySceneProps {
  /** scroll position, read every frame */
  posRef: React.MutableRefObject<StoryPos>;
  chapter: number;
  targetOrgan?: Organ;
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
      <meshBasicMaterial color="#5ff5dc" toneMapped={false} />
    </instancedMesh>
  );
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
  const root=useRef<THREE.Group>(null),phase=useRef(0),manualUntil=useRef(0),time=useRef(0);
  useFrame((_,dt)=>{time.current+=Math.min(dt,.1);const active=chapter===1||chapter===11;if(active&&!reduceMotion&&time.current>manualUntil.current)phase.current+=Math.min(dt,.1)*.35;if(root.current)root.current.rotation.y=THREE.MathUtils.damp(root.current.rotation.y,active?phase.current:0,5,Math.min(dt,.1));});
  return <group ref={root} onPointerMove={e=>{if(e.buttons===1&&(chapter===1||chapter===11)){phase.current+=e.movementX*.01;manualUntil.current=time.current+8;}}}>{children}</group>;
}

function SweepRat({ posRef, v, layers, palette, quality, chapter, exposure, tempo, reduceMotion }: {
  posRef: React.MutableRefObject<StoryPos>; v: ReturnType<typeof ratVisualState>; layers: Layers; palette: "standard" | "cb"; quality: Quality; chapter: number; exposure: Partial<Record<Organ, number>>; tempo: number; reduceMotion: boolean;
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
    sweepRef.current = c === 1 ? slice : c >= 3 ? -99 : 99;
  });
  return <group ref={entrance}>{chapter===1&&<mesh ref={scanPlane} position={[3.1,1,0]}><boxGeometry args={[.018,2.4,1.5]}/><meshBasicMaterial color="#79d7ef" transparent opacity={.15} depthWrite={false}/></mesh>}<RatModel v={v} layers={layers} surfacePhysical={true} animate={!reduceMotion} palette={palette} quality={quality} sweepRef={sweepRef} labelMode={chapter === 1 ? "names" : "grade"} exposure={exposure} tempo={tempo} /></group>;
}

/** A fixed studio backdrop: stable lighting and a subtle illuminated stage at every quality. */
function AnatomyStudio() {
  const motes=useMemo(()=>{const p=new Float32Array(180);for(let i=0;i<60;i++){p[i*3]=Math.sin(i*31.4)*8;p[i*3+1]=.3+(i%19)*.22;p[i*3+2]=Math.cos(i*14.1)*5-1;}return p;},[]);
  return <group>
    <PedestalTicks/>
    <points><bufferGeometry><bufferAttribute attach="attributes-position" array={motes} count={60} itemSize={3}/></bufferGeometry><pointsMaterial size={.018} color="#9fcbd3" transparent opacity={.2} depthWrite={false}/></points>
    <mesh position={[-.4,1.8,0]}><coneGeometry args={[4.2,3.6,48,1,true]}/><meshBasicMaterial color="#63bbcf" transparent opacity={.004} depthWrite={false} side={THREE.DoubleSide}/></mesh>
    <mesh position={[0,1,-4]}>
      <planeGeometry args={[40,24]}/>
      <shaderMaterial depthWrite={false} vertexShader="varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader="varying vec2 vUv; void main(){vec2 p=(vUv-.5)*vec2(2.,1.); float halo=exp(-dot(p,p)*14.); gl_FragColor=vec4(mix(vec3(.008,.018,.035),vec3(.025,.15,.20),halo),1.);}"/>
    </mesh>
    {[3.8,4.2].map((r,i)=><mesh key={r} rotation={[-Math.PI/2,0,0]} position={[-.4,-.035-i*.005,0]}><ringGeometry args={[r,r+.012,128]}/><meshBasicMaterial color={i===0?'#4fc9d9':'#38738c'} transparent opacity={i===0?.35:.16} depthWrite={false}/></mesh>)}
    <mesh position={[-.4,-.16,0]}><cylinderGeometry args={[4.3,4.4,.22,96]}/><meshStandardMaterial color="#183242" metalness={.35} roughness={.8}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[-.4,-.038,0]}><planeGeometry args={[32,32]}/><shaderMaterial transparent depthWrite={false} vertexShader="varying vec2 uvp;void main(){uvp=uv*32.-16.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader="varying vec2 uvp;void main(){vec2 edge=abs(fract(uvp)-.5);float grid=1.-smoothstep(.005,.025,min(edge.x,edge.y));float fade=exp(-length(uvp)*.2);gl_FragColor=vec4(.18,.45,.55,grid*fade*.14);}"/></mesh>
    <pointLight position={[-2,2,-2]} color="#75e3e9" intensity={1.5} distance={9}/>
  </group>;
}

export function StoryScene(p: StorySceneProps) {
  const momentBundle = p.moment?.who === "untreated" ? p.untreated : p.treated;
  const bundle = p.chapter === 5 && p.moment ? momentBundle : p.treated;
  const day = p.chapter === 5 && p.moment ? p.moment.day : p.chapter === 4 ? p.day : p.chapter >= 3 ? 0 : 0;
  const v = useMemo(() => (bundle ? ratVisualState(bundle, day) : null), [bundle, day]);
  const layers: Layers = { ...DEFAULT_LAYERS, xray: p.chapter >= 3 && p.chapter <= 5, labels: (p.chapter === 1 && p.posRef.current.progress > .28) || p.chapter === 4, vessels: p.chapter >= 1, tumor: p.chapter >= 4 && p.chapter <= 6 };
  const split = p.chapter === 6 && p.treated && p.untreated;
  const tempo = p.chapter === 5 ? 0.25 : 1;
  const background = "#07121e";
  return (
    <Canvas onCreated={fastShaders} frameloop={p.paused ? "demand" : "always"} camera={{ position: SHOTS[0]!.pos, fov: 34, near: 0.05, far: 100 }} dpr={p.quality === "high" ? [1, 2] : [1, 1.25]} gl={{ antialias: true, powerPreference: "high-performance" }} style={{ touchAction: "pan-y" }}>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, 12, 26]} />
      <hemisphereLight args={["#dfefff", "#2a2420", 0.55]} />
      <directionalLight position={[4, 7, 5]} intensity={1.6} color="#fff6ea" />
      <directionalLight position={[-6, 3, -4]} intensity={1.0} color="#9fe8ff" />
      <Environment resolution={p.quality === "high" ? 256 : 64}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 3]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-6, 2, -3]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#bff3ff" />
      </Environment>
      <AnatomyStudio />
      {p.chapter === 2 && <MolecularAura />}
      {p.chapter === 9 && <HumanHologram />}
      {p.chapter === 3 && <AdministrationPortal />}
      <CameraChoreo posRef={p.posRef} reduceMotion={p.reduceMotion} />
      {split && p.treated && p.untreated && <TwinRats splitRef={p.splitRef} treated={p.treated} untreated={p.untreated} day={p.twinDay} palette={p.palette} quality={p.quality} />}
      {v && !split && (
        <group position={p.chapter===9?[-2,0,0]:[0,0,0]} scale={p.chapter===9?.55:1}><Turntable chapter={p.chapter} reduceMotion={p.reduceMotion}>
          <SweepRat posRef={p.posRef} v={v} layers={layers} palette={p.palette} quality={p.quality} chapter={p.chapter} exposure={p.chapter === 3 ? p.exposure : p.chapter === 2 && p.targetOrgan ? {[p.targetOrgan]:.65} : {}} tempo={tempo} reduceMotion={p.reduceMotion} />
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
    </Canvas>
  );
}
