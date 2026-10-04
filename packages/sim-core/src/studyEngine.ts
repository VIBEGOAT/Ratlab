import { Rng } from "./rng";
import { simulateAnimal, type AnimalConfig, type PkSummary, type Route } from "./study";
import type { Compound } from "./compound";
import type { DiseaseConfig } from "./disease";
import type { Sex, Strain } from "./physiology";
import {
  clinicalPathology, deriveObservables, makeClinPathContext, necropsy, SIGNS, type OrganFinding, type Panel,
} from "./observables";
import { evaluateHumaneEndpoint, type HumaneEvent } from "./humane";
import { ORGANS } from "./toxicodynamics";

/**
 * A GLP-style repeated-dose study in the spirit of OECD TG 407 (28 day) and TG 408 (90 day):
 * vehicle control plus low, mid and high dose groups, optional recovery and toxicokinetic
 * satellites, both sexes, with litter effects and seeded inter-animal variability.
 */

export type GroupKind = "main" | "recovery" | "tk";

export interface GroupSpec {
  id: string;
  label: string;
  doseMgPerKg: number;
  kind: GroupKind;
  /** animals per sex; defaults to the design value (recovery) or 3 (tk) */
  nPerSex?: number;
}

export interface StudyDesign {
  compound: Compound;
  strain: Strain;
  ageWeeks: number;
  /** 7, 14, 28 or 90 are the usual choices */
  durationDays: number;
  recoveryDays: number;
  nPerSexPerGroup: number;
  sexes: Sex[];
  route: Route;
  intervalH: number;
  disease?: DiseaseConfig;
  groups: GroupSpec[];
  seed: number;
  /** animals per litter and litter-level variation */
  litterSize: number;
  litterCv: { bw: number; cyp: number };
  /** the model time step, hours */
  dtH?: number;
}

export function defaultDesign(compound: Compound, o: Partial<Omit<StudyDesign, "compound" | "groups">> & { highDoseMgPerKg?: number; recovery?: boolean; tk?: boolean; doseFractions?: number[] } = {}): StudyDesign {
  const high = o.highDoseMgPerKg ?? compound.defaultDoseMgPerKg;
  const frac = o.doseFractions ?? [0.1, 0.3, 1];
  const n = o.nPerSexPerGroup ?? 10;
  const groups: GroupSpec[] = [{ id: "G1", label: "Vehicle control", doseMgPerKg: 0, kind: "main" }];
  frac.forEach((f, i) => groups.push({ id: `G${i + 2}`, label: ["Low dose", "Mid dose", "High dose"][i] ?? `Dose ${i + 1}`, doseMgPerKg: high * f, kind: "main" }));
  if (o.recovery) {
    groups.push({ id: "R1", label: "Control recovery", doseMgPerKg: 0, kind: "recovery", nPerSex: Math.max(3, Math.ceil(n / 2)) });
    groups.push({ id: "R4", label: "High dose recovery", doseMgPerKg: high, kind: "recovery", nPerSex: Math.max(3, Math.ceil(n / 2)) });
  }
  if (o.tk) for (const g of groups.filter((x) => x.kind === "main" && x.doseMgPerKg > 0)) groups.push({ id: `T${g.id}`, label: `${g.label} TK satellite`, doseMgPerKg: g.doseMgPerKg, kind: "tk", nPerSex: 3 });
  return {
    compound, strain: o.strain ?? "SD", ageWeeks: o.ageWeeks ?? 8, durationDays: o.durationDays ?? 28, recoveryDays: o.recoveryDays ?? 14,
    nPerSexPerGroup: n, sexes: o.sexes ?? ["M", "F"], route: o.route ?? "oral", intervalH: o.intervalH ?? 24, disease: o.disease, groups,
    seed: o.seed ?? 1, litterSize: o.litterSize ?? 4, litterCv: o.litterCv ?? { bw: 0.04, cyp: 0.1 }, dtH: o.dtH,
  };
}

