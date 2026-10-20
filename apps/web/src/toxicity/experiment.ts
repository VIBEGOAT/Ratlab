import { ARCHETYPES, GRADE_SEVERITY, ORGANS, gradeFromDamage, type AnimalBundle, type AnimalConfig, type Organ, type Route, type Sex } from "@eliminate/sim-core";
export interface Experiment { compound: string; dose: number; days: number; recovery: number; route: Route; sex: Sex; seed: number }
export const DEFAULT_EXPERIMENT: Experiment = { compound: "hepatotoxin", dose: 150, days: 28, recovery: 0, route: "oral", sex: "M", seed: 42 };
export const PROFILE_NAMES: Record<string, string> = { hepatotoxin: "Liver injury", nephrotoxin: "Kidney injury", cardiotoxin: "Cardiac injury", neurotoxin: "Neurotoxicity", myelotoxin: "Marrow & gut injury", reference: "Low-injury reference" };
export function experimentProblems(e: Experiment): string[] {
  const errors: string[] = [];
  if (!ARCHETYPES[e.compound]) errors.push("Choose an available compound profile.");
  if (!Number.isFinite(e.dose) || e.dose <= 0 || e.dose > 2000) errors.push("Dose must be above 0 and at most 2,000 mg/kg per day.");
  if (![7, 14, 28, 90].includes(e.days)) errors.push("Select a supported dosing duration.");
  if (![0, 7, 14].includes(e.recovery)) errors.push("Select a supported recovery period.");
  if (!["oral", "iv"].includes(e.route)) errors.push("Select oral or intravenous dosing.");
  if (!["M", "F"].includes(e.sex)) errors.push("Select a sex.");
  if (!Number.isInteger(e.seed) || e.seed < 0 || e.seed > 2147483647) errors.push("Seed must be an integer between 0 and 2147483647.");
  return errors;
}
export function animalConfig(e: Experiment, dose = e.dose): AnimalConfig {
  const errors = experimentProblems({ ...e, dose });
  if (errors.length) throw new Error(errors.join(" "));
  return { seed: e.seed, animalId: "VAST-01", sex: e.sex, strain: "SD", ageWeeks: 8, compound: ARCHETYPES[e.compound]!, durationDays: e.days + e.recovery, dtH: 0.25, regimen: { route: e.route, doseMgPerKg: dose, intervalH: 24, startH: 0, nDoses: e.days } };
}
export function organResponse(e: Experiment, b: AnimalBundle, organ: Organ, day: number) {
  // Absence of a toxicodynamic mechanism is not evidence of no toxicity.
  const modeled = !!ARCHETYPES[e.compound]?.td[organ];
  const d = Math.min(b.days, Math.max(0, Math.round(day)));
  const damage = modeled ? b.daily.damage[organ][d] ?? 0 : null;
  const grade = damage === null ? null : gradeFromDamage(damage);
  const first = modeled ? b.daily.damage[organ].findIndex((v) => gradeFromDamage(v) >= 2) : -1;
  return { modeled, damage, grade, severity: grade === null ? "Not modeled" : grade === 0 ? "No modeled injury" : GRADE_SEVERITY[grade], firstMildDay: first < 0 ? null : first };
}
export function responseRows(e: Experiment, b: AnimalBundle, day: number) {
  return ORGANS.map((organ) => ({ organ, ...organResponse(e, b, organ, day) }));
}
