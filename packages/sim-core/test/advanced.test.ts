import { describe, it, expect } from "vitest";
import {
  ARCHETYPES, assessCredibility, CONTEXT_PRESETS, REQUIRED_DATASETS, animalsSpared, controlEndpointValues, defaultDesign, forecastToxicity,
  humanEquivalentDose, kaplanMeier, logRank, matchHistorical, maxRecommendedStartingDose, modelRisk, morris, morrisCompound,
  projectedHumanExposure, safetyMargin, sampleVirtualControls, simulatedHistoricalDataset, therapeuticIndex, validateControls,
  virtualControlEligibility, runVirtualControls, type AnimalConfig, type HistoricalRow,
} from "../src";

describe("Kaplan-Meier and log-rank", () => {
  it("matches a hand-computed curve with a censored observation", () => {
    const km = kaplanMeier([1, 2, 3, 4], [true, false, true, true]);
    const at = (t: number) => [...km].reverse().find((s) => s.t <= t)!.survival;
    expect(at(1)).toBeCloseTo(0.75, 12);
    expect(at(2)).toBeCloseTo(0.75, 12);
    expect(at(3)).toBeCloseTo(0.375, 12);
    expect(at(4)).toBeCloseTo(0, 12);
  });
  it("keeps survival monotone and the band inside [0, 1]", () => {
    const km = kaplanMeier([5, 3, 8, 12, 12, 20, 30], [true, true, false, true, true, false, false]);
    for (let i = 1; i < km.length; i++) expect(km[i]!.survival).toBeLessThanOrEqual(km[i - 1]!.survival);
    for (const s of km) { expect(s.low).toBeGreaterThanOrEqual(0); expect(s.high).toBeLessThanOrEqual(1); }
  });
  it("log-rank matches the hand-computed chi-square", () => {
    const r = logRank([1, 2, 3], [true, true, true], [4, 5, 6], [true, true, true]);
    expect(r.chi2).toBeCloseTo(5.0517, 3);
    expect(r.p).toBeCloseTo(0.0246, 3);
  });
  it("log-rank sees no difference between identical groups", () => {
    const r = logRank([2, 4, 6, 8], [true, true, true, true], [2, 4, 6, 8], [true, true, true, true]);
    expect(r.chi2).toBeCloseTo(0, 10);
    expect(r.p).toBeGreaterThan(0.99);
  });
});

describe("Monte Carlo toxicity forecast", () => {
  const base = (dose: number): AnimalConfig => ({
    seed: 77, animalId: "x", sex: "M", strain: "SD", ageWeeks: 8, compound: ARCHETYPES.hepatotoxin!, durationDays: 14,
    regimen: { route: "oral", doseMgPerKg: dose, intervalH: 24, startH: 0, nDoses: 14 },
  });
  const lo = forecastToxicity(base(15), { nAnimals: 30 }), mid = forecastToxicity(base(150), { nAnimals: 30 }), hi = forecastToxicity(base(300), { nAnimals: 30 });

  it("increases the probability of moderate liver injury with dose, with sensible intervals", () => {
    expect(lo.organ.liver.p).toBe(0);
    expect(hi.organ.liver.p).toBeGreaterThanOrEqual(mid.organ.liver.p);
    expect(hi.organ.liver.p).toBeGreaterThan(0.3);
    for (const f of [lo, mid, hi]) {
      expect(f.organ.liver.low).toBeLessThanOrEqual(f.organ.liver.p);
      expect(f.organ.liver.high).toBeGreaterThanOrEqual(f.organ.liver.p);
    }
  });
  it("reports other organs as unaffected for a liver-specific compound", () => {
    expect(hi.organ.heart.p).toBe(0);
    expect(hi.organ.brain.p).toBe(0);
  });
  it("ties the survival curve to the humane-endpoint count", () => {
    expect(lo.survivalAtEnd).toBe(1);
    expect(hi.survivalAtEnd).toBeCloseTo(1 - hi.humaneDays.length / hi.n, 12);
  });
});

