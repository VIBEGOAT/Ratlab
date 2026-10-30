/* eslint-disable jsx-a11y/no-noninteractive-tabindex --
   The animals-spared figure is focusable so its assumptions (a tooltip) are available to keyboard users. */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { tween, useReducedMotion } from "../lib/motion";
import Lenis from "lenis";
import { lenisHolder } from "../presenter/scroll";
import { useStorySound } from "../audio/useStorySound";
import { ARCHETYPES, animalsSpared, type AnimalBundle, type Organ, type TwinBundle } from "@eliminate/sim-core";
import { useStore } from "../store";
import { COMPOUNDS, ORGAN_LABEL } from "../lib/setup";
import { fmt, fmtInt, fmtPct } from "../design/format";
import { GRADE_WORD, gradeVar } from "../design/damage";
import { ratVisualState } from "../three/ratState";
import { SceneBoundary, force3d, softwareGraphics, webglAvailable } from "../three/webgl";
import { ChapterBehaviour, ChapterFinale, ChapterForecast, ChapterHuman, ChapterTrust, ChapterTwin, scaleDose } from "./chapters";
import { ForecastField, HumanScale, SplitDivider } from "./overlays";
import { useStoryScroll, type StoryPos } from "./useStoryScroll";
import { DoseDial } from "./Dial";
import type { Quality } from "../three/RatModel";

const ArenaScene = lazy(() => import("../three/ArenaScene").then((m) => ({ default: m.ArenaScene })));
const StoryScene = lazy(() => import("./StoryScene").then((m) => ({ default: m.StoryScene })));
const CinematicHero = lazy(() => import("./CinematicHero"));

/** Conservative example assumptions. Shown on hover and editable in the Pitch view. */
export const SPARED_ASSUMPTIONS = { studiesPerYear: 20, treatedGroups: 3, animalsPerGroup: 20, screenedOutShare: 0.2, virtualControlShare: 0 };
const STORY_COMPOUNDS = COMPOUNDS.filter((c) => c.key !== "reference");

export function CountUp({ to, duration = 1.6 }: { to: number; duration?: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) { setV(to); return; }
    return tween(0, to, duration, setV);
  }, [to, duration, reduce]);
  return <>{fmtInt(v)}</>;
}

/** Poster shown until the 3D scene is ready, and instead of it without WebGL. A single continuous silhouette. */
export function RatPoster() {
  return (
    <svg viewBox="0 0 640 360" role="img" aria-label="Laboratory rat, side view" style={{ width: "88%", maxWidth: 620 }}>
      <defs>
        <radialGradient id="pg" cx="45%" cy="40%" r="70%"><stop offset="0" stopColor="var(--ink)" stopOpacity="0.95" /><stop offset="1" stopColor="var(--ink)" stopOpacity="0.55" /></radialGradient>
        <linearGradient id="tail" x1="0" x2="1"><stop offset="0" stopColor="var(--ink)" stopOpacity="0.6" /><stop offset="1" stopColor="var(--ink)" stopOpacity="0.05" /></linearGradient>
      </defs>
      <path d="M150 230 C 90 236, 40 250, 8 286" stroke="url(#tail)" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path fill="url(#pg)" d="M150 228 C 140 170, 205 118, 300 116 C 360 115, 410 128, 450 150 C 470 130, 492 124, 504 134 C 512 142, 508 156, 498 164 C 530 176, 560 194, 586 214 C 600 224, 596 236, 582 238 C 560 242, 520 244, 486 248 C 470 262, 448 270, 430 270 L 436 292 C 437 300, 426 302, 422 296 L 410 270 C 360 276, 300 276, 250 270 L 246 296 C 245 304, 233 304, 232 296 L 228 266 C 190 260, 158 250, 150 228 Z" />
      <circle cx="532" cy="190" r="4.5" fill="var(--bg)" />
    </svg>
  );
}

