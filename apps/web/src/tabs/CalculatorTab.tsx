import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SAFETY_FACTOR, REFERENCES, SPECIES, animalToHuman, humanToAnimal, speciesById, type CalcProblem, type SpeciesId } from "@eliminate/sim-core";
import { useStore } from "../store";
import { AnimatedNumber } from "../components/motion";
import { Icon } from "../components/icons";
import { Banner, Panel, TabHead } from "../components/ui";

/** Three significant figures, no scientific notation for everyday values, no trailing zeros. */
export function sig(x: number): string {
  if (!Number.isFinite(x)) return "n/a";
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1000) return Math.round(x).toLocaleString("en-US");
  if (a >= 0.001) return String(Number(x.toPrecision(3)));
  return x.toExponential(1);
}

type Mode = "toHuman" | "toAnimal";
type WeightUnit = "g" | "kg";

const PROBLEM_TEXT: Record<CalcProblem, string> = {
  animalWeight: "Enter the animal's body weight as a positive number.",
  dose: "Enter a dose greater than zero.",
  humanWeight: "Enter the person's body weight as a positive number.",
  safetyFactor: "The safety factor must be greater than zero.",
  concentration: "The concentration must be greater than zero, or left empty.",
};

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const toKg = (v: number, u: WeightUnit) => (u === "g" ? v / 1000 : v);
const refWeight = (id: SpeciesId): { v: string; u: WeightUnit } => {
  const kg = speciesById(id).referenceKg;
  return kg < 1 ? { v: String(Math.round(kg * 1000)), u: "g" } : { v: String(kg), u: "kg" };
};

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return <div className="field calc-field"><label htmlFor={id}>{label}</label>{children}{hint && <span className="small">{hint}</span>}</div>;
}