describe("Morris screening", () => {
  it("recovers the coefficients of a linear model and flags interaction through sigma", () => {
    const lin = morris((x) => 3 * x[0]! + x[1]!, 3, 10, 1);
    expect(lin[0]!.muStar).toBeCloseTo(3, 9);
    expect(lin[1]!.muStar).toBeCloseTo(1, 9);
    expect(lin[2]!.muStar).toBeCloseTo(0, 9);
    expect(lin[0]!.sigma).toBeCloseTo(0, 9);
    const inter = morris((x) => x[0]! * x[1]!, 2, 30, 2);
    expect(inter[0]!.sigma).toBeGreaterThan(0.05);
  });
  it("ranks liver toxicity parameters above an irrelevant renal parameter", () => {
    const cfg: AnimalConfig = {
      seed: 5, animalId: "m", sex: "M", strain: "SD", ageWeeks: 8, compound: ARCHETYPES.hepatotoxin!, durationDays: 7,
      regimen: { route: "oral", doseMgPerKg: 150, intervalH: 24, startH: 0, nDoses: 7 },
    };
    const res = morrisCompound(cfg, { kind: "peakDamage", organ: "liver" }, "liver", 6, 3, ["td.thr", "fReactive", "clRenalLPerHPerKg"]);
    const get = (n: string) => res.find((r) => r.name === n)!.muStar;
    expect(get("td.thr")).toBeGreaterThan(get("clRenalLPerHPerKg"));
    expect(get("fReactive")).toBeGreaterThan(get("clRenalLPerHPerKg"));
  });
});

describe("human translation (illustrative)", () => {
  it("converts a rat dose with the Km ratio", () => {
    expect(humanEquivalentDose(37)).toBeCloseTo(6, 10);
    const m = maxRecommendedStartingDose(100);
    expect(m.hedMgPerKg).toBeCloseTo((100 * 6) / 37, 10);
    expect(m.mrsdMgPerKg).toBeCloseTo(m.hedMgPerKg / 10, 10);
    expect(m.mrsdMgFor60Kg).toBeCloseTo(m.mrsdMgPerKg * 60, 10);
  });
  it("scales clearance with body weight to the power 0.75 and computes margins", () => {
    const p = projectedHumanExposure(0.1, 0.25, 60);
    expect(p.clearanceLPerH).toBeCloseTo(0.1 * Math.pow(240, 0.75), 8);
    expect(safetyMargin(50, 10)).toBe(5);
    expect(therapeuticIndex(60, 10)).toBe(6);
    expect(therapeuticIndex(60, 0)).toBe(Infinity);
  });
});

describe("validation harness", () => {
  const design = defaultDesign(ARCHETYPES.reference!, { nPerSexPerGroup: 10, durationDays: 28 });
  const hist = simulatedHistoricalDataset(design, 5, 10, 500);
  const sim = controlEndpointValues(runVirtualControls(design, 10, 99));

  it("reports NO_DATA when nothing is loaded", () => {
    const r = validateControls(sim, []);
    expect(r.status).toBe("NO_DATA");
    expect(r.message).toMatch(/not been validated/);
  });
  it("passes a new virtual control cohort against simulated demo data, and says what that means", () => {
    const r = validateControls(sim, hist);
    expect(r.usesSimulatedDemoData).toBe(true);
    expect(r.passRate).toBeGreaterThan(0.85);
    expect(["PASS", "PARTIAL"]).toContain(r.status);
    expect(r.message).toMatch(/SIMULATED/);
  });
  it("fails when body weight disagrees with the historical data", () => {
    const shifted: HistoricalRow[] = hist.map((h) => (h.endpoint === "bodyWeightG" ? { ...h, mean: h.mean * 1.5 } : h));
    const r = validateControls(sim, shifted);
    expect(r.status).toBe("FAIL");
    expect(r.checks.find((c) => c.endpoint === "bodyWeightG" && !c.pass)).toBeDefined();
  });
  it("lists the datasets that still need to be sourced, all not loaded", () => {
    expect(REQUIRED_DATASETS.length).toBeGreaterThanOrEqual(5);
    expect(REQUIRED_DATASETS.every((d) => d.status === "NOT LOADED")).toBe(true);
  });
});