export interface AnimalRecord {
  id: string;
  group: string;
  kind: GroupKind;
  sex: Sex;
  litter: string;
  doseMgPerKg: number;
  scheduledDay: number;
  terminalDay: number;
  terminalReason: "scheduled" | "humane";
  humane: HumaneEvent | null;
  /** flat dictionary of terminal measurements used by the statistics */
  endpoints: Record<string, number>;
  chemistry: Panel;
  hematology: Panel;
  histopathology: OrganFinding[];
  pk: Pick<PkSummary, "cmax" | "aucAll" | "accumulationRatio" | "terminalHalfLifeH">;
  signDaysObserved: Record<string, number>;
  /** what is needed to rebuild this exact animal (see configForAnimal) */
  physiologyMods: { bw: number; cyp: number };
  circadianPhaseH: number;
}

export interface StudyResult {
  design: StudyDesign;
  animals: AnimalRecord[];
}

function flatten(prefix: string, panel: Panel, into: Record<string, number>): void {
  for (const [k, a] of Object.entries(panel)) into[`${prefix}.${k}`] = a.value;
}

export function simulateStudyAnimal(design: StudyDesign, g: GroupSpec, sex: Sex, idx: number, litter: string, mods: { bw: number; cyp: number }, phase: number): AnimalRecord {
  const scheduled = g.kind === "recovery" ? design.durationDays + design.recoveryDays : design.durationDays;
  const id = `${g.id}-${sex}${idx + 1}`;
  const cfg: AnimalConfig = {
    seed: design.seed, animalId: id, sex, strain: design.strain, ageWeeks: design.ageWeeks, compound: design.compound,
    durationDays: scheduled,
    regimen: { route: design.route, doseMgPerKg: g.doseMgPerKg, intervalH: design.intervalH, startH: 0, nDoses: design.route === "diet" ? design.durationDays : Math.floor((design.durationDays * 24) / design.intervalH) },
    disease: design.disease, physiologyMods: mods, circadianPhaseH: phase, dtH: design.dtH,
  };
  const r = simulateAnimal(cfg);
  const obs = deriveObservables(r);
  const humane = evaluateHumaneEndpoint(obs);
  const terminalDay = humane && humane.day < scheduled ? humane.day : scheduled;
  const ctx = makeClinPathContext(r, obs);
  const cp = clinicalPathology(ctx, terminalDay);
  const nec = necropsy(r, obs, terminalDay);

  const ep: Record<string, number> = {};
  ep.bodyWeightG = obs.bodyWeightG[terminalDay]!;
  ep.bodyWeightChangePct = (obs.bodyWeightG[terminalDay]! / obs.bodyWeightG[0]! - 1) * 100;
  const from = Math.max(0, terminalDay - 6);
  const avg = (a: Float64Array) => { let s = 0, n = 0; for (let d = from; d <= terminalDay; d++) { s += a[d]!; n++; } return s / n; };
  ep.foodGPerDay = avg(obs.foodG);
  ep.waterMlPerDay = avg(obs.waterMl);
  ep.sicknessIndex = obs.sickness[terminalDay]!;
  ep.grimaceScore = obs.grimace[terminalDay]!;
  flatten("chem", cp.chemistry, ep);
  flatten("heme", cp.hematology, ep);
  for (const [k, w] of Object.entries(nec.organWeights)) { ep[`organ.${k}.relative`] = w.relativePercentBw; ep[`organ.${k}.absolute`] = w.absoluteG; }
  for (const h of nec.histopathology) ep[`histo.${h.organ}.grade`] = h.grade;
  if (design.disease?.cancer) ep.tumorVolumeMm3 = obs.tumorVolume[terminalDay]!;
  if (design.disease?.diabetes) ep.glucoseMgDl = obs.glucose[terminalDay]!;

  const signs: Record<string, number> = {};
  for (const s of SIGNS) { let c = 0; for (let d = 0; d <= terminalDay; d++) c += obs.signObserved[s][d]!; signs[s] = c; }
  return {
    id, group: g.id, kind: g.kind, sex, litter, doseMgPerKg: g.doseMgPerKg, scheduledDay: scheduled, terminalDay,
    terminalReason: humane && humane.day < scheduled ? "humane" : "scheduled", humane, endpoints: ep,
    chemistry: cp.chemistry, hematology: cp.hematology, histopathology: nec.histopathology,
    pk: { cmax: r.pk.cmax, aucAll: r.pk.aucAll, accumulationRatio: r.pk.accumulationRatio, terminalHalfLifeH: r.pk.terminalHalfLifeH },
    signDaysObserved: signs, physiologyMods: mods, circadianPhaseH: phase,
  };
}

