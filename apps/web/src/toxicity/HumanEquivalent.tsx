import { useEffect, useState } from "react";
import { convertDoseMgPerKg } from "@eliminate/sim-core";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function HumanEquivalent({ dose }: { dose: number }) {
  const [ratDose, setRatDose] = useState(String(dose));
  const [weight, setWeight] = useState("60");
  useEffect(() => setRatDose(String(dose)), [dose]);
  const d = ratDose.trim() ? Number(ratDose) : NaN, w = weight.trim() ? Number(weight) : NaN;
  const valid = Number.isFinite(d) && d > 0 && Number.isFinite(w) && w > 0;
  const hed = valid ? convertDoseMgPerKg(d, "rat", "human") : null;
  return <section className="panel tox-hed" aria-labelledby="hed-title"><div className="tox-section-heading"><div><p className="eyebrow">Make the connection</p><h2 id="hed-title">Human-equivalent dose</h2></div><span className="tox-pill">Body-surface-area conversion</span></div>
    <p>Explore how a rat dose converts using standard body-surface-area factors.</p>
    <div className="tox-hed-fields"><label className="field">Rat dose (mg/kg)<input type="number" min="0.01" step="any" value={ratDose} onChange={(e) => setRatDose(e.target.value)} /></label><label className="field">Human body weight (kg)<input type="number" min="1" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} /></label><button onClick={() => setRatDose(String(dose))}>Use selected run dose</button></div>
    <div className="tox-hed-answer" aria-live="polite">{hed !== null ? <><div><span>Human-equivalent dose</span><strong data-testid="hed-value">{fmt(hed)} <small>mg/kg</small></strong></div><div><span>Total at {fmt(w)} kg</span><strong>{fmt(hed * w)} <small>mg</small></strong></div></> : <p>Enter a positive dose and body weight to calculate.</p>}</div>
    <p className="tox-equation">Rat dose × (rat Km 6 / adult human Km 37)</p><p className="small muted">Arithmetic conversion, not a safe human dose or a recommended starting dose. Standard Km factors are reference values; this does not model human exposure, species-specific metabolism, or equivalent toxicity. Weight scales total milligrams only.</p>
    <details><summary>Source and interpretation</summary><p className="small muted">FDA (2005), <i>Estimating the Maximum Safe Starting Dose in Initial Clinical Trials for Therapeutics in Adult Healthy Volunteers</i>, Table 1. A starting-dose assessment requires appropriate nonclinical evidence, selection of the relevant endpoint and species, and justified safety factors. A fictional simulation cannot supply that evidence.</p><a href="https://www.fda.gov/media/72309/download" target="_blank" rel="noreferrer">Read the FDA guidance</a></details>
  </section>;
}

