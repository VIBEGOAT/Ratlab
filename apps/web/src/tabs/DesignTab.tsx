import { ORGANS, constant, type Organ, type TdOrganParams } from "@eliminate/sim-core";
import { useStore } from "../store";
import { buildDesign, compoundOf, guidelineChecks, ORGAN_LABEL } from "../lib/setup";
import { Banner, Chip, Fidelity, Panel, TabHead } from "../components/ui";

function Field({ label, value, onChange, step = 0.01, min = 0 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  const id = `cf-${label.replace(/\W/g, "")}`;
  return <label className="field" htmlFor={id}>{label}<input id={id} type="number" value={value} step={step} min={min} onChange={(e) => onChange(+e.target.value)} /></label>;
}

const TEMPLATE_CONC: TdOrganParams = { driver: "conc", thr: 10, kinj: 0.01, kreg: 0.002, kdefUse: 0, kdefSyn: 0, gate0: 1, kad: 0, kadDecay: 0, adMax: 0 };
const TEMPLATE_LIVER: TdOrganParams = { driver: "reactive", thr: 40, kinj: 0.25, kreg: 0.004, kdefUse: 0.6, kdefSyn: 0.04, gate0: 0.02, kad: 0.002, kadDecay: 0.001, adMax: 1 };

function CustomEditor() {
  const setup = useStore((s) => s.setup);
  const set = useStore((s) => s.setSetup);
  const c = setup.custom;
  const organ = (Object.keys(c.td)[0] ?? "liver") as Organ;
  const td = c.td[organ] ?? TEMPLATE_CONC;
  const upd = (patch: Partial<typeof c>) => set({ custom: { ...c, ...patch } });
  const updTd = (patch: Partial<TdOrganParams>) => upd({ td: { [organ]: { ...td, ...patch } } });
  const targetKp = organ;
  return (
    <Panel title="Custom compound editor" right={<Chip kind="ILLUSTRATIVE">fictional</Chip>}>
      <p className="small muted">Generic ADME and toxicity parameters. Use it to explore how each parameter moves exposure and organ injury. Values outside the ranges the archetypes use are extrapolation.</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Field label="Absorption rate ka (1/h)" value={c.ka} onChange={(v) => upd({ ka: v })} />
        <Field label="Fraction absorbed" value={c.fAbs} onChange={(v) => upd({ fAbs: Math.min(1, v) })} />
        <Field label="Fraction unbound (plasma)" value={c.fu} onChange={(v) => upd({ fu: Math.min(1, v) })} />
        <Field label="Hepatic CLint (L/h/kg)" value={c.clIntLPerHPerKg} onChange={(v) => upd({ clIntLPerHPerKg: v })} />
        <Field label="Renal CL (L/h/kg)" value={c.clRenalLPerHPerKg} onChange={(v) => upd({ clRenalLPerHPerKg: v })} />
        <Field label="Reactive metabolite fraction" value={c.fReactive} onChange={(v) => upd({ fReactive: Math.min(1, v) })} />
        <Field label="Female clearance factor" value={c.femaleClFactor} onChange={(v) => upd({ femaleClFactor: v })} />
        <Field label="Tissue unbound fraction" value={c.fuTissue} onChange={(v) => upd({ fuTissue: Math.min(1, v) })} />
        <label className="field" htmlFor="cf-organ">Target organ
          <select id="cf-organ" value={organ} onChange={(e) => { const o = e.target.value as Organ; upd({ td: { [o]: o === "liver" ? { ...TEMPLATE_LIVER } : { ...TEMPLATE_CONC } } }); }}>
            {ORGANS.map((o) => <option key={o} value={o}>{ORGAN_LABEL[o]}</option>)}
          </select>
        </label>
        <Field label={`Kp in ${ORGAN_LABEL[organ].toLowerCase()}`} value={c.kp[targetKp === "marrow" ? "marrow" : targetKp]} step={0.1} onChange={(v) => upd({ kp: { ...c.kp, [targetKp]: Math.max(0.01, v) } })} />
        <Field label={td.driver === "reactive" ? "Threshold (mg/h/L)" : "Threshold (mg/L)"} value={td.thr} step={1} onChange={(v) => updTd({ thr: Math.max(0.001, v) })} />
        <Field label="Injury rate (1/h)" value={td.kinj} step={0.001} onChange={(v) => updTd({ kinj: v })} />
        <Field label="Regeneration rate (1/h)" value={td.kreg} step={0.0005} onChange={(v) => updTd({ kreg: v })} />
      </div>
    </Panel>
  );
}

export default function DesignTab() {
  const setup = useStore((s) => s.setup);
  const compound = compoundOf(setup);
  const design = buildDesign(setup);
  const checks = guidelineChecks(setup, constant);
  return (
    <>
      <TabHead title="Study design" blurb="A repeated-dose study laid out in the manner of OECD TG 407 (28 day) and TG 408 (90 day): a vehicle control and three dose groups, optional recovery and toxicokinetic satellites, both sexes, randomised littermates." fidelity={["pbpk", "toxicodynamics"]} />
      <div className="grid">
        <Panel title="Groups">
          <div className="scroll"><table>
            <thead><tr><th>ID</th><th>Group</th><th>Type</th><th className="num">Dose mg/kg</th><th className="num">n per sex</th></tr></thead>
            <tbody>{design.groups.map((g) => <tr key={g.id}><td>{g.id}</td><td>{g.label}</td><td>{g.kind}</td><td className="num">{g.doseMgPerKg.toFixed(1)}</td><td className="num">{g.nPerSex ?? design.nPerSexPerGroup}</td></tr>)}</tbody>
          </table></div>
          <p className="small muted">Dosing {design.route === "diet" ? "in the diet" : design.route === "iv" ? "by IV bolus" : "by gavage"} every {design.intervalH} h for {design.durationDays} days. Recovery groups are observed {design.recoveryDays} more days.</p>
        </Panel>
        <Panel title="Check against OECD TG 407 minimums">
          {checks.map((c) => <div key={c.item} style={{ display: "flex", gap: 8 }}><Chip kind={c.ok ? "PASS" : "FAIL"}>{c.ok ? "OK" : "CHECK"}</Chip><span><b>{c.item}.</b> <span className="muted">{c.note}</span></span></div>)}
          <p className="small muted">Minimums come from the TG 407 text recorded as VERIFIED in the reference data. Details of TG 408 are still unverified.</p>
        </Panel>
      </div>
      <Panel title={compound.name} right={<Fidelity id="toxicodynamics" />}>
        <p>{compound.description}</p>
        <div className="scroll"><table>
          <thead><tr><th>Target organ</th><th>Exposure driver</th><th className="num">Threshold</th><th className="num">Injury rate /h</th><th className="num">Regeneration /h</th><th className="num">Defence gate</th></tr></thead>
          <tbody>{Object.entries(compound.td).map(([o, t]) => <tr key={o}><td>{ORGAN_LABEL[o as Organ]}</td><td>{t.driver === "reactive" ? "reactive metabolite flux" : "unbound tissue concentration"}</td><td className="num">{t.thr}</td><td className="num">{t.kinj}</td><td className="num">{t.kreg}</td><td className="num">{t.gate0}</td></tr>)}</tbody>
        </table></div>
        <p className="small muted">Tuned dose range {compound.tunedDoseRange[0]} to {compound.tunedDoseRange[1]} mg/kg. Outside it, results are extrapolation.</p>
      </Panel>
      {setup.compoundKey === "custom" ? <CustomEditor /> : <Banner tone="info">Choose "Custom compound" in the left panel to edit ADME and toxicity parameters.</Banner>}
    </>
  );
}
