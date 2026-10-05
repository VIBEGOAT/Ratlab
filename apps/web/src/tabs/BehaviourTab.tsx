import { useState } from "react";
import type { AnimalBundle } from "@eliminate/sim-core";
import { LineChart } from "../components/Chart";
import { ArenaScene, type ArenaMode } from "../three/ArenaScene";
import { SceneBoundary, useKickResize, webglAvailable } from "../three/RatScene";
import { Banner, Empty, NeedsTwin, Panel, TabHead, f1, ScrollBox } from "../components/ui";

const days = (n: number) => Array.from({ length: n + 1 }, (_, i) => i);

function Track({ t }: { t: AnimalBundle["track"] }) {
  const pts = t.x.map((x, i) => `${(x * 200).toFixed(1)},${(t.y[i]! * 200).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Open field track" style={{ width: "100%", maxWidth: 260, border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface-2)" }}>
      <rect x={50} y={50} width={100} height={100} fill="none" stroke="var(--grid)" strokeDasharray="4 4" />
      <polyline points={pts} fill="none" stroke="var(--c1)" strokeWidth={0.8} />
      <circle cx={t.x[0]! * 200} cy={t.y[0]! * 200} r={3} fill="var(--c3)" />
    </svg>
  );
}

const ARENAS: Array<[ArenaMode, string, string]> = [
  ["open", "Open field", "Five minutes of the last study day replayed at 4× speed. The dashed square is the centre zone."],
  ["maze", "Water maze", "The last training trial. The gold disc is the hidden platform. A rat with low cognition capacity wanders."],
  ["home", "Home cage", "A 24 hour day compressed into 24 seconds. The rat rests in the nest when activity is low and visits food and water when it is high."],
];

function Arena({ t, u, day }: { t: AnimalBundle; u: AnimalBundle; day: number }) {
  const [mode, setMode] = useState<ArenaMode>("open");
  const gl = webglAvailable();
  useKickResize(mode);
  const info = ARENAS.find((a) => a[0] === mode)!;
  return (
    <Panel title="Behaviour arenas" right={<div style={{ display: "flex", gap: 6 }}>{ARENAS.map(([m, l]) => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} style={{ fontWeight: mode === m ? 700 : 500 }}>{l}</button>)}</div>}>
      <div style={{ height: 380, background: "var(--surface-2)", borderRadius: 6, overflow: "hidden" }}>
        {gl ? <SceneBoundary fallback={<Empty>The 3D arena could not start.</Empty>}><ArenaScene mode={mode} treated={t} untreated={u} day={day} hoursPerSec={1} /></SceneBoundary> : <Empty>WebGL is not available in this browser.</Empty>}
      </div>
      <p className="small muted">{info[2]} Both animals show their injury state for the selected day.</p>
    </Panel>
  );
}

export default function BehaviourTab() {
  const [dayRaw, setDay] = useState<number | null>(null);
  return (
    <>
      <TabHead title="Behaviour" blurb="Modelled behavioural endpoints derived from organ injury, sickness, pain, CNS exposure and disease burden. These are endpoints in a model, not statements about what the animal experiences." fidelity={["behaviour"]} />
      <Banner tone="warn">ILLUSTRATIVE. Behaviour is the least validated part of this tool. Use it to see how the pieces connect, not to predict real behaviour.</Banner>
      <NeedsTwin>
        {(tw) => {
          const t = tw.treated, u = tw.untreated;
          const day = dayRaw === null ? Math.min(t.days, Math.max(0, t.days - 1)) : Math.min(dayRaw, t.days);
          const hc = t.homeCage[day]!, hcU = u.homeCage[day]!;
          const fob = t.fob[day]!, fobU = u.fob[day]!;
          const test = t.tests[day]!, testU = u.tests[day]!;
          const dx = days(t.days);
          return (
            <>
              <Panel>
                <div className="slider-row">
                  <span className="small muted">Day</span>
                  <input type="range" min={0} max={t.days} value={day} onChange={(e) => setDay(+e.target.value)} aria-label="Study day" />
                  <b className="mono">{day}</b>
                </div>
              </Panel>
              <Arena t={t} u={u} day={day} />
              <div className="grid wide">
                <Panel title="Home-cage activity over the study">
                  <LineChart label="Activity index" series={[
                    { name: "Treated", x: dx, y: t.daily.behaviour.activityIndex!, color: "var(--c1)" },
                    { name: "Untreated twin", x: dx, y: u.daily.behaviour.activityIndex!, color: "var(--c2)", dash: "5 4" },
                  ]} xLabel="Study day" yLabel="relative to baseline" yMin={0} marker={day} />

                  <p className="small muted">Stimulants raise activity, then tolerance builds and a rebound below baseline follows withdrawal. Sickness lowers activity.</p>
                </Panel>
                <Panel title={`Day ${day}: 24 hour monitoring`}>
                  <LineChart label="Activity per 15 minutes" series={[
                    { name: "Treated", x: Array.from(hc.hours), y: Array.from(hc.activity), color: "var(--c1)" },
                    { name: "Untreated twin", x: Array.from(hcU.hours), y: Array.from(hcU.activity), color: "var(--c2)", dash: "5 4" },
                  ]} xLabel="hour of day (lights off 12 to 24)" yLabel="Activity (counts)" shade={[[12, 24]]} yMin={0} xMin={0} xMax={24} />
                  <LineChart label="Body temperature" series={[
                    { name: "Treated", x: Array.from(hc.hours), y: Array.from(hc.bodyTempC), color: "var(--c6)" },
                    { name: "Untreated twin", x: Array.from(hcU.hours), y: Array.from(hcU.bodyTempC), color: "var(--c2)", dash: "5 4" },
                  ]} xLabel="Hour of day" yLabel="Temperature (°C)" shade={[[12, 24]]} height={170} xMin={0} xMax={24} yMin={34} yMax={39} />
                  <p className="small muted">Dark-phase share of activity: {f1(hc.darkFraction * 100, 0)}% treated, {f1(hcU.darkFraction * 100, 0)}% untreated.</p>
                </Panel>
              </div>
              <div className="grid">
                <Panel title="Behavioural tests (treated vs untreated twin)">
                  <ScrollBox><table>
                    <thead><tr><th>Test</th><th className="num">Treated</th><th className="num">Untreated</th></tr></thead>
                    <tbody>
                      <tr><td>Open field distance (cm / 5 min)</td><td className="num">{f1(test.openField.distanceCm, 0)}</td><td className="num">{f1(testU.openField.distanceCm, 0)}</td></tr>
                      <tr><td>Open field centre time</td><td className="num">{f1(test.openField.centerTimeFraction * 100, 0)}%</td><td className="num">{f1(testU.openField.centerTimeFraction * 100, 0)}%</td></tr>
                      <tr><td>Elevated plus maze, open arm time</td><td className="num">{f1(test.epm.openArmFraction * 100, 0)}%</td><td className="num">{f1(testU.epm.openArmFraction * 100, 0)}%</td></tr>
                      <tr><td>Sucrose preference</td><td className="num">{f1(test.sucrose * 100, 0)}%</td><td className="num">{f1(testU.sucrose * 100, 0)}%</td></tr>
                    </tbody>
                  </table></ScrollBox>
                </Panel>
                <Panel title="Observation battery (Irwin and FOB style)">
                  <ScrollBox><table>
                    <thead><tr><th>Item</th><th className="num">Treated</th><th className="num">Untreated</th></tr></thead>
                    <tbody>
                      {(["posture", "gait", "arousal", "reactivity", "tremor", "ataxia", "convulsions"] as const).map((k) => <tr key={k}><td>{k} (0 normal)</td><td className="num">{fob[k]}</td><td className="num">{fobU[k]}</td></tr>)}
                      {(["gripStrengthPct", "rotarodLatencyPct", "startleAmplitudePct", "prepulseInhibitionPct", "hindLimbSplayPct"] as const).map((k) => <tr key={k}><td>{k.replace(/Pct$/, "")} (% of baseline)</td><td className="num">{f1(fob[k], 0)}</td><td className="num">{f1(fobU[k], 0)}</td></tr>)}
                      <tr><td>righting reflex success</td><td className="num">{f1(fob.rightingReflex * 100, 0)}%</td><td className="num">{f1(fobU.rightingReflex * 100, 0)}%</td></tr>
                    </tbody>
                  </table></ScrollBox>
                </Panel>
              </div>
              <div className="grid">
                <Panel title="Spatial learning (water-maze style)">
                  <LineChart label="Escape latency" series={[{ name: "Latency", x: t.waterMaze.latencySec.map((_, i) => i + 1), y: t.waterMaze.latencySec, color: "var(--c1)" }]} xLabel="Training trial" yLabel="Escape latency (s)" yMin={0} height={200} />
                  <p className="small muted">Learning rate scales with the animal's cognition capacity at the end of the study. A Q-learning agent stands in for the rat.</p>
                </Panel>
                <Panel title="Replayable open-field track">
                  <Track t={t.track} />
                  <p className="small muted">Five minutes at 5 Hz on the last study day. Dashed square marks the centre zone.</p>
                </Panel>
              </div>
            </>
          );
        }}
      </NeedsTwin>
    </>
  );
}
