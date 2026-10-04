import { Rng } from "./rng";
import { expm, matVec } from "./linalg";
import { Rk45 } from "./ode";
import type { Compound } from "./compound";
import { buildPhysiology, TISSUES, type Physiology, type PhysiologyMods, type Sex, type Strain, type Tissue } from "./physiology";
import {
  buildRateMatrix, IDX, N_PK, plasmaConc, reactiveMetaboliteDensity, tissueConc, totalMass,
  type ClearanceFactors,
} from "./pbpk";
import { ORGANS, TD_STATES_PER_ORGAN, tdDeriv, tdInit, type Organ } from "./toxicodynamics";
import { makePd, type PdInstance } from "./pd";
import { DISEASE_SERIES, kidneySensitivity, makeDisease, type DiseaseConfig, type DiseaseReading } from "./disease";

export type Route = "oral" | "iv" | "diet";

export interface Regimen {
  route: Route;
  /** mg per kg per administration (per day for diet) */
  doseMgPerKg: number;
  /** hours between administrations (oral, iv). Ignored for diet. */
  intervalH: number;
  startH: number;
  /** number of administrations (oral, iv) or number of days (diet) */
  nDoses: number;
}

export interface DdiEffect {
  kind: "inhibition" | "induction";
  /** multiplier applied to hepatic clearance while active (below 1 for inhibition, above 1 for induction) */
  factor: number;
  fromH: number;
  toH: number;
}

export interface AnimalConfig {
  seed: number;
  animalId: string;
  sex: Sex;
  strain: Strain;
  ageWeeks: number;
  compound: Compound;
  regimen: Regimen;
  durationDays: number;
  /** time step, hours. Doses are applied on this grid. */
  dtH?: number;
  ddi?: DdiEffect[];
  disease?: DiseaseConfig;
  /** shared multipliers such as a litter effect */
  physiologyMods?: PhysiologyMods;
  /** individual circadian phase offset in hours (positive is later) */
  circadianPhaseH?: number;
  /** let liver and kidney damage reduce clearance (default true) */
  organFeedback?: boolean;
  /** run the toxicodynamics (default true). Turn off for pure PK. */
  toxicodynamics?: boolean;
}

export interface PkSummary {
  cmax: number;
  tmaxH: number;
  /** AUC over the whole observation, mg*h/L (trapezoid) */
  aucAll: number;
  /** AUC over the first and the last dosing interval (repeat-dose only) */
  aucTauFirst: number | null;
  aucTauLast: number | null;
  accumulationRatio: number | null;
  /** terminal half-life from the post-last-dose decline, h; null when not estimable */
  terminalHalfLifeH: number | null;
  organCmax: Record<Tissue, number>;
  organAuc: Record<Tissue, number>;
}

export interface AnimalResult {
  config: AnimalConfig;
  physiology: Physiology;
  timesH: Float64Array;
  plasma: Float64Array;
  tissue: Record<Tissue, Float64Array>;
  damage: Partial<Record<Organ, Float64Array>>;
  defence: Partial<Record<Organ, Float64Array>>;
  /** PD outputs by spec id */
  pd: Record<string, Float64Array>;
  clearanceFactorHepatic: Float64Array;
  /** disease series (tumor volume, glucose, complications ...), one value per time step */
  disease: Record<keyof DiseaseReading, Float64Array>;
  pk: PkSummary;
  doseTotalMg: number;
  /** |dose - sum of all compartments| / dose; should be ~1e-12 */
  massBalanceRelError: number;
}

import { EMPTY_READING } from "./disease";
const EMPTY_FALLBACK: DiseaseReading = EMPTY_READING;
const FEED_DARK_FRACTION = 0.8;

function dietWeight(hourOfDay: number): number {
  // lights off 12:00 to 24:00 (ZT12 to ZT24); rats eat mostly in the dark
  return hourOfDay >= 12 ? FEED_DARK_FRACTION / 12 : (1 - FEED_DARK_FRACTION) / 12;
}

function trapz(t: Float64Array, y: Float64Array, i0: number, i1: number): number {
  let s = 0;
  for (let i = i0; i < i1; i++) s += 0.5 * (y[i]! + y[i + 1]!) * (t[i + 1]! - t[i]!);
  return s;
}

