import { DISCLAIMER, FIDELITY, SIM_VERSION, type StudyResult } from "@eliminate/sim-core";
import type { StudyPayload } from "../worker/protocol";
import { toCsv } from "./csv";

/** Raw animal-level data, one row per animal and endpoint column, with seed and version in each row. */
export function studyToCsv(s: StudyResult): string {
  const keys = new Set<string>();
  for (const a of s.animals) for (const k of Object.keys(a.endpoints)) keys.add(k);
  const cols = [...keys].sort();
  return toCsv(s.animals.map((a) => {
    const row: Record<string, string | number | null> = {
      simVersion: SIM_VERSION, seed: s.design.seed, compound: s.design.compound.name, animal: a.id, group: a.group, groupKind: a.kind, sex: a.sex,
      dose_mg_per_kg: a.doseMgPerKg, litter: a.litter, terminalDay: a.terminalDay, terminalReason: a.terminalReason, humaneReason: a.humane?.reason ?? "",
    };
    for (const c of cols) row[c] = a.endpoints[c] ?? null;
    return row;
  }));
}

export function studyToJson(p: StudyPayload): string {
  return JSON.stringify({ simVersion: SIM_VERSION, disclaimer: DISCLAIMER, seed: p.study.design.seed, fidelity: FIDELITY, design: { ...p.study.design, compound: p.study.design.compound }, animals: p.study.animals, statistics: p.rows, histopathology: p.histo, noael: p.noael }, null, 2);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A self-contained HTML study report. Use the browser print dialog to save it as PDF. */
export function studyToHtml(p: StudyPayload): string {
  const d = p.study.design;
  const f = (x: number, n = 2) => (Number.isFinite(x) ? x.toFixed(n) : "n/a");
  const sig = p.rows.filter((r) => r.significant && Math.abs(r.pctChange) >= 15).sort((a, b) => a.pAdj - b.pAdj).slice(0, 40);
  const groups = d.groups.map((g) => `<tr><td>${esc(g.id)}</td><td>${esc(g.label)}</td><td>${g.kind}</td><td>${f(g.doseMgPerKg, 1)}</td><td>${g.nPerSex ?? d.nPerSexPerGroup}</td></tr>`).join("");
  const humane = p.study.animals.filter((a) => a.humane && a.terminalReason === "humane").map((a) => `<li>${esc(a.id)}: ${esc(a.humane!.banner)}</li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ELIMINATE-Lab study report</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#14201f}h1,h2{font-family:Georgia,serif}table{border-collapse:collapse;width:100%;margin:8px 0 20px}th,td{border:1px solid #ccd;padding:4px 8px;text-align:left;font-size:13px}th{background:#eef3f3}.note{border:1px solid #b45309;padding:8px 12px;border-radius:6px;background:#fff8ee}.chip{font:11px monospace;border:1px solid #888;border-radius:3px;padding:1px 5px}</style></head><body>
<h1>Virtual repeated-dose rat study</h1>
<p class="note"><b>${esc(DISCLAIMER)}</b> Compounds are fictional archetypes and most parameters are unverified placeholders. Results are simulated, not measured.</p>
<p>Simulator version <code>${esc(SIM_VERSION)}</code>, seed <code>${d.seed}</code>. Compound: ${esc(d.compound.name)}. Strain ${d.strain}, ${d.ageWeeks} weeks old, ${d.durationDays} day dosing, route ${d.route}.</p>
<h2>Design</h2><table><tr><th>Group</th><th>Label</th><th>Type</th><th>Dose mg/kg</th><th>n per sex</th></tr>${groups}</table>
<h2>Dose levels</h2><table><tr><th>NOAEL</th><th>LOAEL</th><th>MTD estimate</th></tr><tr><td>${p.noael.noael === null ? "below lowest dose" : (p.noael.noaelIsAtLeast ? "at least " : "") + f(p.noael.noael, 1)} mg/kg</td><td>${p.noael.loael === null ? "not reached" : f(p.noael.loael, 1) + " mg/kg"}</td><td>${p.noael.mtd.doseMgPerKg === null ? "n/a" : f(p.noael.mtd.doseMgPerKg, 1) + " mg/kg"}</td></tr></table>
<p class="note">NOAEL and LOAEL come from a rule-based call with design thresholds that a toxicologist must set. ${esc(p.noael.mtd.basis)}.</p>
<h2>Humane endpoints</h2>${humane ? `<ul>${humane}</ul>` : "<p>None reached.</p>"}
<h2>Largest group differences (adjusted p, change of at least 15%)</h2><table><tr><th>Endpoint</th><th>Sex</th><th>Group</th><th>Change %</th><th>Hedges g</th><th>Adj. p</th><th>Method</th></tr>${sig.map((r) => `<tr><td>${esc(r.endpoint)}</td><td>${r.sex}</td><td>${r.groupId}</td><td>${f(r.pctChange, 0)}</td><td>${f(r.hedgesG)}</td><td>${r.pAdj < 0.001 ? "<0.001" : f(r.pAdj, 3)}</td><td>${r.method}</td></tr>`).join("")}</table>
<h2>Model fidelity</h2><table><tr><th>Subsystem</th><th>Label</th><th>Why</th></tr>${FIDELITY.map((x) => `<tr><td>${esc(x.name)}</td><td><span class="chip">${x.label}</span></td><td>${esc(x.justification)}</td></tr>`).join("")}</table>
</body></html>`;
}

export function download(name: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
