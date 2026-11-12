import { useState, type ReactNode } from "react";
import type { LabSection } from "../store";
import { referenceCaseForCompound } from "../lib/referenceStudies";
import { useStore } from "../store";

function SourceBadge() { return <span className="published-badge">Published case · Open TG-GATEs</span>; }

function EvidenceDrawer() {
  return <details className="lesson-evidence"><summary>Evidence and sources</summary><div><p><b>Genuinely available:</b> protocol metadata and processed pathology associations from the Open TG-GATEs acetaminophen studies.</p><p><b>Not invented:</b> individual rat histories, measured plasma PK, raw ALT/AST values, pathology incidence and a numerical NOAEL.</p><p className="small muted">Sources: ArrayExpress E-MTAB-799 and E-MTAB-800; Igarashi et al. 2015, DOI 10.1093/nar/gku955. The pathology display is derived from a published discretization, not raw slide grades.</p></div></details>;
}

function PathologyTimeline() {
  const item = referenceCaseForCompound("hepatotoxin")!;
  return <ol className="published-timeline lesson-timeline">{item.publishedFindings!.map((finding, index) => <li key={`${finding.dose}-${finding.time}`}><span>Observation {index + 1}</span><b>{finding.time} · {finding.dose.toLocaleString()} mg/kg</b><p>{finding.finding}</p></li>)}</ol>;
}

function Choice({ value, answer, onAnswer, children }: { value: string; answer: string | null; onAnswer: (value: string) => void; children: ReactNode }) {
  return <button type="button" aria-pressed={answer === value} onClick={() => onAnswer(value)}>{children}</button>;
}