function terminalHalfLife(t: Float64Array, c: Float64Array, fromIdx: number): number | null {
  // log-linear regression over the last stretch of decline
  const pts: Array<[number, number]> = [];
  for (let i = fromIdx; i < t.length; i++) if (c[i]! > 0) pts.push([t[i]!, Math.log(c[i]!)]);
  if (pts.length < 6) return null;
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
  const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return slope < 0 ? Math.log(2) / -slope : null;
}

export function simulateAnimal(cfg: AnimalConfig): AnimalResult {
  const dt = cfg.dtH ?? 0.25;
  const c = cfg.compound;
  const rng = new Rng(cfg.seed).fork(cfg.animalId);
  const phys = buildPhysiology({ sex: cfg.sex, strain: cfg.strain, ageWeeks: cfg.ageWeeks, rng: rng.fork("physiology"), mods: cfg.physiologyMods });
  const nSteps = Math.round((cfg.durationDays * 24) / dt);
  const useTd = cfg.toxicodynamics !== false;
  const feedback = cfg.organFeedback !== false;

  // ---- dosing schedule on the time grid
  const doseAt = new Float64Array(nSteps + 1); // mg per step
  const reg = cfg.regimen;
  let doseTotal = 0;
  const doseTimesH: number[] = [];
  if (reg.route === "diet") {
    for (let d = 0; d < reg.nDoses; d++) {
      for (let k = 0; k < Math.round(24 / dt); k++) {
        const stepIdx = Math.round((reg.startH + d * 24) / dt) + k;
        if (stepIdx > nSteps) continue;
        const hod = (k * dt) % 24;
        const mg = reg.doseMgPerKg * phys.bwKg * dietWeight(hod) * dt;
        doseAt[stepIdx] = doseAt[stepIdx]! + mg;
        doseTotal += mg;
      }
    }
  } else {
    for (let d = 0; d < reg.nDoses; d++) {
      const tH = reg.startH + d * reg.intervalH;
      const idx = Math.round(tH / dt);
      if (idx > nSteps) continue;
      const mg = reg.doseMgPerKg * phys.bwKg;
      doseAt[idx] = doseAt[idx]! + mg;
      doseTotal += mg;
      doseTimesH.push(idx * dt);
    }
  }

  // ---- clearance factor schedule (DDI and organ feedback), propagator cache
  const cache = new Map<string, Float64Array>();
  const propagator = (f: ClearanceFactors): Float64Array => {
    const key = `${f.hepatic.toFixed(3)}|${f.renal.toFixed(3)}`;
    let m = cache.get(key);
    if (!m) {
      m = expm(buildRateMatrix(phys, c, f), N_PK, dt);
      cache.set(key, m);
    }
    return m;
  };
  const quant = (v: number) => Math.max(0.05, Math.round(v * 50) / 50);
  const ddiFactor = (tH: number): number => {
    let f = 1;
    for (const e of cfg.ddi ?? []) if (tH >= e.fromH && tH < e.toH) f *= e.factor;
    return f;
  };

  // ---- toxicodynamics + PD state vector
  const organs = ORGANS.filter((o) => c.td[o]);
  const pdSpecs = c.pd ?? [];
  const pdInst: PdInstance[] = pdSpecs.map(makePd);
  const disease = makeDisease(cfg.disease, c.efficacy, rng);
  const nTd = organs.length * TD_STATES_PER_ORGAN;
  const nPd = pdInst.reduce((a, p) => a + p.nStates, 0);
  const nDis = disease?.nStates ?? 0;
  const z = new Float64Array(nTd + nPd + nDis);
  organs.forEach((_, i) => tdInit(z, i * TD_STATES_PER_ORGAN));
  let off = nTd;
  const pdOff = pdInst.map((p) => { const o = off; p.init(z, o); off += p.nStates; return o; });
  const disOff = nTd + nPd;
  disease?.init(z, disOff);
  const solver = new Rk45(z.length);

  const driverState = { tdE0: new Float64Array(organs.length), tdE1: new Float64Array(organs.length), pdC0: new Float64Array(pdInst.length), pdC1: new Float64Array(pdInst.length), pl0: 0, pl1: 0 };
  let t0 = 0;
  const deriv = (t: number, y: Float64Array, dy: Float64Array) => {
    const s = (t - t0) / dt;
    const nephro = disease ? disease.read(y, disOff).nephropathy : 0;
    const ks = kidneySensitivity(nephro);
    for (let i = 0; i < organs.length; i++) {
      const E = driverState.tdE0[i]! + (driverState.tdE1[i]! - driverState.tdE0[i]!) * s;
      const isKidney = organs[i] === "kidney";
      tdDeriv(c.td[organs[i]!]!, E, y, i * TD_STATES_PER_ORGAN, dy, isKidney ? ks.thrScale : 1, isKidney ? ks.kinjScale : 1);
    }
    if (disease) disease.deriv(t, y, disOff, dy, driverState.pl0 + (driverState.pl1 - driverState.pl0) * s);
    for (let j = 0; j < pdInst.length; j++) {
      const drive = driverState.pdC0[j]! + (driverState.pdC1[j]! - driverState.pdC0[j]!) * s;
      pdInst[j]!.deriv(y, pdOff[j]!, dy, drive);
    }
  };

  const driverOf = (x: Float64Array, organ: Organ, f: ClearanceFactors): number => {
    const td = c.td[organ]!;
    if (td.driver === "reactive") return reactiveMetaboliteDensity(x, phys, c, f);
    const tissue: Tissue = organ === "marrow" ? "marrow" : organ;
    return tissueConc(x, phys, tissue) * c.fuTissue;
  };
  const pdDriverOf = (x: Float64Array, spec: (typeof pdSpecs)[number]): number =>
    spec.driver === "plasma" ? plasmaConc(x, phys, c) : tissueConc(x, phys, spec.driver);

  // ---- outputs
  const timesH = new Float64Array(nSteps + 1);
  const plasma = new Float64Array(nSteps + 1);
  const tissue = {} as Record<Tissue, Float64Array>;
  for (const t of TISSUES) tissue[t] = new Float64Array(nSteps + 1);
  const damage: Partial<Record<Organ, Float64Array>> = {};
  const defence: Partial<Record<Organ, Float64Array>> = {};
  for (const o of organs) { damage[o] = new Float64Array(nSteps + 1); defence[o] = new Float64Array(nSteps + 1); }
  const pdOut: Record<string, Float64Array> = {};
  for (const sp of pdSpecs) pdOut[sp.id] = new Float64Array(nSteps + 1);
  const clFactorOut = new Float64Array(nSteps + 1);
  const disOut = {} as Record<keyof DiseaseReading, Float64Array>;
  for (const k of DISEASE_SERIES) disOut[k] = new Float64Array(nSteps + 1);

  const x = new Float64Array(N_PK);
  const xn = new Float64Array(N_PK);
  let factors: ClearanceFactors = { hepatic: 1, renal: 1 };

  const record = (k: number) => {
    timesH[k] = k * dt;
    plasma[k] = plasmaConc(x, phys, c);
    for (const t of TISSUES) tissue[t][k] = tissueConc(x, phys, t);
    organs.forEach((o, i) => { damage[o]![k] = z[i * TD_STATES_PER_ORGAN]!; defence[o]![k] = z[i * TD_STATES_PER_ORGAN + 1]!; });
    pdSpecs.forEach((sp, j) => {
      const drive = pdDriverOf(x, sp);
      pdOut[sp.id]![k] = pdInst[j]!.effect(z, pdOff[j]!, drive);
    });
    clFactorOut[k] = factors.hepatic;
    const reading: DiseaseReading = disease ? disease.read(z, disOff) : EMPTY_FALLBACK;
    for (const key of DISEASE_SERIES) disOut[key][k] = reading[key];
  };

  for (let k = 0; k <= nSteps; k++) {
    const tH = k * dt;
    // clearance factors from DDI and organ function feedback
    const hepD = feedback && organs.includes("liver") ? z[organs.indexOf("liver") * TD_STATES_PER_ORGAN]! : 0;
    const kidD = feedback && organs.includes("kidney") ? z[organs.indexOf("kidney") * TD_STATES_PER_ORGAN]! : 0;
    factors = { hepatic: quant(ddiFactor(tH) * (1 - 0.8 * hepD)), renal: quant(1 - 0.8 * kidD) };

    // dose
    const mg = doseAt[k]!;
    if (mg > 0) x[reg.route === "iv" ? IDX.ven : IDX.gutLumen] = x[reg.route === "iv" ? IDX.ven : IDX.gutLumen]! + mg;
    record(k);
    if (k === nSteps) break;

    // PK propagation (exact for linear system)
    matVec(propagator(factors), x, N_PK, xn);

    // TD and PD integration over the step, with drivers interpolated between start and end
    if (organs.length + pdInst.length + nDis > 0 && useTd) {
      driverState.pl0 = plasmaConc(x, phys, c); driverState.pl1 = plasmaConc(xn, phys, c);
      organs.forEach((o, i) => { driverState.tdE0[i] = driverOf(x, o, factors); driverState.tdE1[i] = driverOf(xn, o, factors); });
      pdSpecs.forEach((sp, j) => { driverState.pdC0[j] = pdDriverOf(x, sp); driverState.pdC1[j] = pdDriverOf(xn, sp); });
      t0 = tH;
      solver.integrate(deriv, z, tH, tH + dt, { rtol: 1e-6, atol: 1e-10, hInit: dt / 4 });
      for (let i = 0; i < organs.length; i++) {
        const b = i * TD_STATES_PER_ORGAN;
        z[b] = Math.min(1, Math.max(0, z[b]!));
        z[b + 1] = Math.min(1, Math.max(0, z[b + 1]!));
        z[b + 2] = Math.max(0, z[b + 2]!);
      }
    }
    x.set(xn);
  }

  // ---- PK summary
  let cmax = 0, imax = 0;
  for (let i = 0; i <= nSteps; i++) if (plasma[i]! > cmax) { cmax = plasma[i]!; imax = i; }
  const organCmax = {} as Record<Tissue, number>;
  const organAuc = {} as Record<Tissue, number>;
  for (const t of TISSUES) {
    let m = 0;
    for (let i = 0; i <= nSteps; i++) if (tissue[t][i]! > m) m = tissue[t][i]!;
    organCmax[t] = m;
    organAuc[t] = trapz(timesH, tissue[t], 0, nSteps);
  }
  let aucTauFirst: number | null = null, aucTauLast: number | null = null, acc: number | null = null, thalf: number | null = null;
  if (reg.route !== "diet" && doseTimesH.length > 0) {
    const iFirst = Math.round(doseTimesH[0]! / dt);
    const tau = reg.intervalH;
    const iTau = Math.min(nSteps, iFirst + Math.round(tau / dt));
    aucTauFirst = trapz(timesH, plasma, iFirst, iTau);
    if (doseTimesH.length > 1) {
      const iLast = Math.round(doseTimesH[doseTimesH.length - 1]! / dt);
      const iEnd = Math.min(nSteps, iLast + Math.round(tau / dt));
      if (iEnd - iLast >= Math.round(tau / dt)) {
        aucTauLast = trapz(timesH, plasma, iLast, iEnd);
        acc = aucTauFirst > 0 ? aucTauLast / aucTauFirst : null;
      }
    }
    const iLastDose = Math.round(doseTimesH[doseTimesH.length - 1]! / dt);
    // terminal phase: from the later of 2h after Cmax or 2h after the last dose, to the end of observation
    const iPeakAfterLast = (() => { let b = iLastDose, m = -1; for (let i = iLastDose; i <= nSteps; i++) if (plasma[i]! > m) { m = plasma[i]!; b = i; } return b; })();
    const fromIdx = Math.min(nSteps, iPeakAfterLast + Math.round(2 / dt));
    if (nSteps - fromIdx >= Math.round(6 / dt)) thalf = terminalHalfLife(timesH, plasma, fromIdx);
  }

  const massBalanceRelError = doseTotal > 0 ? Math.abs(doseTotal - totalMass(x)) / doseTotal : 0;

  return {
    config: cfg, physiology: phys, timesH, plasma, tissue, damage, defence, pd: pdOut, disease: disOut,
    clearanceFactorHepatic: clFactorOut,
    pk: { cmax, tmaxH: timesH[imax]!, aucAll: trapz(timesH, plasma, 0, nSteps), aucTauFirst, aucTauLast, accumulationRatio: acc, terminalHalfLifeH: thalf, organCmax, organAuc },
    doseTotalMg: doseTotal,
    massBalanceRelError,
  };
}

/** Peak damage per organ over the study. */
export function peakDamage(r: AnimalResult): Partial<Record<Organ, number>> {
  const out: Partial<Record<Organ, number>> = {};
  for (const o of ORGANS) {
    const d = r.damage[o];
    if (d) out[o] = d.reduce((m, v) => (v > m ? v : m), 0);
  }
  return out;
}
