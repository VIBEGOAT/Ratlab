import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Organ } from '@eliminate/sim-core';
import { DEFAULT_LAYERS, RatModel } from '../three/RatModel';
import type { RatVisualState } from '../three/ratState';
import { useBodyGeometry } from '../three/bodyGeometry';
import { ORGAN_SHAPES } from '../three/anatomy';
import { SceneBoundary, webglAvailable } from '../three/webgl';
import { Meadow, Signals, FLOOR_FRAGMENT } from './LivingEnvironment';
import { clamp, journeyState } from './journey';

type View = 'auto' | 'surface' | 'organs' | 'nerves';
export interface JourneyRatProps {
  progress: number; reduced: boolean; dose: number; target: string; response: number;
  selected: string; onSelect: (name: string) => void; pathPoint: { x: number; y: number; angle: number };
}
const ORGAN_IDS: Record<string, Organ> = { Brain: 'brain', Heart: 'heart', Liver: 'liver', Kidneys: 'kidney', Gut: 'gut' };
const ORGAN_NAMES: Record<Organ, string> = { brain: 'Brain', heart: 'Heart', liver: 'Liver', kidney: 'Kidneys', gut: 'Gut', marrow: 'Marrow' };

function LivingRat({ progress, reduced, dose, target, response, selected, onSelect, pathPoint, view, onReady }: JourneyRatProps & { view: View; onReady: () => void }) {
  const { chapter, local, pose } = journeyState(progress);
  const body = useBodyGeometry();
  const { invalidate, gl, scene, camera } = useThree();
  const time = useRef(0), natural = useRef(1), organs = useRef(0), nerves = useRef(0), sweep = useRef(99);
  const root = useRef<THREE.Group>(null), floor = useRef<THREE.ShaderMaterial>(null);
  const focus = useRef<string | null>(null);
  const visual = useMemo((): RatVisualState => {
    const organState = Object.fromEntries(Object.values(ORGAN_IDS).concat('marrow').map(o => [o, { damage: o === ORGAN_IDS[target] ? response : 0, grade: 0 as const, severity: 'Illustrative', finding: 'Fictional teaching response, not a pathology grade' }])) as RatVisualState['organs'];
    return { day: 0, organs: organState, size: 1, wasting: 0, jaundice: 0, piloerection: 0, hunch: 0, tremor: 0, convulsion: 0, ataxia: 0, tears: 0, cataract: 0, dehydration: 0, lethargy: 0, grimace: 0, tumorRadius: 0, heartRateBpm: 360, respirationBpm: 85, activity: 1 };
  }, [target, response]);
  const uniforms = useMemo(() => ({ natural: { value: 1 }, time: { value: 0 } }), []);
  useEffect(() => { invalidate(); }, [progress, reduced, dose, selected, response, view, body, invalidate]);
  useEffect(() => {
    if (!body) return;
    let live = true;
    void gl.compileAsync(scene, camera).then(() => { if (live) { invalidate(); onReady(); } });
    return () => { live = false; };
  }, [body, gl, scene, camera, invalidate, onReady]);
  // Runs only when input/scroll invalidates the demand-rendered canvas. No independent clock.
  useFrame(({ camera, size, scene }) => {
    time.current = reduced ? chapter * 3 : progress * 48;
    const anatomy = view === 'auto' ? chapter >= 2 && chapter <= 4 : view !== 'surface';
    const blend = anatomy ? (view === 'auto' && chapter === 2 ? clamp(local / .3) : 1) : 0;
    natural.current = 1 - blend;
    nerves.current = view === 'nerves' ? 1 : 0;
    organs.current = view === 'nerves' ? .08 : blend;
    sweep.current = blend === 0 ? 99 : blend === 1 ? -99 : 3.3 - blend * 5.3;
    const offset = (pathPoint.x - 365) / 160;
    if (root.current) {
      root.current.position.set(offset, reduced || pose !== 'walk' ? 0 : Math.abs(Math.sin(time.current * 8)) * .045, 0);
      root.current.rotation.y = reduced ? 0 : -pathPoint.angle * Math.PI / 720;
    }
    const chosen = ORGAN_IDS[selected] ?? 'liver';
    const close = view === 'auto' && chapter === 3 && !reduced ? Math.sin(clamp((local - .35) / .65) * Math.PI) * .82 : 0;
    focus.current = close > .3 ? chosen : null;
    const angle = reduced ? .28 : .18 + Math.sin(progress * Math.PI * 2) * .38;
    const aspect = size.width / Math.max(1, size.height);
    const distance = Math.max(5.8, 12.5 / Math.max(.3, aspect));
    const look = new THREE.Vector3(offset - .65, .75, 0);
    const position = new THREE.Vector3(offset - .65 + Math.sin(angle) * distance, 2.25, Math.cos(angle) * distance);
    const shape = chosen === 'gut' ? 'stomach' : chosen === 'marrow' ? 'liver' : chosen;
    const organ = new THREE.Vector3(...ORGAN_SHAPES[shape][0]!.center).add(new THREE.Vector3(offset, 0, 0));
    look.lerp(organ, close);
    position.lerp(organ.clone().add(new THREE.Vector3(.4, .45, 2.1)), close);
    camera.position.copy(position); camera.lookAt(look);
    scene.background = new THREE.Color('#020915').lerp(new THREE.Color('#637254'), natural.current);
    if (floor.current) { floor.current.uniforms.natural!.value = natural.current; floor.current.uniforms.time!.value = time.current; }
  }, -1);
  return <>
    <hemisphereLight args={['#fff8ec', '#23382f', 1.9]} />
    <directionalLight position={[3, 6, 4]} intensity={2.8} color="#fff1df" />
    <directionalLight position={[-4, 3, -4]} intensity={1.8} color="#97c8ff" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.045, 0]}><planeGeometry args={[80, 80]} /><shaderMaterial ref={floor} uniforms={uniforms} vertexShader="varying vec2 p; void main(){p=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}" fragmentShader={FLOOR_FRAGMENT} /></mesh>
    <Meadow clock={time} natural={natural} quality="low" />
    <group ref={root} visible={!!body}>
      <RatModel v={visual} layers={{ ...DEFAULT_LAYERS, labels: false, tumor: false, marrow: false, xray: false }} animationTime={time} animate={false} quality="high" gaitSpeed={2.8} walk={reduced || pose !== 'walk' ? 0 : 2.8} sweepRef={sweep} organOpacity={organs} cinematicFocus={focus} selected={chapter === 3 ? ORGAN_IDS[selected] : null} onSelect={o => onSelect(ORGAN_NAMES[o])} exposure={chapter === 2 ? { liver: dose / 220, kidney: dose / 300, heart: dose / 350, gut: dose / 200 } : {}} />
      <Signals clock={time} opacity={nerves} />
    </group>
  </>;
}

