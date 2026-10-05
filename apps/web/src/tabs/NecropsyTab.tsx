import { useState } from "react";
import { FINDINGS, GRADE_SEVERITY, ORGANS, mean, sd, type Organ, type Sex } from "@eliminate/sim-core";
import { NeedsStudy, Panel, TabHead, f1, pfmt, ScrollBox } from "../components/ui";
import { ORGAN_LABEL } from "../lib/setup";

export default function NecropsyTab() {
  const [sex, setSex] = useState<Sex>("M");
  return (
    <>
      <TabHead title="Necropsy and histopathology" blurb="Organ weights and microscopic findings at the end of the study. Findings are graded 0 to 5 from modelled organ damage, with vocabulary a pathologist should review." fidelity={["toxicodynamics"]} />
      <NeedsStudy>
        {(p) => {
          const design = p.study.design;
          const groups = design.groups.filter((g) => g.kind === "main");
          const sexes = design.sexes;
          const s = sexes.includes(sex) ? sex : sexes[0]!;
          const histo = p.histo.filter((h) => h.sex === s);
          const wt = (gid: string, k: string) => p.study.animals.filter((a) => a.group === gid && a.sex === s).map((a) => a.endpoints[k]!).filter(Number.isFinite);
          return (
            <>
              <Panel right={<div style={{ display: "flex", gap: 6 }}>{sexes.map((x) => <button key={x} aria-pressed={x === s} onClick={() => setSex(x)} style={{ fontWeight: x === s ? 700 : 500 }}>{x === "M" ? "Males" : "Females"}</button>)}</div>} title="Microscopic findings">
                <ScrollBox><table>
                  <thead><tr><th>Organ</th><th>Group</th><th className="num">Dose</th><th className="num">n</th><th className="num">Grade ≥1</th><th className="num">Grade ≥2</th><th className="num">Mean grade</th><th>Worst finding</th><th className="num">p vs control</th></tr></thead>
                  <tbody>
                    {histo.filter((h) => h.maxGrade > 0 || h.groupId === groups[groups.length - 1]!.id).map((h) => (
                      <tr key={`${h.organ}-${h.groupId}`} className={h.pAdj < 0.05 && h.groupId !== groups[0]!.id ? "flag" : ""}>
                        <td>{ORGAN_LABEL[h.organ]}</td><td>{h.groupId}</td><td className="num">{f1(h.dose, 1)}</td><td className="num">{h.n}</td><td className="num">{h.incidenceGrade1}</td><td className="num">{h.incidenceGrade2}</td><td className="num">{f1(h.meanGrade, 2)}</td>
                        <td>{GRADE_SEVERITY[h.maxGrade as 0 | 1 | 2 | 3 | 4 | 5]}: {FINDINGS[h.organ as Organ][h.maxGrade as 0 | 1 | 2 | 3 | 4 | 5]}</td>
                        <td className="num">{h.groupId === groups[0]!.id ? "" : pfmt(h.pAdj)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></ScrollBox>
                <p className="small muted">Incidence compared with control by Fisher's exact test on grade 2 or higher, Holm adjusted within each organ.</p>
              </Panel>
              <Panel title="Relative organ weights (% of body weight, mean ± SD)">
                <ScrollBox><table>
                  <thead><tr><th>Organ</th>{groups.map((g) => <th key={g.id} className="num">{g.id} · {f1(g.doseMgPerKg, 0)} mg/kg</th>)}</tr></thead>
                  <tbody>
                    {["liver", "kidney", "heart", "brain", "spleen"].map((o) => (
                      <tr key={o}><td>{o}</td>{groups.map((g) => { const v = wt(g.id, `organ.${o}.relative`); return <td key={g.id} className="num">{v.length ? `${mean(v).toFixed(3)} ± ${sd(v).toFixed(3)}` : "n/a"}</td>; })}</tr>
                    ))}
                  </tbody>
                </table></ScrollBox>
              </Panel>
              <p className="small muted">Organs shown: {ORGANS.map((o) => ORGAN_LABEL[o]).join(", ")}.</p>
            </>
          );
        }}
      </NeedsStudy>
    </>
  );
}
