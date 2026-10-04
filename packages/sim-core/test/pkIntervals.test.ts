import { describe, it, expect } from "vitest";
import {
  ARCHETYPES, configForAnimal, defaultDesign, doseTimesOf, intervalPk, runStudy, simulateAnimal, simulateTwinBundle, type AnimalConfig,
} from "../src";

const cfg = (c = ARCHETYPES.hepatotoxin!, days = 28): AnimalConfig => ({
  seed: 4, animalId: "pk", sex: "M", strain: "SD", ageWeeks: 8, compound: c, durationDays: days,
  regimen: { route: "oral", doseMgPerKg: 20, intervalH: 24, startH: 0, nDoses: days }, toxicodynamics: false, organFeedback: false,
});

describe("per-interval PK", () => {
  it("reports Tmax relative to the dose, within the dosing interval, for once-daily oral dosing", () => {
    const r = simulateAnimal(cfg());
    const s = intervalPk(r.timesH, r.plasma, doseTimesOf(r.config.regimen, 0.25, 28 * 24), 24)!;
    expect(s.first.tmaxH).toBeGreaterThan(0);
    expect(s.first.tmaxH).toBeLessThan(6);
    expect(s.last!.tmaxH).toBeLessThan(6);
    expect(s.last!.dose).toBe(28);
  });

  it("matches the whole-study accumulation ratio and explains it", () => {
    const r = simulateAnimal({ ...cfg(ARCHETYPES.cardiotoxin!, 21), regimen: { ...cfg().regimen, nDoses: 20 } });
    const s = intervalPk(r.timesH, r.plasma, doseTimesOf(r.config.regimen, 0.25, 21 * 24), 24)!;
    expect(s.accumulationRatio!).toBeCloseTo(r.pk.accumulationRatio!, 6);
    expect(s.accumulationRatio!).toBeGreaterThan(1.1);
    expect(s.accumulationNote).toMatch(/steady state/);
  });

  it("calls a short half-life compound non-accumulating", () => {
    const r = simulateAnimal(cfg(ARCHETYPES.neurotoxin!, 10));
    const s = intervalPk(r.timesH, r.plasma, doseTimesOf(r.config.regimen, 0.25, 240), 24)!;
    expect(s.accumulationRatio!).toBeLessThan(1.1);
    expect(s.accumulationNote).toMatch(/little or no accumulation/);
  });

  it("returns null for dietary dosing and handles a single dose", () => {
    expect(doseTimesOf({ route: "diet", doseMgPerKg: 1, intervalH: 24, startH: 0, nDoses: 5 }, 0.25, 120)).toEqual([]);
    const r = simulateAnimal({ ...cfg(), durationDays: 3, regimen: { ...cfg().regimen, nDoses: 1 } });
    const s = intervalPk(r.timesH, r.plasma, [0], 24)!;
    expect(s.last).toBeNull();
    expect(s.accumulationRatio).toBeNull();
  });
});

describe("timeline length follows the study", () => {
  it("a 90-day study gives a 90-day record, and a recovery animal adds the recovery period", () => {
    const design = defaultDesign(ARCHETYPES.reference!, { nPerSexPerGroup: 2, durationDays: 90, recovery: true, recoveryDays: 14, seed: 2, sexes: ["M"] });
    const study = runStudy(design);
    const main = study.animals.find((a) => a.group === "G4")!;
    const rec = study.animals.find((a) => a.group === "R4")!;
    const b = simulateTwinBundle(configForAnimal(design, main));
    expect(b.treated.days).toBe(90);
    expect(b.treated.scheduledDays).toBe(90);
    expect(simulateTwinBundle(configForAnimal(design, rec)).treated.days).toBe(104);
  }, 30000);
});
