import { describe, it, expect } from "vitest";
import {
  ARCHETYPES, behaviourDaily, deriveObservables, elevatedPlusMaze, forcedSwimImmobility, homeCageDay, observationBattery,
  openField, openFieldTrack, simulateAnimal, sucrosePreference, waterMaze, type AnimalConfig, type Compound, type DiseaseConfig,
} from "../src";

function run(c: Compound, dose: number, days: number, follow = 0, disease?: DiseaseConfig) {
  const cfg: AnimalConfig = {
    seed: 21, animalId: "b1", sex: "M", strain: "SD", ageWeeks: 8, compound: c, durationDays: days + follow,
    regimen: { route: "oral", doseMgPerKg: dose, intervalH: 24, startH: 0, nDoses: days }, disease,
  };
  const r = simulateAnimal(cfg);
  const obs = deriveObservables(r);
  return { r, obs, beh: behaviourDaily(r, obs) };
}

describe("home cage", () => {
  const { r, obs, beh } = run(ARCHETYPES.reference!, 0, 14);
  it("is nocturnal, with temperature rising in the dark", () => {
    const h = homeCageDay(r, obs, beh, 7);
    expect(h.activity.length).toBe(96);
    expect(h.darkFraction).toBeGreaterThan(0.8);
    const lightTemp = h.bodyTempC.slice(0, 40).reduce((a, b) => a + b, 0) / 40;
    const darkTemp = h.bodyTempC.slice(52, 92).reduce((a, b) => a + b, 0) / 40;
    expect(darkTemp).toBeGreaterThan(lightTemp);
  });
  it("matches daily food and water totals", () => {
    const h = homeCageDay(r, obs, beh, 7);
    expect(h.feeding.reduce((a, b) => a + b, 0)).toBeCloseTo(obs.foodG[7]!, 6);
    expect(h.drinking.reduce((a, b) => a + b, 0)).toBeCloseTo(obs.waterMl[7]!, 6);
  });
  it("healthy baseline indices are close to 1", () => {
    expect(beh.activityIndex[7]!).toBeGreaterThan(0.85);
    expect(beh.activityIndex[7]!).toBeLessThan(1.15);
  });
});

