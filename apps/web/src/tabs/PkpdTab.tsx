import { useState } from "react";
import { TISSUES } from "@eliminate/sim-core";
import { Legend, LineChart, type Series } from "../components/Chart";
import { NeedsStudy, NeedsTwin, Panel, Stat, TabHead, f1 } from "../components/ui";
import { fmt } from "../design/format";

type Window = "first" | "last" | "all";
const TISSUE_LABEL: Record<string, string> = { liver: "Liver", kidney: "Kidney", heart: "Heart", brain: "Brain", marrow: "Bone marrow" };

export default function PkpdTab() {
  const [log, setLog] = useState(false);
  const [win, setWin] = useState<Window>("first");
  return (
    <>
      <TabHead title="Pharmacokinetics and pharmacodynamics" blurb="How much drug reaches the blood and each organ, after the first dose and once dosing has settled, and how the body responds." fidelity={["pbpk", "pd"]} />
      <NeedsTwin>
        {(tw) => {
          const t = tw.treated;
          const iv = t.pkIntervals;
          const tau = iv?.tauH ?? 24;
          // the chart is sampled hourly; the summary numbers use the full 15-minute resolution
          const range: [number, number] = win === "first" && iv ? [iv.first.doseTimeH, iv.first.doseTimeH + tau]
            : win === "last" && iv?.last ? [iv.last.doseTimeH, iv.last.doseTimeH + tau] : [0, t.hoursH[t.hoursH.length - 1] ?? 0];
          const idx = t.hoursH.map((h, i) => [h, i] as const).filter(([h]) => h >= range[0] - 1e-9 && h <= range[1] + 1e-9).map(([, i]) => i);
          const whole = win === "all";
          const x = idx.map((i) => (whole ? t.hoursH[i]! / 24 : t.hoursH[i]! - range[0]));
          const colors = ["var(--c1)", "var(--c3)", "var(--c6)", "var(--c2)", "var(--c4)", "var(--c5)"];
          const series: Series[] = [
            { name: "Plasma", x, y: idx.map((i) => t.plasma[i]!), color: "var(--ink)", width: 2.2 },
            ...(["liver", "kidney", "heart", "brain", "marrow"] as const).map((o, k) => ({ name: TISSUE_LABEL[o]!, x, y: idx.map((i) => t.tissue[o][i]!), color: colors[k]!, width: 1.4 })),
          ];
          const pk = t.pk;
          const pd = Object.entries(t.pd);
          const row = (label: string, a: NonNullable<typeof iv>["first"] | null) => (
            <tr><td>{label}</td><td className="num">{a ? fmt(a.cmax, 2) : "n/a"}</td><td className="num">{a ? fmt(a.tmaxH, 2) : "n/a"}</td><td className="num">{a ? fmt(a.aucTau, 1) : "n/a"}</td><td className="num">{a ? fmt(a.trough, 3) : "n/a"}</td></tr>
          );
          return (
            <>
              <Panel title="Exposure per dose">
                {iv ? (
                  <>
                    <div className="scroll"><table>
                      <thead><tr><th>Interval</th><th className="num">Cmax (mg/L)</th><th className="num">Tmax after dose (h)</th><th className="num">AUC over {fmt(tau, 0)} h (mg·h/L)</th><th className="num">Trough (mg/L)</th></tr></thead>
                      <tbody>{row("First dose", iv.first)}{row(iv.last ? `Last dose (dose ${iv.last.dose}, steady state)` : "Last dose", iv.last)}</tbody>
                    </table></div>
                    <div className="stats">
                      <span className="hovercard">
                        <Stat label="Accumulation ratio" value={iv.accumulationRatio === null ? "n/a" : fmt(iv.accumulationRatio, 2)} hint="last over first dose, hover to read" />
                        <span className="card" role="tooltip" style={{ left: 0, right: "auto" }}>{iv.accumulationNote}</span>
                      </span>
                      <Stat label="Terminal half-life" value={pk.terminalHalfLifeH ? `${fmt(pk.terminalHalfLifeH, 1)} h` : "n/a"} hint="after the last dose" />
                      <Stat label="Doses given" value={iv.nDoses} hint={`every ${fmt(tau, 0)} h`} />
                    </div>
                  </>
                ) : <p className="muted">Dietary dosing has no discrete doses, so per-dose values do not apply. Whole-study AUC is {fmt(pk.aucAll, 0)} mg·h/L.</p>}
              </Panel>
              <Panel title="Concentration in blood and organs" right={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <div className="segmented" role="group" aria-label="Time window">
                    <button aria-pressed={win === "first"} onClick={() => setWin("first")} disabled={!iv}>First dose</button>
                    <button aria-pressed={win === "last"} onClick={() => setWin("last")} disabled={!iv?.last}>Last dose</button>
                    <button aria-pressed={win === "all"} onClick={() => setWin("all")}>Whole study</button>
                  </div>
                  <button aria-pressed={log} onClick={() => setLog(!log)}>{log ? "Log scale" : "Linear scale"}</button>
                </div>}>
                <LineChart label="Plasma and tissue concentration" series={series} xLabel={whole ? "Time since first dose (days)" : "Time after dose (h)"} yLabel="Concentration (mg/L)" logY={log} height={280} />
                <Legend items={series.map((s) => ({ name: s.name, color: s.color }))} />
              </Panel>
              <div className="grid">
                <Panel title="Exposure by tissue">
                  <div className="scroll"><table>
                    <thead><tr><th>Tissue</th><th className="num">Cmax mg/L</th><th className="num">AUC mg·h/L</th></tr></thead>
                    <tbody>{TISSUES.map((tis) => <tr key={tis}><td>{tis}</td><td className="num">{f1(pk.organCmax[tis], 2)}</td><td className="num">{f1(pk.organAuc[tis], 0)}</td></tr>)}</tbody>
                  </table></div>
                </Panel>
                {pd.length > 0 && (
                  <Panel title="Pharmacodynamic response">
                    <LineChart label="PD response" series={pd.map(([k, v], i) => ({ name: k, x: t.hoursH.map((h) => h / 24), y: v, color: colors[i]! }))} xLabel="Time since first dose (days)" yLabel="Response (0 to 1)" yMin={0} yMax={1} />
                    <p className="small muted">Effect-compartment model driven by brain concentration, so the response lags the concentration.</p>
                  </Panel>
                )}
              </div>
            </>
          );
        }}
      </NeedsTwin>
      <NeedsStudy>
        {(p) => {
          const main = p.study.animals.filter((a) => a.kind !== "tk" || true).filter((a) => a.doseMgPerKg > 0);
          const pts = main.map((a) => ({ x: a.pk.aucAll, y: Math.max(...Object.entries(a.endpoints).filter(([k]) => k.startsWith("histo.")).map(([, v]) => v)) }));
          if (pts.length === 0) return null;
          const maxX = Math.max(...pts.map((q) => q.x)), W = 560, H = 220;
          return (
            <Panel title="Exposure and toxicity across the study">
              <p className="small muted">Each dot is one treated animal: whole-study AUC against its worst histopathology grade at necropsy.</p>
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="AUC against worst histopathology grade" style={{ width: "100%", maxWidth: 640 }}>
                <g transform="translate(48,10)">
                  {[0, 1, 2, 3, 4, 5].map((g) => <g key={g}><line x1={0} x2={W - 60} y1={(H - 44) * (1 - g / 5)} y2={(H - 44) * (1 - g / 5)} stroke="var(--grid)" /><text x={-8} y={(H - 44) * (1 - g / 5)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">{g}</text></g>)}
                  {pts.map((q, i) => <circle key={i} cx={(q.x / maxX) * (W - 60)} cy={(H - 44) * (1 - q.y / 5) + ((i * 7) % 5) - 2} r={3.5} fill="var(--c1)" opacity={0.7} />)}
                  <text x={W - 60} y={H - 24} textAnchor="end" fontSize={11} fill="var(--muted)">AUC (mg·h/L), 0 to {f1(maxX, 0)}</text>
                  <text transform="translate(-34,0) rotate(-90)" textAnchor="end" fontSize={11} fill="var(--muted)">worst grade</text>
                </g>
              </svg>
            </Panel>
          );
        }}
      </NeedsStudy>
    </>
  );
}
