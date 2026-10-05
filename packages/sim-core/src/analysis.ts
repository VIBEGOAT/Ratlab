import type { Sex } from "./physiology";
import type { AnimalRecord, StudyResult } from "./studyEngine";
import { dunnett, dunnVsControl, fisherExact, hedgesG, holm, linearTrend, mean, sd, skewness } from "./stats";
import { ORGANS, type Organ } from "./toxicodynamics";

/** Study analysis: group comparisons, incidence tables, NOAEL and LOAEL, MTD estimate. */

export type Method = "dunnett" | "kruskal-dunn";

export interface EndpointRow {
  endpoint: string;
  sex: Sex;
  groupId: string;
  dose: number;
  nTreated: number;
  nControl: number;
  meanTreated: number;
  sdTreated: number;
  meanControl: number;
  sdControl: number;
  pctChange: number;
  hedgesG: number;
  method: Method;
  pAdj: number;
  significant: boolean;
  trendP: number;
}

export interface AnalysisOptions {
  /** force a method; "auto" picks Kruskal-Wallis and Dunn when data are strongly skewed or very small */
  method?: "auto" | Method;
  alpha?: number;
}

function mainAnimals(s: StudyResult, sex: Sex): Map<string, AnimalRecord[]> {
  const m = new Map<string, AnimalRecord[]>();
  for (const g of s.design.groups) if (g.kind === "main") m.set(g.id, s.animals.filter((a) => a.group === g.id && a.sex === sex));
  return m;
}

export function analyseEndpoints(s: StudyResult, opts: AnalysisOptions = {}): EndpointRow[] {
  const alpha = opts.alpha ?? 0.05;
  const rows: EndpointRow[] = [];
  const mainGroups = s.design.groups.filter((g) => g.kind === "main").sort((a, b) => a.doseMgPerKg - b.doseMgPerKg);
  const control = mainGroups[0]!;
  const treated = mainGroups.slice(1);
  for (const sex of s.design.sexes) {
    const byGroup = mainAnimals(s, sex);
    const ctrl = byGroup.get(control.id) ?? [];
    if (ctrl.length < 2) continue;
    const endpoints = Object.keys(ctrl[0]!.endpoints);
    for (const ep of endpoints) {
      const cv = ctrl.map((a) => a.endpoints[ep]!).filter(Number.isFinite);
      const tv = treated.map((g) => (byGroup.get(g.id) ?? []).map((a) => a.endpoints[ep]!).filter(Number.isFinite));
      if (cv.length < 2 || tv.some((t) => t.length < 2)) continue;
      const all = [cv, ...tv];
      const constant = all.every((g) => g.every((v) => v === all[0]![0]));
      if (constant) continue;
      const method: Method = opts.method && opts.method !== "auto" ? opts.method : all.some((g) => g.length < 3 || Math.abs(skewness(g)) > 1.5) ? "kruskal-dunn" : "dunnett";
      let p: number[];
      if (method === "dunnett") p = dunnett(cv, tv).rows.map((r) => r.pAdj);
      else p = dunnVsControl(cv, tv).rows.map((r) => r.pAdj);
      const trend = linearTrend(all, [0, ...treated.map((_, i) => i + 1)]).p;
      treated.forEach((g, i) => {
        const mt = mean(tv[i]!), mc = mean(cv);
        rows.push({
          endpoint: ep, sex, groupId: g.id, dose: g.doseMgPerKg, nTreated: tv[i]!.length, nControl: cv.length,
          meanTreated: mt, sdTreated: sd(tv[i]!), meanControl: mc, sdControl: sd(cv),
          pctChange: mc !== 0 ? ((mt - mc) / Math.abs(mc)) * 100 : 0, hedgesG: hedgesG(tv[i]!, cv), method, pAdj: p[i]!, significant: p[i]! < alpha, trendP: trend,
        });
      });
    }
  }
  return rows;
}

export interface HistoRow { organ: Organ; sex: Sex; groupId: string; dose: number; n: number; incidenceGrade1: number; incidenceGrade2: number; meanGrade: number; maxGrade: number; pAdj: number }

