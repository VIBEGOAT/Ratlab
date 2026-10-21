import { useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useReducedMotion } from '../lib/motion';
import { CHAPTER_IDS, JOURNEY_PATH, JOURNEY_TITLES, PROFILES, clamp, concentration, injury, journeyState } from './journey';
import { useJourney } from './useJourney';
import './journey.css';

const ORGANS = ['Brain', 'Heart', 'Liver', 'Kidneys', 'Gut'] as const;
const ORGAN_POINTS: Record<string, [number, number]> = { Brain: [48, -36], Heart: [12, -12], Liver: [-10, 0], Kidneys: [-35, -9], Gut: [-30, 10] };

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
  const xray = journey.chapter >= 2 && journey.chapter <= 4;
  const leg = reduce || journey.pose !== 'walk' ? 0 : Math.sin(progress * 180) * 24;
  const pulse = reduce ? 1 : 1 + Math.sin(progress * 220) * .12;
  const validWeight = Number(weight) >= 1 && Number(weight) <= 500, hed = dose * 6 / 37;
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const slider = (id: string) => <label className="journey-dose" htmlFor={id}><span>Story dose <strong>{dose} mg/kg</strong></span><input id={id} type="range" min="1" max="200" step="1" value={dose} onChange={e => setDose(Number(e.target.value))} /><span className="journey-range"><span>1 mg/kg</span><span>200 mg/kg</span></span></label>;
  const paragraphs = [
    'One fictional compound. One question. Follow a virtual rat from dose to exposure, then explore what the numbers can—and cannot—tell us.',
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
          <div className="journey-scene-title"><span>VIRTUAL SPECIMEN / 001</span><span>{xray ? 'EXPOSURE VIEW' : 'SURFACE VIEW'}</span></div>
          <svg viewBox="0 0 720 480" role="img" aria-label={`Illustrated rat, ${reduce ? 'stationary' : journey.pose}, ${xray ? 'with organs visible' : 'external view'}`}>
            <defs><linearGradient id="journey-coat" x2=".3" y2="1"><stop stopColor="#f6eee4" /><stop offset=".5" stopColor="#c8c9bd" /><stop offset="1" stopColor="#8b9d94" /></linearGradient><radialGradient id="journey-light"><stop stopColor="#327878" stopOpacity=".3" /><stop offset="1" stopColor="#142426" stopOpacity="0" /></radialGradient></defs>
            <ellipse cx="360" cy="240" rx="340" ry="210" fill="url(#journey-light)" />
            <g stroke="#6bb8b1" strokeWidth=".7" opacity=".15">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 90} 130V410 M30 ${130 + i * 35}H690`} />)}</g>
            <path ref={path} d={JOURNEY_PATH} fill="none" stroke="#80c9bb" strokeWidth="1.5" strokeDasharray="3 7" opacity=".45" />
            {geometry.stations.map((p, i) => <g key={i} transform={`translate(${p.x} ${p.y})`}><circle r="11" fill={i <= journey.chapter ? '#9fdbcb' : '#203938'} stroke="#9fdbcb" /><text y="52" textAnchor="middle" fill="#bad0cd" fontSize="12">{String(i + 1).padStart(2, '0')}</text></g>)}
            <g data-testid="journey-rat" data-pose={reduce ? 'pause' : journey.pose} data-x={geometry.x.toFixed(3)} data-y={geometry.y.toFixed(3)} style={{ transform: `translate(${geometry.x}px, ${geometry.y}px) rotate(${geometry.angle}deg)` }}>
              <g transform="scale(.85)"><ellipse cy="35" rx="73" ry="9" fill="#000" opacity=".25" /><path d="M-65 7 Q-101 30 -135 14 Q-153 4 -168 10" fill="none" stroke="#bb9690" strokeWidth="5" strokeLinecap="round" />
                <g stroke="#bda69c" strokeWidth="8" strokeLinecap="round"><path d="M-42 10l-7 23 16 1" style={{ transform: `rotate(${leg}deg)` }} /><path d="M22 5l13 28 12 0" style={{ transform: `rotate(${-leg}deg)` }} /></g>
                <path d="M-72 8C-82-20-57-42-27-40C1-42 13-35 30-38C43-60 70-45 75-25L100-7Q110 1 98 5L66 13Q54 20 36 15C8 34-49 32-72 8Z" fill={xray ? '#8ee9de' : 'url(#journey-coat)'} fillOpacity={xray ? .13 : 1} stroke={xray ? '#9cebdd' : '#d3d8cb'} strokeWidth="1.2" />
                <path d="M42-36C23-66 48-75 58-52L57-37" fill="#b69b93" stroke="#d5b7ad" /><path d="M46-40Q34-60 47-59L52-45" fill="#806d6a" /><circle cx="75" cy="-24" r="4.6" fill="#111b1a" /><circle cx="76" cy="-25" r="1.4" fill="#fff" /><ellipse cx="103" cy="0" rx="4" ry="3" fill="#d8a3a1" />
                <g stroke="#dbe6df" strokeWidth=".7" opacity=".8"><path d="M97 2l29-12M98 4l32 1M96 6l25 13" /></g>
                <g style={{ opacity: xray ? 1 : 0 }}>
                  <ellipse cx="48" cy="-36" rx="11" ry="7" fill="#bbaff7" /><path d="M16-16Q24-30 30-14L17-1Q0-7 7-17Q12-22 16-16" fill="#f68a91" style={{ transform: `translate(16px,-12px) scale(${pulse}) translate(-16px,12px)` }} />
                  <ellipse cx="-10" cy="0" rx="18" ry="9" fill={profile.target === 'Liver' ? `hsl(${42 - response * 42} 76% 65%)` : '#8cc8bf'} /><path d="M-43-16Q-26-22-30-8Q-40 0-43-16M-47-3Q-31-8-35 5Q-45 10-47-3" fill={profile.target === 'Kidneys' ? `hsl(${42 - response * 42} 76% 65%)` : '#8cc8bf'} />
                  <path d="M-48 9q10-12 18 0t18 0m-37 6q10-12 18 0t18 0" stroke="#d5bd86" strokeWidth="4" fill="none" /><path d="M45-30L20-22-30-25M20-22L14-12M-12-24L-10 0M-30-25L-36-8" fill="none" stroke="#a9edeb" strokeWidth="1.4" />
                  {journey.chapter === 3 && <circle transform={`translate(${ORGAN_POINTS[selected]![0]} ${ORGAN_POINTS[selected]![1]})`} r="22" fill="none" stroke="#fff" strokeDasharray="3 3" />}
                </g>
                <g stroke="#d5b6aa" strokeWidth="7" strokeLinecap="round"><path d="M-49 15l9 21 14 0" style={{ transform: `rotate(${-leg}deg)` }} /><path d="M31 13l-3 23 15 1" style={{ transform: `rotate(${leg}deg)` }} /></g>
              </g>
            </g>
            {journey.chapter === 1 && <g transform={`translate(${geometry.x + 35} ${geometry.y - 85}) scale(${.6 + dose / 200})`}><rect x="-14" y="-6" width="28" height="12" rx="6" fill="#b0ebd5" /><path d="M0-6v12" stroke="#224b46" /></g>}
          </svg>
          <div className="journey-scene-caption"><strong>{journey.chapter === 3 ? selected : ['A question worth exploring', 'One dose. A connected story.', 'From gut to circulation', '', 'A response, not a prediction', 'Continue with better questions'][journey.chapter]}</strong><span>{profile.name.split(' · ')[0]} · {dose} mg/kg · {reduce ? 'Static chapter view' : 'Scroll to follow'}</span></div>
        </div>
      </div>
      <p className="journey-disclaimer">Fictional compound profiles · For research and education only.<br />Illustrative, unvalidated models. Not for clinical dosing or safety decisions.</p>
      <div className="journey-progress" role="progressbar" aria-label="Story progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><i style={{ transform: `scaleX(${progress})` }} /></div>
      {debug && <output className="journey-debug">progress {progress.toFixed(4)} · chapter {journey.chapter + 1}<br />path ({geometry.x.toFixed(2)}, {geometry.y.toFixed(2)})</output>}
    </div>
  </section></main>;
}
