import type { Regimen } from "./study";

/**
 * PK summaries per dosing interval. The whole-study Cmax and Tmax in PkSummary describe
 * the single highest point of the study, which for repeated dosing is usually near the
 * end. Toxicologists report exposure after the first dose and at steady state, with Tmax
 * measured from the dose that produced the peak.
 */

export interface IntervalPk {
  /** dose number, 1-based */
  dose: number;
  doseTimeH: number;
  cmax: number;
  /** hours after this dose */
  tmaxH: number;
  /** AUC over the dosing interval, mg*h/L */
  aucTau: number;
  /** concentration at the end of the interval, just before the next dose */
  trough: number;
}

export interface IntervalPkSummary {
  tauH: number;
  nDoses: number;
  first: IntervalPk;
  /** last complete dosing interval, or null when only one dose was given */
  last: IntervalPk | null;
  /** AUCtau of the last interval divided by that of the first, or null */
  accumulationRatio: number | null;
  /** plain-English reading of the accumulation ratio */
  accumulationNote: string;
}

/** Dose times on the simulation grid, as the study loop applies them. */
export function doseTimesOf(reg: Regimen, dtH: number, durationH: number): number[] {
  if (reg.route === "diet") return [];
  const out: number[] = [];
  for (let d = 0; d < reg.nDoses; d++) {
    const t = Math.round((reg.startH + d * reg.intervalH) / dtH) * dtH;
    if (t <= durationH + 1e-9) out.push(t);
  }
  return out;
}

function interval(timesH: ArrayLike<number>, c: ArrayLike<number>, from: number, to: number, dose: number): IntervalPk {
  let cmax = -Infinity, tmax = from, auc = 0, last = 0, started = false, prevT = 0, prevC = 0;
  for (let i = 0; i < timesH.length; i++) {
    const t = timesH[i]!;
    if (t < from - 1e-9) continue;
    if (t > to + 1e-9) break;
    const v = c[i]!;
    if (v > cmax) { cmax = v; tmax = t; }
    if (started) auc += 0.5 * (v + prevC) * (t - prevT);
    started = true; prevT = t; prevC = v; last = v;
  }
  return { dose, doseTimeH: from, cmax: Math.max(0, cmax), tmaxH: tmax - from, aucTau: auc, trough: last };
}

export function intervalPk(timesH: ArrayLike<number>, plasma: ArrayLike<number>, doseTimesH: readonly number[], tauH: number): IntervalPkSummary | null {
  if (doseTimesH.length === 0 || timesH.length < 2) return null;
  const end = timesH[timesH.length - 1]!;
  const first = interval(timesH, plasma, doseTimesH[0]!, Math.min(end, doseTimesH[0]! + tauH), 1);
  let last: IntervalPk | null = null;
  if (doseTimesH.length > 1) {
    const t0 = doseTimesH[doseTimesH.length - 1]!;
    if (t0 + tauH <= end + 1e-9) last = interval(timesH, plasma, t0, t0 + tauH, doseTimesH.length);
  }
  const ratio = last && first.aucTau > 0 ? last.aucTau / first.aucTau : null;
  const note = ratio === null
    ? "Needs at least two complete dosing intervals."
    : ratio < 1.1
      ? `${ratio.toFixed(2)} means little or no accumulation: the drug is mostly cleared before the next dose.`
      : `${ratio.toFixed(2)} means exposure at steady state is ${ratio.toFixed(1)} times the first dose, because drug remains when the next dose arrives.`;
  return { tauH, nDoses: doseTimesH.length, first, last, accumulationRatio: ratio, accumulationNote: note };
}