describe("sickness behaviour", () => {
  const healthy = run(ARCHETYPES.reference!, 0, 21);
  const sick = run(ARCHETYPES.reference!, 0, 21, 0, { cancer: { v0Mm3: 600 } });
  it("lowers activity, exploration and social interaction, and raises anxiety-like and anhedonia-like scores", () => {
    const d = 18;
    expect(sick.beh.activityIndex[d]!).toBeLessThan(healthy.beh.activityIndex[d]!);
    expect(sick.beh.explorationIndex[d]!).toBeLessThan(healthy.beh.explorationIndex[d]!);
    expect(sick.beh.socialInteractionIndex[d]!).toBeLessThan(healthy.beh.socialInteractionIndex[d]!);
    expect(sick.beh.anxietyLike[d]!).toBeGreaterThan(healthy.beh.anxietyLike[d]!);
    expect(sick.beh.anhedoniaLike[d]!).toBeGreaterThan(healthy.beh.anhedoniaLike[d]!);
    expect(sucrosePreference(sick.beh, d, 3)).toBeLessThan(sucrosePreference(healthy.beh, d, 3));
    expect(forcedSwimImmobility(sick.beh, sick.obs, d, 3)).toBeGreaterThan(forcedSwimImmobility(healthy.beh, healthy.obs, d, 3));
  });
  it("reduces distance and widens wall preference in the open field", () => {
    const a = openField(healthy.beh, 18, 5), b = openField(sick.beh, 18, 5);
    expect(b.distanceCm).toBeLessThan(a.distanceCm);
    expect(b.centerTimeFraction).toBeLessThan(a.centerTimeFraction);
    const epmA = elevatedPlusMaze(healthy.beh, 18, 5), epmB = elevatedPlusMaze(sick.beh, 18, 5);
    expect(epmB.openArmFraction).toBeLessThan(epmA.openArmFraction);
  });
  it("keeps every bounded endpoint within its range", () => {
    for (let d = 0; d <= 21; d++) {
      for (const v of [sick.beh.anxietyLike[d]!, sick.beh.anhedoniaLike[d]!, sick.beh.sleepFragmentation[d]!, sick.beh.cognition[d]!]) {
        expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("CNS-active compound: stimulation, tolerance and withdrawal rebound", () => {
  const { obs, beh } = run(ARCHETYPES.neurotoxin!, 40, 7, 14);
  it("raises activity above baseline while dosing", () => {
    expect(Math.max(...Array.from(beh.activityIndex).slice(0, 8))).toBeGreaterThan(1.05);
  });
  it("weakens the effect with repeated dosing (tolerance)", () => {
    expect(beh.netCns[6]!).toBeLessThan(beh.netCns[1]! * 0.9 + 1e-9);
  });
  it("shows a rebound below baseline after dosing stops", () => {
    const after = Array.from(beh.netCns).slice(9, 14);
    expect(Math.min(...after)).toBeLessThan(-0.02);
    expect(obs.days).toBe(21);
  });
});

describe("observation battery", () => {
  it("scores more tremor and convulsion at a high neurotoxin dose than at vehicle", () => {
    const hi = run(ARCHETYPES.neurotoxin!, 100, 3, 0), lo = run(ARCHETYPES.neurotoxin!, 0, 3, 0);
    const a = observationBattery(hi.r, hi.obs, hi.beh, 2), b = observationBattery(lo.r, lo.obs, lo.beh, 2);
    expect(a.tremor).toBeGreaterThan(b.tremor);
    expect(a.startleAmplitudePct).toBeGreaterThan(b.startleAmplitudePct * 0.95);
  });
  it("returns ordinal scores in range and non-negative percentages", () => {
    const { r, obs, beh } = run(ARCHETYPES.nephrotoxin!, 150, 14);
    const f = observationBattery(r, obs, beh, 14);
    for (const k of ["gait", "reactivity", "tremor", "ataxia", "convulsions"] as const) { expect(f[k]).toBeGreaterThanOrEqual(0); expect(f[k]).toBeLessThanOrEqual(3); }
    expect(f.posture).toBeGreaterThanOrEqual(0); expect(f.posture).toBeLessThanOrEqual(2);
    for (const k of ["gripStrengthPct", "rotarodLatencyPct", "startleAmplitudePct", "prepulseInhibitionPct", "hindLimbSplayPct"] as const) expect(f[k]).toBeGreaterThanOrEqual(0);
    expect(f.rightingReflex).toBeGreaterThanOrEqual(0); expect(f.rightingReflex).toBeLessThanOrEqual(1);
  });
  it("is deterministic", () => {
    const { r, obs, beh } = run(ARCHETYPES.reference!, 0, 7);
    expect(observationBattery(r, obs, beh, 5)).toEqual(observationBattery(r, obs, beh, 5));
  });
});

describe("water maze learning", () => {
  it("shows a falling latency curve for an intact animal", () => {
    const { latencySec } = waterMaze(5, 1, 25);
    const first = latencySec.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const last = latencySec.slice(-3).reduce((a, b) => a + b, 0) / 3;
    expect(last).toBeLessThan(first * 0.6);
  });
  it("learns less with low cognition, averaged over animals", () => {
    const mean = (c: number) => { let s = 0; for (let k = 0; k < 12; k++) { const l = waterMaze(100 + k, c, 25).latencySec; s += l.slice(-5).reduce((a, b) => a + b, 0) / 5; } return s / 12; };
    expect(mean(0.25)).toBeGreaterThan(mean(1) * 1.3);
  });
  it("is deterministic by seed and returns a route that ends on the platform", () => {
    const a = waterMaze(9, 1, 10), b = waterMaze(9, 1, 10);
    expect(a).toEqual(b);
    expect(a.lastRoute.at(-1)).toEqual(a.platform);
  });
});

describe("open-field track", () => {
  it("is replayable, bounded in the arena, and shorter for a sick animal", () => {
    const healthy = run(ARCHETYPES.reference!, 0, 21), sick = run(ARCHETYPES.reference!, 0, 21, 0, { cancer: { v0Mm3: 600 } });
    const a = openFieldTrack(healthy.beh, 18, 4), a2 = openFieldTrack(healthy.beh, 18, 4), b = openFieldTrack(sick.beh, 18, 4);
    expect(Array.from(a.x)).toEqual(Array.from(a2.x));
    expect(a.x.length).toBe(1500);
    for (const v of [...a.x, ...a.y]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    const len = (t: typeof a) => { let s = 0; for (let i = 1; i < t.x.length; i++) s += Math.hypot(t.x[i]! - t.x[i - 1]!, t.y[i]! - t.y[i - 1]!); return s; };
    expect(len(b)).toBeLessThan(len(a));
  });
});