/** Incidence of grade 2 or higher with Fisher's exact test against control, Holm adjusted within each organ and sex. */
export function histopathTable(s: StudyResult): HistoRow[] {
  const out: HistoRow[] = [];
  const mainGroups = s.design.groups.filter((g) => g.kind === "main").sort((a, b) => a.doseMgPerKg - b.doseMgPerKg);
  const control = mainGroups[0]!;
  for (const sex of s.design.sexes) {
    for (const organ of ORGANS) {
      const grades = (gid: string) => s.animals.filter((a) => a.group === gid && a.sex === sex).map((a) => a.histopathology.find((h) => h.organ === organ)?.grade ?? 0);
      const cg = grades(control.id);
      if (!cg.length) continue;
      const cInc = cg.filter((g) => g >= 2).length;
      const raw = mainGroups.slice(1).map((g) => { const t = grades(g.id); return fisherExact(t.filter((x) => x >= 2).length, t.length - t.filter((x) => x >= 2).length, cInc, cg.length - cInc); });
      const adj = holm(raw);
      mainGroups.forEach((g, gi) => {
        const t = grades(g.id);
        out.push({
          organ, sex, groupId: g.id, dose: g.doseMgPerKg, n: t.length,
          incidenceGrade1: t.filter((x) => x >= 1).length, incidenceGrade2: t.filter((x) => x >= 2).length,
          meanGrade: t.length ? mean(t) : 0, maxGrade: t.length ? Math.max(...t) : 0, pAdj: gi === 0 ? 1 : adj[gi - 1]!,
        });
      });
    }
  }
  return out;
}

/** Minimum change that is treated as biologically relevant, by endpoint family. Design values for the prototype, to be set by a toxicologist. */
export function relevanceThresholdPct(endpoint: string): number {
  if (endpoint === "bodyWeightG" || endpoint === "bodyWeightChangePct") return 10;
  if (endpoint.startsWith("organ.")) return 15;
  if (endpoint.startsWith("chem.") || endpoint.startsWith("heme.")) return 25;
  if (endpoint === "foodGPerDay" || endpoint === "waterMlPerDay") return 20;
  return 25;
}

/** Minimum Hedges g for a change to count as adverse. Design value. */
export const MIN_EFFECT_SIZE = 1.5;
/** Effect size at which a single-sex finding is accepted without corroboration. Design value. */
export const STRONG_EFFECT_SIZE = 3;

const EXCLUDED_FROM_ADVERSITY = new Set(["bodyWeightChangePct", "sicknessIndex", "grimaceScore", "tumorVolumeMm3", "glucoseMgDl"]);

/**
 * Endpoints where a rise against control is not a sign of harm. In a disease model the control group is
 * itself unwell, so a treated group that is heavier, eats more or has healthier blood counts is showing
 * benefit, not toxicity. Only falls in these endpoints can be adverse.
 */
const BENIGN_WHEN_HIGHER = new Set(["bodyWeightG", "foodGPerDay", "chem.albumin", "heme.rbc", "heme.hemoglobin", "heme.hematocrit", "heme.platelets", "heme.neutrophils", "heme.lymphocytes", "heme.wbc"]);

/** Absolute organ weights follow body weight, so adversity is judged on relative weights only. */
const isAbsoluteOrganWeight = (endpoint: string) => endpoint.startsWith("organ.") && endpoint.endsWith(".absolute");

export interface GroupFinding { groupId: string; dose: number; adverse: boolean; reasons: string[] }
export interface NoaelResult {
  loael: number | null;
  noael: number | null;
  /** true when no tested dose caused an adverse effect, so the NOAEL is the highest dose tested or higher */
  noaelIsAtLeast: boolean;
  groups: GroupFinding[];
  mtd: { doseMgPerKg: number | null; basis: string };
}

