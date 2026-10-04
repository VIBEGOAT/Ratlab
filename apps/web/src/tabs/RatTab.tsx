import { useEffect, useState } from "react";
import { FINDINGS, GRADE_SEVERITY, ORGANS, SIGNS, type AnimalBundle, type Organ, type TwinBundle } from "@eliminate/sim-core";
import { Legend, LineChart } from "../components/Chart";
import { Banner, Empty, NeedsTwin, Panel, Stat, TabHead, f1 } from "../components/ui";
import { ORGAN_LABEL } from "../lib/setup";
import { DEFAULT_LAYERS, type Layers } from "../three/RatModel";
import { RatScene, SceneBoundary, useKickResize, webglAvailable } from "../three/RatScene";
import { ORGAN_DETAIL, ratVisualState } from "../three/ratState";

const SIGN_LABEL: Record<string, string> = {
  reducedIntake: "Reduced intake", lethargy: "Lethargy", hunchedPosture: "Hunched posture", ruffledFur: "Ruffled fur", chromodacryorrhoea: "Red tears (chromodacryorrhoea)",
  jaundice: "Jaundice", tremor: "Tremor", ataxia: "Ataxia", convulsions: "Convulsions", dyspnoea: "Dyspnoea", diarrhoea: "Diarrhoea", dehydration: "Dehydration", tumour: "Palpable tumour", cataract: "Cataract",
};
const LAYER_LABEL: Array<[keyof Layers, string]> = [["xray", "X-ray body"], ["skeleton", "Skeleton"], ["brain", "Brain"], ["heart", "Heart"], ["lungs", "Lungs"], ["liver", "Liver"], ["kidneys", "Kidneys"], ["gut", "Gut"], ["marrow", "Bone marrow"], ["tumor", "Tumor"], ["labels", "Grade labels"]];

function OrganDetail({ organ, b, day }: { organ: Organ; b: AnimalBundle; day: number }) {
  const det = ORGAN_DETAIL[organ];
  const v = ratVisualState(b, day).organs[organ];
  const hx = b.hoursH.map((h) => h / 24);
  const damage = b.damage[organ];
  const defence = b.defence[organ];
  const cp = b.clinpath[Math.min(day, b.days)]!;
  return (
    <Panel title={`${ORGAN_LABEL[organ]} on day ${day}`}>
      <div className="organ" style={{ borderColor: v.grade >= 3 ? "var(--bad)" : v.grade >= 1 ? "var(--warn)" : undefined }}>
        <b>Grade {v.grade} · {v.severity}</b>
        <span className="small muted">{v.finding}</span>
        <span className="mono small">damage {v.damage.toFixed(2)}</span>
      </div>
      <LineChart label={`${organ} damage and drug concentration`} height={190} xLabel="day" marker={day} series={[
        ...(damage ? [{ name: "Damage (0 to 1)", x: hx, y: damage, color: "var(--c6)" }] : []),
        ...(defence ? [{ name: "Defence capacity", x: hx, y: defence, color: "var(--c4)", dash: "5 4" }] : []),
      ]} yMin={0} yMax={1} />
      <LineChart label={`${organ} tissue concentration`} height={150} xLabel="day" marker={day} yLabel="mg/L" series={[{ name: "Tissue concentration", x: hx, y: b.tissue[det.tissue], color: "var(--c1)" }]} yMin={0} />
      <Legend items={[{ name: "Damage", color: "var(--c6)" }, { name: "Defence capacity", color: "var(--c4)", dash: true }, { name: "Tissue concentration", color: "var(--c1)" }]} />
      <div className="scroll" style={{ maxHeight: 200 }}><table>
        <thead><tr><th>Marker</th><th className="num">Value</th><th className="num">× ULN</th></tr></thead>
        <tbody>{det.markers.map((m) => { const a = cp[m.panel === "chemistry" ? "chemistry" : "hematology"][m.key]; return a ? <tr key={m.key} className={a.flag ? "flag" : ""}><td>{m.key}</td><td className="num">{f1(a.value, a.value < 10 ? 2 : 0)}</td><td className="num">{f1(a.xUln, 2)}</td></tr> : null; })}</tbody>
      </table></div>
    </Panel>
  );
}

