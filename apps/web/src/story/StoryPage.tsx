import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useReducedMotion } from '../lib/motion';
import { CHAPTER_IDS, JOURNEY_PATH, JOURNEY_TITLES, PROFILES, clamp, concentration, injury, journeyState } from './journey';
import { useJourney } from './useJourney';
import './journey.css';

const ORGANS = ['Brain', 'Heart', 'Liver', 'Kidneys', 'Gut'] as const;
const JourneyRat3D = lazy(() => import('./JourneyRat3D'));

function Curve({ kind, dose, clearance, midpoint, reveal = 1 }: { kind: 'pk' | 'response'; dose: number; clearance: number; midpoint: number; reveal?: number }) {
  const points = Array.from({ length: 101 }, (_, i) => {
    const value = kind === 'pk' ? concentration(i * .24, dose, clearance) / 140 : injury(i * 2, midpoint);
    return `${30 + i * 3.2},${130 - value * 105}`;
  });
  const markerX = 30 + dose / 200 * 320, markerY = 130 - injury(dose, midpoint) * 105;
  return <svg className="journey-chart" viewBox="0 0 370 160" role="img" aria-label={kind === 'pk' ? 'Fictional plasma concentration over 24 hours' : 'Fictional dose response, with the current dose and model midpoint'}>
    <defs><clipPath id={`curve-${kind}`}><rect x="0" y="0" width="370" height="160" style={{ transform: `scaleX(${clamp(reveal)})` }} /></clipPath></defs>
    <path d="M30 15V130H350" fill="none" stroke="currentColor" opacity=".3" />
    <g clipPath={`url(#curve-${kind})`}><polyline points={points.join(' ')} fill="none" stroke="var(--journey-accent)" strokeWidth="3" /></g>
    {kind === 'response' && <><path d="M0 18V130" transform={`translate(${30 + midpoint / 200 * 320} 0)`} stroke="currentColor" strokeDasharray="3 4" opacity=".6" /><circle r="6" transform={`translate(${markerX} ${markerY})`} fill="var(--journey-accent)" stroke="var(--bg)" strokeWidth="2" /></>}
    <g fill="currentColor" fontSize="10"><text x="30" y="151">0</text><text x="350" y="151" textAnchor="end">{kind === 'pk' ? '24 hours' : '200 mg/kg'}</text><text x="36" y="16">{kind === 'pk' ? 'Concentration · mg/L' : 'Response index · 0–1'}</text></g>
  </svg>;
}

