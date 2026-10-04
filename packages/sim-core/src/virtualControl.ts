import { Rng } from "./rng";
import type { Sex } from "./physiology";
import type { HistoricalRow } from "./validation";

/**
 * Virtual control groups: use matched historical control data to reduce or replace part of the
 * concurrent control group (concept of Steger-Hartmann et al. 2020, ALTEX 37:343-349). The
 * historical data must match the study in strain, sex, age and conditions. This module provides
 * the mechanics; it is only meaningful with real historical control data.
 */

export interface MatchCriteria { strain: string; sex: Sex; ageWeeks?: number; ageToleranceWeeks?: number }

export function matchHistorical(rows: readonly HistoricalRow[], m: MatchCriteria): HistoricalRow[] {
  const tol = m.ageToleranceWeeks ?? 2;
  return rows.filter((r) => r.strain === m.strain && r.sex === m.sex && (m.ageWeeks === undefined || r.ageWeeks === undefined || Math.abs(r.ageWeeks - m.ageWeeks) <= tol));
}

/** Draw virtual control animals by sampling each endpoint independently from the matched historical distribution. */
export function sampleVirtualControls(rows: readonly HistoricalRow[], n: number, seed: number): Array<Record<string, number>> {
  const rng = new Rng(seed).fork("virtual-control");
  const out: Array<Record<string, number>> = [];
  for (let i = 0; i < n; i++) {
    const rec: Record<string, number> = {};
    for (const r of rows) rec[r.endpoint] = Math.max(0, r.mean + r.sd * rng.normal());
    out.push(rec);
  }
  return out;
}

export interface EligibilityCheck { endpoint: string; concurrentMean: number; historicalMean: number; historicalSd: number; z: number; consistent: boolean }
export interface Eligibility { checks: EligibilityCheck[]; fractionConsistent: number; eligible: boolean; message: string }

/**
 * A concurrent control group supports using virtual controls when its means sit within two historical
 * SDs of the matched historical means for at least 90 percent of endpoints. Thresholds are design values.
 */
export function virtualControlEligibility(concurrent: ReadonlyMap<string, readonly number[]>, matched: readonly HistoricalRow[]): Eligibility {
  const checks: EligibilityCheck[] = [];
  for (const h of matched) {
    const v = concurrent.get(h.endpoint);
    if (!v || v.length === 0) continue;
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    const z = h.sd > 0 ? (m - h.mean) / h.sd : 0;
    checks.push({ endpoint: h.endpoint, concurrentMean: m, historicalMean: h.mean, historicalSd: h.sd, z, consistent: Math.abs(z) <= 2 });
  }
  const frac = checks.length ? checks.filter((c) => c.consistent).length / checks.length : 0;
  const eligible = checks.length > 0 && frac >= 0.9;
  return {
    checks, fractionConsistent: frac, eligible,
    message: checks.length === 0 ? "No matched historical data. Virtual controls cannot be justified." : eligible ? "Concurrent control is consistent with matched historical data." : "Concurrent control differs from matched historical data. Keep concurrent controls.",
  };
}

export interface AnimalsSparedInput {
  studiesPerYear: number;
  /** treated groups per study, not counting the control */
  treatedGroups: number;
  animalsPerGroup: number;
  /** share of candidate studies removed by virtual screening before any animal is used, 0 to 1 */
  screenedOutShare: number;
  /** share of each remaining study's concurrent control animals replaced by virtual controls, 0 to 1 */
  virtualControlShare: number;
}

export interface AnimalsSparedResult { baselineAnimals: number; withTool: number; spared: number; sparedShare: number }

export function animalsSpared(i: AnimalsSparedInput): AnimalsSparedResult {
  const perStudy = (i.treatedGroups + 1) * i.animalsPerGroup;
  const baseline = i.studiesPerYear * perStudy;
  const remaining = i.studiesPerYear * (1 - i.screenedOutShare);
  const perStudyAfter = i.treatedGroups * i.animalsPerGroup + i.animalsPerGroup * (1 - i.virtualControlShare);
  const withTool = remaining * perStudyAfter;
  return { baselineAnimals: baseline, withTool, spared: baseline - withTool, sparedShare: baseline > 0 ? (baseline - withTool) / baseline : 0 };
}
