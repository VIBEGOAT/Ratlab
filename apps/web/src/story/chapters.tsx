import { behaviorTelemetry } from "../three/behaviorTelemetry";
import { useMemo, useState } from "react";
import { CONSTANTS, CONTEXT_PRESETS, FIDELITY, REFERENCES, animalsSpared, listUnverifiedConstants, assessCredibility, humanEquivalentDose, kaplanMeier, maxRecommendedStartingDose, wilson, type AnimalBundle, type RatOutcome, type TwinBundle } from "@eliminate/sim-core";
import { LineChart } from "../components/Chart";
import { Chip, Fidelity } from "../components/ui";
import { fmt, fmtInt, fmtPct } from "../design/format";
import { GRADE_VAR, GRADE_WORD } from "../design/damage";
import { useStore } from "../store";
import { download, studyToHtml } from "../lib/export";
import { outcomeCounts } from "./overlays";

/** Chapter 7. Same animal, with and without treatment. */
export function ChapterTwin({ tw, day, split }: { tw: TwinBundle | null; day: number; split: number }) {
  if (!tw) return null;
  const t = tw.treated, u = tw.untreated;
  const rows: Array<[string, string, string]> = [
    ["Tumour", t.daily.tumorVolume[day]! > 0 ? `${fmtInt(t.daily.tumorVolume[day]!)} mm³` : "none", u.daily.tumorVolume[day]! > 0 ? `${fmtInt(u.daily.tumorVolume[day]!)} mm³` : "none"],
    ["Body weight", `${fmtInt(t.daily.bodyWeightG[day]!)} g`, `${fmtInt(u.daily.bodyWeightG[day]!)} g`],
    ["Sickness index", fmt(t.daily.sickness[day]!, 2), fmt(u.daily.sickness[day]!, 2)],
    ["Heart injury", GRADE_WORD[Math.min(5, Math.round(t.daily.damage.heart[day]! * 6))]!, GRADE_WORD[Math.min(5, Math.round(u.daily.damage.heart[day]! * 6))]!],
  ];
  return (
    <>
      <p className="lede">The same rat, with and without treatment. A real animal can only ever be one of these.</p>
      <p className="small muted">Drag the divider, or use the arrow keys. Day {day}.</p>
      <div className="compare" role="table" aria-label="Treated against untreated twin">
        <div role="row" className="compare-head"><span role="columnheader"><span className="sr-only">Measure</span></span><b role="columnheader">Treated</b><b role="columnheader">Untreated</b></div>
        {rows.map(([k, a, b]) => <div role="row" key={k}><span role="rowheader" className="muted">{k}</span><b role="cell">{a}</b><b role="cell">{b}</b></div>)}
      </div>
      {u.humane && <p className="small">Without treatment this rat reaches a humane endpoint on day {u.humane.day}. {t.humane ? `With treatment, on day ${t.humane.day}.` : "With treatment, it does not."}</p>}
      <span className="sr-only">Divider at {Math.round(split * 100)} percent.</span>
    </>
  );
}