export default function JourneyRat3D(props: JourneyRatProps) {
  const [available] = useState(webglAvailable);
  const [view, setView] = useState<View>('auto');
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const chapter = journeyState(props.progress).chapter;
  const fallback = <div className="rat3d-loading" role="status">3D graphics are unavailable in this browser. The dose and organ controls remain usable.</div>;
  return <div className="journey-rat3d" data-testid="journey-rat" data-ready={ready} data-pose={props.reduced ? 'pause' : journeyState(props.progress).pose} data-x={props.pathPoint.x.toFixed(3)} data-y={props.pathPoint.y.toFixed(3)} data-time={props.reduced ? chapter * 3 : props.progress * 48} data-view={view}>
    {available ? <SceneBoundary fallback={fallback}>
      <div className="rat3d-canvas" style={{ opacity: ready ? 1 : 0 }}>
        <Canvas frameloop="demand" camera={{ position: [1, 2.5, 10], fov: 40, near: .05, far: 100 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }} style={{ touchAction: 'pan-y' }}>
          <LivingRat {...props} view={view} onReady={onReady} />
        </Canvas>
      </div>
      {!ready && <div className="rat3d-loading" role="status"><span>Preparing your virtual lab rat</span><small>Loading anatomy and fur…</small></div>}
    </SceneBoundary> : fallback}
    <div className="rat3d-controls" role="group" aria-label="Virtual rat layers">{(['auto', 'surface', 'organs', 'nerves'] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v === 'auto' ? 'Follow story' : v === 'surface' ? 'Whole rat' : v === 'organs' ? 'Organs' : 'Nerves'}</button>)}</div>
  </div>;
}
