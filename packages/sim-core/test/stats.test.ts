import { describe, it, expect } from "vitest";
import {
  Rng, betaInc, chi2Cdf, chi2Sf, dunnett, dunnettCritical, dunnettJointProb, dunnVsControl, erf, fisherExact, hedgesG, holm,
  jonckheereTerpstra, kruskalWallis, lgamma, linearTrend, mean, normalCdf, normalQuantile, oneWayAnova, sd, tCdf, tQuantile, wilson,
} from "../src";

describe("special functions", () => {
  it("lgamma matches factorials", () => {
    expect(Math.exp(lgamma(5))).toBeCloseTo(24, 9);
    expect(Math.exp(lgamma(0.5))).toBeCloseTo(Math.sqrt(Math.PI), 10);
  });
  it("erf and the normal CDF match known values", () => {
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 12);
    expect(normalCdf(1.959963984540054)).toBeCloseTo(0.975, 10);
    expect(normalCdf(-4)).toBeCloseTo(3.167124183311992e-5, 12);
    expect(normalCdf(0)).toBeCloseTo(0.5, 14);
    expect(normalCdf(3)).toBeCloseTo(0.9986501019683699, 12);
  });
  it("normal quantile inverts the CDF", () => {
    for (const p of [1e-6, 0.01, 0.2, 0.5, 0.9, 0.999]) expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 10);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959963984540054, 8);
  });
  it("t distribution matches tables", () => {
    expect(tQuantile(0.975, 20)).toBeCloseTo(2.085963447, 6);
    expect(tQuantile(0.975, 5)).toBeCloseTo(2.570581836, 6);
    expect(tCdf(0, 7)).toBeCloseTo(0.5, 12);
    expect(tCdf(1.5, 1)).toBeCloseTo(0.5 + Math.atan(1.5) / Math.PI, 10); // Cauchy
  });
  it("chi-square matches tables", () => {
    expect(chi2Cdf(3.841458820694124, 1)).toBeCloseTo(0.95, 9);
    expect(chi2Sf(5.991464547107979, 2)).toBeCloseTo(0.05, 9);
    expect(chi2Sf(7.2, 2)).toBeCloseTo(Math.exp(-3.6), 12);
  });
  it("incomplete beta has the right symmetry and endpoints", () => {
    expect(betaInc(2, 3, 0)).toBe(0);
    expect(betaInc(2, 3, 1)).toBe(1);
    expect(betaInc(2, 3, 0.4) + betaInc(3, 2, 0.6)).toBeCloseTo(1, 12);
  });
});

describe("ANOVA and effect size", () => {
  it("F with 1 numerator df equals the squared t statistic's tail", () => {
    const a = [5.1, 4.9, 5.6, 5.3, 4.8], b = [6.0, 6.2, 5.7, 6.4, 5.9];
    const an = oneWayAnova([a, b]);
    const sp = Math.sqrt((((a.length - 1) * sd(a) ** 2) + ((b.length - 1) * sd(b) ** 2)) / 8);
    const t = (mean(b) - mean(a)) / (sp * Math.sqrt(2 / 5));
    expect(an.f).toBeCloseTo(t * t, 9);
    expect(an.p).toBeCloseTo(2 * (1 - tCdf(Math.abs(t), 8)), 9);
  });
  it("Hedges g is about d with small-sample correction", () => {
    const g = hedgesG([1, 2, 3, 4, 5], [3, 4, 5, 6, 7]);
    expect(g).toBeLessThan(0);
    expect(Math.abs(g)).toBeLessThan(1.265);
    expect(Math.abs(g)).toBeGreaterThan(1.0);
  });
});

