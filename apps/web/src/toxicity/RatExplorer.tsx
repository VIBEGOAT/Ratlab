import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { AnimalBundle, Organ } from "@eliminate/sim-core";
import { useStore } from "../store";
import { useReducedMotion } from "../lib/motion";
import { ORGAN_LABEL } from "../lib/setup";
import { SceneBoundary, softwareGraphics, webglAvailable } from "../three/webgl";
import { OrganMap } from "./OrganMap";
import type { Experiment } from "./experiment";

const RatViewport = lazy(() => import("./RatViewport"));

export function RatExplorer({ experiment, animal, day, selected, onSelect }: {
  experiment: Experiment; animal: AnimalBundle; day: number; selected: Organ; onSelect: (organ: Organ) => void;
}) {
  const [view, setView] = useState<"3d" | "map">(() => webglAvailable() && !softwareGraphics() ? "3d" : "map");
  const [inside, setInside] = useState(false);
  const [motion, setMotion] = useState(true);
  const [angle, setAngle] = useState(0.2);
  const [focus, setFocus] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [touch] = useState(() => matchMedia("(pointer: coarse)").matches);
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const cb = useStore((s) => s.cbPalette);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => { setFailed(true); setView("map"); }, []);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let visible = true;
    const update = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry!.isIntersecting; update(); });
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  const fallback = <OrganMap experiment={experiment} animal={animal} day={day} selected={selected} onSelect={onSelect} />;
  return <div className="rat-explorer" ref={root}>
    <div className="rat-toolbar"><span className="rat-model-label"><i />Virtual rat <span>· Day {day}</span></span>
      <div className="rat-view-switch" role="group" aria-label="Rat display">
        <button aria-pressed={view === "3d"} disabled={failed} onClick={() => { if (webglAvailable()) { setReady(false); setView("3d"); } else onFailure(); }}>3D</button>
        <button aria-pressed={view === "map"} onClick={() => setView("map")}>Organ map</button>
      </div>
    </div>
    <div className="rat-stage" data-testid="rat-stage" data-view={view}>
      <div className="rat-stage-halo" aria-hidden="true" />
      {view === "3d" ? <SceneBoundary fallback={fallback} onError={onFailure}><Suspense fallback={<div className="rat-starting" role="status">Preparing your virtual rat…</div>}>
        <RatViewport animal={animal} day={day} selected={selected} inside={inside} animate={motion && !reduce} active={active}
          angle={angle} focus={focus} resetKey={resetKey} palette={cb ? "cb" : "standard"} onSelect={onSelect} onReady={onReady} onFailure={onFailure} />
      </Suspense></SceneBoundary> : fallback}
      <div className="rat-stage-foot"><span>{view === "3d" ? ready ? inside ? touch ? "Tap an organ · use arrows to rotate" : "Drag to rotate · select an organ" : touch ? "Use arrows to meet the virtual rat" : "Drag to rotate · choose Inside to explore" : "Loading the 3D model" : "Tap a highlighted organ to explore"}</span><span>Illustrative anatomy</span></div>
    </div>
    {failed && <p className="small muted" role="status">3D is unavailable on this device. The interactive organ map shows the same results.</p>}
    {view === "3d" && <div className="rat-controls">
      <div className="rat-view-switch" role="group" aria-label="Anatomy layers">
        <button aria-pressed={!inside} onClick={() => setInside(false)}>Surface</button>
        <button aria-pressed={inside} onClick={() => setInside(true)}>Inside</button>
      </div>
      <div className="rat-camera-controls">
        <button onClick={() => setAngle((a) => a - Math.PI / 4)} aria-label="Rotate rat left">↶</button>
        <button onClick={() => { setAngle(0.2); setFocus(false); setResetKey((key) => key + 1); }}>Reset view</button>
        <button onClick={() => setAngle((a) => a + Math.PI / 4)} aria-label="Rotate rat right">↷</button>
        {inside && <button aria-pressed={focus} onClick={() => setFocus(!focus)}>Focus {ORGAN_LABEL[selected]}</button>}
        {!reduce && <button aria-pressed={motion} onClick={() => setMotion(!motion)}>{motion ? "Pause motion" : "Resume motion"}</button>}
      </div>
    </div>}
  </div>;
}