/** Chapter 8. The forecast. */
export function ChapterForecast({ pop, days, progress, doseMgPerKg, mode, setMode, sorted, setSorted }: {
  pop: { status: string; done: number; total: number; treated: RatOutcome[]; untreated: RatOutcome[]; error?: string };
  days: number; progress: number; doseMgPerKg: number; mode: "treated" | "untreated"; setMode: (m: "treated" | "untreated") => void; sorted: boolean; setSorted: (s: boolean) => void;
}) {
  const n = pop.total / 2 || 1000;
  const T = pop.treated, U = pop.untreated;
  const reveal = Math.min(1, Math.max(0, (progress - 0.2) / 0.5));
  const cut = reveal * days;
  const curve = (o: RatOutcome[]) => {
    if (o.length === 0) return { x: [0], y: [1] };
    const km = kaplanMeier(o.map((r) => r.humaneDay ?? days), o.map((r) => r.humaneDay !== null));
    const x: number[] = [], y: number[] = [];
    for (const s of km) if (s.t <= cut) { x.push(s.t); y.push(s.survival); }
    const last = y[y.length - 1] ?? 1;
    x.push(cut); y.push(last);
    return { x, y };
  };
  const ct = useMemo(() => curve(T), [T, cut]); // eslint-disable-line react-hooks/exhaustive-deps
  const cu = useMemo(() => curve(U), [U, cut]); // eslint-disable-line react-hooks/exhaustive-deps
  const humT = T.filter((r) => r.humaneDay !== null).length, humU = U.filter((r) => r.humaneDay !== null).length;
  const wT = wilson(humT, Math.max(1, T.length)), wU = wilson(humU, Math.max(1, U.length));
  const counts = outcomeCounts(T);
  const running = pop.status === "running" || pop.status === "idle";
  return (
    <>
      <p className="lede">{fmtInt(n)} virtual rats, each with its own body and its own luck.</p>
      <p className="small muted" role="status">{running ? `Simulating… ${fmtInt(pop.done)} of ${fmtInt(pop.total)}` : `Dose ${fmtInt(doseMgPerKg)} mg/kg/day for ${days} days.`}</p>
      <div className="segmented" role="group" aria-label="Show">
        <button type="button" aria-pressed={mode === "treated"} onClick={() => setMode("treated")}>Treated</button>
        <button type="button" aria-pressed={mode === "untreated"} onClick={() => setMode("untreated")}>Untreated</button>
      </div>
      <label className="checks small"><input type="checkbox" checked={sorted} onChange={(e) => setSorted(e.target.checked)} />Order bands by severity</label>
      {mode === "treated" && (
        <div className="legend" aria-label="Colour key">{GRADE_WORD.map((w, g) => <span key={w}><i style={{ background: GRADE_VAR[g] }} />{w} {counts[g]}</span>)}<span><i style={{ background: "transparent", border: "2px solid var(--ink)", height: 8, width: 8, borderRadius: 4 }} />humane endpoint</span></div>
      )}
      <div className="forecast-stats">
        <div><span className="eyebrow">Humane endpoint, treated</span><b>{T.length ? fmtPct(wT.p, 1) : "…"}</b><span className="small muted">{T.length ? `95% range ${fmtPct(wT.low, 1)} to ${fmtPct(wT.high, 1)}${T.length < n ? ` (so far, ${fmtInt(T.length)} rats)` : ""}` : "waiting for the first rats"}</span></div>
        <div><span className="eyebrow">Humane endpoint, untreated</span><b>{U.length ? fmtPct(wU.p, 1) : "…"}</b><span className="small muted">{U.length ? `95% range ${fmtPct(wU.low, 1)} to ${fmtPct(wU.high, 1)}${U.length < n ? ` (so far, ${fmtInt(U.length)} rats)` : ""}` : "waiting for the first rats"}</span></div>
      </div>
      <LineChart label="Survival without a humane endpoint" height={190} xLabel="Study day" yLabel="Rats without a humane endpoint" xMin={0} xMax={days} yMin={0} yMax={1} fmtY={(v) => `${Math.round(v * 100)}%`}
        series={[{ name: "Treated", x: ct.x, y: ct.y, color: "var(--c1)", step: true }, { name: "Untreated", x: cu.x, y: cu.y, color: "var(--c6)", step: true }]} />
      <div className="legend"><span><i style={{ background: "var(--c1)" }} />Treated</span><span><i style={{ background: "var(--c6)" }} />Untreated</span></div>
      <p className="small muted">Ranges show how much chance alone can move these figures with {fmtInt(n)} rats. They do not include uncertainty in the model's parameters, which are still unverified.</p>
    </>
  );
}

