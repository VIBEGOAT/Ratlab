import { useState } from "react";
import { constant, humanEquivalentDose, maxRecommendedStartingDose, projectedHumanExposure, safetyMargin, therapeuticIndex, mean } from "@eliminate/sim-core";
import { Banner, Fidelity, NeedsStudy, Panel, Stat, TabHead, f1 } from "../components/ui";

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  const id = `tr-${label.replace(/\W/g, "")}`;
  return <label className="field" htmlFor={id}>{label}<input id={id} type="number" value={value} step={step} min={0} onChange={(e) => onChange(+e.target.value)} /></label>;
}

export default function TranslationTab() {
  const [sf, setSf] = useState(10);
  const [humanBw, setHumanBw] = useState(60);
  const [effDose, setEffDose] = useState(5);
  const [humanDose, setHumanDose] = useState(0);
  return (
    <>
      <TabHead title="Human translation outlook" blurb="From the rat NOAEL to a human equivalent dose, a maximum recommended starting dose and an exposure-based safety margin. Scaling rules only." fidelity={["translation"]} />
      <Banner tone="warn">ILLUSTRATIVE. This is arithmetic on a simulated NOAEL. It has not been validated against human data and must not guide any real dosing.</Banner>
      <NeedsStudy>
        {(p) => {
          const noael = p.noael.noael;
          if (noael === null || noael <= 0) return <Banner tone="info">No NOAEL was identified above zero in this study, so there is no starting dose to derive. Lower the dose levels and run again.</Banner>;
          const sd = maxRecommendedStartingDose(noael, sf);
          const doseMg = humanDose > 0 ? humanDose : sd.mrsdMgFor60Kg;
          const nDoses = Math.floor(p.study.design.durationDays * 24 / p.study.design.intervalH);
          const g = p.study.design.groups.find((x) => x.kind === "main" && Math.abs(x.doseMgPerKg - noael) < 1e-6);
          const animals = p.study.animals.filter((a) => g && a.group === g.id);
          const ratAucPerInterval = animals.length ? mean(animals.map((a) => a.pk.aucAll)) / Math.max(1, nDoses) : 0;
          const ratBw = animals.length ? mean(animals.map((a) => a.endpoints.bodyWeightG!)) / 1000 : 0.3;
          const ratClPerKg = ratAucPerInterval > 0 ? (noael) / ratAucPerInterval : 0;
          const human = projectedHumanExposure(ratClPerKg * ratBw, ratBw, doseMg, humanBw);
          const margin = safetyMargin(ratAucPerInterval, human.aucMgHPerL);
          const loael = p.noael.loael;
          return (
            <>
              <div className="stats">
                <Stat label="Rat NOAEL" value={`${f1(noael, 1)} mg/kg`} />
                <Stat label="Human equivalent dose" value={`${f1(humanEquivalentDose(noael), 2)} mg/kg`} hint={`× ${constant("translation.km.rat")}/${constant("translation.km.human")}`} />
                <Stat label="Maximum starting dose" value={`${f1(sd.mrsdMgPerKg, 3)} mg/kg`} hint={`${f1(sd.mrsdMgFor60Kg, 1)} mg for ${humanBw} kg`} tone="good" />
              </div>
              <div className="grid">
                <Panel title="Assumptions" right={<Fidelity id="translation" />}>
                  <Num label="Safety factor" value={sf} onChange={setSf} />
                  <Num label="Human body weight (kg)" value={humanBw} onChange={setHumanBw} />
                  <Num label="Planned human dose (mg), 0 uses the starting dose" value={humanDose} onChange={setHumanDose} />
                  <Num label="Effective dose in rat (mg/kg), for the therapeutic index" value={effDose} onChange={setEffDose} step={0.5} />
                  <p className="small muted">Km factors and the safety factor of 10 follow the FDA 2005 starting-dose guidance. The Km values are UNVERIFIED in the reference data until checked against the guidance table.</p>
                </Panel>
                <Panel title="Exposure-based margin">
                  <p className="small muted">Rat exposure per dosing interval at the NOAEL is approximated as whole-study AUC divided by the number of doses. Human clearance scales with body weight to the power 0.75.</p>
                  <div className="stats">
                    <Stat label="Rat AUC at NOAEL" value={`${f1(ratAucPerInterval, 1)} mg·h/L`} />
                    <Stat label="Projected human AUC" value={`${f1(human.aucMgHPerL, 2)} mg·h/L`} />
                    <Stat label="Safety margin" value={`${f1(margin, 1)}×`} tone={margin >= 10 ? "good" : margin >= 3 ? "warn" : "bad"} />
                    {loael !== null && <Stat label="Therapeutic index" value={`${f1(therapeuticIndex(loael, effDose), 1)}`} hint="LOAEL ÷ effective dose" />}
                  </div>
                </Panel>
              </div>
            </>
          );
        }}
      </NeedsStudy>
    </>
  );
}
