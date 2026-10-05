import { describe, it, expect } from "vitest";
import { ARCHETYPES, kaplanMeier, simulatePopulation, type AnimalConfig } from "../src";

const base = (dose: number, disease = true): AnimalConfig => ({
  seed: 9, animalId: "x", sex: "M", strain: "SD", ageWeeks: 8, compound: ARCHETYPES.cardiotoxin!, durationDays: 28,
  regimen: { route: "oral", doseMgPerKg: dose, intervalH: 24, startH: 0, nDoses: 28 }, disease: disease ? { cancer: {} } : undefined,
});

describe("population outcomes", () => {
  it("is deterministic, and chunks add up to one run", () => {
    const whole = simulatePopulation(base(8), { n: 6 });
    const a = simulatePopulation(base(8), { n: 3, offset: 0 }), b = simulatePopulation(base(8), { n: 3, offset: 3 });
    expect([...a, ...b]).toEqual(whole);
    expect(simulatePopulation(base(8), { n: 6 })).toEqual(whole);
  });

  it("gives every rat its own variability", () => {
    const pop = simulatePopulation(base(8), { n: 12 });
    expect(new Set(pop.map((p) => p.tumourEndMm3.toFixed(2))).size).toBeGreaterThan(8);
    expect(pop.filter((p) => p.sex === "M").length).toBe(6);
  });

  it("reports grades in range, and an organ whenever the grade is above zero", () => {
    for (const p of simulatePopulation(base(16), { n: 8 })) {
      expect(p.worstGrade).toBeGreaterThanOrEqual(0);
      expect(p.worstGrade).toBeLessThanOrEqual(5);
      expect(p.worstOrgan === null).toBe(p.worstGrade === 0);
    }
  });

  it("shows untreated tumour-bearing rats reaching the humane limit and treated ones largely avoiding it", () => {
    const treated = simulatePopulation(base(8), { n: 20 });
    const untreated = simulatePopulation(base(0), { n: 20 });
    const humane = (p: ReturnType<typeof simulatePopulation>) => p.filter((x) => x.humaneDay !== null).length;
    expect(humane(untreated)).toBeGreaterThan(humane(treated));
    expect(untreated.every((p) => p.worstGrade === 0)).toBe(true);
    const km = (p: ReturnType<typeof simulatePopulation>) => kaplanMeier(p.map((x) => x.humaneDay ?? 28), p.map((x) => x.humaneDay !== null));
    expect(km(untreated).at(-1)!.survival).toBeLessThan(km(treated).at(-1)!.survival);
  }, 60000);

  it("a 0.5 h step stays close to the 0.25 h step for the quantity that is plotted", () => {
    const fine = simulatePopulation(base(8), { n: 8 }), coarse = simulatePopulation(base(8), { n: 8, dtH: 0.5 });
    const meanGrade = (p: typeof fine) => p.reduce((s, x) => s + x.worstGrade, 0) / p.length;
    expect(Math.abs(meanGrade(fine) - meanGrade(coarse))).toBeLessThan(0.6);
  }, 60000);
});
