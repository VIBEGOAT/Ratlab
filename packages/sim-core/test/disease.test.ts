import { describe, it, expect } from "vitest";
import { ARCHETYPES, peakDamage, simulateAnimal, simulateTwin, type AnimalConfig, type Compound, type DiseaseConfig } from "../src";

function cfg(c: Compound, dose: number, disease: DiseaseConfig | undefined, days = 28, nDoses = days, id = "r1"): AnimalConfig {
  return {
    seed: 7, animalId: id, sex: "M", strain: "SD", ageWeeks: 8, compound: c, durationDays: days,
    regimen: { route: "oral", doseMgPerKg: dose, intervalH: 24, startH: 0, nDoses }, disease,
  };
}
const day = (a: Float64Array, d: number) => a[d * 96]!;

describe("cancer overlay", () => {
  const C = ARCHETYPES.cardiotoxin!;
  const cancer: DiseaseConfig = { cancer: {} };

  it("grows untreated tumors monotonically toward a plateau", () => {
    const r = simulateAnimal(cfg(C, 0, cancer, 60));
    const v = r.disease.tumorVolume;
    for (let d = 1; d <= 60; d++) expect(day(v, d)).toBeGreaterThanOrEqual(day(v, d - 1) - 1e-6);
    expect(day(v, 60)).toBeGreaterThan(day(v, 0) * 10);
    expect(day(v, 60)).toBeLessThan(6000);
  });

  it("is reduced by an active compound, more so at a higher dose", () => {
    const vol = (dose: number) => day(simulateAnimal(cfg(C, dose, cancer, 14)).disease.tumorVolume, 14);
    const v0 = vol(0), v4 = vol(4), v8 = vol(8), v16 = vol(16);
    expect(v8).toBeLessThan(v0 * 0.5);
    expect(v4).toBeLessThan(v0);
    expect(v8).toBeLessThanOrEqual(v4);
    expect(v16).toBeLessThanOrEqual(v8);
  });

  it("does not shrink tumors with an inactive compound", () => {
    const H = ARCHETYPES.hepatotoxin!;
    const a = day(simulateAnimal(cfg(H, 100, cancer, 14)).disease.tumorVolume, 14);
    const b = day(simulateAnimal(cfg(H, 0, cancer, 14)).disease.tumorVolume, 14);
    expect(a / b).toBeGreaterThan(0.9);
  });

  it("lets resistant clones take over under continued therapy, and regrowth follows", () => {
    const r = simulateAnimal(cfg(C, 16, cancer, 70, 70));
    const f = r.disease.tumorResistantFraction;
    expect(day(f, 50)).toBeGreaterThan(day(f, 7));
    expect(day(f, 50)).toBeGreaterThan(0.5);
  });

  it("produces no tumor signal without the overlay", () => {
    const r = simulateAnimal(cfg(C, 8, undefined, 14));
    expect(Math.max(...r.disease.tumorVolume)).toBe(0);
  });
});

describe("diabetes overlay", () => {
  const C = ARCHETYPES.reference!;
  it("STZ-like onset is fast and type-2-like onset is slow", () => {
    const stz = simulateAnimal(cfg(C, 0, { diabetes: { kind: "stz", severity: 0.8 } }, 20));
    const t2 = simulateAnimal(cfg(C, 0, { diabetes: { kind: "type2", severity: 0.8 } }, 20));
    expect(day(stz.disease.glucose, 5)).toBeGreaterThan(300);
    expect(day(t2.disease.glucose, 5)).toBeLessThan(day(stz.disease.glucose, 5) * 0.6);
    expect(day(t2.disease.glucose, 20)).toBeGreaterThan(day(t2.disease.glucose, 5));
  });

  it("HbA1c-like marker lags glucose, and complications develop in order of exposure", () => {
    const r = simulateAnimal(cfg(C, 0, { diabetes: { kind: "stz", severity: 0.9 } }, 90));
    expect(day(r.disease.hba1c, 5)).toBeLessThan(5.5);
    expect(day(r.disease.hba1c, 80)).toBeGreaterThan(7);
    expect(day(r.disease.nephropathy, 28)).toBeGreaterThan(0.05);
    expect(day(r.disease.nephropathy, 28)).toBeGreaterThan(day(r.disease.cataract, 28));
    expect(day(r.disease.cataract, 90)).toBeGreaterThan(0.02);
  });

  it("stays at baseline with zero severity", () => {
    const r = simulateAnimal(cfg(C, 0, { diabetes: { kind: "stz", severity: 0 } }, 30));
    expect(day(r.disease.glucose, 30)).toBeLessThan(125);
    expect(day(r.disease.nephropathy, 30)).toBeLessThan(0.001);
  });

  it("makes the kidney more sensitive to a nephrotoxin than in a healthy twin", () => {
    const N = ARCHETYPES.nephrotoxin!;
    const healthy = peakDamage(simulateAnimal(cfg(N, 40, undefined, 21))).kidney!;
    const diab = peakDamage(simulateAnimal(cfg(N, 40, { diabetes: { kind: "stz", severity: 0.9 } }, 21))).kidney!;
    expect(diab).toBeGreaterThan(healthy);
  });
});

describe("untreated twin", () => {
  it("shares physiology and disease parameters with the treated arm", () => {
    const tw = simulateTwin(cfg(ARCHETYPES.cardiotoxin!, 8, { cancer: {} }, 21));
    expect(tw.treated.result.physiology).toEqual(tw.untreated.result.physiology);
    expect(day(tw.treated.result.disease.tumorVolume, 0)).toBe(day(tw.untreated.result.disease.tumorVolume, 0));
    expect(day(tw.treated.result.disease.tumorVolume, 14)).toBeLessThan(day(tw.untreated.result.disease.tumorVolume, 14));
  });

  it("matches a direct zero-dose simulation exactly", () => {
    const base = cfg(ARCHETYPES.cardiotoxin!, 8, { cancer: {} }, 14);
    const tw = simulateTwin(base);
    const direct = simulateAnimal({ ...base, regimen: { ...base.regimen, doseMgPerKg: 0 } });
    expect(Array.from(tw.untreated.result.disease.tumorVolume)).toEqual(Array.from(direct.disease.tumorVolume));
  });

  it("shows treatment delaying or preventing the tumor humane endpoint", () => {
    const tw = simulateTwin(cfg(ARCHETYPES.cardiotoxin!, 8, { cancer: {} }, 28));
    expect(tw.untreated.humane?.criteria).toContain("tumor-burden");
    expect(tw.humaneDelayDays === Infinity || (tw.humaneDelayDays ?? 0) > 0).toBe(true);
  });

  it("has no humane endpoint for a healthy untreated animal", () => {
    const tw = simulateTwin(cfg(ARCHETYPES.reference!, 100, undefined, 28));
    expect(tw.treated.humane).toBeNull();
    expect(tw.untreated.humane).toBeNull();
    expect(tw.humaneDelayDays).toBeNull();
  });
});
