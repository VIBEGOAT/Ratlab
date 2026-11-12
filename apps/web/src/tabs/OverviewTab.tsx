import { useMemo, useState } from "react";
import { CONTEXT_PRESETS, FINDINGS, GRADE_SEVERITY, ORGANS, assessCredibility, listUnverifiedConstants, type Organ } from "@eliminate/sim-core";
import { useStore, type LabSection } from "../store";
import { COMPOUNDS, ORGAN_LABEL } from "../lib/setup";
import { doseLadder, doseText, studyVerdict } from "../lib/verdict";
import { firstToFail } from "../presenter/prediction";
import { ratVisualState } from "../three/ratState";
import { GRADE_WORD, gradeVar } from "../design/damage";
import { fmtInt } from "../design/format";
import { AnimatedNumber } from "../components/motion";
import { Icon } from "../components/icons";
import { Empty, NeedsStudy } from "../components/ui";
import type { ViewId } from "../lib/nav";
import { referenceCaseForCompound } from "../lib/referenceStudies";

const USES: Array<[keyof typeof CONTEXT_PRESETS, string]> = [["education", "Teaching"], ["screening", "Screening compounds"], ["designAid", "Designing a study"], ["replacement", "Replacing an animal study"]];

function Tile({ label, to, children, hint, tone }: { label: string; to: [LabSection, ViewId]; children: React.ReactNode; hint: string; tone?: "good" | "warn" | "bad" }) {
  const goLab = useStore((s) => s.goLab);
  return (
    <button type="button" className={`kpi ${tone ?? ""}`} onClick={() => goLab(to[0], to[1])}>
      <span className="kpi-label">{label}</span>
      <b className="kpi-value">{children}</b>
      <span className="kpi-hint">{hint}</span>
      <span className="kpi-go"><span>Details</span><Icon name="arrow" size={16} /></span>
    </button>
  );
}

