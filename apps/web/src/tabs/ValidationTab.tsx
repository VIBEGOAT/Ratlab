import { REQUIRED_DATASETS } from "@eliminate/sim-core";
import { Banner, Chip, NeedsStudy, Panel, TabHead, f1 } from "../components/ui";
import { useStore } from "../store";
import { parseHistoricalCsv } from "../lib/csv";
import { download } from "../lib/export";
import { useState } from "react";

const TEMPLATE = "dataset,source,strain,sex,ageWeeks,endpoint,n,mean,sd\nVENDOR-2024,Charles River report,SD,M,8,bodyWeightG,300,285,22\nVENDOR-2024,Charles River report,SD,M,8,chem.alt,300,45,12\n";

export default function ValidationTab() {
  const validation = useStore((s) => s.validation);
  const run = useStore((s) => s.runValidation);
  const historical = useStore((s) => s.historical);
  const setHist = useStore((s) => s.setHistorical);
  const [errors, setErrors] = useState<string[]>([]);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const { rows, errors } = parseHistoricalCsv(await f.text());
    setErrors(errors);
    setHist(rows);
  };
  const v = validation.data;
  return (
    <>
      <TabHead title="Validation" blurb="Does a simulated vehicle-control group look like real control rats? Load historical control data and the harness compares body weights, organ weights, chemistry and haematology." fidelity={["validation"]} />
      <Banner tone="bad"><b>This model has not been validated against animal data.</b> No real historical control data ships with the tool. Until you load some, the status is NO_DATA.</Banner>
      <Panel title="Historical control data">
        <p className="small muted">CSV with the columns dataset, source, strain, sex, ageWeeks, endpoint, n, mean, sd. Endpoint names must match the simulator, for example bodyWeightG, chem.alt, organ.liver.relative, heme.neutrophils.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input type="file" accept=".csv,text/csv" aria-label="Historical control CSV" onChange={(e) => onFile(e.target.files?.[0])} />
          <button onClick={() => download("historical-controls-template.csv", TEMPLATE, "text/csv")}>Download template</button>
          <span className="small">{historical.length} rows loaded{historical.length ? ` from ${new Set(historical.map((h) => h.dataset)).size} dataset(s)` : ""}</span>
          {historical.length > 0 && <button onClick={() => setHist([])}>Clear</button>}
        </div>
        {errors.length > 0 && <Banner tone="bad">{errors.slice(0, 5).join(" ")}</Banner>}
      </Panel>
      <NeedsStudy>
        {() => (
          <Panel title="Run the check" right={<button className="primary" onClick={run} disabled={validation.status === "running"}>{validation.status === "running" ? "Running…" : historical.length ? "Compare with my data" : "Run with simulated demo data"}</button>}>
            {validation.status === "error" && <Banner tone="bad">{validation.error}</Banner>}
            {v ? (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}><Chip kind={v.report.status}>{v.report.status}</Chip><span>{v.report.message}</span></div>
                {v.report.checks.length > 0 && (
                  <>
                    <p className="small">Pass rate {f1(v.report.passRate * 100, 0)}% of {v.report.checks.length} checks. A check passes when the simulated mean is within two historical SDs and the SD is between half and double.</p>
                    <div className="scroll"><table>
                      <thead><tr><th>Endpoint</th><th>Sex</th><th className="num">Sim mean</th><th className="num">Hist mean</th><th className="num">z</th><th className="num">SD ratio</th><th>Result</th></tr></thead>
                      <tbody>{v.report.checks.map((c, i) => <tr key={i} className={c.pass ? "" : "flag"}><td>{c.endpoint}</td><td>{c.sex}</td><td className="num">{f1(c.simulatedMean, 2)}</td><td className="num">{f1(c.historicalMean, 2)}</td><td className="num">{f1(c.zMean, 2)}</td><td className="num">{f1(c.sdRatio, 2)}</td><td>{c.reason}</td></tr>)}</tbody>
                    </table></div>
                  </>
                )}
                {v.eligibility && <Banner tone={v.eligibility.eligible ? "good" : "warn"}><b>Virtual control groups.</b> {v.eligibility.message} ({f1(v.eligibility.fractionConsistent * 100, 0)}% of endpoints consistent.){v.usedDemo ? " Based on simulated demo data only." : ""}</Banner>}
              </>
            ) : <p className="muted">Not run yet.</p>}
          </Panel>
        )}
      </NeedsStudy>
      <Panel title="Datasets to source before any claim of validity">
        <div className="scroll"><table>
          <thead><tr><th>Dataset</th><th>Used for</th><th>Access</th><th /></tr></thead>
          <tbody>{REQUIRED_DATASETS.map((d) => <tr key={d.name}><td>{d.name}</td><td>{d.usedFor}</td><td className="small">{d.access}</td><td><Chip kind="NO_DATA">{d.status}</Chip></td></tr>)}</tbody>
        </table></div>
      </Panel>
    </>
  );
}
