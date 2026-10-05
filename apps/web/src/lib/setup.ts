import { ARCHETYPES, defaultDesign, validateCompound, type Compound, type DiseaseConfig, type Organ, type Route, type Sex, type Strain, type StudyDesign } from "@eliminate/sim-core";

export type DiseaseChoice = "none" | "cancer" | "diabetes-stz" | "diabetes-type2";

export interface Setup {
  compoundKey: string;
  custom: Compound;
  highDose: number;
  fractions: [number, number, number];
  durationDays: number;
  recoveryDays: number;
  nPerSex: number;
  sexes: Sex[];
  strain: Strain;
  ageWeeks: number;
  route: Route;
  recovery: boolean;
  tk: boolean;
  disease: DiseaseChoice;
  seed: number;
}

/** Friendly names for the fictional archetypes. The archetype letter stays available as a subtitle. */
export const COMPOUNDS: Array<{ key: string; name: string; sub: string }> = [
  { key: "hepatotoxin", name: "Liver-toxic", sub: "Damages the liver at high exposure" },
  { key: "nephrotoxin", name: "Kidney-toxic", sub: "Builds up in the kidney" },
  { key: "cardiotoxin", name: "Heart-toxic anticancer", sub: "Shrinks tumours, slowly harms the heart" },
  { key: "neurotoxin", name: "Nerve-toxic", sub: "Overstimulates the brain" },
  { key: "myelotoxin", name: "Marrow-toxic", sub: "Suppresses blood cell production" },
  { key: "reference", name: "Well tolerated", sub: "A safe reference compound" },
];

export const COMPOUND_LABELS: Record<string, string> = {
  ...Object.fromEntries(COMPOUNDS.map((c) => [c.key, c.name])),
  custom: "Custom compound",
};

export function compoundName(key: string): string {
  return COMPOUND_LABELS[key] ?? key;
}

export function newCustomCompound(): Compound {
  const base = ARCHETYPES.hepatotoxin!;
  return {
    ...base, id: "custom", name: "Custom compound", archetype: "custom",
    description: "Generic ADME and toxicity parameters set by the user. Fictional.",
    kp: { ...base.kp }, td: { liver: { ...base.td.liver! } }, defaultDoseMgPerKg: 50, tunedDoseRange: [1, 200],
  };
}

/**
 * Default scenario: the heart-toxic anticancer archetype in tumour-bearing rats. It shows efficacy and
 * toxicity together, and untreated tumours reach the humane limit, which the story needs to be honest.
 */
export function defaultSetup(): Setup {
  const c = ARCHETYPES.cardiotoxin!;
  return {
    compoundKey: "cardiotoxin", custom: newCustomCompound(), highDose: c.defaultDoseMgPerKg, fractions: [0.1, 0.3, 1],
    durationDays: 28, recoveryDays: 14, nPerSex: 10, sexes: ["M", "F"], strain: "SD", ageWeeks: 8, route: "oral", recovery: false, tk: false,
    disease: "cancer", seed: 42,
  };
}

export function compoundOf(s: Setup): Compound {
  return s.compoundKey === "custom" ? s.custom : ARCHETYPES[s.compoundKey]!;
}

export function diseaseOf(d: DiseaseChoice): DiseaseConfig | undefined {
  if (d === "cancer") return { cancer: {} };
  if (d === "diabetes-stz") return { diabetes: { kind: "stz", severity: 0.8 } };
  if (d === "diabetes-type2") return { diabetes: { kind: "type2", severity: 0.7 } };
  return undefined;
}

export function buildDesign(s: Setup): StudyDesign {
  const compound = compoundOf(s);
  const d = defaultDesign(compound, {
    strain: s.strain, ageWeeks: s.ageWeeks, durationDays: s.durationDays, recoveryDays: s.recoveryDays, nPerSexPerGroup: s.nPerSex, sexes: s.sexes,
    route: s.route, disease: diseaseOf(s.disease), seed: s.seed, highDoseMgPerKg: s.highDose, doseFractions: s.fractions, recovery: s.recovery, tk: s.tk,
  });
  return d;
}

export function designProblems(s: Setup): string[] {
  const p: string[] = [];
  const c = compoundOf(s);
  p.push(...validateCompound(c));
  if (s.sexes.length === 0) p.push("Select at least one sex.");
  if (s.nPerSex < 2) p.push("At least 2 animals per sex per group are needed for statistics.");
  if (!(s.highDose > 0)) p.push("High dose must be above zero.");
  if (!(s.fractions[0] < s.fractions[1] && s.fractions[1] < s.fractions[2])) p.push("Dose fractions must increase from low to high.");
  return p;
}

export interface Tg407Check { item: string; ok: boolean; note: string }

/** Compare the design with the OECD TG 407 minimums that are recorded (VERIFIED) in reference.json. */
export function guidelineChecks(s: Setup, constant: (k: string) => number): Tg407Check[] {
  const perGroup = s.nPerSex * s.sexes.length;
  return [
    { item: "Animals per dose group", ok: perGroup >= constant("study.tg407.minAnimalsPerGroup"), note: `${perGroup} per group, TG 407 asks for at least ${constant("study.tg407.minAnimalsPerGroup")} (5 per sex)` },
    { item: "Dose groups", ok: true, note: `3 dose groups plus a control, TG 407 asks for at least ${constant("study.tg407.minDoseGroups")}` },
    { item: "Duration", ok: [7, 14, 28, 90].includes(s.durationDays), note: `${s.durationDays} days (TG 407 is 28 days, TG 408 is 90 days)` },
    { item: "Both sexes", ok: s.sexes.length === 2, note: s.sexes.length === 2 ? "Males and females" : "One sex only" },
  ];
}

/**
 * The animal shown in the detail views. With recovery groups, pick the high-dose recovery animal so the
 * timeline covers dosing plus recovery. Otherwise the first male in the highest-dose main group.
 */
export function defaultFocusId(study: { design: { groups: Array<{ id: string; kind: string; doseMgPerKg: number }> }; animals: Array<{ id: string; group: string; sex: string }> }): string | null {
  const groups = study.design.groups;
  const top = (kind: string) => groups.filter((g) => g.kind === kind && g.doseMgPerKg > 0).sort((a, b) => b.doseMgPerKg - a.doseMgPerKg)[0];
  const g = top("recovery") ?? top("main") ?? groups[0];
  if (!g) return null;
  const inGroup = study.animals.filter((a) => a.group === g.id);
  return (inGroup.find((a) => a.sex === "M") ?? inGroup[0] ?? study.animals[0])?.id ?? null;
}

export function sameSetup(a: Setup, b: Setup | null): boolean {
  return !!b && JSON.stringify(a) === JSON.stringify(b);
}

export const ORGAN_LABEL: Record<Organ, string> = { liver: "Liver", kidney: "Kidneys", heart: "Heart", brain: "Brain", gut: "Gut", marrow: "Bone marrow" };
