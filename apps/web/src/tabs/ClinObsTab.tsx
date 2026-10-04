import { SIGNS } from "@eliminate/sim-core";
import { HeatGrid, Legend, LineChart } from "../components/Chart";
import { NeedsTwin, Panel, TabHead } from "../components/ui";

const LABEL: Record<string, string> = {
  reducedIntake: "Reduced intake", lethargy: "Lethargy", hunchedPosture: "Hunched posture", ruffledFur: "Ruffled fur", chromodacryorrhoea: "Red tears", jaundice: "Jaundice", tremor: "Tremor",
  ataxia: "Ataxia", convulsions: "Convulsions", dyspnoea: "Dyspnoea", diarrhoea: "Diarrhoea", dehydration: "Dehydration", tumour: "Tumour", cataract: "Cataract",
};

export default function ClinObsTab() {
  return (
    <>
      <TabHead title="Clinical observations" blurb="What the study team records every day: weight, intake, sickness, pain score and the clinical signs an observer would note. Signs appear with a probability that rises with their underlying intensity." fidelity={["clinpath", "behaviour"]} />
      <NeedsTwin>
        {(tw) => {
          const t = tw.treated, u = tw.untreated;
          const d = Array.from({ length: t.days + 1 }, (_, i) => i);
          const legend = [{ name: "Treated", color: "var(--c1)" }, { name: "Untreated twin", color: "var(--c2)", dash: true }];
          const pair = (a: number[], b: number[]) => [{ name: "Treated", x: d, y: a, color: "var(--c1)" }, { name: "Untreated twin", x: d, y: b, color: "var(--c2)", dash: "5 4" }];
          const rows = SIGNS.map((s) => ({ label: LABEL[s]!, on: t.daily.signObserved[s]! })).filter((r) => r.on.some((v) => v === 1));
          return (
            <>
              <div className="grid wide">
                <Panel title="Body weight"><LineChart label="Body weight" series={pair(t.daily.bodyWeightG, u.daily.bodyWeightG)} xLabel="day" yLabel="g" yMin={0} /><Legend items={legend} /></Panel>
                <Panel title="Food and water"><LineChart label="Food intake" series={pair(t.daily.foodG, u.daily.foodG)} xLabel="day" yLabel="g per day" yMin={0} height={150} /><LineChart label="Water intake" series={pair(t.daily.waterMl, u.daily.waterMl)} xLabel="day" yLabel="mL per day" yMin={0} height={150} /></Panel>
                <Panel title="Sickness index"><LineChart label="Sickness index" series={pair(t.daily.sickness, u.daily.sickness)} xLabel="day" yMin={0} yMax={1} /><Legend items={legend} /></Panel>
                <Panel title="Grimace score"><LineChart label="Grimace score" series={pair(t.daily.grimace, u.daily.grimace)} xLabel="day" yMin={0} yMax={2} /><p className="small muted">Rat Grimace Scale style, 0 to 2. Scores above the limit trigger a humane endpoint.</p></Panel>
              </div>
              <Panel title="Clinical signs recorded by day (treated animal)">
                {rows.length === 0 ? <p className="muted">No clinical signs were recorded.</p> : <HeatGrid rows={rows} days={t.days} />}
              </Panel>
            </>
          );
        }}
      </NeedsTwin>
    </>
  );
}