export default function OverviewTab() {
  const [answer, setAnswer] = useState<string | null>(null);
  const setup = useStore((s) => s.setup);
  const twin = useStore((s) => s.twin.data);
  const focusId = useStore((s) => s.focusId);
  const goLab = useStore((s) => s.goLab);
  const uses = useMemo(() => USES.map(([k, label]) => ({ label, ok: assessCredibility(CONTEXT_PRESETS[k]!).adequate })), []);
  const unverified = listUnverifiedConstants().length;
  const compound = COMPOUNDS.find((c) => c.key === setup.compoundKey)?.name ?? "Custom compound";
  const referenceCase = referenceCaseForCompound(setup.compoundKey);

  return (
    <>
      <div className="head">
        <div>
          <h2>Your study at a glance</h2>
          <p>The answers first. Every tile opens the full analysis behind it.</p>
        </div>
      </div>
      <NeedsStudy>
        {(p) => {
          const verdict = studyVerdict(p.noael);
          const ladder = doseLadder(p.study.design.groups, p.noael.groups);
          const main = p.study.animals.filter((a) => a.kind === "main");
          const humane = main.filter((a) => a.terminalReason === "humane");
          const control = new Set(p.study.design.groups.filter((g) => g.kind === "main" && g.doseMgPerKg === 0).map((g) => g.id));
          const humaneControl = humane.filter((a) => control.has(a.group)).length;
          const t = twin?.treated ?? null;
          const first = t ? firstToFail(t) : null;
          const end = t ? ratVisualState(t, t.days) : null;
          const cmax = t ? (t.pkIntervals?.first.cmax ?? Math.max(...t.plasma)) : null;
          const highGroup = p.study.design.groups.filter((g) => g.kind === "main").sort((a, b) => b.doseMgPerKg - a.doseMgPerKg)[0];
          const modelLiver = highGroup ? p.histo.find((row) => row.groupId === highGroup.id && row.organ === "liver" && row.sex === "M") : undefined;
          return (
            <div className="overview">
              <section className={`verdict ${verdict.tone}`} aria-labelledby="verdict-title">
                <div className="verdict-text">
                  <span className="eyebrow">{compound} · {p.study.design.durationDays} days · {fmtInt(main.length)} virtual rats</span>
                  <h3 id="verdict-title">{verdict.headline}</h3>
                  {verdict.reason && <p className="verdict-reason">First sign of harm: {verdict.reason}.</p>}
                  <ol className="ladder" aria-label="Dose groups, lowest first">
                    {ladder.map((s, i) => (
                      <li key={s.id} className={s.status} style={{ "--i": i } as React.CSSProperties}>
                        <span className="rung-dose">{s.status === "control" ? "Control" : `${doseText(s.dose)} mg/kg`}</span>
                        <span className="rung-status">{s.status === "control" ? "no drug" : s.status === "adverse" ? "adverse" : "no adverse effect"}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="organ-map" aria-label={t ? `Organ status of animal ${focusId} at the end of the study` : "Organ status"}>
                  <span className="eyebrow">Animal {focusId ?? "…"}, day {t?.days ?? "…"}</span>
                  {end ? (
                    <ul>
                      {ORGANS.map((o: Organ, i) => {
                        const g = end.organs[o].grade;
                        return (
                          <li key={o} style={{ "--i": i, "--gc": gradeVar(g) } as React.CSSProperties} className={g >= 3 ? "hot" : ""}>
                            <button type="button" onClick={() => goLab("animal", "rat")} aria-label={`${ORGAN_LABEL[o]}: ${GRADE_WORD[g]}. Open the 3D rat.`}>
                              <i className="orb" aria-hidden="true" />
                              <span className="orb-name">{ORGAN_LABEL[o]}</span>
                              <span className="orb-grade">{GRADE_WORD[g]}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <Empty>Preparing the selected animal…</Empty>}
                </div>
              </section>

              <div className="kpis">
                <Tile label="Highest dose with no adverse effect" to={["data", "stats"]} tone="good" hint={p.noael.noaelIsAtLeast ? "No tested dose was adverse" : "The NOAEL, from the statistics"}>
                  {p.noael.noael === null ? "Below the lowest dose" : <><AnimatedNumber value={p.noael.noael} format={(n) => doseText(Number(n.toFixed(2)))} /> <small>mg/kg/day</small></>}
                </Tile>
                <Tile label="First organ affected" to={["animal", "rat"]} tone={first?.day !== null && first ? "warn" : undefined} hint={first ? (first.day !== null ? `Animal ${focusId}, first mild injury` : `No organ reached mild injury in animal ${focusId}`) : "Preparing…"}>
                  {first ? <>{ORGAN_LABEL[first.organ]}{first.day !== null && <small> · day <AnimatedNumber value={first.day} format={(n) => String(Math.round(n))} /></small>}</> : "…"}
                </Tile>
                <Tile label="Humane endpoints" to={["population", "population"]} tone={humane.length ? "bad" : "good"} hint={humane.length === 0 ? "No animal would have needed to be euthanised early" : humaneControl === humane.length ? "All in the untreated control group" : `${humaneControl} in the control group`}>
                  <AnimatedNumber value={humane.length} format={(n) => String(Math.round(n))} /> <small>of {main.length}</small>
                </Tile>
                <Tile label="Peak drug level in blood" to={["data", "pkpd"]} hint={`After the first dose, animal ${focusId ?? "…"}`}>
                  {cmax === null ? "…" : <><AnimatedNumber value={cmax} format={(n) => n.toFixed(2)} /> <small>mg/L</small></>}
                </Tile>
              </div>

              {referenceCase?.publishedFindings && <section className="evidence-lab" aria-labelledby="evidence-lab-title">
                <div className="evidence-lab-head">
                  <div><span className="eyebrow">Evidence comparison · {referenceCase.drug}</span><h3 id="evidence-lab-title">Same biological question. Different evidence.</h3></div>
                  <span className="evidence-rule">Do not merge these columns</span>
                </div>
                <div className="evidence-columns">
                  <article className="evidence-column observed">
                    <div className="evidence-column-title"><span>Published observation</span><b>{referenceCase.source.label}</b></div>
                    <p>Findings imported from the cited protocol. Read the source limits before treating them as a general dose-response rule.</p>
                    <ul>{referenceCase.publishedFindings.map((finding) => <li key={`${finding.dose}-${finding.time}`}><strong>{fmtInt(finding.dose)} mg/kg</strong><span>{finding.time}</span><p>{finding.finding}</p></li>)}</ul>
                  </article>
                  <article className="evidence-column predicted">
                    <div className="evidence-column-title"><span>Predicted</span><b>VAST model sandbox</b></div>
                    <p>A fictional organ-toxicity proxy at your selected design—not a fitted {referenceCase.drug} model.</p>
                    {modelLiver && highGroup ? <div className="model-evidence-card"><span>Model top dose</span><strong>{fmtInt(highGroup.doseMgPerKg)} mg/kg/day</strong><span>Predicted liver pathology</span><strong>{GRADE_SEVERITY[modelLiver.maxGrade as 0 | 1 | 2 | 3 | 4 | 5]} · {FINDINGS.liver[modelLiver.maxGrade as 0 | 1 | 2 | 3 | 4 | 5]}</strong><small>Mean model grade {modelLiver.meanGrade.toFixed(2)} · males</small></div> : <p>Model pathology is still calculating.</p>}
                  </article>
                </div>
                <div className="evidence-question">
                  <h4>What can you conclude?</h4>
                  <div role="group" aria-label="Evidence interpretation question">
                    <button type="button" aria-pressed={answer === "validated"} onClick={() => setAnswer("validated")}>The model validates the published experiment.</button>
                    <button type="button" aria-pressed={answer === "pattern"} onClick={() => setAnswer("pattern")}>Both concern liver injury, but direct agreement has not been tested.</button>
                    <button type="button" aria-pressed={answer === "pk"} onClick={() => setAnswer("pk")}>The pathology findings prove the modelled PK curve.</button>
                  </div>
                  {answer && <p className={answer === "pattern" ? "correct" : "incorrect"} role="status">{answer === "pattern" ? "Correct. The source and model address a related mechanism, but their doses, outputs and evidence types are not yet matched for validation." : "Not supported. A shared drug or organ does not establish validation, and pathology cannot verify an unobserved PK curve."}</p>}
                </div>
              </section>}

              <section className="trust-strip" aria-labelledby="trust-title">
                <div>
                  <h3 id="trust-title">How far to trust this</h3>
                  <p className="small muted">No part is validated against real animal data yet. {unverified} of the model's constants still await an expert check.</p>
                </div>
                <ul className="uses">
                  {uses.map((u) => (
                    <li key={u.label} className={u.ok ? "ok" : "no"}>
                      <Icon name={u.ok ? "check" : "cross"} size={16} /><span>{u.label}</span><span className="sr-only">{u.ok ? ": adequate" : ": not yet credible"}</span>
                    </li>
                  ))}
                </ul>
                <div className="trust-actions">
                  <button type="button" onClick={() => goLab("trust", "calculator")}>Dose calculator <Icon name="arrow" size={16} /></button>
                  <button type="button" onClick={() => goLab("trust", "fidelity")}>See the sources <Icon name="arrow" size={16} /></button>
                </div>
              </section>
            </div>
          );
        }}
      </NeedsStudy>
    </>
  );
}