describe("credibility (V&V 40 structure)", () => {
  it("maps influence and consequence to model risk", () => {
    expect(modelRisk("low", "low")).toBe("low");
    expect(modelRisk("medium", "medium")).toBe("medium");
    expect(modelRisk("high", "high")).toBe("high");
    expect(modelRisk("high", "low")).toBe("medium");
  });
  it("accepts the tool for teaching but not for screening, design or replacement", () => {
    expect(assessCredibility(CONTEXT_PRESETS.education!).adequate).toBe(true);
    for (const k of ["screening", "designAid", "replacement"]) expect(assessCredibility(CONTEXT_PRESETS[k]!).adequate).toBe(false);
  });
  it("names the largest gaps and counts unverified inputs", () => {
    const r = assessCredibility(CONTEXT_PRESETS.replacement!);
    expect(r.summary).toMatch(/Not yet credible/);
    expect(r.factors.find((f) => f.id === "val-inputs")!.evidence.join(" ")).toMatch(/UNVERIFIED/);
    expect(r.factors.every((f) => f.required === 3)).toBe(true);
  });
});

describe("virtual control groups", () => {
  const design = defaultDesign(ARCHETYPES.reference!, { nPerSexPerGroup: 10 });
  const hist = simulatedHistoricalDataset(design, 4, 10, 800);

  it("matches historical rows by strain, sex and age", () => {
    expect(matchHistorical(hist, { strain: "SD", sex: "M", ageWeeks: 8 }).every((r) => r.sex === "M" && r.strain === "SD")).toBe(true);
    expect(matchHistorical(hist, { strain: "WI", sex: "M" }).length).toBe(0);
    expect(matchHistorical(hist, { strain: "SD", sex: "M", ageWeeks: 30 }).length).toBe(0);
  });
  it("samples non-negative, reproducible virtual controls with the historical mean", () => {
    const rows = matchHistorical(hist, { strain: "SD", sex: "M", ageWeeks: 8 });
    const a = sampleVirtualControls(rows, 400, 3), b = sampleVirtualControls(rows, 400, 3);
    expect(a).toEqual(b);
    const bw = rows.find((r) => r.endpoint === "bodyWeightG")!;
    const m = a.reduce((s, x) => s + x.bodyWeightG!, 0) / a.length;
    expect(Math.abs(m - bw.mean)).toBeLessThan(0.3 * bw.sd + 1);
    for (const x of a) for (const v of Object.values(x)) expect(v).toBeGreaterThanOrEqual(0);
  });
  it("supports virtual controls only when the concurrent control is consistent", () => {
    const rows = matchHistorical(hist, { strain: "SD", sex: "M", ageWeeks: 8 });
    const concurrent = new Map<string, number[]>();
    for (const [k, v] of controlEndpointValues(runVirtualControls(design, 10, 4242))) if (k.startsWith("M|")) concurrent.set(k.slice(2), v);
    expect(virtualControlEligibility(concurrent, rows).eligible).toBe(true);
    const shifted = new Map([...concurrent].map(([k, v]) => [k, v.map((x) => x * 1.6)] as [string, number[]]));
    expect(virtualControlEligibility(shifted, rows).eligible).toBe(false);
    expect(virtualControlEligibility(new Map(), []).eligible).toBe(false);
  });
  it("computes animals spared from editable assumptions", () => {
    const r = animalsSpared({ studiesPerYear: 10, treatedGroups: 3, animalsPerGroup: 10, screenedOutShare: 0.4, virtualControlShare: 0.5 });
    expect(r.baselineAnimals).toBe(400);
    expect(r.withTool).toBeCloseTo(210, 8);
    expect(r.spared).toBeCloseTo(190, 8);
    expect(r.sparedShare).toBeCloseTo(0.475, 8);
    expect(animalsSpared({ studiesPerYear: 10, treatedGroups: 3, animalsPerGroup: 10, screenedOutShare: 0, virtualControlShare: 0 }).spared).toBeCloseTo(0, 10);
  });
});