export function PublishedCaseView({ section }: { section: LabSection }) {
  const setup = useStore((s) => s.setup);
  const item = referenceCaseForCompound(setup.compoundKey);
  const [answer, setAnswer] = useState<string | null>(null);
  if (!item || item.id !== "acetaminophen-liver") return null;

  if (section === "design") return <section className="published-case lesson-screen">
    <div className="lesson-opening"><div><SourceBadge /><span className="eyebrow">Virtual practical · approximately 12 minutes</span><h2>How can acetaminophen injure the liver?</h2><p>You are the junior toxicologist. Inspect a real published study design, predict what will happen and defend a conclusion from the evidence.</p><div className="lesson-objectives"><span><b>01</b>Design a fair comparison</span><span><b>02</b>Recognise a dose–time pattern</span><span><b>03</b>Separate evidence from assumption</span></div></div><div className="lesson-molecule" aria-label="Acetaminophen case illustration"><span>APAP</span><i /><i /><i /><small>Primary focus<br /><b>Liver</b></small></div></div>
    <div className="lesson-brief"><span className="eyebrow">Your study card</span><h3>Compare untreated controls with increasing exposure</h3><div><span>Test model<b>Male Sprague–Dawley rats, 6 weeks</b></span><span>Administration<b>Oral gavage</b></span><span>Dose groups<b>0 · 300 · 600 · 1,000 mg/kg</b></span><span>Observation plan<b>Single and repeat-dose time points</b></span></div><p>The control group shows what happens without the drug. Increasing dose groups help reveal whether the response changes with exposure.</p></div>
    <div className="lesson-check"><div><span className="eyebrow">Quick check</span><h3>Why is the untreated control essential?</h3></div><div className="lesson-choices"><Choice value="compare" answer={answer} onAnswer={setAnswer}>It provides the normal baseline for comparison.</Choice><Choice value="speed" answer={answer} onAnswer={setAnswer}>It makes acetaminophen metabolise faster.</Choice><Choice value="replace" answer={answer} onAnswer={setAnswer}>It replaces the need for dose groups.</Choice></div>{answer && <p role="status" className={answer === "compare" ? "correct" : "incorrect"}>{answer === "compare" ? "Correct. A change is meaningful only when compared with an appropriate baseline." : "Try again. The control does not change the drug; it provides the baseline."}</p>}</div>
    <EvidenceDrawer />
  </section>;

  if (section === "overview") return <section className="published-case lesson-screen">
    <div className="lesson-heading"><div><SourceBadge /><span className="eyebrow">Prediction checkpoint</span><h2>Commit to a hypothesis.</h2><p>Do this before seeing the findings. Prediction turns passive browsing into an experiment.</p></div><span className="lesson-number">02</span></div>
    <div className="prediction-stage"><div className="dose-ladder" aria-hidden="true"><span><i style={{ height: "12%" }} />0</span><span><i style={{ height: "36%" }} />300</span><span><i style={{ height: "64%" }} />600</span><span><i style={{ height: "100%" }} />1,000<small>mg/kg</small></span></div><div><h3>Which pattern do you expect?</h3><p>Select your prediction. There is no penalty—you will compare it with the published pattern next.</p><div className="lesson-choices vertical"><Choice value="higher" answer={answer} onAnswer={setAnswer}>Higher doses will produce earlier or more substantial liver findings.</Choice><Choice value="same" answer={answer} onAnswer={setAnswer}>Every dose will produce exactly the same findings.</Choice><Choice value="lower" answer={answer} onAnswer={setAnswer}>Only the untreated control will show liver findings.</Choice></div></div></div>
    {answer && <div className="prediction-lock"><span>Hypothesis recorded</span><b>{answer === "higher" ? "Liver response increases with dose and time." : answer === "same" ? "Response is unrelated to dose." : "Findings occur only in controls."}</b><p>Continue to watch how acetaminophen moves through the body.</p></div>}
  </section>;

  if (section === "animal") return <section className="published-case lesson-screen">
    <div className="lesson-heading"><div><SourceBadge /><span className="eyebrow">Drug journey · simplified teaching animation</span><h2>From dose to liver response.</h2><p>The animation explains the biological sequence. It is not a measured PK trace from this dataset.</p></div><span className="lesson-number">03</span></div>
    <div className="adme-stage" aria-label="Animated oral acetaminophen journey"><div className="adme-path" /><div className="adme-pulse" /><article><span>00:00</span><i className="adme-icon">1</i><b>Mouth</b><p>Acetaminophen is administered by gavage.</p></article><article><span>00:08</span><i className="adme-icon">2</i><b>Gut</b><p>The dose dissolves and is absorbed.</p></article><article className="target"><span>00:25</span><i className="adme-icon">3</i><b>Liver</b><p>Most is processed safely; a reactive metabolite can form.</p></article><article><span>Later</span><i className="adme-icon">4</i><b>Excretion</b><p>Conjugated products leave through urine.</p></article></div>
    <div className="mechanism-strip"><span><b>Normal pathway</b>Most acetaminophen is conjugated into products the body can remove.</span><span><b>High-exposure risk</b>Protective capacity can be overwhelmed, increasing reactive-metabolite stress.</span><span><b>What we inspect</b>Liver pathology provides evidence of tissue response.</span></div>
    <div className="banner info"><b>Important:</b> this is established biological context. The evidence package has no measured concentration-time data, so the animation shows no invented numbers.</div>
  </section>;

  if (section === "data") return <section className="published-case lesson-screen">
    <div className="lesson-heading"><div><SourceBadge /><span className="eyebrow">Reveal the observations</span><h2>Look for a pattern—not a single dramatic number.</h2><p>Read from lower to higher exposure and from earlier to later observations.</p></div><span className="lesson-number">04</span></div>
    <PathologyTimeline />
    <div className="lesson-check"><div><span className="eyebrow">Interpret the evidence</span><h3>What is the strongest supported statement?</h3></div><div className="lesson-choices"><Choice value="pattern" answer={answer} onAnswer={setAnswer}>Higher exposure is associated with earlier and more substantial hepatic pathology.</Choice><Choice value="safe" answer={answer} onAnswer={setAnswer}>300 mg/kg is proven completely safe for every rat.</Choice><Choice value="human" answer={answer} onAnswer={setAnswer}>The results directly determine a safe human dose.</Choice></div>{answer && <p role="status" className={answer === "pattern" ? "correct" : "incorrect"}>{answer === "pattern" ? "Correct. This matches the dose–time pattern without claiming more than the data support." : "Not supported. The package cannot prove universal safety or directly set a human dose."}</p>}</div>
    <EvidenceDrawer />
  </section>;

  if (section === "population") return <section className="published-case lesson-screen">
    <div className="lesson-heading"><div><SourceBadge /><span className="eyebrow">Toxicologist’s decision</span><h2>Write the conclusion the evidence deserves.</h2><p>A good conclusion is specific, cautious and connected to an observation.</p></div><span className="lesson-number">05</span></div>
    <div className="conclusion-builder"><div><h3>Choose your conclusion</h3><div className="lesson-choices vertical"><Choice value="supported" answer={answer} onAnswer={setAnswer}>In this rat study, acetaminophen exposure was associated with dose- and time-related liver pathology.</Choice><Choice value="noael" answer={answer} onAnswer={setAnswer}>The study proves a precise numerical NOAEL from the information shown.</Choice><Choice value="all" answer={answer} onAnswer={setAnswer}>Acetaminophen always causes identical liver failure in all animals and humans.</Choice></div></div><aside><span className="eyebrow">Conclusion checklist</span><ul><li>Names the model and compound</li><li>Describes the observed organ response</li><li>Avoids unsupported thresholds</li><li>Avoids unsupported human translation</li></ul></aside></div>
    {answer && <div className={`conclusion-feedback ${answer === "supported" ? "correct" : "incorrect"}`}><b>{answer === "supported" ? "Evidence-aligned conclusion" : "Conclusion overreaches the evidence"}</b><p>{answer === "supported" ? "You identified the model, exposure pattern and target organ without inventing a threshold." : "Return to the observations and remove claims the available dataset cannot establish."}</p></div>}
  </section>;

  return <section className="published-case lesson-screen">
    <div className="lesson-finale"><span className="lesson-complete">Practical complete</span><h2>You followed the toxicologist’s reasoning loop.</h2><p>You moved from a biological question to a controlled design, made a prediction, interpreted a published pattern and judged the limits of the evidence.</p><div className="lesson-recap"><span><b>Question</b>Can exposure affect the rat liver?</span><span><b>Design</b>Control plus increasing gavage doses</span><span><b>Observation</b>Dose–time-associated hepatic pathology</span><span><b>Judgement</b>Supported in this model; no numerical NOAEL or human dose claimed</span></div></div>
    <div className="next-learning"><div><span className="eyebrow">What you should now understand</span><h3>Data do not speak without a comparison.</h3><p>The skill is not memorising 1,000 mg/kg. It is recognising how controls, exposure groups, time points and pathology combine into a defensible conclusion.</p></div><div><span className="eyebrow">Optional next challenge</span><h3>Open Model Sandbox</h3><p>Change a fictional model’s dose or duration and test whether its predicted pattern resembles the published case. Predictions remain clearly labelled.</p></div></div>
    <EvidenceDrawer />
  </section>;
}