const MARKERS: Array<{ key: string; label: string; organ: string }> = [
  { key: "alt", label: "ALT", organ: "liver" }, { key: "bilirubin", label: "Bilirubin", organ: "liver" },
  { key: "creatinine", label: "Creatinine", organ: "kidney" }, { key: "troponinI", label: "Troponin I", organ: "heart" },
];

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1.2, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${30 - (v / max) * 28}`).join(" ");
  return <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: "100%", height: 30 }} aria-hidden="true"><line x1="0" x2="100" y1={30 - (1 / max) * 28} y2={30 - (1 / max) * 28} stroke="var(--grid)" strokeDasharray="2 3" /><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>;
}

function BiomarkerRibbon({ b, day }: { b: AnimalBundle; day: number }) {
  const cp = b.clinpath[day]!;
  return (
    <div className="ribbon" role="group" aria-label={`Blood tests on day ${day}`}>
      {MARKERS.map((m) => {
        const a = cp.chemistry[m.key]!;
        const hist = b.clinpath.slice(0, day + 1).map((c) => c.chemistry[m.key]!.xUln);
        const color = a.xUln > 3 ? "var(--bad)" : a.xUln > 1 ? "var(--warn)" : "var(--good)";
        return (
          <div key={m.key} className="ribbon-item">
            <span className="eyebrow">{m.label}</span>
            <b style={{ color }}>{fmt(a.xUln, 1)}×</b>
            <span className="small muted">upper limit</span>
            <Spark values={hist} color={color} />
          </div>
        );
      })}
    </div>
  );
}

const CRITERION_SENTENCE: Record<string, string> = {
  "weight-loss": "weight loss passes the humane limit",
  grimace: "pain score passes the humane limit",
  moribund: "condition becomes moribund",
  "tumor-burden": "tumour passes the humane size limit",
  convulsions: "convulsions become severe",
};

function storyMoment(tw: TwinBundle | null): { who: "treated" | "untreated"; day: number; reason: string } | null {
  if (!tw) return null;
  const pick = (h: NonNullable<AnimalBundle["humane"]>) => h.criteria.map((c) => CRITERION_SENTENCE[c] ?? c).join(", and its ");
  if (tw.treated.humane) return { who: "treated", day: tw.treated.humane.day, reason: pick(tw.treated.humane) };
  if (tw.untreated.humane) return { who: "untreated", day: tw.untreated.humane.day, reason: pick(tw.untreated.humane) };
  return null;
}

function useThemeBackground(): string {
  const [bg, setBg] = useState("#0f1617");
  useEffect(() => {
    const read = () => setBg(getComputedStyle(document.documentElement).getPropertyValue("--surface-2").trim() || "#0f1617");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return bg;
}

export function StoryPage() {
  const reduce = !!useReducedMotion();
  const { pos, ref: posRef } = useStoryScroll();
  const goLab = useStore((s) => s.goLab);
  const study = useStore((s) => s.study);
  const runStudy = useStore((s) => s.runStudy);
  const twin = useStore((s) => s.twin.data);
  const setup = useStore((s) => s.setup);
  const setSetup = useStore((s) => s.setSetup);
  const cb = useStore((s) => s.cbPalette);
  const qualitySetting = useStore((s) => s.quality);
  // Automatic quality is fixed for the visit: changing materials mid-scroll caused visible flashes.
  const quality: Quality = qualitySetting === "auto" ? "low" : qualitySetting;
  const bg = useThemeBackground();
  const [entryPhase, setEntryPhase] = useState<"ready" | "fade" | "initialize">("ready");
  const previousChapter = useRef(0);
  useEffect(() => {
    const entering = pos.chapter === 1 && previousChapter.current === 0 && !reduce;
    previousChapter.current = pos.chapter;
    if (!entering) { setEntryPhase("ready"); return; }
    setEntryPhase("fade");
    const fade = window.setTimeout(() => setEntryPhase("initialize"), 600);
    const ready = window.setTimeout(() => setEntryPhase("ready"), 2000);
    return () => { clearTimeout(fade); clearTimeout(ready); };
  }, [pos.chapter, reduce]);
  const [glOk, setGlOk] = useState(false);
  // paint the page with the poster first, then bring the live 3D scene up when the browser is idle
  const [sceneReady, setSceneReady] = useState(false);
  const [software, setSoftware] = useState(false);
  useEffect(() => {
    let t = 0, idle = 0, live = true;
    const go = () => {
      // the first WebGL context starts the GPU process, which is slow, so even the probe waits for idle
      const start = () => {
        if (!live) return;
        const ok = webglAvailable();
        setGlOk(ok);
        if (!ok) return;
        const sw = softwareGraphics();
        setSoftware(sw);
        if (!sw) setSceneReady(true);
      };
      const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) idle = ric(start, { timeout: 2500 }); else t = window.setTimeout(start, 600);
    };
    // phones and tablets: wait for the first touch or scroll, so the first seconds go to the page itself
    const coarse = window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 760;
    const onFirstInput = () => go();
    if (coarse) {
      window.addEventListener("scroll", onFirstInput, { once: true, passive: true });
      window.addEventListener("pointerdown", onFirstInput, { once: true });
      window.addEventListener("keydown", onFirstInput, { once: true });
    } else if (document.readyState === "complete") t = window.setTimeout(go, 700); else window.addEventListener("load", () => { t = window.setTimeout(go, 700); }, { once: true });
    return () => { live = false; window.removeEventListener("scroll", onFirstInput); window.removeEventListener("pointerdown", onFirstInput); window.removeEventListener("keydown", onFirstInput); window.clearTimeout(t); if (idle) (window as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(idle); };
  }, []);
  const gl = glOk && sceneReady && !software;
  const plasmaRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef(0.5);
  const [split, setSplitState] = useState(0.5);
  const setSplit = (v: number) => { splitRef.current = v; setSplitState(v); };
  const population = useStore((s) => s.population);
  const runPopulation = useStore((s) => s.runPopulation);
  const [popMode, setPopMode] = useState<"treated" | "untreated">("treated");
  const [sorted, setSorted] = useState(true);
  const spared = animalsSpared(SPARED_ASSUMPTIONS);
  useStorySound(posRef as React.MutableRefObject<StoryPos>);

  // smooth scrolling, never under reduced motion
  useEffect(() => {
    if (reduce) return;
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
    let id = 0;
    const raf = (t: number) => { lenis.raf(t); id = requestAnimationFrame(raf); };
    id = requestAnimationFrame(raf);
    lenisHolder.current = lenis;
    return () => { cancelAnimationFrame(id); lenisHolder.current = null; lenis.destroy(); };
  }, [reduce]);

  useEffect(() => { if (study.status === "done" && pos.chapter >= 5 && population.status === "idle") void runPopulation(1000); }, [study.status, pos.chapter, population.status, runPopulation]);

  const t = twin?.treated ?? null;
  const u = twin?.untreated ?? null;
  const days = t?.days ?? setup.durationDays;
  const moment = storyMoment(twin);

  // dose day: the first dosing interval, hour by hour
  const hour = pos.chapter === 3 ? Math.min(24, Math.max(0, Math.round(((pos.progress - 0.15) / 0.8) * 24))) : 0;
  const exposure = useMemo(() => {
    const out: Partial<Record<Organ, number>> = {};
    if (!t) return out;
    const tissues: Array<[Organ, "liver" | "kidney" | "heart" | "brain" | "gut" | "marrow"]> = [["liver", "liver"], ["kidney", "kidney"], ["heart", "heart"], ["brain", "brain"], ["gut", "gut"], ["marrow", "marrow"]];
    for (const [o, tis] of tissues) { const s = t.tissue[tis].slice(0, 25); const m = Math.max(...s, 1e-9); out[o] = (s[hour] ?? 0) / m; }
    return out;
  }, [t, hour]);
  useEffect(() => {
    if (!t) return;
    const s = t.plasma.slice(0, 25);
    plasmaRef.current = (s[hour] ?? 0) / Math.max(...s, 1e-9);
  }, [t, hour]);

  const twinDay = u?.humane ? Math.min(days, u.humane.day) : days;
  const noael = study.data?.noael.noael ?? null;
  const scaled = scaleDose(noael);
  const humanP = pos.chapter === 9 ? Math.min(1, Math.max(0, (pos.progress - 0.15) / 0.6)) : pos.chapter > 9 ? 1 : 0;
  const paused = pos.chapter === 7 || pos.chapter === 8;
  const damageDay = pos.chapter === 4 ? Math.min(days, Math.round(Math.min(1, pos.progress / 0.85) * days)) : days;
  const vDay = t ? ratVisualState(t, damageDay) : null;
  const animals = study.data?.study.animals ?? [];
  const humaneCount = animals.filter((a) => a.terminalReason === "humane").length;
  const firstHumaneDay = animals.filter((a) => a.terminalReason === "humane").reduce((m, a) => Math.min(m, a.terminalDay), Infinity);
  const ref = ARCHETYPES[setup.compoundKey] ?? ARCHETYPES.cardiotoxin!;
  const mult = setup.highDose / ref.defaultDoseMgPerKg;
  const signs = vDay ? ([["Weight loss", vDay.wasting * 2], ["Hunched posture", vDay.hunch], ["Ruffled fur", vDay.piloerection], ["Jaundice", vDay.jaundice], ["Red tears", vDay.tears], ["Tremor", vDay.tremor], ["Cataract", vDay.cataract], ["Tumour", vDay.tumorRadius > 0.15 ? 1 : 0]] as Array<[string, number]>).filter(([, x]) => x > 0.2) : [];
  const momentT = pos.chapter === 5 ? pos.progress : 0;
  const dim = reduce ? (pos.chapter === 5 ? 0.86 : 0) : Math.min(0.86, Math.max(0, (momentT - 0.04) / 0.22) * 0.86);
  const showLine = (from: number) => reduce || momentT > from;

  return (
    <main className="story" id="main">
      <div className="story-hero-grid" style={{opacity:pos.chapter===0?1:0,transition:reduce?"none":"opacity .6s ease"}}><div className="story-text">          {/* 1 · hero */}
          <section data-chapter={0} className="chapter-sec hero-sec" aria-labelledby="c0">
            <div className="eyebrow">Replace · Reduce · Refine</div>
            <h1 id="c0">Every animal we spare starts with a simulation <span className="accent">we can trust.</span></h1>
            <p className="lede">A virtual laboratory rat that shows what a compound would do, before any animal is dosed.</p>
            <div className="cta">
              <button className="primary press" onClick={() => document.querySelector("[data-chapter='1']")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" })}>Begin</button>
              <button onClick={() => goLab("design")}>Open the Lab</button>
            </div>
            <div className="hovercard" style={{ marginTop: 36 }}>
              <div tabIndex={0} aria-describedby="spared-assumptions">
                <div className="big-number"><CountUp to={spared.spared} /></div>
                <div className="big-caption">animals a year one lab could avoid using, on example assumptions. Hover or focus to see them.</div>
              </div>
              <span className="card" role="tooltip" id="spared-assumptions" style={{ left: 0, right: "auto" }}>
                <b>Example assumptions, not data</b><br />{SPARED_ASSUMPTIONS.studiesPerYear} studies a year, {SPARED_ASSUMPTIONS.treatedGroups} dose groups plus a control, {SPARED_ASSUMPTIONS.animalsPerGroup} animals per group, {fmtPct(SPARED_ASSUMPTIONS.screenedOutShare)} of studies avoided by screening first, {fmtPct(SPARED_ASSUMPTIONS.virtualControlShare)} of controls replaced. Baseline {fmtInt(spared.baselineAnimals)} animals. Edit them in Lab, Translate &amp; Trust, Pitch.
              </span>
            </div>
          </section>

</div><div className="story-hero-viewport">{gl && t ? <SceneBoundary fallback={<div className="poster"><RatPoster /></div>}><Suspense fallback={<div className="poster"><RatPoster /></div>}><CinematicHero animal={t} reduced={reduce} quality={quality} /></Suspense></SceneBoundary> : <div className="poster"><RatPoster /></div>}</div></div>
      <div className="story-grid">
        <div className="story-text">
          {/* 2 · meet the rat */}
          <section data-chapter={1} className="chapter-sec" aria-labelledby="c1">
            <span className="n">02</span>
            <h2 id="c1">Meet the rat.</h2>
            <p className="lede">A virtual Sprague-Dawley rat, built organ by organ. Keep scrolling to look inside.</p>
            <ul className="facts">
              <li><b>17</b><span>body compartments that drug moves through</span></li>
              <li><b>6</b><span>organs watched for injury, day by day</span></li>
              <li><b>1 seed</b><span>reproduces every result exactly</span></li>
            </ul>
          </section>

          {/* 3 · choose */}
          <section data-chapter={2} className="chapter-sec" aria-labelledby="c2">
            <span className="n">03</span>
            <h2 id="c2">Choose a compound.</h2>
            <p className="small muted">Fictional archetypes, each with a different way of doing harm.</p>
            <div className="cards story-cards" role="group" aria-label="Compound">
              {STORY_COMPOUNDS.map((c) => (
                <button key={c.key} type="button" className="ccard" aria-pressed={setup.compoundKey === c.key} onClick={() => setSetup({ compoundKey: c.key, highDose: ARCHETYPES[c.key]!.defaultDoseMgPerKg })}>
                  <b>{c.name}</b><span>{c.sub}</span>
                </button>
              ))}
            </div>
            <h3 style={{ marginTop: 18 }}>How much?</h3>
            <DoseDial label="Highest dose" value={Math.round(mult * 20) / 20} min={0.25} max={2.5} step={0.05} referenceDose={ref.defaultDoseMgPerKg} onChange={(m) => setSetup({ highDose: Math.max(0.1, +(m * ref.defaultDoseMgPerKg).toFixed(2)) })} />
            <p className="small muted" role="status">{study.status === "running" ? "Simulating 80 virtual rats…" : `${fmtInt(animals.length)} virtual rats ready.`}</p>
          </section>

          {/* 4 · dose day */}
          <section data-chapter={3} className="chapter-sec tall" aria-labelledby="c3">
            <div className="sticky-block">
            <span className="n">04</span>
            <h2 id="c3">Dose day.</h2>
            <p className="lede">Follow the first dose from the stomach, through the liver, into the blood.</p>
            {t && (
              <div className="readout" aria-live="polite">
                <div><span className="eyebrow">Hour</span><b>{hour}</b></div>
                <div><span className="eyebrow">Plasma</span><b>{fmt(t.plasma[hour] ?? 0, 2)}</b><span className="small muted">mg/L</span></div>
                <div><span className="eyebrow">Heart tissue</span><b>{fmt(t.tissue.heart[hour] ?? 0, 2)}</b><span className="small muted">mg/L</span></div>
              </div>
            )}
            {t && <div className="pk-story-card"><span className="eyebrow">Plasma exposure · first 24 hours</span><svg viewBox="0 0 300 100" role="img" aria-label="Simulated plasma concentration over the first 24 hours"><polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={t.plasma.slice(0,25).map((c,i)=>`${12+i*11.5},${90-c/Math.max(...t.plasma.slice(0,25),1e-9)*75}`).join(" ")}/><line x1={12+hour*11.5} x2={12+hour*11.5} y1="8" y2="95" stroke="var(--ink)" strokeDasharray="3 3"/></svg><small>Cmax {Math.max(...t.plasma.slice(0,25)).toFixed(2)} mg/L · Tmax {t.plasma.slice(0,25).indexOf(Math.max(...t.plasma.slice(0,25)))} h</small></div>}
            <p className="small muted">Glow shows where the drug is, scaled to each organ's own peak. Concentrations come from the PBPK model.</p>
            </div>
          </section>

          {/* 5 · damage */}
          <section data-chapter={4} className="chapter-sec tall" aria-labelledby="c4">
            <div className="sticky-block">
            <span className="n">05</span>
            <h2 id="c4">{days} days, compressed.</h2>
            {t && vDay && (
              <>
                <div className="day-counter"><span className="eyebrow">Study day</span><b>{damageDay}</b><span className="small muted">of {days}</span></div>
                <div className="grade-row">
                  {(["heart", "liver", "kidney", "marrow"] as Organ[]).map((o) => {
                    const g = vDay.organs[o].grade;
                    return <div key={o} className="grade-pill" style={{ borderColor: gradeVar(g) }}><span>{ORGAN_LABEL[o]}</span><b><i className="gdot" style={{ background: gradeVar(g) }} aria-hidden="true" />{GRADE_WORD[g]}</b></div>;
                  })}
                </div>
                <BiomarkerRibbon b={t} day={damageDay} />
                {t.clinpath[damageDay]!.hysLaw.met && <div className="banner bad" role="alert">Hy's Law pattern: liver enzymes and bilirubin both high. A warning sign for serious liver injury.</div>}
                {signs.length > 0 && <div className="sign-chips" aria-label="Visible signs">{signs.map(([s]) => <span key={s} className="chip ILLUSTRATIVE" style={{ color: "var(--warn)" }}>{s}</span>)}</div>}
                {t.daily.tumorVolume[damageDay]! > 0 && <p className="small muted">Tumour: {fmtInt(t.daily.tumorVolume[damageDay]!)} mm³ treated, {fmtInt(u?.daily.tumorVolume[damageDay] ?? 0)} mm³ in the same rat without treatment.</p>}
              </>
            )}
            </div>
          </section>

          {/* 6 · the moment */}
          <section data-chapter={5} className="chapter-sec moment-sec" aria-labelledby="c5">
            <h2 id="c5" className="sr-only">The humane endpoint</h2>
          </section>

          {/* 7 · untreated twin */}
          <section data-chapter={6} className="chapter-sec" aria-labelledby="c6">
            <span className="n">07</span>
            <h2 id="c6">Meet the twin.</h2>
            <ChapterTwin tw={twin} day={twinDay} split={split} />
          </section>

          {/* 8 · forecast */}
          <section data-chapter={7} className="chapter-sec tall" aria-labelledby="c7">
            <div className="sticky-block">
              <span className="n">08</span>
              <h2 id="c7">A thousand rats.</h2>
              <ChapterForecast pop={population} days={days} progress={pos.chapter === 7 ? pos.progress : pos.chapter > 7 ? 1 : 0} doseMgPerKg={population.doseMgPerKg || setup.highDose} mode={popMode} setMode={setPopMode} sorted={sorted} setSorted={setSorted} />
            </div>
          </section>

          {/* 9 · behaviour */}
          <section data-chapter={8} className="chapter-sec" aria-labelledby="c8">
            <span className="n">09</span>
            <h2 id="c8">How it behaves.</h2>
            <ChapterBehaviour tw={twin} />
          </section>

          {/* 10 · humans */}
          <section data-chapter={9} className="chapter-sec tall" aria-labelledby="c9">
            <div className="sticky-block">
              <span className="n">10</span>
              <h2 id="c9">Toward humans.</h2>
              <ChapterHuman noael={noael} scaled={scaled} />
            </div>
          </section>

          {/* 11 · trust */}
          <section data-chapter={10} className="chapter-sec" aria-labelledby="c10">
            <span className="n">11</span>
            <h2 id="c10">How far to trust it.</h2>
            <ChapterTrust />
          </section>

          {/* 12 · finale */}
          <section data-chapter={11} className="chapter-sec finale" aria-labelledby="c11">
            <span className="n">12</span>
            <h2 id="c11">Every animal we spare.</h2>
            <ChapterFinale initial={SPARED_ASSUMPTIONS} />
          </section>
        </div>

        <div className="story-stage" data-entry={entryPhase} ref={stageRef} aria-hidden={pos.chapter === 5 ? true : undefined}>
          {gl ? (
            <Suspense fallback={<div className="poster"><RatPoster /></div>}>
              <StoryScene posRef={posRef as React.MutableRefObject<StoryPos>} chapter={pos.chapter} targetOrgan={setup.compoundKey.includes("hepato")?"liver":setup.compoundKey.includes("nephro")?"kidney":setup.compoundKey.includes("neuro")?"brain":setup.compoundKey.includes("marrow")?"marrow":"heart"} treated={t} untreated={u} day={damageDay} moment={moment} exposure={exposure} plasmaRef={plasmaRef}
                reduceMotion={reduce} palette={cb ? "cb" : "standard"} quality={quality} background={bg} paused={paused || pos.chapter === 0} splitRef={splitRef} twinDay={twinDay} />

            </Suspense>
          ) : <div className="poster"><RatPoster /></div>}
          {entryPhase !== "ready" && <div className="story-initialize" role="status"><span>VAST / LIVING SYSTEMS</span><strong>A living system.<br/>Ready to explore.</strong><small>Initializing the anatomy studio</small></div>}
          {glOk && software && (
            <div className="gl-note" role="status">
              <span>Software graphics detected, so live 3D is paused to keep the page responsive.</span>
              <button type="button" onClick={() => { force3d(); setSoftware(false); setSceneReady(true); }}>Turn on 3D</button>
            </div>
          )}
          {pos.chapter === 1 && <div className="meet-frame" aria-hidden="true"><div className="meet-frame-top"><span>VAST / ANATOMY STUDIO</span><span>02 — EXPLORE</span></div><div className="meet-frame-bottom"><span>A living system.<br/><strong>Revealed, layer by layer.</strong></span><small>SCROLL TO LOOK INSIDE ↓</small></div></div>}
          {pos.chapter === 2 && <div className="stage-scientific-note">Illustrative binding motif · target highlighting · not a real molecular structure</div>}
          {pos.chapter === 3 && <div className="stage-scientific-note">Oral route → gut → portal liver → circulation → renal clearance<br/>Bio-tracers illustrate model transport; glow is normalized to each tissue’s peak.</div>}
          {pos.chapter === 6 && t && u && <div className="comparison-heatmap">{(["heart","liver","kidney"] as Organ[]).map(o=><span key={o}>{ORGAN_LABEL[o]} <b style={{color:gradeVar(ratVisualState(t,twinDay).organs[o].grade)}}>{GRADE_WORD[ratVisualState(t,twinDay).organs[o].grade]}</b><b style={{color:gradeVar(ratVisualState(u,twinDay).organs[o].grade)}}>{GRADE_WORD[ratVisualState(u,twinDay).organs[o].grade]}</b></span>)}</div>}
          {pos.chapter === 6 && t && u && <SplitDivider split={split} onChange={setSplit} stage={stageRef} />}
          {pos.chapter === 7 && <div className="stage-overlay"><ForecastField outcomes={popMode === "treated" ? population.treated : population.untreated} total={population.total / 2 || 1000} mode={popMode} palette={cb ? "cb" : "standard"} sorted={sorted && population.status === "done"} /></div>}
          {pos.chapter === 8 && t && u && gl && <div className="stage-overlay"><SceneBoundary fallback={<div className="poster"><RatPoster /></div>}><Suspense fallback={null}><ArenaScene mode="open" treated={t} untreated={u} day={days} hoursPerSec={1} /></Suspense></SceneBoundary></div>}
          {pos.chapter === 9 && <div className="translation-overlay"><HumanScale progress={humanP} ratDose={noael} hedDose={scaled.hed} ratLabel="rat dose, no adverse effect" /></div>}
          {!t && study.status === "error" ? (
            <div className="stage-status" role="alert">
              <span>We couldn’t prepare this virtual study.</span>
              <button type="button" onClick={() => void runStudy()}>Retry</button>
            </div>
          ) : !t ? <div className="stage-status" role="status">Preparing the virtual study…</div> : null}
        </div>
      </div>

      {/* the humane endpoint moment: calm, dignified, no alarms */}
      <div className="moment" style={{ opacity: dim > 0 ? 1 : 0, background: `radial-gradient(ellipse, rgba(12,37,49,${dim}), rgba(6,17,30,${dim}))`, visibility: dim > 0 ? "visible" : "hidden" }} aria-live="polite">
        {pos.chapter === 5 && (
          <div className="moment-inner">
            {moment ? (
              <>
                <p className="moment-day" style={{ opacity: showLine(0.12) ? 1 : 0 }}>Day {moment.day}</p>
                <p className="moment-line" style={{ opacity: showLine(0.22) ? 1 : 0 }}>
                  {moment.who === "untreated" ? "Without treatment, this rat's " : "On this treatment, this rat's "}{moment.reason}.
                </p>
                <p className="moment-line big" style={{ opacity: showLine(0.36) ? 1 : 0 }}>In a laboratory, this is the day a living animal would have suffered.</p>
                <p className="moment-line big accent" style={{ opacity: showLine(0.5) ? 1 : 0 }}>Here, no one did.</p>
              </>
            ) : (
              <>
                <p className="moment-line big" style={{ opacity: showLine(0.2) ? 1 : 0 }}>At these doses, this rat never reached a humane endpoint.</p>
                <p className="moment-line" style={{ opacity: showLine(0.35) ? 1 : 0 }}>Finding a dose that avoids suffering before any animal is used: that is refinement.</p>
              </>
            )}
            <div style={{ opacity: showLine(0.64) ? 1 : 0, marginTop: 30 }}>
              <div className="big-number">{showLine(0.64) ? <CountUp to={animals.length} duration={1.4} /> : 0}</div>
              <p className="moment-caption">virtual rats in this study. {humaneCount > 0 ? `${fmtInt(humaneCount)} of them would have reached a humane endpoint, the first on day ${firstHumaneDay}.` : "None of them reached a humane endpoint."} No animal was used.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
