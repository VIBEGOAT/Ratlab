import { useEffect, useState } from "react";
import "./doseLesson.css";

const beats = [
  { name: "Administration", organ: "Mouth", text: "An oral dose enters the digestive tract. Swallowing is only the beginning: drug in the gut is not yet drug in the blood.", x: 740, y: 160 },
  { name: "Absorption", organ: "Intestine", text: "Drug crosses the intestinal wall into portal blood. Formulation, gut conditions and transport can change how much reaches circulation.", x: 420, y: 280 },
  { name: "First pass", organ: "Liver", text: "Portal blood reaches the liver before the general circulation. For acetaminophen, conjugation is a major metabolic route; a smaller pathway forms the reactive metabolite NAPQI.", x: 480, y: 235 },
  { name: "Distribution", organ: "Circulation", text: "Blood carries parent drug and metabolites through the body. Concentration at a tissue depends on blood flow, binding and tissue partitioning.", x: 590, y: 205 },
  { name: "Metabolism", organ: "Liver", text: "Metabolism and distribution overlap in real time. Glutathione helps detoxify NAPQI. Exposure and defence capacity matter when interpreting liver injury.", x: 480, y: 235 },
  { name: "Excretion", organ: "Kidneys", text: "Urine removes acetaminophen metabolites and some unchanged drug. Excretion is a continuing process, not a single event at the end of the journey.", x: 345, y: 225 },
];

