import { Rng } from "./rng";
import { constant } from "./reference";
import { meanBodyWeightG } from "./physiology";
import type { AnimalResult } from "./study";
import { ORGANS, gradeFromDamage, FINDINGS, GRADE_SEVERITY, type Organ } from "./toxicodynamics";

/**
 * What a study team would record, derived from the simulated organ state, disease
 * state and PD output. All mappings from damage to measurements are ASSUMED
 * (SEMI-QUANTITATIVE). Reference ranges are placeholders until replaced with
 * vendor historical-control data.
 */

export const SIGNS = [
  "reducedIntake", "lethargy", "hunchedPosture", "ruffledFur", "chromodacryorrhoea", "jaundice", "tremor",
  "ataxia", "convulsions", "dyspnoea", "diarrhoea", "dehydration", "tumour", "cataract",
] as const;
export type Sign = (typeof SIGNS)[number];

const SICKNESS_WEIGHT: Record<Organ, number> = { liver: 0.7, kidney: 0.7, heart: 0.6, brain: 0.5, gut: 0.9, marrow: 0.5 };

export interface Observables {
  days: number;
  stepsPerDay: number;
  /** effective damage including diabetic nephropathy for the kidney, one value per day */
  damage: Record<Organ, Float64Array>;
  bodyWeightG: Float64Array;
  weightChangeFraction: Float64Array;
  foodG: Float64Array;
  waterMl: Float64Array;
  sickness: Float64Array;
  pain: Float64Array;
  /** Rat Grimace Scale style score, 0 to 2 */
  grimace: Float64Array;
  /** daily mean CNS effect (signed by cnsSign), 0 when the compound has none */
  cnsEffect: Float64Array;
  /** daily peak of the CNS effect, used for tremor and convulsions */
  cnsPeak: Float64Array;
  /** underlying intensity 0 to 1 */
  signIntensity: Record<Sign, Float64Array>;
  /** whether a cage-side observer would record the sign that day */
  signObserved: Record<Sign, Uint8Array>;
  tumorVolume: Float64Array;
  glucose: Float64Array;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function lagSeries(series: ArrayLike<number>, tauH: number, dtH: number, initial?: number): Float64Array {
  const out = new Float64Array(series.length);
  const a = 1 - Math.exp(-dtH / tauH);
  let v = initial ?? series[0] ?? 0;
  for (let i = 0; i < series.length; i++) { v += a * (series[i]! - v); out[i] = v; }
  return out;
}

export function deriveObservables(r: AnimalResult): Observables {
  const dt = r.config.dtH ?? 0.25;
  const spd = Math.round(24 / dt);
  const days = Math.floor(r.config.durationDays);
  const nSteps = r.timesH.length - 1;
  const rng = new Rng(r.config.seed).fork(`${r.config.animalId}/obs`);
  const idx = (d: number) => Math.min(nSteps, d * spd);

  const gBase = constant("rat.clinchem.glucose.mean");
  const gMax = constant("disease.diabetes.glucoseMax");
  const cachMax = constant("disease.tumor.cachexiaMaxLoss"), cachHalf = constant("disease.tumor.cachexiaHalfVolume");
  const hasCns = r.config.compound.pd?.some((p) => p.id === "cns-activation");
  const cnsSign = r.config.compound.cnsSign ?? 1;

  const dmg = {} as Record<Organ, Float64Array>;
  for (const o of ORGANS) {
    const a = new Float64Array(days + 1);
    for (let d = 0; d <= days; d++) {
      let D = r.damage[o]?.[idx(d)] ?? 0;
      if (o === "kidney") { const N = r.disease.nephropathy[idx(d)]!; D = 1 - (1 - D) * (1 - N); }
      a[d] = D;
    }
    dmg[o] = a;
  }

  const obs: Observables = {
    days, stepsPerDay: spd, damage: dmg,
    bodyWeightG: new Float64Array(days + 1), weightChangeFraction: new Float64Array(days + 1),
    foodG: new Float64Array(days + 1), waterMl: new Float64Array(days + 1),
    sickness: new Float64Array(days + 1), pain: new Float64Array(days + 1), grimace: new Float64Array(days + 1),
    cnsEffect: new Float64Array(days + 1), cnsPeak: new Float64Array(days + 1),
    signIntensity: {} as Record<Sign, Float64Array>, signObserved: {} as Record<Sign, Uint8Array>,
    tumorVolume: new Float64Array(days + 1), glucose: new Float64Array(days + 1),
  };
  for (const s of SIGNS) { obs.signIntensity[s] = new Float64Array(days + 1); obs.signObserved[s] = new Uint8Array(days + 1); }

  const bw0 = r.physiology.bwKg * 1000;
  const wAge0 = meanBodyWeightG(r.config.sex, r.config.strain, r.config.ageWeeks);
  let loss = 0;
  const gl = 1 - Math.exp(-1 / 3);
  const signRng = rng.fork("signs");
  const noise = rng.fork("noise");
  let painSmooth = 0;

  for (let d = 0; d <= days; d++) {
    const i = idx(d);
    const V = r.disease.tumorVolume[i]!;
    const G = r.disease.glucose[i]!;
    const sevG = clamp01((G - gBase) / (gMax - gBase));
    let cns = 0, cnsMax = 0;
    if (hasCns) {
      const series = r.pd["cns-activation"]!;
      const i1 = Math.min(nSteps, i + spd);
      let sum = 0;
      for (let k = i; k < i1; k++) { sum += series[k]!; if (series[k]! > cnsMax) cnsMax = series[k]!; }
      cns = (sum / Math.max(1, i1 - i)) * cnsSign;
    }
    obs.cnsEffect[d] = cns;
    obs.cnsPeak[d] = cnsMax * cnsSign;
    obs.tumorVolume[d] = V;
    obs.glucose[d] = G;

    // sickness and pain
    let surv = 1;
    for (const o of ORGANS) surv *= 1 - SICKNESS_WEIGHT[o] * dmg[o]![d]!;
    const tumourTerm = 0.6 * (V / (V + 1500));
    const diabTerm = 0.35 * sevG * sevG;
    const S = 1 - surv * (1 - tumourTerm) * (1 - diabTerm);
    const P = 1 - (1 - 0.8 * dmg.gut[d]!) * (1 - 0.4 * dmg.liver[d]!) * (1 - 0.5 * dmg.kidney[d]!) * (1 - 0.3 * (V / (V + 2500))) * (1 - 0.3 * dmg.heart[d]!);
    painSmooth += (P - painSmooth) * 0.6;
    obs.sickness[d] = S;
    obs.pain[d] = painSmooth;
    obs.grimace[d] = Math.min(2, Math.max(0, 2 * Math.pow(painSmooth, 0.8) + 0.08 * noise.normal()));

    // body weight: expected growth times a smoothed loss
    const growth = meanBodyWeightG(r.config.sex, r.config.strain, r.config.ageWeeks + d / 7) / wAge0;
    const cach = cachMax * (V / (V + cachHalf));
    const target = Math.min(0.5, 0.3 * S + cach + 0.2 * sevG);
    loss += (target - loss) * gl;
    obs.bodyWeightG[d] = bw0 * growth * (1 - loss);
    obs.weightChangeFraction[d] = obs.bodyWeightG[d]! / bw0 - 1;

    // intake
    const food = 0.065 * bw0 * Math.pow(growth, 0.3) * (1 - 0.8 * S) * (1 + 0.4 * sevG);
    obs.foodG[d] = food;
    obs.waterMl[d] = 1.5 * food * (1 + 3 * sevG) * (1 + 0.6 * dmg.kidney[d]!) * (1 - 0.4 * S);

    // signs, intensity 0 to 1
    const I = obs.signIntensity;
    const stress = clamp01(0.6 * S + 0.4 * obs.pain[d]!);
    const bili = dmg.liver[d]!;
    I.reducedIntake[d] = clamp01(0.8 * S);
    I.lethargy[d] = clamp01(S + 0.5 * Math.max(0, -cns));
    I.hunchedPosture[d] = clamp01(1.2 * obs.pain[d]!);
    I.ruffledFur[d] = clamp01(1.1 * S);
    I.chromodacryorrhoea[d] = clamp01(1.2 * stress - 0.1);
    I.jaundice[d] = clamp01((bili - 0.25) / 0.5);
    I.tremor[d] = clamp01(2 * (Math.max(0, obs.cnsPeak[d]!) - 0.25) + 1.2 * dmg.brain[d]!);
    I.ataxia[d] = clamp01(1.3 * dmg.brain[d]! + 0.5 * Math.max(0, -cns) + 0.5 * (r.disease.neuropathy[i] ?? 0));
    I.convulsions[d] = clamp01((Math.max(0, obs.cnsPeak[d]!) - 0.7) / 0.3);
    I.dyspnoea[d] = clamp01((dmg.heart[d]! - 0.3) / 0.5);
    I.diarrhoea[d] = clamp01(1.2 * dmg.gut[d]!);
    I.dehydration[d] = clamp01(0.8 * dmg.kidney[d]! + 0.5 * dmg.gut[d]! + 0.4 * sevG);
    I.tumour[d] = V > 150 ? 1 : 0;
    I.cataract[d] = clamp01(r.disease.cataract[i] ?? 0);
    for (const s of SIGNS) {
      const p = s === "tumour" ? (I[s][d]! > 0 ? 0.95 : 0) : Math.min(0.97, Math.pow(I[s][d]!, 1.2));
      obs.signObserved[s][d] = signRng.uniform() < p ? 1 : 0;
    }
  }
  return obs;
}

// ---------------------------------------------------------------- clinical pathology

export interface Analyte { value: number; unit: string; lln: number; uln: number; xUln: number; flag: "H" | "L" | "" }
export type Panel = Record<string, Analyte>;

const CHEM = ["alt", "ast", "alp", "ggt", "bilirubin", "albumin", "bun", "creatinine", "troponinI", "ck", "glucose", "cholesterol", "triglycerides", "sodium", "potassium", "chloride", "calcium", "phosphorus"] as const;
const HEME = ["rbc", "hemoglobin", "hematocrit", "wbc", "neutrophils", "lymphocytes", "platelets", "reticulocytes"] as const;

export interface ClinPathContext {
  result: AnimalResult;
  obs: Observables;
  lagN: Float64Array; lagP: Float64Array; lagR: Float64Array; lagSlow: Float64Array; marrow: Float64Array;
}

export function makeClinPathContext(result: AnimalResult, obs: Observables): ClinPathContext {
  const dt = result.config.dtH ?? 0.25;
  const m = result.damage.marrow ?? new Float64Array(result.timesH.length);
  return { result, obs, marrow: m, lagN: lagSeries(m, 24, dt), lagP: lagSeries(m, 72, dt), lagR: lagSeries(m, 336, dt), lagSlow: lagSeries(m, 168, dt) };
}

function limits(mean: number, cv: number) { return { lln: mean * (1 - 1.96 * cv), uln: mean * (1 + 1.96 * cv) }; }

/**
 * One blood sample taken on `day`. Each animal has a persistent offset per analyte
 * (biological) plus analytical noise that is deterministic for (animal, day).
 */
export function clinicalPathology(ctx: ClinPathContext, day: number): { chemistry: Panel; hematology: Panel } {
  const { result: r, obs } = ctx;
  const d = Math.min(obs.days, Math.max(0, Math.floor(day)));
  const i = Math.min(r.timesH.length - 1, d * obs.stepsPerDay);
  const D = (o: Organ) => obs.damage[o][d]!;
  const S = obs.sickness[d]!;
  const aCv = constant("rat.clinpath.analyticalCv");
  const base = new Rng(r.config.seed).fork(`${r.config.animalId}/clinpath-base`);
  const samp = new Rng(r.config.seed).fork(`${r.config.animalId}/clinpath-day-${d}`);
  const V = obs.tumorVolume[d]!;
  const tumourAnaemia = 0.3 * (V / (V + 1500));
  const sevG = clamp01((obs.glucose[d]! - constant("rat.clinchem.glucose.mean")) / (constant("disease.diabetes.glucoseMax") - constant("rat.clinchem.glucose.mean")));
  const conv = obs.signIntensity.convulsions[d]!;

  const effect: Record<string, number> = {
    alt: 1 + 40 * Math.pow(D("liver"), 1.3),
    ast: 1 + 25 * Math.pow(D("liver"), 1.2) + 12 * D("heart") + 4 * D("kidney") + 4 * conv,
    alp: 1 + 4 * Math.pow(D("liver"), 1.5) + 2 * D("gut"),
    ggt: 1 + 8 * D("liver"),
    bilirubin: 1 + 25 * D("liver") ** 2,
    albumin: 1 - 0.35 * D("liver") - 0.25 * S,
    bun: (1 + 4 * D("kidney")) * (1 + 0.5 * obs.signIntensity.dehydration[d]!) * (1 + 0.3 * S),
    creatinine: 1 + 6 * Math.pow(D("kidney"), 1.5),
    troponinI: 1 + 60 * Math.pow(D("heart"), 1.5),
    ck: 1 + 10 * D("heart") + 6 * conv + 3 * D("brain"),
    glucose: Math.max(0.5, obs.glucose[d]! / constant("rat.clinchem.glucose.mean") * (1 - 0.15 * S)),
    cholesterol: 1 + 0.6 * D("liver") + 0.8 * sevG,
    triglycerides: 1 + 0.5 * D("liver") + 2.0 * sevG - 0.3 * S,
    sodium: 1 - 0.04 * D("gut") - 0.03 * D("kidney"),
    potassium: 1 + 0.5 * D("kidney") + 0.3 * D("gut") * 0 + 0.2 * conv,
    chloride: 1 - 0.03 * D("gut"),
    calcium: 1 - 0.1 * D("kidney") - 0.05 * D("gut"),
    phosphorus: 1 + 0.6 * D("kidney"),
  };
  const chemistry: Panel = {};
  for (const k of CHEM) {
    const mean = constant(`rat.clinchem.${k}.mean`), cv = constant(`rat.clinchem.${k}.cv`);
    const offs = base.fork(k).lognormalFactor(cv * 0.9);
    const v = mean * offs * effect[k]! * samp.lognormalFactor(aCv);
    const { lln, uln } = limits(mean, cv);
    chemistry[k] = { value: v, unit: "", lln, uln, xUln: v / uln, flag: v > uln ? "H" : v < lln ? "L" : "" };
  }

  // haematology with lineage-specific lags behind marrow damage
  const Dn = ctx.lagN[i]!, Dp = ctx.lagP[i]!, Dr = ctx.lagR[i]!;
  const Dm = ctx.marrow[i]!;
  const rebound = 1 + 1.5 * Math.max(0, ctx.lagSlow[i]! - Dm);
  const hEffect: Record<string, number> = {
    neutrophils: Math.max(0.05, 1 - 0.9 * Dn) * (1 + 0.5 * S * (1 - Dn)),
    lymphocytes: Math.max(0.1, 1 - 0.5 * Dn - 0.3 * S),
    platelets: Math.max(0.1, 1 - 0.8 * Dp),
    rbc: Math.max(0.3, 1 - 0.5 * Dr - tumourAnaemia - 0.1 * S),
    hemoglobin: Math.max(0.3, 1 - 0.5 * Dr - tumourAnaemia - 0.1 * S),
    hematocrit: Math.max(0.3, 1 - 0.5 * Dr - tumourAnaemia - 0.1 * S),
    reticulocytes: Math.max(0.05, 1 - 0.8 * Dm) * rebound,
    wbc: 1,
  };
  const hematology: Panel = {};
  const vals: Record<string, number> = {};
  for (const k of HEME) {
    const mean = constant(`rat.hematology.${k}.mean`), cv = constant(`rat.hematology.${k}.cv`);
    const offs = base.fork(k).lognormalFactor(cv * 0.9);
    const own = k === "wbc" ? 1 : hEffect[k]!;
    vals[k] = mean * offs * own * samp.lognormalFactor(aCv);
  }
  vals.wbc = vals.neutrophils! + vals.lymphocytes! + 0.3 * constant("rat.hematology.wbc.mean") * 0.1;
  for (const k of HEME) {
    const mean = constant(`rat.hematology.${k}.mean`), cv = constant(`rat.hematology.${k}.cv`);
    const { lln, uln } = limits(mean, cv);
    const v = vals[k]!;
    hematology[k] = { value: v, unit: "", lln, uln, xUln: v / uln, flag: v > uln ? "H" : v < lln ? "L" : "" };
  }
  return { chemistry, hematology };
}

/** Hy's Law style check: ALT above 3x ULN with bilirubin above 2x ULN. Thresholds are UNVERIFIED in reference.json. */
export function hysLawCheck(chemistry: Panel): { met: boolean; altXuln: number; bilirubinXuln: number } {
  const a = chemistry.alt!.xUln, b = chemistry.bilirubin!.xUln;
  return { met: a > constant("safety.hysLaw.altXuln") && b > constant("safety.hysLaw.bilirubinXuln"), altXuln: a, bilirubinXuln: b };
}

export interface CardiacMarkers { heartRateBpm: number; qtcChangePercent: number; ejectionFractionPercent: number }
/** QT-like marker (ICH S7B/E14 concept, relative change only) and cardiac function. */
export function cardiacMarkers(obs: Observables, day: number): CardiacMarkers {
  const d = Math.min(obs.days, Math.max(0, Math.floor(day)));
  const Dh = obs.damage.heart[d]!;
  const S = obs.sickness[d]!;
  return {
    heartRateBpm: constant("rat.heartRate.rest") * (1 + 0.35 * Dh) * (1 - 0.15 * S),
    qtcChangePercent: 35 * Dh,
    ejectionFractionPercent: 75 * (1 - 0.6 * Dh),
  };
}

/** Urinary kidney injury marker as fold change over baseline (KIM-1 style). */
export function renalInjuryMarkers(obs: Observables, day: number): { kidneyInjuryMarkerFold: number } {
  const d = Math.min(obs.days, Math.max(0, Math.floor(day)));
  return { kidneyInjuryMarkerFold: 1 + 20 * Math.pow(obs.damage.kidney[d]!, 1.2) };
}

/** Neutrophil nadir and recovery from the noise-free lineage model. */
export function myelosuppression(ctx: ClinPathContext): { nadirFraction: number; nadirDay: number; recoveryDay: number | null } {
  const { obs } = ctx;
  let nadir = 1, nadirDay = 0;
  const frac = (d: number) => Math.max(0.05, 1 - 0.9 * ctx.lagN[Math.min(ctx.lagN.length - 1, d * obs.stepsPerDay)]!);
  for (let d = 0; d <= obs.days; d++) { const f = frac(d); if (f < nadir) { nadir = f; nadirDay = d; } }
  let rec: number | null = null;
  if (nadir < 0.8) for (let d = nadirDay; d <= obs.days; d++) if (frac(d) >= 0.8) { rec = d; break; }
  return { nadirFraction: nadir, nadirDay, recoveryDay: rec };
}

// ---------------------------------------------------------------- terminal necropsy

export interface OrganFinding { organ: Organ; grade: number; severity: string; finding: string }
export interface Necropsy {
  day: number;
  organWeights: Record<string, { absoluteG: number; relativePercentBw: number }>;
  histopathology: OrganFinding[];
}

const ORGAN_REL_WEIGHT: Record<string, number> = {
  liver: constant("rat.organVolume.liver"), kidney: constant("rat.organVolume.kidney"), heart: constant("rat.organVolume.heart"),
  brain: constant("rat.organVolume.brain"), spleen: constant("rat.organVolume.spleen"),
};

export function necropsy(r: AnimalResult, obs: Observables, day: number): Necropsy {
  const d = Math.min(obs.days, Math.max(0, Math.floor(day)));
  const rng = new Rng(r.config.seed).fork(`${r.config.animalId}/necropsy-${d}`);
  const bw = obs.bodyWeightG[d]!;
  const bw0 = obs.bodyWeightG[0]!;
  const D = (o: Organ) => obs.damage[o][d]!;
  const S = obs.sickness[d]!;
  const factor: Record<string, number> = {
    liver: 1 + 0.4 * Math.sin(Math.PI * Math.min(1, D("liver"))) - 0.3 * Math.max(0, D("liver") - 0.6),
    kidney: 1 + 0.3 * Math.sin(Math.PI * Math.min(1, D("kidney"))),
    heart: 1 - 0.3 * D("heart"),
    brain: 1,
    spleen: 1 - 0.5 * D("marrow") - 0.3 * S,
  };
  const organWeights: Necropsy["organWeights"] = {};
  for (const [k, f] of Object.entries(factor)) {
    // organs scale with the size the animal would have had, so wasting raises relative weight
    const abs = ORGAN_REL_WEIGHT[k]! * bw0 * (bw / bw0) ** 0.8 * f * rng.lognormalFactor(constant("rat.organVolume.cv"));
    organWeights[k] = { absoluteG: abs, relativePercentBw: (abs / bw) * 100 };
  }
  const histopathology: OrganFinding[] = [];
  for (const o of ORGANS) {
    if (!r.config.compound.td[o] && o !== "kidney") continue;
    const g = gradeFromDamage(D(o) * rng.lognormalFactor(0.1));
    histopathology.push({ organ: o, grade: g, severity: GRADE_SEVERITY[g], finding: FINDINGS[o][g] });
  }
  return { day: d, organWeights, histopathology };
}
