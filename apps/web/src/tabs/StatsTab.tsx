import { useState } from "react";
import { Banner, NeedsStudy, Panel, Stat, TabHead, f1, pfmt } from "../components/ui";

export default function StatsTab() {
  const [onlySig, setOnlySig] = useState(true);
  const [sex, setSex] = useState<"all" | "M" | "F">("all");
  const [q, setQ] = useState("");
  const [minPct, setMinPct] = useState(10);
  return (
    <>
      <TabHead title="Statistics and NOAEL" blurb="Each treated group is compared with the control for every endpoint, by sex. Dunnett's test is used for roughly normal data and Kruskal-Wallis with Dunn's test when data are skewed or very small." fidelity={["statistics", "noael"]} />
      <NeedsStudy>
        {(p) => {
          const n = p.noael;
          const rows = p.rows
            .filter((r) => (!onlySig || r.significant) && Math.abs(r.pctChange) >= minPct && (sex === "all" || r.sex === sex) && r.endpoint.toLowerCase().includes(q.toLowerCase()))
            .sort((a, b) => a.pAdj - b.pAdj).slice(0, 300);
          return (
            <>
              <div className="stats">
                <Stat label="NOAEL" value={n.noael === null ? "below lowest" : `${n.noaelIsAtLeast ? "≥ " : ""}${f1(n.noael, 1)} mg/kg`} tone="good" />
                <Stat label="LOAEL" value={n.loael === null ? "not reached" : `${f1(n.loael, 1)} mg/kg`} tone={n.loael === null ? undefined : "bad"} />
                <Stat label="MTD estimate" value={n.mtd.doseMgPerKg === null ? "n/a" : `${f1(n.mtd.doseMgPerKg, 1)} mg/kg`} />
              </div>
              <Banner tone="info">Adverse call: a significant, dose-related, biologically relevant change with a large effect size, seen in both sexes or very large, or a significant grade 2+ finding, or humane endpoints in at least 10% of a group. The thresholds are design values for a toxicologist to set. MTD: {n.mtd.basis}.</Banner>
              <div className="grid">
                {n.groups.map((g) => (
                  <Panel key={g.groupId} title={`${g.groupId} · ${f1(g.dose, 1)} mg/kg`} right={<span className={`chip ${g.adverse ? "FAIL" : "PASS"}`}>{g.adverse ? "ADVERSE" : "NO ADVERSE EFFECT"}</span>}>
                    {g.reasons.length === 0 ? <p className="muted small">No adverse findings.</p> : <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{g.reasons.slice(0, 8).map((r) => <li key={r}>{r}</li>)}</ul>}
                  </Panel>
                ))}
              </div>
              <Panel title="Endpoint comparisons">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <label className="small"><input type="checkbox" checked={onlySig} onChange={(e) => setOnlySig(e.target.checked)} /> Significant only</label>
                  <label className="small">Sex <select value={sex} onChange={(e) => setSex(e.target.value as "all" | "M" | "F")} style={{ width: "auto" }}><option value="all">Both</option><option value="M">Male</option><option value="F">Female</option></select></label>
                  <label className="small">Minimum change {minPct}% <input type="range" min={0} max={100} value={minPct} onChange={(e) => setMinPct(+e.target.value)} style={{ width: 120 }} /></label>
                  <input type="text" placeholder="Filter endpoint, for example chem.alt" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter endpoint" style={{ maxWidth: 260 }} />
                </div>
                <div className="scroll"><table>
                  <thead><tr><th>Endpoint</th><th>Sex</th><th>Group</th><th className="num">Dose</th><th className="num">Control</th><th className="num">Treated</th><th className="num">Change %</th><th className="num">Hedges g</th><th className="num">Adj. p</th><th className="num">Trend p</th><th>Method</th></tr></thead>
                  <tbody>{rows.map((r, i) => (
                    <tr key={i} className={r.significant ? "flag" : ""}>
                      <td>{r.endpoint}</td><td>{r.sex}</td><td>{r.groupId}</td><td className="num">{f1(r.dose, 1)}</td><td className="num">{f1(r.meanControl, 2)}</td><td className="num">{f1(r.meanTreated, 2)}</td><td className="num">{f1(r.pctChange, 0)}</td><td className="num">{f1(r.hedgesG, 2)}</td><td className="num">{pfmt(r.pAdj)}</td><td className="num">{pfmt(r.trendP)}</td><td>{r.method === "dunnett" ? "Dunnett" : "KW + Dunn"}</td>
                    </tr>))}</tbody>
                </table></div>
                <p className="small muted">{rows.length} rows shown of {p.rows.length}. About 1 in 20 comparisons can reach p &lt; 0.05 by chance in a study with no effect.</p>
              </Panel>
            </>
          );
        }}
      </NeedsStudy>
    </>
  );
}
