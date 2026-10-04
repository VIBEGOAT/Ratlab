import { simulateAnimal, type AnimalConfig } from "./study";
import { deriveObservables } from "./observables";
import { evaluateHumaneEndpoint } from "./humane";
import { ORGANS, gradeFromDamage, type Organ } from "./toxicodynamics";
import { chi2Sf, normalCdf } from "./specialfns";
import { wilson } from "./stats";
import type { Sex } from "./physiology";

/**
 * Monte Carlo toxicity forecast over N virtual rats, with Kaplan-Meier survival where the
 * "event" is reaching a humane endpoint (a live animal would have been euthanised).
 */

export interface KmStep { t: number; atRisk: number; events: number; survival: number; low: number; high: number }

/** Kaplan-Meier estimate with Greenwood standard error (linear confidence band, clamped to [0, 1]). */
export function kaplanMeier(times: readonly number[], event: readonly boolean[]): KmStep[] {
  const order = times.map((t, i) => [t, event[i]!] as const).sort((a, b) => a[0] - b[0]);
  const steps: KmStep[] = [{ t: 0, atRisk: order.length, events: 0, survival: 1, low: 1, high: 1 }];
  let atRisk = order.length, S = 1, gw = 0;
  for (let i = 0; i < order.length;) {
    const t = order[i]![0];
    let d = 0, c = 0;
    while (i < order.length && order[i]![0] === t) { if (order[i]![1]) d++; else c++; i++; }
    if (d > 0) {
      S *= 1 - d / atRisk;
      gw += atRisk > d ? d / (atRisk * (atRisk - d)) : 0;
      const se = S * Math.sqrt(gw);
      steps.push({ t, atRisk, events: d, survival: S, low: Math.max(0, S - 1.96 * se), high: Math.min(1, S + 1.96 * se) });
    }
    atRisk -= d + c;
  }
  return steps;
}

/** Two-group log-rank test. */
export function logRank(t1: readonly number[], e1: readonly boolean[], t2: readonly number[], e2: readonly boolean[]): { chi2: number; p: number } {
  const times = [...new Set([...t1.filter((_, i) => e1[i]), ...t2.filter((_, i) => e2[i])])].sort((a, b) => a - b);
  let O1 = 0, E1 = 0, V = 0;
  for (const t of times) {
    const n1 = t1.filter((x) => x >= t).length, n2 = t2.filter((x) => x >= t).length;
    const d1 = t1.filter((x, i) => x === t && e1[i]).length, d2 = t2.filter((x, i) => x === t && e2[i]).length;
    const n = n1 + n2, d = d1 + d2;
    if (n < 2) continue;
    O1 += d1; E1 += (d * n1) / n; V += (d * (n1 / n) * (1 - n1 / n) * (n - d)) / (n - 1);
  }
  const chi2 = V > 0 ? (O1 - E1) ** 2 / V : 0;
  return { chi2, p: chi2Sf(chi2, 1) };
}

export interface ForecastOptions {
  nAnimals: number;
  sex?: Sex;
  /** minimum grade counted as toxicity, default 3 (moderate) */
  gradeThreshold?: number;
  /** seed offset so forecasts at different doses share animals (common random numbers) */
  seed?: number;
}

export interface ForecastResult {
  doseMgPerKg: number;
  n: number;
  gradeThreshold: number;
  organ: Record<Organ, { p: number; low: number; high: number }>;
  humane: { p: number; low: number; high: number };
  humaneDays: number[];
  survival: KmStep[];
  survivalAtEnd: number;
}

/** Forecast toxicity for one dose. Each virtual rat has its own physiology and sensitivity. */
export function forecastToxicity(base: AnimalConfig, o: ForecastOptions): ForecastResult {
  const thr = o.gradeThreshold ?? 3;
  const counts: Record<Organ, number> = { liver: 0, kidney: 0, heart: 0, brain: 0, gut: 0, marrow: 0 };
  const times: number[] = [], events: boolean[] = [];
  const humaneDays: number[] = [];
  for (let i = 0; i < o.nAnimals; i++) {
    const cfg: AnimalConfig = { ...base, animalId: `mc${i}`, seed: (o.seed ?? base.seed) + 0, sex: o.sex ?? (i % 2 === 0 ? "M" : "F") };
    const r = simulateAnimal(cfg);
    for (const org of ORGANS) {
      const d = r.damage[org];
      if (d && gradeFromDamage(d.reduce((m, v) => (v > m ? v : m), 0)) >= thr) counts[org]++;
    }
    const h = evaluateHumaneEndpoint(deriveObservables(r));
    if (h) { times.push(h.day); events.push(true); humaneDays.push(h.day); } else { times.push(base.durationDays); events.push(false); }
  }
  const organ = {} as ForecastResult["organ"];
  for (const org of ORGANS) { const w = wilson(counts[org], o.nAnimals); organ[org] = { p: w.p, low: w.low, high: w.high }; }
  const hw = wilson(humaneDays.length, o.nAnimals);
  const km = kaplanMeier(times, events);
  return {
    doseMgPerKg: base.regimen.doseMgPerKg, n: o.nAnimals, gradeThreshold: thr, organ,
    humane: { p: hw.p, low: hw.low, high: hw.high }, humaneDays, survival: km, survivalAtEnd: km.at(-1)!.survival,
  };
}

/** Wilson-based two-sided test of a proportion against a reference, used to compare forecasts to targets. */
export function proportionZ(k: number, n: number, p0: number): { z: number; p: number } {
  const z = (k / n - p0) / Math.sqrt((p0 * (1 - p0)) / n);
  return { z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}
