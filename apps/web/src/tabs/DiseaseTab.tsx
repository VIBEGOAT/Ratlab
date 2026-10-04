import { Legend, LineChart } from "../components/Chart";
import { Banner, NeedsTwin, Panel, Stat, TabHead, f1 } from "../components/ui";
import { useStore } from "../store";

export default function DiseaseTab() {
  const disease = useStore((s) => s.setup.disease);
  return (
    <>
      <TabHead title="Disease progression" blurb="Disease overlays that run beside the toxicity model and interact with it. Each chart shows the treated animal against its untreated twin, so disease-only progression is visible." fidelity={["disease"]} />
      {disease === "none" && <Banner tone="info">No disease model is selected. Choose a tumor or diabetes model in the left panel and run the study again.</Banner>}
      <NeedsTwin>
        {(tw) => {
          const t = tw.treated, u = tw.untreated;
          const d = Array.from({ length: t.days + 1 }, (_, i) => i);
          const hx = t.hoursH.map((h) => h / 24);
          const key = (a: typeof t, k: keyof typeof t.disease) => a.disease[k];
          const legend = [{ name: "Treated", color: "var(--c1)" }, { name: "Untreated twin", color: "var(--c2)", dash: true }];
          const two = (k: keyof typeof t.disease) => [
            { name: "Treated", x: hx, y: key(t, k), color: "var(--c1)" },
            { name: "Untreated twin", x: hx, y: key(u, k), color: "var(--c2)", dash: "5 4" },
          ];
          const last = t.days;
          return (
            <>
              <div className="stats">
                {disease === "cancer" && <>
                  <Stat label="Tumor, treated" value={`${f1(t.daily.tumorVolume[last]!, 0)} mm³`} />
                  <Stat label="Tumor, untreated" value={`${f1(u.daily.tumorVolume[last]!, 0)} mm³`} tone="warn" />
                  <Stat label="Resistant share, treated" value={`${f1(t.disease.tumorResistantFraction[t.disease.tumorResistantFraction.length - 1]! * 100, 0)}%`} />
                </>}
                {disease.startsWith("diabetes") && <>
                  <Stat label="Glucose" value={`${f1(t.daily.glucose[last]!, 0)} mg/dL`} />
                  <Stat label="HbA1c-like" value={`${f1(t.disease.hba1c[t.disease.hba1c.length - 1]!, 1)}%`} />
                  <Stat label="Nephropathy" value={f1(t.disease.nephropathy[t.disease.nephropathy.length - 1]!, 2)} />
                  <Stat label="Cataract" value={f1(t.disease.cataract[t.disease.cataract.length - 1]!, 2)} />
                </>}
                <Stat label="Humane endpoint, treated" value={t.humane ? `day ${t.humane.day}` : "none"} tone={t.humane ? "bad" : "good"} />
                <Stat label="Humane endpoint, untreated" value={u.humane ? `day ${u.humane.day}` : "none"} tone={u.humane ? "bad" : "good"} />
              </div>
              {u.humane && <Banner tone="bad">Untreated twin: {u.humane.banner}</Banner>}
              <div className="grid wide">
                {disease === "cancer" && (
                  <Panel title="Tumor volume">
                    <LineChart label="Tumor volume" series={two("tumorVolume")} xLabel="day" yLabel="mm³" yMin={0} />
                    <Legend items={legend} />
                    <p className="small muted">Gompertz growth. Drug kill acts on the sensitive population only, so resistant clones can regrow under therapy.</p>
                  </Panel>
                )}
                {disease.startsWith("diabetes") && (
                  <>
                    <Panel title="Blood glucose"><LineChart label="Blood glucose" series={two("glucose")} xLabel="day" yLabel="mg/dL" yMin={0} /><Legend items={legend} /></Panel>
                    <Panel title="HbA1c-like marker"><LineChart label="HbA1c-like marker" series={two("hba1c")} xLabel="day" yLabel="%" yMin={0} /><Legend items={legend} /></Panel>
                    <Panel title="Complications">
                      <LineChart label="Complications" series={[
                        { name: "Nephropathy", x: hx, y: t.disease.nephropathy, color: "var(--c1)" },
                        { name: "Neuropathy", x: hx, y: t.disease.neuropathy, color: "var(--c3)" },
                        { name: "Cataract", x: hx, y: t.disease.cataract, color: "var(--c4)" },
                      ]} xLabel="day" yMin={0} yMax={1} />
                      <Legend items={[{ name: "Nephropathy", color: "var(--c1)" }, { name: "Neuropathy", color: "var(--c3)" }, { name: "Cataract", color: "var(--c4)" }]} />
                      <p className="small muted">A diabetic kidney is more sensitive to a nephrotoxin: nephropathy lowers its injury threshold.</p>
                    </Panel>
                  </>
                )}
                <Panel title="Body weight and wasting">
                  <LineChart label="Body weight" series={[
                    { name: "Treated", x: d, y: t.daily.bodyWeightG, color: "var(--c1)" },
                    { name: "Untreated twin", x: d, y: u.daily.bodyWeightG, color: "var(--c2)", dash: "5 4" },
                  ]} xLabel="day" yLabel="g" yMin={0} />
                  <Legend items={legend} />
                </Panel>
              </div>
            </>
          );
        }}
      </NeedsTwin>
    </>
  );
}
