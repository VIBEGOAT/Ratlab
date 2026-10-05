import { useState } from "react";
import { ORGANS } from "@eliminate/sim-core";
import { BarList, LineChart } from "../components/Chart";
import { Banner, NeedsStudy, Panel, TabHead, f1 } from "../components/ui";
import { useStore } from "../store";
import { ORGAN_LABEL } from "../lib/setup";

export default function PopulationTab() {
  const forecast = useStore((s) => s.forecast);
  const run = useStore((s) => s.runForecast);
  const [n, setN] = useState(100);
  const colors = ["var(--c1)", "var(--c3)", "var(--c6)", "var(--c4)"];
  return (
    <>
      <TabHead title="Population and humane endpoints" blurb="Which animals would have had to be euthanised, and how likely each kind of toxicity is across a larger virtual population. Every virtual rat has its own metabolism, size and sensitivity." fidelity={["montecarlo", "humane"]} />
      <NeedsStudy>
        {(p) => {
          const humane = p.study.animals.filter((a) => a.terminalReason === "humane");
          return (
            <>
              <Panel title="This study: animals that reached a humane endpoint">
                {humane.length === 0 ? <p className="muted">None. Every animal reached its scheduled end.</p> : (
                  <>
                    <Banner tone="bad">{humane.length} of {p.study.animals.length} animals reached a humane endpoint. In a live study each would have been euthanised early. Here no animal was harmed.</Banner>
                    <div className="scroll"><table>
                      <thead><tr><th>Animal</th><th>Dose</th><th className="num">Day</th><th>Reason</th></tr></thead>
                      <tbody>{humane.map((a) => <tr key={a.id}><td>{a.id}</td><td>{f1(a.doseMgPerKg, 1)}</td><td className="num">{a.terminalDay}</td><td>{a.humane!.reason}</td></tr>)}</tbody>
                    </table></div>
                  </>
                )}
              </Panel>
              <Panel title="Toxicity forecast over a larger virtual population" right={
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <label className="small">Animals per dose <b className="mono">{n}</b> <input type="range" min={20} max={1000} step={20} value={n} onChange={(e) => setN(+e.target.value)} style={{ width: 140 }} aria-label="Animals per dose" /></label>
                  <button className="primary" disabled={forecast.status === "running"} onClick={() => run(n)}>{forecast.status === "running" ? `${Math.round(forecast.progress * 100)}%` : "Run forecast"}</button>
                </div>}>
                <p className="small muted">Share of virtual rats with moderate or worse injury (grade 3 or higher) at any point, with 95% intervals. Larger populations give narrower intervals but take longer (about {Math.round(n * 0.03 * 3)} to {Math.round(n * 0.06 * 3)} seconds for three doses).</p>
                {forecast.status === "error" && <Banner tone="bad">{forecast.error}</Banner>}
                {forecast.data ? (
                  <>
                    <div className="grid">
                      {forecast.data.map((f) => (
                        <div key={f.doseMgPerKg}>
                          <h3 style={{ marginBottom: 8 }}>{f1(f.doseMgPerKg, 1)} mg/kg · n = {f.n}</h3>
                          <BarList items={[
                            ...ORGANS.map((o) => ({ label: ORGAN_LABEL[o], value: f.organ[o].p, low: f.organ[o].low, high: f.organ[o].high })),
                            { label: "Humane endpoint", value: f.humane.p, low: f.humane.low, high: f.humane.high, color: "var(--bad)" },
                          ]} />
                        </div>
                      ))}
                    </div>
                    <h3 style={{ marginTop: 8 }}>Survival without a humane endpoint (Kaplan-Meier)</h3>
                    <LineChart label="Survival curves by dose" series={forecast.data.map((f, i) => ({ name: `${f1(f.doseMgPerKg, 0)} mg/kg`, x: f.survival.map((s) => s.t), y: f.survival.map((s) => s.survival), color: colors[i % colors.length]!, step: true }))} xLabel="Study day" yLabel="Rats without a humane endpoint" yMin={0} yMax={1} fmtY={(v) => `${(v * 100).toFixed(0)}%`} />
                  </>
                ) : forecast.status !== "running" && <p className="muted">Press Run forecast.</p>}
              </Panel>
            </>
          );
        }}
      </NeedsStudy>
    </>
  );
}
