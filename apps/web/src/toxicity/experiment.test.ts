import { describe, expect, it } from "vitest";
import { simulateTwinBundle } from "@eliminate/sim-core";
import { animalConfig, DEFAULT_EXPERIMENT, experimentProblems, organResponse } from "./experiment";

describe("toxicity experiment design and coverage", () => {
  it("stops dosing before recovery while keeping the same animal across dose arms", () => {
    const e = { ...DEFAULT_EXPERIMENT, days: 7, recovery: 14 };
    const selected = animalConfig(e), lower = animalConfig(e, e.dose / 2);
    expect(selected.durationDays).toBe(21);
    expect(selected.regimen.nDoses).toBe(7);
    expect(selected.regimen.intervalH).toBe(24);
    expect(selected.seed).toBe(lower.seed);
    expect(selected.animalId).toBe(lower.animalId);
    expect(lower.regimen.doseMgPerKg).toBe(selected.regimen.doseMgPerKg / 2);
    expect(selected.disease).toBeUndefined();
  });
  it("reports unparameterized organs as unassessed, never healthy", () => {
    const e = { ...DEFAULT_EXPERIMENT, days: 7 };
    const b = simulateTwinBundle(animalConfig(e)).treated;
    const kidney = organResponse(e, b, "kidney", 7);
    expect(kidney.modeled).toBe(false);
    expect(kidney.damage).toBeNull();
    expect(kidney.grade).toBeNull();
    expect(kidney.severity).toBe("Exposure only");
    expect(organResponse(e, b, "liver", 0).modeled).toBe(true);
    expect(organResponse(e, b, "liver", 500)).toEqual(organResponse(e, b, "liver", 7));
  });
  it("produces reproducible and distinct exposure comparisons from the real simulation engine", () => {
    const e = { ...DEFAULT_EXPERIMENT, days: 7 };
    const a = simulateTwinBundle(animalConfig(e)).treated;
    const b = simulateTwinBundle(animalConfig(e, e.dose / 2)).treated;
    const repeat = simulateTwinBundle(animalConfig(e)).treated;
    expect(a.physiology).toEqual(b.physiology);
    expect(a.plasma).toEqual(repeat.plasma);
    expect(a.pk.aucAll).toBeGreaterThan(b.pk.aucAll);
    expect(a.hoursH.at(-1)).toBe(168);
    expect(a.plasma.every(Number.isFinite)).toBe(true);
  });
  it("rejects malformed dose, duration, profile, and seed inputs", () => {
    for (const dose of [NaN, Infinity, 0, -1, 2001]) expect(experimentProblems({ ...DEFAULT_EXPERIMENT, dose }).length).toBeGreaterThan(0);
    for (const override of [{ compound: "missing" }, { days: 0 }, { recovery: -1 }, { seed: 1.5 }]) expect(() => animalConfig({ ...DEFAULT_EXPERIMENT, ...override })).toThrow();
  });
});
