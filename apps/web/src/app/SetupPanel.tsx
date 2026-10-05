/* eslint-disable jsx-a11y/label-has-associated-control --
   These labels have visible text in nested spans and an explicit htmlFor/id pair; the rule cannot see through the spans. */
import { ARCHETYPES } from "@eliminate/sim-core";
import { useStore, useResultsStale } from "../store";
import { COMPOUNDS, designProblems, type DiseaseChoice } from "../lib/setup";
import { fmtInt } from "../design/format";

/** Study setup with progressive disclosure: four primary choices, everything else under Advanced. */
export function SetupPanel() {
  const setup = useStore((s) => s.setup);
  const set = useStore((s) => s.setSetup);
  const study = useStore((s) => s.study);
  const stale = useResultsStale();
  const problems = designProblems(setup);
  const pickCompound = (key: string) => set({ compoundKey: key, highDose: key === "custom" ? setup.custom.defaultDoseMgPerKg : ARCHETYPES[key]!.defaultDoseMgPerKg });

  return (
    <section className="panel" aria-labelledby="setup-title">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 id="setup-title">Design the study</h2>
        <RunStatus />
      </div>

      <div className="field">Test compound <span className="small">All compounds are fictional archetypes.</span></div>
      <div className="cards" role="group" aria-label="Test compound">
        {COMPOUNDS.map((c) => (
          <button key={c.key} type="button" className="ccard" aria-pressed={setup.compoundKey === c.key} onClick={() => pickCompound(c.key)}>
            <b>{c.name}</b><span>{c.sub}</span>
          </button>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label className="field" htmlFor="top-dose">
          <span className="row"><span>Highest dose</span><b>{fmtInt(setup.highDose)} mg/kg/day</b></span>
          <input id="top-dose" type="range" min={1} max={Math.max(400, setup.highDose)} step={1} value={setup.highDose} onChange={(e) => set({ highDose: +e.target.value })} />
          <span className="small">Low and mid doses are {Math.round(setup.fractions[0] * 100)}% and {Math.round(setup.fractions[1] * 100)}% of this.</span>
        </label>
        <div className="field">
          <span>Study length</span>
          <div className="segmented" role="group" aria-label="Study length">
            {[7, 14, 28, 90].map((d) => <button key={d} type="button" aria-pressed={setup.durationDays === d} onClick={() => set({ durationDays: d })}>{d} days</button>)}
          </div>
          <span className="small">{setup.recovery ? `Plus ${setup.recoveryDays} recovery days for recovery groups.` : "No recovery period."}</span>
        </div>
        <label className="field" htmlFor="disease">Disease model
          <select id="disease" value={setup.disease} onChange={(e) => set({ disease: e.target.value as DiseaseChoice })}>
            <option value="none">None (healthy animals)</option>
            <option value="cancer">Tumour (xenograft)</option>
            <option value="diabetes-stz">Diabetes, fast onset</option>
            <option value="diabetes-type2">Diabetes, slow onset</option>
          </select>
        </label>
      </div>

      <details className="more">
        <summary>Advanced</summary>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label className="field" htmlFor="nsex"><span className="row"><span>Animals per sex per group</span><b>{setup.nPerSex}</b></span>
            <input id="nsex" type="range" min={2} max={20} value={setup.nPerSex} onChange={(e) => set({ nPerSex: +e.target.value })} /></label>
          <div className="field">Sexes
            <div className="checks">{(["M", "F"] as const).map((x) => <label key={x}><input type="checkbox" checked={setup.sexes.includes(x)} onChange={(e) => set({ sexes: e.target.checked ? [...setup.sexes, x] : setup.sexes.filter((s) => s !== x) })} />{x === "M" ? "Male" : "Female"}</label>)}</div></div>
          <label className="field" htmlFor="strain">Strain<select id="strain" value={setup.strain} onChange={(e) => set({ strain: e.target.value as "SD" | "WI" })}><option value="SD">Sprague-Dawley</option><option value="WI">Wistar</option></select></label>
          <label className="field" htmlFor="age"><span className="row"><span>Age at start</span><b>{setup.ageWeeks} weeks</b></span><input id="age" type="range" min={6} max={20} value={setup.ageWeeks} onChange={(e) => set({ ageWeeks: +e.target.value })} /></label>
          <label className="field" htmlFor="route">Route<select id="route" value={setup.route} onChange={(e) => set({ route: e.target.value as "oral" | "iv" | "diet" })}><option value="oral">Oral gavage</option><option value="iv">Intravenous</option><option value="diet">In the diet</option></select></label>
          <div className="field">Satellite groups
            <div className="checks">
              <label><input type="checkbox" checked={setup.recovery} onChange={(e) => set({ recovery: e.target.checked })} />Recovery</label>
              <label><input type="checkbox" checked={setup.tk} onChange={(e) => set({ tk: e.target.checked })} />Toxicokinetic</label>
            </div></div>
          <label className="field" htmlFor="seed">Random seed<input id="seed" type="number" value={setup.seed} onChange={(e) => set({ seed: Math.floor(+e.target.value) || 0 })} /></label>
          <label className="field" htmlFor="custom-pick"><span>Custom compound</span><button id="custom-pick" type="button" aria-pressed={setup.compoundKey === "custom"} onClick={() => pickCompound("custom")}>Use the custom compound editor</button></label>
        </div>
      </details>
      {problems.length > 0 && <div className="banner warn small" role="alert">{problems[0]}</div>}
      {study.status === "error" && <div className="banner bad small" role="alert">{study.error}</div>}
      {stale && study.status !== "running" && <span className="sr-only">Results are updating.</span>}
    </section>
  );
}

export function RunStatus() {
  const study = useStore((s) => s.study);
  const stale = useResultsStale();
  const n = study.data?.study.animals.length ?? 0;
  if (study.status === "running") return <span className="small muted" role="status">Simulating… {Math.round(study.progress * 100)}%</span>;
  if (stale) return <span className="small" style={{ color: "var(--warn)" }} role="status">Settings changed. Updating results…</span>;
  if (study.status === "done") return <span className="small muted" role="status">{fmtInt(n)} virtual animals simulated</span>;
  return null;
}

/** Choose which simulated animal the Animal and Data views show. */
export function AnimalPicker() {
  const study = useStore((s) => s.study.data);
  const focusId = useStore((s) => s.focusId);
  const setFocus = useStore((s) => s.setFocus);
  if (!study) return null;
  return (
    <label className="field" htmlFor="focus" style={{ maxWidth: 360 }}>Animal shown
      <select id="focus" value={focusId ?? ""} onChange={(e) => void setFocus(e.target.value)}>
        {study.study.design.groups.map((g) => (
          <optgroup key={g.id} label={`${g.label} · ${fmtInt(g.doseMgPerKg)} mg/kg`}>
            {study.study.animals.filter((a) => a.group === g.id).map((a) => <option key={a.id} value={a.id}>{a.id}{a.terminalReason === "humane" ? " · humane endpoint" : ""}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
