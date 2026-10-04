import { useState } from "react";
import { FINDINGS, GRADE_SEVERITY, ORGANS, SIGNS, gradeFromDamage, type Organ } from "@eliminate/sim-core";
import { Banner, Empty, NeedsTwin, Panel, Stat, TabHead, f1 } from "../components/ui";
import { ORGAN_LABEL } from "../lib/setup";

const SIGN_LABEL: Record<string, string> = {
  reducedIntake: "Reduced intake", lethargy: "Lethargy", hunchedPosture: "Hunched posture", ruffledFur: "Ruffled fur", chromodacryorrhoea: "Red tears (chromodacryorrhoea)",
  jaundice: "Jaundice", tremor: "Tremor", ataxia: "Ataxia", convulsions: "Convulsions", dyspnoea: "Dyspnoea", diarrhoea: "Diarrhoea", dehydration: "Dehydration", tumour: "Palpable tumour", cataract: "Cataract",
};

export default function RatTab() {
  const [dayRaw, setDay] = useState<number | null>(null);
  return (
    <>
      <TabHead title="Live rat" blurb="The selected animal, day by day: organ injury grades, clinical signs and vital signs. The rotatable 3D model with X-ray layers is the next build phase and will sit above this panel." fidelity={["toxicodynamics", "behaviour"]} />
      <NeedsTwin>
        {(tw) => {
          const t = tw.treated;
          const day = dayRaw === null ? t.days : Math.min(dayRaw, t.days);
          const d = t.daily;
          const signs = SIGNS.map((s) => ({ s, v: d.signIntensity[s]![day]! })).filter((x) => x.v > 0.1).sort((a, b) => b.v - a.v);
          const cp = t.clinpath[day]!;
          return (
            <>
              <Panel>
                <div className="slider-row">
                  <button onClick={() => setDay(Math.max(0, day - 1))} aria-label="Previous day">‹</button>
                  <input type="range" min={0} max={t.days} value={day} onChange={(e) => setDay(+e.target.value)} aria-label="Study day" />
                  <b className="mono">Day {day} of {t.days}</b>
                </div>
              </Panel>
              {t.humane && day >= t.humane.day && <Banner tone="bad">{t.humane.banner}</Banner>}
              <Empty>3D rat model: coming in the next phase. Organ colour, grade labels and clinical signs shown below will drive it.</Empty>
              <div className="stats">
                <Stat label="Body weight" value={`${f1(d.bodyWeightG[day]!, 0)} g`} hint={`${f1(d.weightChangeFraction[day]! * 100, 0)}% from day 0`} />
                <Stat label="Sickness index" value={f1(d.sickness[day]!, 2)} tone={d.sickness[day]! > 0.5 ? "bad" : d.sickness[day]! > 0.25 ? "warn" : undefined} />
                <Stat label="Grimace score" value={f1(d.grimace[day]!, 2)} hint="0 to 2" tone={d.grimace[day]! > 1.5 ? "bad" : undefined} />
                <Stat label="Heart rate" value={`${f1(cp.cardiac.heartRateBpm, 0)} bpm`} />
                <Stat label="QTc change" value={`${f1(cp.cardiac.qtcChangePercent, 0)}%`} />
                <Stat label="Tumor" value={d.tumorVolume[day]! > 0 ? `${f1(d.tumorVolume[day]!, 0)} mm³` : "none"} />
              </div>
              <Panel title="Organ status">
                <div className="organ-grid">
                  {ORGANS.map((o: Organ) => {
                    const D = d.damage[o][day]!;
                    const g = gradeFromDamage(D);
                    return (
                      <div className="organ" key={o} style={{ borderColor: g >= 3 ? "var(--bad)" : g >= 1 ? "var(--warn)" : undefined }}>
                        <b>{ORGAN_LABEL[o]}</b>
                        <span className="mono">damage {D.toFixed(2)} · grade {g}</span>
                        <span className="small muted">{GRADE_SEVERITY[g]}: {FINDINGS[o][g]}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
              <Panel title="Clinical signs on this day">
                {signs.length === 0 ? <p className="muted">No clinical signs.</p> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {signs.map(({ s, v }) => <div key={s} className="barrow"><span>{SIGN_LABEL[s]}</span><div className="bar"><i style={{ width: `${v * 100}%`, background: "var(--c3)" }} /></div><span className="mono" style={{ textAlign: "right" }}>{(v * 100).toFixed(0)}%</span></div>)}
                  </div>
                )}
              </Panel>
            </>
          );
        }}
      </NeedsTwin>
    </>
  );
}