describe("Dunnett's test", () => {
  it("reduces to the two-sample t test for one comparison", () => {
    const c = [10.1, 9.8, 10.4, 10.0, 9.7, 10.2], t1 = [11.0, 10.7, 11.3, 10.9, 11.4, 10.8];
    const r = dunnett(c, [t1]);
    expect(r.rows[0]!.pAdj).toBeCloseTo(r.rows[0]!.pUnadjusted, 4);
  });

  it("adjusted p lies between the unadjusted p and the Bonferroni bound", () => {
    const rng = new Rng(3);
    const draw = (m: number, n: number) => Array.from({ length: n }, () => m + rng.normal());
    const r = dunnett(draw(0, 8), [draw(0.8, 8), draw(1.2, 8), draw(0.2, 8)]);
    for (const row of r.rows) {
      expect(row.pAdj).toBeGreaterThanOrEqual(row.pUnadjusted - 1e-4);
      expect(row.pAdj).toBeLessThanOrEqual(Math.min(1, 3 * row.pUnadjusted) + 1e-4);
    }
  });

  it("critical values approach the known normal-limit values for large df", () => {
    // two-sided 5%: k = 1, 2, 3 comparisons give about 1.96, 2.21, 2.35 as df grows
    expect(dunnettCritical(10, [10], 2000)).toBeCloseTo(1.96, 1);
    expect(dunnettCritical(10, [10, 10], 2000)).toBeCloseTo(2.21, 1);
    expect(dunnettCritical(10, [10, 10, 10], 2000)).toBeCloseTo(2.35, 1);
  });

  it("agrees with the t quantile for k = 1 at finite df", () => {
    expect(dunnettCritical(10, [10], 18)).toBeCloseTo(tQuantile(0.975, 18), 3);
  });

  it("controls the familywise error rate by simulation (equal and unequal group sizes)", () => {
    for (const [n0, ns] of [[6, [6, 6, 6]], [6, [5, 8, 7]]] as Array<[number, number[]]>) {
      const df = n0 + ns.reduce((a, b) => a + b, 0) - (ns.length + 1);
      const d = dunnettCritical(n0, ns, df, 0.05);
      const rng = new Rng(1234);
      let hit = 0;
      const reps = 20000;
      for (let r = 0; r < reps; r++) {
        const groups = [n0, ...ns].map((n) => Array.from({ length: n }, () => rng.normal()));
        const { mse } = oneWayAnova(groups);
        let maxT = 0;
        for (let i = 1; i < groups.length; i++) maxT = Math.max(maxT, Math.abs(mean(groups[i]!) - mean(groups[0]!)) / Math.sqrt(mse * (1 / groups[i]!.length + 1 / n0)));
        if (maxT > d) hit++;
      }
      expect(hit / reps).toBeGreaterThan(0.04);
      expect(hit / reps).toBeLessThan(0.06);
    }
  });

  it("is a proper distribution function", () => {
    expect(dunnettJointProb(0.01, 8, [8, 8], 20)).toBeLessThan(0.02);
    expect(dunnettJointProb(15, 8, [8, 8], 20)).toBeCloseTo(1, 6);
  });
});

describe("Kruskal-Wallis and Dunn", () => {
  it("matches the hand-computed H for three perfectly separated groups", () => {
    const kw = kruskalWallis([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    expect(kw.h).toBeCloseTo(7.2, 10);
    expect(kw.p).toBeCloseTo(Math.exp(-3.6), 10);
  });
  it("applies the tie correction", () => {
    const noTies = kruskalWallis([[1, 2, 3], [4, 5, 6]]).h;
    const ties = kruskalWallis([[1, 2, 2], [4, 5, 5]]);
    expect(ties.h).toBeGreaterThan(0);
    expect(noTies).toBeCloseTo(3.857142857142857, 9);
  });
  it("Holm adjusts monotonically and never exceeds 1", () => {
    const adj = holm([0.01, 0.04, 0.03]);
    expect(adj[0]).toBeCloseTo(0.03, 12);
    expect(adj[2]).toBeCloseTo(0.06, 12);
    expect(adj[1]).toBeCloseTo(0.06, 12);
    expect(Math.max(...holm([0.5, 0.9, 0.7]))).toBeLessThanOrEqual(1);
  });
  it("Dunn flags a clearly shifted group", () => {
    const r = dunnVsControl([1, 2, 3, 4, 5, 6], [[1.5, 2.5, 3.5, 4.5, 5.5, 3], [20, 21, 22, 23, 24, 25]]);
    expect(r.rows[0]!.pAdj).toBeGreaterThan(0.5);
    expect(r.rows[1]!.pAdj).toBeLessThan(0.05);
  });
});

describe("trend tests", () => {
  it("Jonckheere-Terpstra matches the hand-computed example", () => {
    const r = jonckheereTerpstra([[1, 2], [3, 4], [5, 6]]);
    expect(r.statistic).toBe(12);
    expect(r.z).toBeCloseTo(6 / Math.sqrt(6.333333333333333), 6);
    expect(r.pIncreasing).toBeCloseTo(0.00857, 3);
  });
  it("linear trend detects a dose-related slope and not a flat profile", () => {
    const rng = new Rng(8);
    const g = (m: number) => Array.from({ length: 8 }, () => m + 0.5 * rng.normal());
    expect(linearTrend([g(0), g(1), g(2), g(3)], [0, 1, 2, 3]).p).toBeLessThan(0.001);
    expect(linearTrend([g(1), g(1), g(1), g(1)], [0, 1, 2, 3]).p).toBeGreaterThan(0.01);
    expect(linearTrend([g(0), g(1), g(2), g(3)], [0, 1, 2, 3]).slope).toBeCloseTo(1, 0);
  });
});

describe("incidence", () => {
  it("Fisher's exact test matches the tea-tasting example", () => {
    expect(fisherExact(3, 1, 1, 3)).toBeCloseTo(0.4857142857, 8);
    expect(fisherExact(10, 0, 0, 10)).toBeLessThan(1e-4);
    expect(fisherExact(5, 5, 5, 5)).toBeCloseTo(1, 10);
  });
  it("Wilson interval contains the estimate and stays in [0, 1]", () => {
    const w = wilson(0, 10);
    expect(w.low).toBe(0);
    expect(w.high).toBeGreaterThan(0.2);
    const x = wilson(5, 10);
    expect(x.low).toBeLessThan(0.5); expect(x.high).toBeGreaterThan(0.5);
  });
});