function RatLab({ tw }: { tw: TwinBundle }) {
  const t = tw.treated;
  const [day, setDay] = useState(t.days);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [selected, setSelected] = useState<Organ | null>(null);
  const [twins, setTwins] = useState(true);
  const [reset, setReset] = useState(0);
  const gl = webglAvailable();
  useKickResize(reset);
  const d = Math.min(t.days, Math.round(day));

  useEffect(() => { setDay(t.days); setPlaying(false); }, [t]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setDay((x) => { const n = x + speed * 0.1; if (n >= t.days) { setPlaying(false); return t.days; } return n; }), 100);
    return () => clearInterval(id);
  }, [playing, speed, t.days]);

  const v = ratVisualState(t, d);
  const sd = t.daily;
  const signs = SIGNS.map((s) => ({ s, v: sd.signIntensity[s]![d]! })).filter((x) => x.v > 0.1).sort((a, b) => b.v - a.v);
  const cp = t.clinpath[d]!;

  return (
    <>
      {t.humane && d >= t.humane.day && <Banner tone="bad">{t.humane.banner}</Banner>}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 460, position: "relative", background: "var(--surface-2)" }}>
          {gl ? (
            <SceneBoundary fallback={<Empty>The 3D view could not start. All readouts below still work.</Empty>}>
              <RatScene treated={t} untreated={tw.untreated} day={day} layers={layers} selected={selected} onSelect={setSelected} twins={twins} resetKey={reset} animate />
            </SceneBoundary>
          ) : <Empty>This browser does not offer WebGL, so the 3D rat cannot be drawn. The readouts below still work.</Empty>}
          <div className="small muted" style={{ position: "absolute", right: 10, top: 8, pointerEvents: "none" }}>drag to rotate · scroll to zoom · click an organ</div>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--line)" }}>
          <div className="slider-row">
            <button className="primary" onClick={() => { if (day >= t.days) setDay(0); setPlaying(!playing); }} aria-label={playing ? "Pause" : "Play"}>{playing ? "Pause" : "Play"}</button>
            <input type="range" min={0} max={t.days} step={0.1} value={day} onChange={(e) => { setPlaying(false); setDay(+e.target.value); }} aria-label="Study day" />
            <b className="mono">Day {d} / {t.days}</b>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <label className="small">Speed <select value={speed} onChange={(e) => setSpeed(+e.target.value)} style={{ width: "auto" }}>{[0.5, 1, 2, 4, 8].map((s) => <option key={s} value={s}>{s} days/s</option>)}</select></label>
            <label className="small"><input type="checkbox" checked={twins} onChange={(e) => setTwins(e.target.checked)} /> Show untreated twin</label>
            <button onClick={() => setReset(reset + 1)}>Reset view</button>
          </div>
          <div className="checks" role="group" aria-label="Layers">
            {LAYER_LABEL.map(([k, l]) => <label key={k}><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />{l}</label>)}
          </div>
        </div>
      </div>

      <div className="stats">
        <Stat label="Body weight" value={`${f1(sd.bodyWeightG[d]!, 0)} g`} hint={`${f1(sd.weightChangeFraction[d]! * 100, 0)}% from day 0`} />
        <Stat label="Sickness index" value={f1(sd.sickness[d]!, 2)} tone={sd.sickness[d]! > 0.5 ? "bad" : sd.sickness[d]! > 0.25 ? "warn" : undefined} />
        <Stat label="Grimace score" value={f1(sd.grimace[d]!, 2)} hint="0 to 2" tone={sd.grimace[d]! > 1.5 ? "bad" : undefined} />
        <Stat label="Heart rate" value={`${f1(cp.cardiac.heartRateBpm, 0)} bpm`} />
        <Stat label="QTc change" value={`${f1(cp.cardiac.qtcChangePercent, 0)}%`} />
        <Stat label="Tumor" value={sd.tumorVolume[d]! > 0 ? `${f1(sd.tumorVolume[d]!, 0)} mm³` : "none"} />
      </div>

      <div className="grid wide">
        <Panel title="Organ status (click one to open it)">
          <div className="organ-grid">
            {ORGANS.map((o) => {
              const ov = v.organs[o];
              return (
                <button key={o} className="organ" onClick={() => setSelected(o)} aria-pressed={selected === o} style={{ textAlign: "left", borderColor: selected === o ? "var(--accent)" : ov.grade >= 3 ? "var(--bad)" : ov.grade >= 1 ? "var(--warn)" : undefined }}>
                  <b>{ORGAN_LABEL[o]}</b>
                  <span className="mono small">damage {ov.damage.toFixed(2)} · grade {ov.grade}</span>
                  <span className="small muted">{GRADE_SEVERITY[ov.grade]}: {FINDINGS[o][ov.grade]}</span>
                </button>
              );
            })}
          </div>
        </Panel>
        {selected ? <OrganDetail organ={selected} b={t} day={d} /> : (
          <Panel title="Clinical signs on this day">
            {signs.length === 0 ? <p className="muted">No clinical signs.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {signs.map(({ s, v: iv }) => <div key={s} className="barrow"><span>{SIGN_LABEL[s]}</span><div className="bar"><i style={{ width: `${iv * 100}%`, background: "var(--c3)" }} /></div><span className="mono" style={{ textAlign: "right" }}>{(iv * 100).toFixed(0)}%</span></div>)}
              </div>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}

export default function RatTab() {
  return (
    <>
      <TabHead title="Live rat" blurb="A rotatable 3D model of the selected animal. Organs change colour and show grade labels as injury grows, and the body shows the clinical signs. The untreated twin stands beside it." fidelity={["toxicodynamics", "behaviour"]} />
      <NeedsTwin>{(tw) => <RatLab tw={tw} />}</NeedsTwin>
    </>
  );
}