/**
 * NOAEL and LOAEL. A group is adverse if it has a statistically significant, dose-consistent
 * (trend p < 0.05), biologically relevant change in any endpoint, or a significant increase in
 * grade 2 or higher histopathology, or early humane endpoints in at least 10 percent of animals.
 */
export function determineNoael(s: StudyResult, rows = analyseEndpoints(s), histo = histopathTable(s)): NoaelResult {
  const mainGroups = s.design.groups.filter((g) => g.kind === "main").sort((a, b) => a.doseMgPerKg - b.doseMgPerKg);
  const treated = mainGroups.slice(1);
  const findings: GroupFinding[] = treated.map((g) => {
    const reasons: string[] = [];
    for (const r of rows) {
      if (r.groupId !== g.id || EXCLUDED_FROM_ADVERSITY.has(r.endpoint) || isAbsoluteOrganWeight(r.endpoint)) continue;
      if (r.pctChange > 0 && BENIGN_WHEN_HIGHER.has(r.endpoint)) continue;
      if (!(r.significant && r.trendP < 0.05 && Math.abs(r.pctChange) >= relevanceThresholdPct(r.endpoint) && Math.abs(r.hedgesG) >= MIN_EFFECT_SIZE)) continue;
      // dose-related: the change must not reverse sign at any higher dose
      const higher = rows.filter((x) => x.endpoint === r.endpoint && x.sex === r.sex && x.dose > r.dose);
      if (higher.some((x) => Math.sign(x.pctChange) !== Math.sign(r.pctChange))) continue;
      // corroboration: the same change in the other sex, or a very large effect. Isolated single-sex findings are treated as incidental.
      const other = rows.find((x) => x.endpoint === r.endpoint && x.groupId === r.groupId && x.sex !== r.sex);
      const corroborated = (other && other.significant && Math.sign(other.pctChange) === Math.sign(r.pctChange)) || Math.abs(r.hedgesG) >= STRONG_EFFECT_SIZE;
      if (!corroborated) continue;
      reasons.push(`${r.endpoint} (${r.sex}) ${r.pctChange >= 0 ? "+" : ""}${r.pctChange.toFixed(0)}%`);
    }
    for (const h of histo) if (h.groupId === g.id && h.pAdj < 0.05 && h.incidenceGrade2 > 0) reasons.push(`histopathology ${h.organ} (${h.sex}) grade 2+ in ${h.incidenceGrade2}/${h.n}`);
    const animals = s.animals.filter((a) => a.group === g.id);
    const humane = animals.filter((a) => a.terminalReason === "humane").length;
    if (animals.length && humane / animals.length >= 0.1) reasons.push(`humane endpoints in ${humane}/${animals.length}`);
    return { groupId: g.id, dose: g.doseMgPerKg, adverse: reasons.length > 0, reasons };
  });
  const firstAdverse = findings.findIndex((f) => f.adverse);
  const loael = firstAdverse >= 0 ? findings[firstAdverse]!.dose : null;
  const noael = firstAdverse < 0 ? treated.at(-1)?.doseMgPerKg ?? 0 : firstAdverse === 0 ? null : findings[firstAdverse - 1]!.dose;

  // MTD: highest dose with at most 10% humane endpoints and no more than 10% body weight reduction versus control
  const ctrlBw = mean(s.animals.filter((a) => a.group === mainGroups[0]!.id).map((a) => a.endpoints.bodyWeightG!));
  let mtd: number | null = null;
  for (const g of treated) {
    const an = s.animals.filter((a) => a.group === g.id);
    const humane = an.filter((a) => a.terminalReason === "humane").length / Math.max(1, an.length);
    const bwDrop = 1 - mean(an.map((a) => a.endpoints.bodyWeightG!)) / ctrlBw;
    if (humane <= 0.1 && bwDrop <= 0.1) mtd = g.doseMgPerKg;
  }
  return {
    loael, noael, noaelIsAtLeast: firstAdverse < 0, groups: findings,
    mtd: { doseMgPerKg: mtd, basis: "highest tested dose with at most 10% humane endpoints and at most 10% body weight reduction versus control" },
  };
}
