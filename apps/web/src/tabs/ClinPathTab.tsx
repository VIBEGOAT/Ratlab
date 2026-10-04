import { useState } from "react";
import type { Panel as PanelT } from "@eliminate/sim-core";
import { Legend, LineChart } from "../components/Chart";
import { Banner, NeedsTwin, Panel, Stat, TabHead, f1 } from "../components/ui";

function Table({ panel }: { panel: PanelT }) {
  return (
    <div className="scroll"><table>
      <thead><tr><th>Marker</th><th className="num">Value</th><th className="num">Low</th><th className="num">High</th><th className="num">× ULN</th><th /></tr></thead>
      <tbody>
        {Object.entries(panel).map(([k, a]) => (
          <tr key={k} className={a.flag ? "flag" : ""}>
            <td>{k}</td><td className="num">{f1(a.value, a.value < 10 ? 2 : 0)}</td><td className="num">{f1(a.lln, a.lln < 10 ? 2 : 0)}</td><td className="num">{f1(a.uln, a.uln < 10 ? 2 : 0)}</td><td className="num">{f1(a.xUln, 2)}</td><td>{a.flag}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

export default function ClinPathTab() {
  const [dayRaw, setDay] = useState<number | null>(null);
  const [marker, setMarker] = useState("alt");
  return (
    <>
      <TabHead title="Clinical pathology" blurb="Blood chemistry and haematology for the selected animal. Each animal has its own baseline plus analytical noise. Reference limits are placeholders until vendor control data is loaded." fidelity={["clinpath"]} />
      <NeedsTwin>
        {(tw) => {
          const t = tw.treated, u = tw.untreated;
          const day = dayRaw === null ? t.days : Math.min(dayRaw, t.days);
          const cp = t.clinpath[day]!;
          const d = Array.from({ length: t.days + 1 }, (_, i) => i);
          const all = { ...cp.chemistry, ...cp.hematology };
          const series = (a: typeof t) => a.clinpath.map((c) => (c.chemistry[marker] ?? c.hematology[marker])?.value ?? NaN);
          const m = t.myelosuppression;
          return (
            <>
              <Panel><div className="slider-row"><span className="small muted">Sample day</span><input type="range" min={0} max={t.days} value={day} onChange={(e) => setDay(+e.target.value)} aria-label="Sample day" /><b className="mono">{day}</b></div></Panel>
              {cp.hysLaw.met && <Banner tone="bad">Hy's Law criteria met on day {day}: ALT {f1(cp.hysLaw.altXuln, 1)}× ULN and bilirubin {f1(cp.hysLaw.bilirubinXuln, 1)}× ULN. This pattern marks a high risk of serious drug-induced liver injury.</Banner>}
              <div className="stats">
                <Stat label="ALT" value={`${f1(cp.hysLaw.altXuln, 1)}× ULN`} tone={cp.hysLaw.altXuln > 3 ? "bad" : undefined} />
                <Stat label="Bilirubin" value={`${f1(cp.hysLaw.bilirubinXuln, 1)}× ULN`} tone={cp.hysLaw.bilirubinXuln > 2 ? "bad" : undefined} />
                <Stat label="QTc change" value={`${f1(cp.cardiac.qtcChangePercent, 0)}%`} hint="relative, S7B concept" />
                <Stat label="Ejection fraction" value={`${f1(cp.cardiac.ejectionFractionPercent, 0)}%`} />
                <Stat label="Kidney injury marker" value={`${f1(cp.kidneyInjuryMarkerFold, 1)}×`} hint="fold over baseline" />
                <Stat label="Neutrophil nadir" value={`${f1(m.nadirFraction * 100, 0)}%`} hint={m.recoveryDay !== null ? `day ${m.nadirDay}, recovered day ${m.recoveryDay}` : `day ${m.nadirDay}`} tone={m.nadirFraction < 0.5 ? "bad" : undefined} />
              </div>
              <Panel title="Marker over time" right={
                <select value={marker} onChange={(e) => setMarker(e.target.value)} aria-label="Marker" style={{ width: "auto" }}>
                  {Object.keys(all).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>}>
                <LineChart label={`${marker} over time`} series={[{ name: "Treated", x: d, y: series(t), color: "var(--c1)" }, { name: "Untreated twin", x: d, y: series(u), color: "var(--c2)", dash: "5 4" }]} xLabel="day" marker={day} yMin={0} />
                <Legend items={[{ name: "Treated", color: "var(--c1)" }, { name: "Untreated twin", color: "var(--c2)", dash: true }]} />
              </Panel>
              <div className="grid">
                <Panel title={`Clinical chemistry, day ${day}`}><Table panel={cp.chemistry} /></Panel>
                <Panel title={`Haematology, day ${day}`}><Table panel={cp.hematology} /></Panel>
              </div>
            </>
          );
        }}
      </NeedsTwin>
    </>
  );
}
