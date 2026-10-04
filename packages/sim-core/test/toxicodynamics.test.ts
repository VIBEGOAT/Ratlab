import { describe, it, expect } from "vitest";
import { ARCHETYPES, gradeFromDamage, peakDamage, simulateAnimal, type AnimalConfig, type Compound, type Organ } from "../src";

function study(c: Compound, dose: number, days: number, follow = 21, over: Partial<AnimalConfig> = {}) {
  return simulateAnimal({
    seed: 3, animalId: "t", sex: "M", strain: "SD", ageWeeks: 8, compound: c, durationDays: days + follow,
    regimen: { route: "oral", doseMgPerKg: dose, intervalH: 24, startH: 0, nDoses: days }, ...over,
  });
}

const TARGET: Record<string, Organ> = {
  hepatotoxin: "liver", nephrotoxin: "kidney", cardiotoxin: "heart", neurotoxin: "brain", myelotoxin: "marrow",
};

describe("pathology grade", () => {
  it("maps damage onto grades 0 to 5 at the documented cut points", () => {
    expect(gradeFromDamage(0)).toBe(0);
    expect(gradeFromDamage(0.049)).toBe(0);
    expect(gradeFromDamage(0.05)).toBe(1);
    expect(gradeFromDamage(0.2)).toBe(2);
    expect(gradeFromDamage(0.4)).toBe(3);
    expect(gradeFromDamage(0.6)).toBe(4);
    expect(gradeFromDamage(0.9)).toBe(5);
  });
});

describe("dose-response", () => {
  for (const [name, organ] of Object.entries(TARGET)) {
    const c = ARCHETYPES[name]!;
    it(`${name}: no injury at a low dose and non-decreasing peak damage with dose`, () => {
      const mults = [0.05, 0.2, 0.5, 1, 1.5, 2];
      const peaks = mults.map((m) => peakDamage(study(c, c.defaultDoseMgPerKg * m, 14))[organ]!);
      expect(peaks[0]!).toBeLessThan(0.01);
      for (let i = 1; i < peaks.length; i++) expect(peaks[i]!).toBeGreaterThanOrEqual(peaks[i - 1]! - 1e-9);
      expect(peaks.at(-1)!).toBeGreaterThan(0.1);
    });
  }

  it("the safe reference compound shows no pathology at its upper tuned dose", () => {
    const c = ARCHETYPES.reference!;
    const r = study(c, c.tunedDoseRange[1], 28);
    for (const v of Object.values(peakDamage(r))) expect(v!).toBeLessThan(0.05);
  });

  it("keeps damage and defence inside [0,1]", () => {
    const c = ARCHETYPES.hepatotoxin!;
    const r = study(c, 400, 14);
    for (const v of r.damage.liver!) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    for (const v of r.defence.liver!) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
});

describe("defence depletion", () => {
  it("exhausts liver defences at a toxic dose but not at a low dose", () => {
    const c = ARCHETYPES.hepatotoxin!;
    const tox = study(c, 200, 7), low = study(c, 15, 7);
    expect(Math.min(...tox.defence.liver!)).toBeLessThan(0.2);
    expect(Math.min(...low.defence.liver!)).toBeGreaterThan(Math.min(...tox.defence.liver!) + 0.3);
    expect(peakDamage(low).liver!).toBeLessThan(0.01);
  });
});

describe("recovery after dosing stops", () => {
  it("liver injury regresses", () => {
    const c = ARCHETYPES.hepatotoxin!;
    const r = study(c, 200, 7, 28);
    const peak = peakDamage(r).liver!;
    expect(peak).toBeGreaterThan(0.2);
    expect(r.damage.liver!.at(-1)!).toBeLessThan(peak * 0.5);
  });

  it("marrow regenerates much faster than the heart", () => {
    const m = ARCHETYPES.myelotoxin!, h = ARCHETYPES.cardiotoxin!;
    const rm = study(m, m.defaultDoseMgPerKg, 14, 28), rh = study(h, h.defaultDoseMgPerKg, 14, 28);
    expect(rm.damage.marrow!.at(-1)!).toBeLessThan(peakDamage(rm).marrow! * 0.2);
    expect(rh.damage.heart!.at(-1)!).toBeGreaterThan(peakDamage(rh).heart! * 0.9);
  });

  it("cardiac damage keeps rising with repeated exposure (cumulative)", () => {
    const h = ARCHETYPES.cardiotoxin!;
    const r = study(h, 8, 28, 0);
    const d = r.damage.heart!;
    const at = (day: number) => d[Math.round((day * 24) / 0.25)]!;
    expect(at(21)).toBeGreaterThan(at(10));
    expect(at(10)).toBeGreaterThan(at(3));
  });
});

describe("organ function feedback", () => {
  it("lowers hepatic clearance and raises exposure when the liver is injured", () => {
    const c = ARCHETYPES.hepatotoxin!;
    const on = study(c, 250, 7, 2, { organFeedback: true });
    const off = study(c, 250, 7, 2, { organFeedback: false });
    expect(Math.min(...on.clearanceFactorHepatic)).toBeLessThan(0.9);
    expect(on.pk.aucAll).toBeGreaterThan(off.pk.aucAll);
  });
});

describe("neurotoxin PD", () => {
  it("produces a CNS activation response that rises with dose and lags brain concentration", () => {
    const c = ARCHETYPES.neurotoxin!;
    const lo = study(c, 10, 1, 1), hi = study(c, 80, 1, 1);
    const max = (a: Float64Array) => a.reduce((m, v) => (v > m ? v : m), 0);
    expect(max(hi.pd["cns-activation"]!)).toBeGreaterThan(max(lo.pd["cns-activation"]!));
    const iBrain = hi.tissue.brain.indexOf(max(hi.tissue.brain));
    const iEff = hi.pd["cns-activation"]!.indexOf(max(hi.pd["cns-activation"]!));
    expect(iEff).toBeGreaterThan(iBrain);
  });
});
