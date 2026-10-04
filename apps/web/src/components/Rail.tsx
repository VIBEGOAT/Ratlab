import { useStore } from "../store";
import { COMPOUND_LABELS, designProblems, type DiseaseChoice } from "../lib/setup";
import { ORGAN_LABEL } from "../lib/setup";
import { ORGANS } from "@eliminate/sim-core";

function Num({ id, label, value, min, max, step = 1, onChange, unit }: { id: string; label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label className="field" htmlFor={id}>
      <span className="row"><span>{label}</span><b>{value}{unit ?? ""}</b></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

export function Rail() {
  const setup = useStore((s) => s.setup);
  const set = useStore((s) => s.setSetup);
  const study = useStore((s) => s.study);
  const run = useStore((s) => s.runStudy);
  const focusId = useStore((s) => s.focusId);
  const setFocus = useStore((s) => s.setFocus);
  const problems = designProblems(setup);
  const animals = study.data?.study.animals ?? [];
  const running = study.status === "running";

  return (
    <aside className="rail" aria-label="Study setup">
      <div>
        <div className="eyebrow">Study setup</div>
        <p className="small muted" style={{ marginTop: 4 }}>A virtual repeated-dose rat study. Change anything, then run.</p>
      </div>
      <label className="field" htmlFor="compound">Test compound
        <select id="compound" value={setup.compoundKey} onChange={(e) => {
          const key = e.target.value;
          set({ compoundKey: key });
          if (key !== "custom") import("@eliminate/sim-core").then(({ ARCHETYPES }) => set({ highDose: ARCHETYPES[key]!.defaultDoseMgPerKg }));
        }}>
          {Object.entries(COMPOUND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label className="field" htmlFor="highdose">High dose (mg/kg/day)
        <input id="highdose" type="number" min={0.1} step={1} value={setup.highDose} onChange={(e) => set({ highDose: +e.target.value })} />
      </label>
      <label className="field" htmlFor="disease">Disease model
        <select id="disease" value={setup.disease} onChange={(e) => set({ disease: e.target.value as DiseaseChoice })}>
          <option value="none">None (healthy)</option>
          <option value="cancer">Tumor xenograft</option>
          <option value="diabetes-stz">Diabetes, STZ-like</option>
          <option value="diabetes-type2">Diabetes, type-2-like</option>
        </select>
      </label>
      <Num id="duration" label="Dosing days" value={setup.durationDays} min={7} max={90} step={1} onChange={(v) => set({ durationDays: v })} />
      <div className="checks" role="group" aria-label="Preset durations">
        {[7, 14, 28, 90].map((d) => <button key={d} type="button" onClick={() => set({ durationDays: d })} aria-pressed={setup.durationDays === d} style={{ padding: "3px 8px", fontWeight: setup.durationDays === d ? 700 : 500 }}>{d} d</button>)}
      </div>
      <Num id="nsex" label="Animals per sex per group" value={setup.nPerSex} min={2} max={20} onChange={(v) => set({ nPerSex: v })} />
      <div className="checks" role="group" aria-label="Sexes">
        {(["M", "F"] as const).map((x) => (
          <label key={x}><input type="checkbox" checked={setup.sexes.includes(x)} onChange={(e) => set({ sexes: e.target.checked ? [...setup.sexes, x] : setup.sexes.filter((s) => s !== x) })} />{x === "M" ? "Male" : "Female"}</label>
        ))}
      </div>
      <label className="field" htmlFor="strain">Strain
        <select id="strain" value={setup.strain} onChange={(e) => set({ strain: e.target.value as "SD" | "WI" })}>
          <option value="SD">Sprague-Dawley</option><option value="WI">Wistar</option>
        </select>
      </label>
      <Num id="age" label="Age at start (weeks)" value={setup.ageWeeks} min={6} max={20} onChange={(v) => set({ ageWeeks: v })} />
      <label className="field" htmlFor="route">Route
        <select id="route" value={setup.route} onChange={(e) => set({ route: e.target.value as "oral" | "iv" | "diet" })}>
          <option value="oral">Oral gavage</option><option value="iv">Intravenous bolus</option><option value="diet">Dietary</option>
        </select>
      </label>
      <div className="checks">
        <label><input type="checkbox" checked={setup.recovery} onChange={(e) => set({ recovery: e.target.checked })} />Recovery satellites</label>
        <label><input type="checkbox" checked={setup.tk} onChange={(e) => set({ tk: e.target.checked })} />TK satellites</label>
      </div>
      <label className="field" htmlFor="seed">Random seed
        <input id="seed" type="number" value={setup.seed} onChange={(e) => set({ seed: Math.floor(+e.target.value) })} />
      </label>
      {problems.length > 0 && <div className="banner warn small">{problems[0]}</div>}
      <button className="primary" onClick={run} disabled={running || problems.length > 0}>{running ? `Running ${Math.round(study.progress * 100)}%` : "Run study"}</button>
      {running && <div className="progress" role="progressbar" aria-valuenow={Math.round(study.progress * 100)}><i style={{ width: `${study.progress * 100}%` }} /></div>}
      {study.status === "error" && <div className="banner bad small">{study.error}</div>}

      {animals.length > 0 && (
        <label className="field" htmlFor="focus">Animal shown in detail tabs
          <select id="focus" value={focusId ?? ""} onChange={(e) => setFocus(e.target.value)}>
            {study.data!.study.design.groups.map((g) => (
              <optgroup key={g.id} label={`${g.label} (${g.doseMgPerKg.toFixed(1)} mg/kg)`}>
                {animals.filter((a) => a.group === g.id).map((a) => <option key={a.id} value={a.id}>{a.id}{a.terminalReason === "humane" ? " · humane endpoint" : ""}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <p className="small muted">Target organs: {ORGANS.map((o) => ORGAN_LABEL[o]).join(", ")}.</p>
    </aside>
  );
}
