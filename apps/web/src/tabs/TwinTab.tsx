import { ORGANS, gradeFromDamage } from "@eliminate/sim-core";
import { Legend, LineChart } from "../components/Chart";
import { Banner, NeedsTwin, ORGAN_COLOR, Panel, TabHead, f1 } from "../components/ui";
import { ORGAN_LABEL } from "../lib/setup";

export default function TwinTab() {
  return (
    <>
      <TabHead title="Untreated twin" blurb="The same animal, with the same body, metabolism, litter and disease parameters, given no dose. A live study cannot make this comparison, because one rat cannot be both treated and untreated." fidelity={["twin"]} />
      <NeedsTwin>
        {(tw) => {
          const t = tw.treated, u = tw.untreated;
          const d = Array.from({ length: t.days + 1 }, (_, i) => i);
          const hx = t.hoursH.map((h) => h / 24);
          const last = t.days;
          const rows: Array<[string, string, string]> = [
            ["Body weight at end", `${f1(t.daily.bodyWeightG[last]!, 0)} g`, `${f1(u.daily.bodyWeightG[last]!, 0)} g`],
            ["Sickness index at end", f1(t.daily.sickness[last]!, 2), f1(u.daily.sickness[last]!, 2)],
            ["Tumor volume at end", `${f1(t.daily.tumorVolume[last]!, 0)} mm³`, `${f1(u.daily.tumorVolume[last]!, 0)} mm³`],
            ["Glucose at end", `${f1(t.daily.glucose[last]!, 0)} mg/dL`, `${f1(u.daily.glucose[last]!, 0)} mg/dL`],
            ["First humane endpoint", t.humane ? `day ${t.humane.day}` : "none", u.humane ? `day ${u.humane.day}` : "none"],
            ...ORGANS.map((o): [string, string, string] => [`${ORGAN_LABEL[o]} grade at end`, String(gradeFromDamage(t.daily.damage[o][last]!)), String(gradeFromDamage(u.daily.damage[o][last]!))]),
          ];
          const delay = tw.humaneDelayDays;
          return (
            <>
              {delay !== null && delay > 0 && <Banner tone="good">{delay > 1e8 ? "The untreated twin reached a humane endpoint and the treated animal did not." : `Treatment delayed the first humane endpoint by ${delay} days.`}</Banner>}
              {delay !== null && delay < 0 && <Banner tone="bad">{delay < -1e8 ? "The treated animal reached a humane endpoint and its untreated twin did not. The treatment caused the harm." : `Treatment brought the first humane endpoint forward by ${-delay} days.`}</Banner>}
              <div className="grid wide">
                <Panel title="Summary">
                  <div className="scroll"><table>
                    <thead><tr><th>Measure</th><th className="num">Treated</th><th className="num">Untreated twin</th></tr></thead>
                    <tbody>{rows.map(([a, b, c]) => <tr key={a}><td>{a}</td><td className="num">{b}</td><td className="num">{c}</td></tr>)}</tbody>
                  </table></div>
                </Panel>
                <Panel title="Organ damage, treated animal">
                  <LineChart label="Organ damage over time" series={ORGANS.filter((o) => t.damage[o]).map((o) => ({ name: o, x: hx, y: t.damage[o]!, color: ORGAN_COLOR[o]! }))} xLabel="Study day" yLabel="Damage (0 to 1)" yMin={0} yMax={1} />
                  <Legend items={ORGANS.map((o) => ({ name: ORGAN_LABEL[o], color: ORGAN_COLOR[o]! }))} />
                  <p className="small muted">The untreated twin has no toxicity. Only disease can injure it.</p>
                </Panel>
                <Panel title="Body weight"><LineChart label="Body weight, treated and untreated" series={[{ name: "Treated", x: d, y: t.daily.bodyWeightG, color: "var(--c1)" }, { name: "Untreated twin", x: d, y: u.daily.bodyWeightG, color: "var(--c2)", dash: "5 4" }]} xLabel="Study day" yLabel="Body weight (g)" yMin={0} /><Legend items={[{ name: "Treated", color: "var(--c1)" }, { name: "Untreated twin", color: "var(--c2)", dash: true }]} /></Panel>
              </div>
            </>
          );
        }}
      </NeedsTwin>
    </>
  );
}
