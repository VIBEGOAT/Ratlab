import { useState } from "react";
import { REFERENCES, animalsSpared } from "@eliminate/sim-core";
import { Banner, Chip, Panel, Stat, TabHead, f1 } from "../components/ui";

function Field({ label, value, onChange, step = 1, max }: { label: string; value: number; onChange: (v: number) => void; step?: number; max?: number }) {
  const id = `pf-${label.replace(/\W/g, "")}`;
  return <label className="field" htmlFor={id}>{label}<input id={id} type="number" value={value} step={step} min={0} max={max} onChange={(e) => onChange(+e.target.value)} /></label>;
}

const DIFFS = [
  ["Organ-resolved, not a single curve", "Exposure, injury, blood markers, clinical signs and behaviour come from one simulated body, so a change in one can be traced to its cause."],
  ["Untreated twin", "The same animal with no dose. A live study cannot compare an animal with itself."],
  ["Humane endpoints shown, not suffered", "The tool says on which day a live animal would have been euthanised and why, so safer dose levels can be chosen before any animal is used."],
  ["Honest by construction", "Every subsystem carries a fidelity label. Every constant says if it is verified. Validation reads NO_DATA until real data is loaded."],
  ["Reproducible and auditable", "Each run is fixed by a seed and a version. Exports carry both, plus the fidelity labels."],
  ["Credibility built in", "A V&V 40 style report shows what is missing for a stated use, rather than hiding it."],
] as const;

export default function PitchTab() {
  const [studies, setStudies] = useState(20);
  const [groups, setGroups] = useState(3);
  const [n, setN] = useState(10);
  const [screen, setScreen] = useState(30);
  const [vcg, setVcg] = useState(0);
  const r = animalsSpared({ studiesPerYear: studies, treatedGroups: groups, animalsPerGroup: n, screenedOutShare: screen / 100, virtualControlShare: vcg / 100 });
  return (
    <>
      <TabHead title="Pitch" blurb="What this project offers and the numbers behind it. Everything below is a claim to test, not a result." />
      <Banner tone="warn">The tool does not replace animal studies. It aims to reduce and refine animal use by screening, by choosing doses, and by showing humane endpoints in advance. Until validated, treat the numbers below as an exercise with your own assumptions.</Banner>
      <div className="grid wide">
        <Panel title="Animals spared calculator">
          <p className="small muted">Edit the assumptions. The defaults are examples, not data.</p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <Field label="Studies per year" value={studies} onChange={setStudies} />
            <Field label="Treated groups per study" value={groups} onChange={setGroups} />
            <Field label="Animals per group" value={n} onChange={setN} />
            <Field label="Studies removed by virtual screening (%)" value={screen} onChange={(v) => setScreen(Math.min(100, v))} max={100} />
            <Field label="Control animals replaced by virtual controls (%)" value={vcg} onChange={(v) => setVcg(Math.min(100, v))} max={100} />
          </div>
          <div className="stats">
            <Stat label="Animals per year today" value={f1(r.baselineAnimals, 0)} />
            <Stat label="With the tool" value={f1(r.withTool, 0)} />
            <Stat label="Animals spared" value={f1(r.spared, 0)} tone="good" hint={`${f1(r.sparedShare * 100, 0)}% fewer`} />
          </div>
          <p className="small muted">Virtual controls default to 0% because they need matched real historical control data and regulator acceptance. Screening can only remove a study if its prediction is trusted for that purpose, which the credibility tab shows is not yet the case.</p>
        </Panel>
        <Panel title="What is different">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {DIFFS.map(([h, t]) => <div key={h}><b>{h}.</b> <span className="muted">{t}</span></div>)}
          </div>
          <p className="small muted">Existing platforms such as PK-Sim, Simcyp, GastroPlus and DILIsym are mature prior art. This project makes no claim to outperform them.</p>
        </Panel>
      </div>
      <Panel title="References">
        <p className="small muted">VERIFIED means the bibliographic record was confirmed against a live source. It does not mean every number taken from the paper was checked.</p>
        <div className="scroll"><table>
          <thead><tr><th>Status</th><th>Reference</th><th>Used for</th></tr></thead>
          <tbody>{REFERENCES.map((x) => (
            <tr key={x.id}>
              <td><Chip kind={x.status}>{x.status}</Chip></td>
              <td>{x.authors} ({x.year ?? "n.d."}). {x.title}. <span className="muted">{x.venue}</span>{x.doi ? <> · <a href={`https://doi.org/${x.doi}`} target="_blank" rel="noreferrer">doi:{x.doi}</a></> : x.url ? <> · <a href={x.url} target="_blank" rel="noreferrer">link</a></> : null}{x.note ? <div className="small muted">{x.note}</div> : null}</td>
              <td className="small">{x.usedFor}</td>
            </tr>))}</tbody>
        </table></div>
      </Panel>
    </>
  );
}
