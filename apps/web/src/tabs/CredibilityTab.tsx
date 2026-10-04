import { useState } from "react";
import { CONTEXT_PRESETS, ORGANS, assessCredibility, type ContextOfUse, type Level, type Organ } from "@eliminate/sim-core";
import { BarList } from "../components/Chart";
import { Banner, Chip, NeedsStudy, Panel, TabHead } from "../components/ui";
import { useStore } from "../store";
import { ORGAN_LABEL } from "../lib/setup";

const PRESET_LABEL: Record<string, string> = { education: "Teaching and demonstration", screening: "Screening before animal studies", designAid: "Study design aid", replacement: "Replace a regulatory animal study" };
const LEVELS: Level[] = ["low", "medium", "high"];

export default function CredibilityTab() {
  const [preset, setPreset] = useState("education");
  const [cou, setCou] = useState<ContextOfUse>(CONTEXT_PRESETS.education!);
  const morris = useStore((s) => s.morris);
  const runMorris = useStore((s) => s.runMorris);
  const [organ, setOrgan] = useState<Organ>("liver");
  const report = assessCredibility(cou);
  const max = morris.data ? Math.max(...morris.data.map((m) => m.muStar), 1e-9) : 1;
  return (
    <>
      <TabHead title="Uncertainty and credibility" blurb="How much the model can be trusted for a stated purpose. The structure follows the ASME V&V 40 risk-informed credibility framework: context of use, model risk, then evidence for each credibility factor." fidelity={["montecarlo", "validation"]} />
      <Panel title="1. Context of use">
        <label className="field" htmlFor="cou-preset">Start from
          <select id="cou-preset" value={preset} onChange={(e) => { setPreset(e.target.value); setCou(CONTEXT_PRESETS[e.target.value]!); }}>
            {Object.keys(CONTEXT_PRESETS).map((k) => <option key={k} value={k}>{PRESET_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="cou-q">Question the model must answer<textarea id="cou-q" rows={2} value={cou.question} onChange={(e) => setCou({ ...cou, question: e.target.value })} /></label>
        <label className="field" htmlFor="cou-role">Role of the result<input id="cou-role" type="text" value={cou.role} onChange={(e) => setCou({ ...cou, role: e.target.value })} /></label>
        <div className="grid">
          <label className="field" htmlFor="cou-inf">Model influence on the decision
            <select id="cou-inf" value={cou.modelInfluence} onChange={(e) => setCou({ ...cou, modelInfluence: e.target.value as Level })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          </label>
          <label className="field" htmlFor="cou-cons">Consequence if the model is wrong
            <select id="cou-cons" value={cou.decisionConsequence} onChange={(e) => setCou({ ...cou, decisionConsequence: e.target.value as Level })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
          </label>
        </div>
      </Panel>
      <Panel title="2. Model risk and verdict" right={<Chip kind={report.adequate ? "PASS" : "FAIL"}>risk {report.risk}</Chip>}>
        <Banner tone={report.adequate ? "good" : "bad"}>{report.summary}</Banner>
        <p className="small muted">The risk matrix and the 0 to 3 evidence scale are an illustrative mapping. V&V 40 was written for medical devices and is applied here by analogy.</p>
      </Panel>
      <Panel title="3. Credibility factors">
        <div className="scroll"><table>
          <thead><tr><th>Factor</th><th>Area</th><th className="num">Achieved</th><th className="num">Required</th><th>Evidence and gap</th></tr></thead>
          <tbody>{report.factors.map((f) => (
            <tr key={f.id} className={f.shortfall > 0 ? "flag" : ""}>
              <td>{f.name}</td><td>{f.category}</td><td className="num">{f.achieved}</td><td className="num">{f.required}</td>
              <td className="small">{f.evidence.join("; ")}{f.gap ? <><br /><span className="muted">Gap: {f.gap}</span></> : null}</td>
            </tr>))}</tbody>
        </table></div>
      </Panel>
      <NeedsStudy>
        {() => (
          <Panel title="Sensitivity: which parameters matter (Morris screening)" right={
            <div style={{ display: "flex", gap: 8 }}>
              <select value={organ} onChange={(e) => setOrgan(e.target.value as Organ)} aria-label="Target organ" style={{ width: "auto" }}>{ORGANS.map((o) => <option key={o} value={o}>{ORGAN_LABEL[o]}</option>)}</select>
              <button className="primary" disabled={morris.status === "running"} onClick={() => runMorris(organ)}>{morris.status === "running" ? "Running…" : "Run screening"}</button>
            </div>}>
            <p className="small muted">Each compound parameter is varied by a factor of 3 either way. The bar shows the mean absolute effect (μ*) on peak damage in the chosen organ for the highest-dose animal. Large σ means nonlinearity or interaction.</p>
            {morris.status === "error" && <Banner tone="bad">{morris.error}</Banner>}
            {morris.data ? <BarList max={max} fmt={(v) => v.toFixed(3)} items={[...morris.data].sort((a, b) => b.muStar - a.muStar).map((m) => ({ label: m.name, value: m.muStar, note: `sigma ${m.sigma.toFixed(3)}` }))} /> : <p className="muted">Press Run screening.</p>}
          </Panel>
        )}
      </NeedsStudy>
    </>
  );
}