export function runStudy(design: StudyDesign, onProgress?: (done: number, total: number) => void): StudyResult {
  const rng = new Rng(design.seed).fork("study-allocation");
  const animals: AnimalRecord[] = [];
  const plan: Array<{ g: GroupSpec; sex: Sex; idx: number }> = [];
  for (const g of design.groups) {
    const n = g.nPerSex ?? design.nPerSexPerGroup;
    for (const sex of design.sexes) for (let i = 0; i < n; i++) plan.push({ g, sex, idx: i });
  }
  // litters: shuffle litter membership so littermates are spread across groups (randomised allocation)
  const litterOf = new Map<string, { litter: string; bw: number; cyp: number }>();
  const bySex = new Map<Sex, Array<{ g: GroupSpec; idx: number }>>();
  for (const p of plan) { const a = bySex.get(p.sex) ?? []; a.push({ g: p.g, idx: p.idx }); bySex.set(p.sex, a); }
  for (const [sex, list] of bySex) {
    const nLit = Math.ceil(list.length / design.litterSize);
    const slots = Array.from({ length: list.length }, (_, i) => i % nLit);
    for (let i = slots.length - 1; i > 0; i--) { const j = rng.int(0, i + 1); [slots[i], slots[j]] = [slots[j]!, slots[i]!]; }
    const lit = Array.from({ length: nLit }, (_, l) => { const r = rng.fork(`litter-${sex}-${l}`); return { litter: `${sex}L${l + 1}`, bw: r.lognormalFactor(design.litterCv.bw), cyp: r.lognormalFactor(design.litterCv.cyp) }; });
    list.forEach((p, i) => litterOf.set(`${p.g.id}-${sex}${p.idx + 1}`, lit[slots[i]!]!));
  }
  plan.forEach((p, i) => {
    const key = `${p.g.id}-${p.sex}${p.idx + 1}`;
    const l = litterOf.get(key)!;
    const phase = rng.fork(`phase-${key}`).normal() * 0.5;
    animals.push(simulateStudyAnimal(design, p.g, p.sex, p.idx, l.litter, { bw: l.bw, cyp: l.cyp }, phase));
    onProgress?.(i + 1, plan.length);
  });
  return { design, animals };
}

export const ORGANS_WITH_HISTOLOGY = ORGANS;

/** Rebuild the exact AnimalConfig used for a study animal, for example to inspect its time courses or its untreated twin. */
export function configForAnimal(design: StudyDesign, a: AnimalRecord): AnimalConfig {
  return {
    seed: design.seed, animalId: a.id, sex: a.sex, strain: design.strain, ageWeeks: design.ageWeeks, compound: design.compound,
    durationDays: a.scheduledDay,
    regimen: { route: design.route, doseMgPerKg: a.doseMgPerKg, intervalH: design.intervalH, startH: 0, nDoses: design.route === "diet" ? design.durationDays : Math.floor((design.durationDays * 24) / design.intervalH) },
    disease: design.disease, physiologyMods: a.physiologyMods, circadianPhaseH: a.circadianPhaseH, dtH: design.dtH,
  };
}