/** Chapter 9. Behaviour, labelled as modelled. */
export function ChapterBehaviour({ tw }: { tw: TwinBundle | null }) {
  if (!tw) return null;
  const t=behaviorTelemetry(tw.treated),u=behaviorTelemetry(tw.untreated);
  const rows: Array<[string,string,string]> = [["Locomotor velocity",`${t.velocity.toFixed(1)} / ${u.velocity.toFixed(1)} cm/s`,'50 cm arena calibration'],["Exploration",`${t.exploration.toFixed(1)} / ${u.exploration.toFixed(1)} entries/min`,'Center entries; rearing is not modelled'],["Rest index",`${(t.rest*100).toFixed(0)}% / ${(u.rest*100).toFixed(0)}%`,'Intervals below the movement threshold']];
  return <><p className="lede">Open-field actigraphy. One clear comparison.</p><p className="small muted">Dosed / control · illustrative tracks</p><div className="behavior-kpis">{rows.map(([label,value,note])=><div key={label}><span className="eyebrow">{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div><Fidelity id="behaviour"/></>;

}

/** Chapter 10. Toward humans. Arithmetic only. */
export function ChapterHuman({ noael, scaled }: { noael: number | null; scaled: { hed: number | null; mrsdMg: number | null } }) {
  return (
    <>
      <p className="lede">Doses scale by body surface, not by weight.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><Fidelity id="translation" /><Chip kind="UNVERIFIED">Km factors unverified</Chip></div>
      {noael === null || scaled.hed === null ? (
        <p className="small">No dose level in this study was free of adverse effects, so there is no starting dose to scale. Lower the dose levels to find one.</p>
      ) : (
        <div className="forecast-stats">
          <div><span className="eyebrow">Rat NOAEL</span><b>{fmt(noael, 1)}</b><span className="small muted">mg/kg/day</span></div>
          <div><span className="eyebrow">Human equivalent</span><b>{fmt(scaled.hed, 2)}</b><span className="small muted">mg/kg/day</span></div>
          <div><span className="eyebrow">Illustrative starting-dose arithmetic</span><b>{fmt(scaled.mrsdMg, 1)}</b><span className="small muted">mg for 60 kg, after a 10× safety factor</span></div>
        </div>
      )}
      <p className="small muted">This is scaling arithmetic on a simulated NOAEL of a fictional compound. It has not been compared with any human outcome and must never guide a real dose.</p>
    </>
  );
}

export function scaleDose(noael: number | null): { hed: number | null; mrsdMg: number | null } {
  if (noael === null || !(noael > 0)) return { hed: null, mrsdMg: null };
  return { hed: humanEquivalentDose(noael), mrsdMg: maxRecommendedStartingDose(noael).mrsdMgFor60Kg };
}

/** Chapter 11. How much to trust it. */
export function ChapterTrust() {
  const goLab = useStore((s) => s.goLab);
  const [key, setKey] = useState<keyof typeof CONTEXT_PRESETS>("education");
  const report = useMemo(() => assessCredibility(CONTEXT_PRESETS[key]!), [key]);
  const labels: Record<string, string> = { education: "Teaching", screening: "Screening compounds", designAid: "Designing a study", replacement: "Replacing an animal study" };
  const ids = [...new Set(FIDELITY.map((f) => f.id))].filter((i) => ["pbpk", "pd", "toxicodynamics", "clinpath", "disease", "behaviour", "translation", "validation"].includes(i));
  const gaps = report.factors.filter((f) => f.shortfall > 0);
  return (
    <>
      <p className="lede">Honesty is a feature. Here is exactly how far to trust this.</p>
      <div className="stats"><div className="stat bad"><span>Validated against animal data</span><b>None yet</b></div><div className="stat warn"><span>Unverified parameters</span><b>{listUnverifiedConstants().length} / {Object.keys(CONSTANTS).length}</b></div></div>
      <h3>What would you use it for?</h3>
      <div className="segmented wrap" role="group" aria-label="Intended use">
        {(Object.keys(CONTEXT_PRESETS) as Array<keyof typeof CONTEXT_PRESETS>).map((k) => <button key={k} type="button" aria-pressed={key === k} onClick={() => setKey(k)}>{labels[k]}</button>)}
      </div>
      <div className={`banner ${report.adequate ? "good" : "bad"}`} role="status">
        <b>{report.adequate ? "Adequate for this use." : "Not yet credible for this use."}</b> Model risk {report.risk}. {report.adequate ? "Teaching needs verified code and honest labels, which exist." : `${gaps.length} of ${report.factors.length} credibility factors fall short. The biggest gaps: no comparison with animal data, and unverified inputs.`}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{ids.map((i) => <Fidelity key={i} id={i} />)}</div>
      <p className="small muted">Structured after the ASME V&amp;V 40 credibility framework, written for medical devices and applied here by analogy.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => goLab("trust", "validation")}>Validation roadmap</button>
        <button onClick={() => goLab("trust", "fidelity")}>Every parameter and source</button>
      </div>
    </>
  );
}

/** Chapter 12. What it could spare. */
export function ChapterFinale({ initial }: { initial: { studiesPerYear: number; treatedGroups: number; animalsPerGroup: number; screenedOutShare: number; virtualControlShare: number } }) {
  const goLab = useStore((s) => s.goLab);
  const data = useStore((s) => s.study.data);
  const [a, setA] = useState(initial);
  const r = animalsSpared(a);
  const num = (id: string, label: string, v: number, set: (x: number) => void, max?: number, pct?: boolean) => (
    <label className="field" htmlFor={id}>{label}<input id={id} type="number" min={0} max={max} value={pct ? Math.round(v * 100) : v} onChange={(e) => set(pct ? Math.min(1, Math.max(0, +e.target.value / 100)) : Math.max(0, +e.target.value))} /></label>
  );
  const verified = REFERENCES.filter((x) => x.status === "VERIFIED" && ["fda-moda-2.0-2022", "fda-roadmap-2025", "steger-hartmann-2020", "oecd-tg407", "oecd-gd19", "igarashi-2015"].includes(x.id));
  return (
    <>
      <p className="lede">What a lab could spare, on assumptions you can change.</p>
      <div className="calc">
        {num("sp-studies", "Studies a year", a.studiesPerYear, (x) => setA({ ...a, studiesPerYear: x }))}
        {num("sp-groups", "Dose groups per study", a.treatedGroups, (x) => setA({ ...a, treatedGroups: x }))}
        {num("sp-n", "Animals per group", a.animalsPerGroup, (x) => setA({ ...a, animalsPerGroup: x }))}
        {num("sp-screen", "Studies avoided by screening (%)", a.screenedOutShare, (x) => setA({ ...a, screenedOutShare: x }), 100, true)}
        {num("sp-vcg", "Controls replaced by virtual controls (%)", a.virtualControlShare, (x) => setA({ ...a, virtualControlShare: x }), 100, true)}
      </div>
      <div><div className="big-number" aria-live="polite">{fmtInt(r.spared)}</div><p className="big-caption">fewer animals a year on these assumptions ({fmtPct(r.sparedShare)}), from {fmtInt(r.baselineAnimals)}. Virtual controls start at 0% because they need real matched historical data and regulator acceptance.</p></div>
      <ul className="facts diffs">
        <li><b>Twin</b><span>The same animal with and without treatment. Reality cannot offer that.</span></li>
        <li><b>Humane</b><span>The day an animal would have suffered, shown before anyone is.</span></li>
        <li><b>Honest</b><span>Every part labelled. Every unverified number counted.</span></li>
      </ul>
      <div className="small muted"><b style={{ color: "var(--ink-2)" }}>Verified sources.</b>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{verified.map((x) => <li key={x.id}>{x.authors} ({x.year}). {x.title}.{x.doi ? <> <a href={`https://doi.org/${x.doi}`} target="_blank" rel="noreferrer">doi:{x.doi}</a></> : null}</li>)}</ul>
        <p style={{ marginTop: 6 }}>The full list, with unverified items marked, is in the Lab.</p>
      </div>
      <div className="cta">
        <button className="primary" onClick={() => goLab("design")}>Open the Lab</button>
        <button disabled={!data} onClick={() => data && download("study-report.html", studyToHtml(data), "text/html")}>Download study report</button>
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>Research and education tool. It reduces and refines animal use today. It does not replace animal studies.</p>
    </>
  );
}

export type { AnimalBundle };
