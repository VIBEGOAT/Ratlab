import { useState } from "react";
import { PublishedCaseView } from "../app/PublishedCaseView";
import type { LabSection } from "../store";

const STEPS: Array<{ id: LabSection; label: string; hint: string }> = [
  { id: "design", label: "Start the practical", hint: "Question and study design" },
  { id: "overview", label: "Make a prediction", hint: "Commit before the reveal" },
  { id: "animal", label: "Follow the dose", hint: "Administration to excretion" },
  { id: "data", label: "Read the evidence", hint: "Find the dose–time pattern" },
  { id: "population", label: "Make a conclusion", hint: "Reason like a toxicologist" },
  { id: "trust", label: "Review and reflect", hint: "Feedback and sources" },
];

export function AcetaminophenPractical({ onExit }: { onExit: () => void }) {
  const [section, setSection] = useState<LabSection>("design");
  const active = STEPS.findIndex((step) => step.id === section);
  const go = (next: LabSection) => setSection(next);

  return <main id="main" className="learn-case-page">
    <header className="learn-case-header">
      <div><span className="eyebrow">VAST classroom · Practical 02</span><h1>Acetaminophen and the rat liver</h1><p>Published-case reasoning for undergraduate toxicology.</p></div>
      <button type="button" className="ghost" onClick={onExit}>← All Learn practicals</button>
    </header>
    <div className="learn-case-progress" aria-label="Practical progress"><span style={{ width: `${((active + 1) / STEPS.length) * 100}%` }} /></div>
    <nav className="learn-case-steps" aria-label="Acetaminophen practical steps">
      {STEPS.map((step, index) => <button key={step.id} type="button" aria-current={step.id === section ? "step" : undefined} onClick={() => go(step.id)}><small>{String(index + 1).padStart(2, "0")}</small><span><b>{step.label}</b><em>{step.hint}</em></span></button>)}
    </nav>
    <div className="learn-case-content" key={section}><PublishedCaseView section={section} standalone onContinue={go} /></div>
  </main>;
}