export default function CalculatorTab() {
  const noael = useStore((s) => s.study.data?.noael.noael ?? null);
  const [mode, setMode] = useState<Mode>("toHuman");
  const [species, setSpecies] = useState<SpeciesId>("rat");
  const [wVal, setWVal] = useState(refWeight("rat").v);
  const [wUnit, setWUnit] = useState<WeightUnit>(refWeight("rat").u);
  const [dose, setDose] = useState("50");
  const [doseUnit, setDoseUnit] = useState<"mgPerKg" | "mgTotal">("mgPerKg");
  const [humanKg, setHumanKg] = useState("60");
  const [sf, setSf] = useState(String(DEFAULT_SAFETY_FACTOR));
  const [conc, setConc] = useState("");
  const [copied, setCopied] = useState(false);

  const sp = speciesById(species);
  const pickSpecies = (id: SpeciesId) => { setSpecies(id); const r = refWeight(id); setWVal(r.v); setWUnit(r.u); };
  useEffect(() => { if (!copied) return; const t = window.setTimeout(() => setCopied(false), 1800); return () => window.clearTimeout(t); }, [copied]);

  const animalKg = toKg(num(wVal), wUnit);
  const concVal = conc.trim() === "" ? undefined : Number(conc);
  const out = useMemo(() => {
    if (mode === "toHuman") return { kind: "toHuman" as const, r: animalToHuman({ species, animalKg, dose: num(dose), doseUnit, humanKg: num(humanKg), safetyFactor: num(sf), concentrationMgPerMl: concVal }) };
    return { kind: "toAnimal" as const, r: humanToAnimal({ species, animalKg, humanDose: num(dose), humanDoseUnit: doseUnit, humanKg: num(humanKg), concentrationMgPerMl: concVal }) };
  }, [mode, species, animalKg, dose, doseUnit, humanKg, sf, concVal]);

  const fda = REFERENCES.find((r) => r.id === "fda-hed-2005");
  const switchMode = (m: Mode) => { setMode(m); setDose(m === "toHuman" ? "50" : "10"); setDoseUnit("mgPerKg"); };

  const summary = (): string => {
    if ("problem" in out.r) return "";
    const head = `Dose conversion (FDA 2005 body-surface-area method, research and education only)`;
    if (out.kind === "toHuman" && "result" in out.r) {
      const r = out.r.result;
      return [head, `${sp.name} ${sig(r.animalDoseMgPerKg)} mg/kg (${sig(r.animalDoseMgTotal)} mg for ${wVal} ${wUnit}) = ${sig(r.animalDoseMgPerM2)} mg/m2`,
        `Human equivalent dose: ${sig(r.hedMgPerKg)} mg/kg = ${sig(r.hedMgTotal)} mg for ${sig(r.humanKg)} kg`,
        `If this is a NOAEL, maximum recommended starting dose (safety factor ${sig(r.safetyFactor)}): ${sig(r.mrsdMgPerKg)} mg/kg = ${sig(r.mrsdMgTotal)} mg`,
        `Source: US FDA, Estimating the Maximum Safe Starting Dose in Initial Clinical Trials (2005), Tables 1 and 3.`].join("\n");
    }
    if (out.kind === "toAnimal" && "result" in out.r) {
      const r = out.r.result;
      return [head, `Human dose ${sig(r.humanDoseMgPerKg)} mg/kg (${sig(r.humanDoseMgTotal)} mg for ${sig(r.humanKg)} kg)`,
        `${sp.name} equivalent: ${sig(r.animalDoseMgPerKg)} mg/kg = ${sig(r.animalDoseMgTotal)} mg for ${wVal} ${wUnit}`,
        `Source: US FDA, Estimating the Maximum Safe Starting Dose in Initial Clinical Trials (2005), Tables 1 and 3.`].join("\n");
    }
    return "";
  };
  const copy = async () => { try { await navigator.clipboard.writeText(summary()); setCopied(true); } catch { /* clipboard may be blocked */ } };

  const problem = "problem" in out.r ? out.r.problem : null;
  const toHuman = out.kind === "toHuman" && "result" in out.r ? out.r.result : null;
  const toAnimal = out.kind === "toAnimal" && "result" in out.r ? out.r.result : null;
  const fit = (toHuman ?? toAnimal)?.fit ?? "within";
  const range = sp.workingKg;
  const maxBar = toHuman ? Math.max(...toHuman.acrossSpecies.map((s) => s.mgPerKg)) : 1;

  return (
    <>
      <TabHead title="Dose calculator" blurb="Convert a dose between a laboratory animal and a person by body surface area, the standard method in the FDA starting-dose guidance. Enter the weights and a dose; the answer updates as you type." fidelity={["translation"]} />
      <Banner tone="warn">Scaling arithmetic for research and education. It does not establish that any dose is safe for a person or an animal, and it must not be used to dose people. The guidance is nonbinding and written for first-in-human trial planning.</Banner>

      <div className="calc">
        <Panel title="Your numbers">
          <div className="segmented" role="group" aria-label="Direction">
            <button type="button" aria-pressed={mode === "toHuman"} onClick={() => switchMode("toHuman")}>Animal to human</button>
            <button type="button" aria-pressed={mode === "toAnimal"} onClick={() => switchMode("toAnimal")}>Human to animal</button>
          </div>

          <Field id="calc-species" label="Animal species">
            <select id="calc-species" value={species} onChange={(e) => pickSpecies(e.target.value as SpeciesId)}>
              {SPECIES.filter((s) => s.id !== "human").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>

          <Field id="calc-weight" label="Animal body weight" hint={range ? `Standard range for this species: ${sig(range[0] * (range[0] < 1 ? 1000 : 1))} to ${sig(range[1] * (range[1] < 1 ? 1000 : 1))} ${range[1] < 1 ? "g" : "kg"}` : undefined}>
            <div className="calc-pair">
              <input id="calc-weight" type="number" inputMode="decimal" min="0" step="any" value={wVal} onChange={(e) => setWVal(e.target.value)} />
              <select aria-label="Weight unit" value={wUnit} onChange={(e) => setWUnit(e.target.value as WeightUnit)}><option value="g">g</option><option value="kg">kg</option></select>
            </div>
          </Field>

          <Field id="calc-dose" label={mode === "toHuman" ? `${sp.name} dose` : "Human dose"}>
            <div className="calc-pair">
              <input id="calc-dose" type="number" inputMode="decimal" min="0" step="any" value={dose} onChange={(e) => setDose(e.target.value)} />
              <select aria-label="Dose unit" value={doseUnit} onChange={(e) => setDoseUnit(e.target.value as "mgPerKg" | "mgTotal")}>
                <option value="mgPerKg">mg/kg</option><option value="mgTotal">mg total</option>
              </select>
            </div>
          </Field>
          {mode === "toHuman" && noael !== null && (
            <button type="button" className="calc-fill" onClick={() => { setMode("toHuman"); pickSpecies("rat"); setDose(String(Number(noael.toFixed(3)))); setDoseUnit("mgPerKg"); }}>
              <Icon name="data" size={16} /> Use this study's rat NOAEL ({sig(noael)} mg/kg)
            </button>
          )}

          <Field id="calc-human" label="Human body weight (kg)" hint="The guidance assumes 60 kg.">
            <input id="calc-human" type="number" inputMode="decimal" min="0" step="any" value={humanKg} onChange={(e) => setHumanKg(e.target.value)} />
          </Field>

          {mode === "toHuman" && (
            <Field id="calc-sf" label="Safety factor" hint="Applied to a NOAEL to get a starting dose. The guidance's default is 10 and says to judge it case by case.">
              <input id="calc-sf" type="number" inputMode="decimal" min="0" step="any" value={sf} onChange={(e) => setSf(e.target.value)} />
            </Field>
          )}

          <Field id="calc-conc" label="Dosing solution concentration (mg/mL), optional" hint="Gives the volume to give one animal.">
            <input id="calc-conc" type="number" inputMode="decimal" min="0" step="any" placeholder="for example 5" value={conc} onChange={(e) => setConc(e.target.value)} />
          </Field>
        </Panel>

        <section className="calc-out" aria-label="Result">
          {problem && <div className="calc-hint" role="status"><Icon name="cross" size={18} />{PROBLEM_TEXT[problem]}</div>}

          {toHuman && (
            <>
              <div className="calc-hero" aria-live="polite">
                <span className="eyebrow">Human equivalent dose</span>
                <b><AnimatedNumber value={toHuman.hedMgPerKg} format={sig} /> <small>mg/kg</small></b>
                <span className="calc-sub"><AnimatedNumber value={toHuman.hedMgTotal} format={sig} /> mg for a {sig(toHuman.humanKg)} kg person</span>
              </div>
              <div className="calc-cards">
                <div className="calc-card good">
                  <span className="calc-label">If this is a NOAEL: maximum recommended starting dose</span>
                  <b><AnimatedNumber value={toHuman.mrsdMgPerKg} format={sig} /> <small>mg/kg</small></b>
                  <span className="small muted"><AnimatedNumber value={toHuman.mrsdMgTotal} format={sig} /> mg for {sig(toHuman.humanKg)} kg, after dividing by {sig(toHuman.safetyFactor)}</span>
                </div>
                <div className="calc-card">
                  <span className="calc-label">Your {sp.name.toLowerCase().replace(/ \(.*\)/, "")} receives</span>
                  <b><AnimatedNumber value={toHuman.animalDoseMgTotal} format={sig} /> <small>mg</small></b>
                  <span className="small muted">{sig(toHuman.animalDoseMgPerKg)} mg/kg, {sig(toHuman.animalDoseMgPerM2)} mg/m²{toHuman.volumeMl !== null && <> · <b>{sig(toHuman.volumeMl)} mL</b> of solution ({sig(toHuman.volumeMlPerKg ?? 0)} mL/kg)</>}</span>
                </div>
              </div>
            </>
          )}

          {toAnimal && (
            <>
              <div className="calc-hero" aria-live="polite">
                <span className="eyebrow">{sp.name} equivalent dose</span>
                <b><AnimatedNumber value={toAnimal.animalDoseMgPerKg} format={sig} /> <small>mg/kg</small></b>
                <span className="calc-sub"><AnimatedNumber value={toAnimal.animalDoseMgTotal} format={sig} /> mg for a {wVal} {wUnit} animal</span>
              </div>
              <div className="calc-cards">
                <div className="calc-card">
                  <span className="calc-label">The human dose</span>
                  <b><AnimatedNumber value={toAnimal.humanDoseMgPerKg} format={sig} /> <small>mg/kg</small></b>
                  <span className="small muted">{sig(toAnimal.humanDoseMgTotal)} mg for {sig(toAnimal.humanKg)} kg</span>
                </div>
                <div className="calc-card">
                  <span className="calc-label">Same dose per body surface</span>
                  <b><AnimatedNumber value={toAnimal.animalDoseMgPerM2} format={sig} /> <small>mg/m²</small></b>
                  <span className="small muted">{toAnimal.volumeMl !== null ? <><b>{sig(toAnimal.volumeMl)} mL</b> of solution for one animal</> : "Add a concentration to get a volume."}</span>
                </div>
              </div>
            </>
          )}

          {(toHuman || toAnimal) && fit !== "within" && range && (
            <Banner tone="warn">
              {sp.name} at {wVal} {wUnit} is {fit === "above" ? "heavier" : "lighter"} than the guidance's standard range ({sig(range[0] * (range[0] < 1 ? 1000 : 1))} to {sig(range[1] * (range[1] < 1 ? 1000 : 1))} {range[1] < 1 ? "g" : "kg"}), where the standard factor can be off by more than 20%.
              {toHuman && <> The guidance then suggests the weight-based formula: <b>{sig(toHuman.hedByWeightMgPerKg)} mg/kg</b> ({sig(toHuman.hedByWeightMgTotal)} mg for {sig(toHuman.humanKg)} kg), against {sig(toHuman.hedMgPerKg)} mg/kg from the standard factor.</>}
            </Banner>
          )}

          {(toHuman || toAnimal) && (
            <button type="button" className="calc-copy" onClick={() => void copy()}>
              <Icon name={copied ? "check" : "arrow"} size={16} />{copied ? "Copied" : "Copy this summary"}
            </button>
          )}
        </section>
      </div>

      {toHuman && (
        <Panel title="The same dose in other species" right={<span className="small muted">matched on body surface area</span>}>
          <ul className="across" aria-label="Equivalent dose in each species">
            {toHuman.acrossSpecies.map((s, i) => (
              <li key={s.id} className={s.id === species ? "from" : s.id === "human" ? "to" : ""} style={{ "--i": i } as React.CSSProperties}>
                <span className="across-name">{s.name.replace(/ \(.*\)/, "")}</span>
                <span className="across-bar" aria-hidden="true"><i style={{ width: `${Math.max(2, (s.mgPerKg / maxBar) * 100)}%` }} /></span>
                <span className="across-val">{sig(s.mgPerKg)} mg/kg</span>
                <span className="across-abs small muted">{sig(s.mgAtReference)} mg at {sig(s.referenceKg * (s.referenceKg < 1 ? 1000 : 1))} {s.referenceKg < 1 ? "g" : "kg"}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <details className="calc-work">
        <summary>Show the working</summary>
        <div className="calc-work-body">
          <p><b>Body-surface-area method (FDA Table 1).</b> Each species has a factor km (body weight divided by surface area). A dose in mg/kg times km is a dose in mg/m². Doses are matched on mg/m², so the human equivalent dose is the animal dose × km<sub>animal</sub> ÷ km<sub>human</sub>.</p>
          {toHuman && (
            <>
              <p className="mono small">{sig(toHuman.animalDoseMgPerKg)} mg/kg × {sp.km} ÷ {speciesById("human").km} = <b>{sig(toHuman.hedMgPerKg)} mg/kg</b></p>
              <p className="mono small">{sig(toHuman.hedMgPerKg)} mg/kg × {sig(toHuman.humanKg)} kg = <b>{sig(toHuman.hedMgTotal)} mg</b></p>
              <p className="mono small">{sig(toHuman.hedMgPerKg)} ÷ {sig(toHuman.safetyFactor)} = <b>{sig(toHuman.mrsdMgPerKg)} mg/kg</b> starting dose, if the animal dose is a NOAEL</p>
              <p><b>Weight-based alternative.</b> For weights outside the standard range or species not in the table: HED = animal dose × (animal weight ÷ human weight)<sup>0.33</sup>.</p>
              <p className="mono small">{sig(toHuman.animalDoseMgPerKg)} × ({sig(animalKg)} ÷ {sig(toHuman.humanKg)})<sup>0.33</sup> = <b>{sig(toHuman.hedByWeightMgPerKg)} mg/kg</b></p>
            </>
          )}
          {toAnimal && <p className="mono small">{sig(toAnimal.humanDoseMgPerKg)} mg/kg × {speciesById("human").km} ÷ {sp.km} = <b>{sig(toAnimal.animalDoseMgPerKg)} mg/kg</b></p>}
          <p className="small muted">
            Source: {fda ? <>{fda.authors} ({fda.year}), <a href={fda.url ?? undefined} target="_blank" rel="noreferrer">{fda.title}</a>. Tables 1 and 3 and the default safety factor of 10 were read in the guidance itself ({fda.status}).</> : "US FDA, 2005."} Body-surface-area scaling is an approximation. It is a starting point for planning, not evidence that a dose is safe, and for some drugs (for example some biologics) other methods apply.
          </p>
        </div>
      </details>
    </>
  );
}
