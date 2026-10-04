import { useState } from "react";
import { TISSUES } from "@eliminate/sim-core";
import { Legend, LineChart, type Series } from "../components/Chart";
import { NeedsStudy, NeedsTwin, Panel, Stat, TabHead, f1 } from "../components/ui";

export default function PkpdTab() {
  const [log, setLog] = useState(false);
  const [window, setWindow] = useState<"first" | "all">("first");
  return (
    <>
      <TabHead title="Pharmacokinetics and pharmacodynamics" blurb="Whole-body PBPK for the selected animal, exposure in each organ, PD responses and the link between exposure and injury across the whole study." fidelity={["pbpk", "pd"]} />
      <NeedsTwin>
        {(tw) => {
          const t = tw.treated;
          const hrs = window === "first" ? Math.min(72, t.hoursH.length) : t.hoursH.length;
          const x = t.hoursH.slice(0, hrs).map((h) => h / 24);
          const colors = ["var(--c1)", "var(--c3)", "var(--c6)", "var(--c2)", "var(--c4)", "var(--c5)"];
          const series: Series[] = [
            { name: "Plasma", x, y: t.plasma.slice(0, hrs), color: "var(--ink)", width: 2.2 },
            ...(["liver", "kidney", "heart", "brain", "marrow"] as const).map((o, i) => ({ name: o, x, y: t.tissue[o].slice(0, hrs), color: colors[i]!, width: 1.4 })),
          ];
          const pk = t.pk;
          const pd = Object.entries(t.pd);
          return (
            <>
              <div className="stats">
                <Stat label="Cmax" value={`${f1(pk.cmax, 2)} mg/L`} />
                <Stat label="Tmax" value={`${f1(pk.tmaxH, 1)} h`} />
                <Stat label="AUC (whole study)" value={`${f1(pk.aucAll, 0)} mg·h/L`} />
                <Stat label="Terminal half-life" value={pk.terminalHalfLifeH ? `${f1(pk.terminalHalfLifeH, 1)} h` : "n/a"} />
                <Stat label="Accumulation ratio" value={pk.accumulationRatio ? f1(pk.accumulationRatio, 2) : "n/a"} hint="last over first interval" />
              </div>
              <Panel title="Concentration over time" right={
                <div style={{ display: "flex", gap: 8 }}>
                  <button aria-pressed={window === "first"} onClick={() => setWindow(window === "first" ? "all" : "first")}>{window === "first" ? "First 3 days" : "Whole study"}</button>
                  <button aria-pressed={log} onClick={() => setLog(!log)}>{log ? "Log scale" : "Linear scale"}</button>
                </div>}>
                <LineChart label="Plasma and tissue concentration" series={series} xLabel="day" yLabel="mg/L" logY={log} height={280} />
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
                    <LineChart label="PD response" series={pd.map(([k, v], i) => ({ name: k, x: t.hoursH.map((h) => h / 24), y: v, color: colors[i]! }))} xLabel="day" yLabel="response (0 to 1)" yMin={0} yMax={1} />
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