export function DoseLesson({ onWorkbench }: { onWorkbench: () => void }) {
  const [route, setRoute] = useState<"oral" | "iv">("oral");
  const [prediction, setPrediction] = useState("");
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const steps = route === "oral" ? beats : [
    { ...beats[0]!, organ: "Vein", text: "An intravenous dose enters the circulation directly, bypassing gastrointestinal absorption and the initial hepatic first pass.", x: 590, y: 205 },
    beats[3]!, beats[4]!, beats[5]!,
  ];
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (step >= steps.length - 1) setPlaying(false);
      else setStep(step + 1);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [playing, step, steps.length]);
  const beat = steps[step]!;
  const chooseRoute = (value: "oral" | "iv") => { setRoute(value); setStep(0); setStarted(false); setPlaying(false); setPrediction(""); };
  return <main id="main" className="dose-lesson">
    <header className="dose-intro"><div><span className="eyebrow">VAST / Field notes 001</span><h1>A dose.<br /><em>A whole journey.</em></h1><p>Become the investigator. Follow a medicine through the body, then explain what the evidence can tell you.</p></div><aside><span className="dose-tag">Acetaminophen · mechanism lesson</span><p>Start with a question</p><h2>Does changing the route change the journey?</h2><small>Concept animation · no quantitative rat prediction</small></aside></header>
    <div className="dose-layout"><section className="dose-protocol" aria-label="Lesson setup"><span className="eyebrow">01 / Set the scene</span><h2>Your experiment</h2><label>Teaching model<select disabled><option>Rat · schematic anatomy</option></select></label><p className="small">Healthy-animal disposition. Strain, sex and disease-specific predictions require a matched reference study.</p><label>Medicine<select disabled><option>Acetaminophen (paracetamol)</option></select></label><fieldset><legend>Administration route</legend><div className="dose-choices"><button aria-pressed={route === "oral"} onClick={() => chooseRoute("oral")}>By mouth</button><button aria-pressed={route === "iv"} onClick={() => chooseRoute("iv")}>Intravenous</button></div></fieldset><div className="dose-predict"><b>Before you watch…</b><p>Which route bypasses intestinal absorption?</p>{["Oral", "Intravenous"].map(answer => <button key={answer} aria-pressed={prediction === answer} onClick={() => setPrediction(answer)}>{answer}</button>)}{prediction && <p role="status">{prediction === "Intravenous" ? "Exactly. IV delivers directly into circulation." : "Consider where the dose enters. An oral dose still needs to cross the gut wall."}</p>}</div><button className="primary" disabled={!prediction} onClick={() => { setStarted(true); setStep(0); setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches); }}>Follow this dose →</button><small>Playback seconds describe the lesson, not biological time.</small></section>
    <section className="dose-stage" aria-label="Drug journey"><div className="dose-stage-top"><span>{started ? `CHAPTER ${step + 1} / ${steps.length}` : "READY WHEN YOU ARE"}</span><span>Illustrative anatomy</span></div><svg viewBox="0 0 900 410" role="img" aria-label={`Schematic rat; ${started ? beat.organ + ' highlighted' : 'organs visible'}`}>
      <defs><radialGradient id="lesson-glow"><stop stopColor="#e8a855" stopOpacity=".22"/><stop offset="1" stopColor="#e8a855" stopOpacity="0"/></radialGradient></defs><ellipse cx="490" cy="230" rx="360" ry="190" fill="url(#lesson-glow)"/>
      <path d="M235 275 Q90 320 30 258" fill="none" stroke="#bfa893" strokeWidth="9" strokeLinecap="round"/>
      <path d="M230 270 Q180 130 340 115 Q480 95 600 135 Q665 95 710 128 L790 174 Q828 195 770 212 L699 227 Q670 269 600 280 L615 330 L570 330 L553 286 L320 282 L298 332 L250 332 L270 280Z" fill="#d6c7b5" fillOpacity=".12" stroke="#d6c7b5" strokeWidth="2"/>
      <ellipse cx="682" cy="125" rx="25" ry="34" fill="#c58276" fillOpacity=".45"/><circle cx="730" cy="162" r="6" fill="#f4f0ea"/>
      <path d="M785 192l55-19m-55 24l60 8m-59-3l49 28" stroke="#d6c7b5"/>
      <path d="M740 180 Q610 180 560 245 Q530 280 490 268" stroke="#e8a855" fill="none" strokeWidth="5" opacity=".6"/>
      {beats.filter((b, i) => i !== 4 && i !== 0).map(b => <g key={b.name}><ellipse cx={b.x} cy={b.y} rx={b.organ === "Liver" ? 39 : 25} ry="20" fill={started && beat.organ === b.organ ? "#e8a855" : "#78a78d"} fillOpacity=".7"/><text x={b.x} y={b.y + 42} textAnchor="middle" fill="#e2d5c4" fontSize="14">{b.organ}</text></g>)}
      {started && <g className="dose-marker" style={{ transform: `translate(${beat.x}px, ${beat.y}px)` }}><circle r="40" fill="none" stroke="#e8a855" strokeWidth="2"/><circle r="6" fill="#fff2ca"/></g>}
    </svg><div className="dose-caption" aria-live="polite"><span className="eyebrow">{started ? beat.organ : "02 / Follow the molecule"}</span><h2>{started ? beat.name : "Small molecule. Big questions."}</h2><p>{started ? beat.text : "Choose a route and make your prediction. Then trace absorption, distribution, metabolism and excretion, one chapter at a time."}</p></div><div className="dose-playback"><button disabled={!started} onClick={() => { if (step === steps.length - 1) setStep(0); setPlaying(!playing); }}>{playing ? "Pause" : "Play"}</button><input aria-label="Journey chapter" type="range" min="0" max={steps.length - 1} value={step} disabled={!started} onChange={e => { setStep(Number(e.target.value)); setPlaying(false); }}/><span>{step + 1}/{steps.length}</span></div><div className="dose-stations">{steps.map((b, i) => <button key={b.name} disabled={!started} aria-current={started && step === i ? "step" : undefined} onClick={() => { setStep(i); setPlaying(false); }}>{b.name}</button>)}</div></section></div>
    <section className="dose-debrief"><div><span className="eyebrow">03 / Think like a researcher</span><h2>What would you measure?</h2><p>Follow the mechanism with measurements. A plausible animation alone cannot establish drug safety.</p></div><div className="dose-cards">{[["PK", "How much gets there?", "Cmax: peak concentration. Tmax: time to peak. AUC: exposure over time."], ["PD", "What does it do?", "Choose a response linked to the research question, then compare it with a vehicle control."], ["Safety", "When does harm emerge?", "Interpret liver biomarkers together with tissue findings, dose and sampling time."]].map(([tag, title, text]) => <article key={tag}><span>{tag}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <details className="dose-evidence"><summary>Inside the evidence · what this lesson supports</summary><p>This is a qualitative mechanism lesson. No published rat measurements have been imported or independently validated in this module. Numerical dose choices, PK curves and toxicity predictions remain unavailable here until a suitable dataset is curated.</p><p>Acetaminophen injury susceptibility differs across species. Rat results must not be inferred from mouse or human injury data. The stages overlap in biology; this sequence separates them for learning.</p><a href="https://pubmed.ncbi.nlm.nih.gov/?term=acetaminophen+rat+pharmacokinetics+metabolism" target="_blank" rel="noreferrer">Explore rat-specific literature on PubMed ↗</a></details>
    <footer className="dose-footer"><p>Want to explore the existing numerical engine?<br/><small>Its compound profiles are fictional teaching archetypes.</small></p><button onClick={onWorkbench}>Open simulation workbench →</button></footer>
  </main>;
}