export function StoryPage() {
  const { section, stage, progress, ready, revision, jump } = useJourney();
  const reduce = !!useReducedMotion(), journey = journeyState(progress);
  const setMode = useStore(s => s.setMode);
  const [profileIndex, setProfileIndex] = useState(0), [dose, setDose] = useState(60);
  const [weight, setWeight] = useState('60'), [selected, setSelected] = useState<string>('Liver'), [prediction, setPrediction] = useState(false);
  const profile = PROFILES[profileIndex]!, response = injury(dose, profile.midpoint);
  const path = useRef<SVGPathElement>(null);
  const [geometry, setGeometry] = useState({ x: 100, y: 270, angle: 0, stations: [] as { x: number; y: number }[] });
  const pathProgress = reduce ? journey.chapter / 5 : journey.pathProgress;
  useLayoutEffect(() => {
    if (!path.current) return;
    const length = path.current.getTotalLength(), distance = pathProgress * length;
    const point = path.current.getPointAtLength(distance), a = path.current.getPointAtLength(Math.max(0, distance - 1)), b = path.current.getPointAtLength(Math.min(length, distance + 1));
    setGeometry({ x: point.x, y: point.y, angle: reduce ? 0 : Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, stations: Array.from({ length: 6 }, (_, i) => { const p = path.current!.getPointAtLength(length * i / 5); return { x: p.x, y: p.y }; }) });
  }, [pathProgress, reduce, revision]);
  const validWeight = Number(weight) >= 1 && Number(weight) <= 500, hed = dose * 6 / 37;
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const slider = (id: string) => <label className="journey-dose" htmlFor={id}><span>Story dose <strong>{dose} mg/kg</strong></span><input id={id} type="range" min="1" max="200" step="1" value={dose} onChange={e => setDose(Number(e.target.value))} /><span className="journey-range"><span>1 mg/kg</span><span>200 mg/kg</span></span></label>;
  const paragraphs = [
    'Your virtual laboratory rat is the experiment. Inspect its anatomy, choose a fictional compound, and follow how dose and exposure connect to organ response.',
    'Dose starts the journey. Change it here; the same value follows you through every station.',
    'An oral dose enters the circulation, reaches tissues, and is cleared. Scroll to trace one dose over 24 hours.',
    'Exposure is not the same as injury. This teaching model assigns a response to one target organ; other organs show exposure only.',
    'A larger dose can produce a stronger response. Explore a smooth model curve and its 50% response midpoint.',
    'Body surface area provides a mathematical bridge between species. A converted dose is not a recommended or safe human dose.',
  ];
  const widgets = [
    <div className="journey-widget" key="compound"><label htmlFor="story-compound">Fictional profile</label><select id="story-compound" value={profileIndex} onChange={e => { const i = Number(e.target.value); setProfileIndex(i); setSelected(PROFILES[i]!.target); }} >{PROFILES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</select><strong>{profile.question}</strong><button aria-expanded={prediction} onClick={() => setPrediction(!prediction)}>{prediction ? 'Hide the hypothesis' : 'Make a prediction'}</button>{prediction && <small>With these assumptions, a larger dose increases exposure and the target-organ response. Test that in the next stations.</small>}</div>,
    <div className="journey-widget" key="dose">{slider('story-dose')}<p>Single oral dose · illustrative 0.25 kg rat<br /><strong>{(dose * .25).toFixed(2)} mg</strong> administered in this example.</p><small>The capsule cue grows with dose. Animal size stays constant.</small></div>,
    <div className="journey-widget" key="pk"><Curve kind="pk" dose={dose} clearance={profile.clearance} midpoint={profile.midpoint} reveal={reduce ? 1 : clamp(journey.local / .85)} /><small>One-compartment model · absorption 1/h · elimination {profile.clearance}/h · bioavailability 80%. Illustrative parameters, not measured data.</small></div>,
    <div className="journey-widget" key="organs"><div className="journey-organs" role="group" aria-label="Inspect an organ">{ORGANS.map(o => <button key={o} aria-pressed={selected === o} onClick={() => setSelected(o)}>{o}</button>)}</div><strong>{selected}: {selected === profile.target ? `${(response * 100).toFixed(0)} / 100 simulated injury index` : 'exposure only'}</strong><small>{selected === profile.target ? 'Color represents a fictional dose-dependent response, not a measured injury grade.' : 'No injury relationship is defined for this organ in the selected teaching profile.'}</small></div>,
    <div className="journey-widget" key="response"><Curve kind="response" dose={dose} clearance={profile.clearance} midpoint={profile.midpoint} />{slider('story-response-dose')}<small>Dashed marker: 50% model response at {profile.midpoint} mg/kg. This is not a safety threshold or a NOAEL.</small></div>,
    <div className="journey-widget journey-hed" key="hed"><label htmlFor="story-weight">Human body weight (kg)<input id="story-weight" type="number" min="1" max="500" value={weight} aria-invalid={!validWeight} onChange={e => setWeight(e.target.value)} /></label><div><small>Rat dose × rat Kₘ / human Kₘ</small><strong className="journey-result">{hed.toFixed(2)} <small>mg/kg</small></strong><small>{dose} × 6 / 37{validWeight ? ` · ${(hed * Number(weight)).toFixed(1)} mg total at ${weight} kg` : ' · Enter 1–500 kg.'}</small></div><small className="journey-wide">Adult reference Kₘ factors from <a href="https://www.fda.gov/media/72309/download" target="_blank" rel="noreferrer">FDA guidance</a>. No safety factor is applied; this fictional dose is not a NOAEL.</small><button className="primary journey-wide" onClick={() => setMode('toxicity')}>Explore the workbench <span aria-hidden="true">↗</span></button></div>,
  ];
  return <main id="main" className="journey-main"><section id="story" className="journey-section" ref={section} data-progress={progress.toFixed(6)} data-active-chapter={journey.chapter} aria-label="A compound's journey">
    <div ref={stage} className="journey-stage">
      <nav className="journey-nav" aria-label="Story chapters">{JOURNEY_TITLES.map((title, i) => <button key={title} aria-label={`${String(i + 1).padStart(2, '0')}. ${['Compound', 'Dose', 'Exposure', 'Organs', 'Response', 'Human'][i]}: ${title}`} aria-current={journey.chapter === i ? 'step' : undefined} onClick={() => jump(i)}><span>{String(i + 1).padStart(2, '0')}</span><b>{['Compound', 'Dose', 'Exposure', 'Organs', 'Response', 'Human'][i]}</b></button>)}</nav>
      <div className="journey-columns" style={{ opacity: ready ? 1 : 0 }}>
        <div className="journey-copy">{JOURNEY_TITLES.map((title, i) => {
          const active = journey.chapter === i;
          const appear = reduce || i === 0 ? 1 : .85 + .15 * clamp(journey.local / .12);
          return <article key={title} id={`story-panel-${CHAPTER_IDS[i]}`} aria-hidden={!active} {...(!active ? { inert: '' } : {})} className="journey-panel" style={{ opacity: active ? appear : 0, transform: `translateY(${active && !reduce ? (1 - appear) * 24 : 0}px)`, pointerEvents: active ? 'auto' : 'none' }}><span className="journey-eyebrow">A compound’s journey / {String(i + 1).padStart(2, '0')}</span><h1>{title}</h1><p>{paragraphs[i]}</p>{active && widgets[i]}</article>;
        })}</div>
        <div className="journey-scene" aria-label={`Rat at station ${journey.chapter + 1}: ${JOURNEY_TITLES[journey.chapter]}`}>
          <div className="journey-scene-title"><span>YOUR VIRTUAL LAB RAT / 001</span><span>INTERACTIVE 3D ANATOMY</span></div>
          <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', visibility: 'hidden' }}><path ref={path} d={JOURNEY_PATH} /></svg>
          <Suspense fallback={<div className="rat3d-loading" role="status">Loading your virtual lab rat…</div>}>
            <JourneyRat3D progress={progress} reduced={reduce} dose={dose} target={profile.target} response={response} selected={selected} onSelect={setSelected} pathPoint={geometry} />
          </Suspense>
          <div className="journey-scene-caption"><strong>{journey.chapter === 3 ? selected : ['A question worth exploring', 'One dose. A connected story.', 'From gut to circulation', '', 'A response, not a prediction', 'Continue with better questions'][journey.chapter]}</strong><span>{profile.name.split(' · ')[0]} · {dose} mg/kg · {reduce ? 'Static chapter view' : 'Scroll to follow'}</span></div>
        </div>
      </div>
      <p className="journey-disclaimer">Fictional compound profiles · For research and education only.<br />Illustrative, unvalidated models. Not for clinical dosing or safety decisions.</p>
      <div className="journey-progress" role="progressbar" aria-label="Story progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><i style={{ transform: `scaleX(${progress})` }} /></div>
      {debug && <output className="journey-debug">progress {progress.toFixed(4)} · chapter {journey.chapter + 1}<br />path ({geometry.x.toFixed(2)}, {geometry.y.toFixed(2)})</output>}
    </div>
  </section></main>;
}
