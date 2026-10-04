import { describe, it, expect } from "vitest";
import { ARCHETYPES, configForAnimal, defaultDesign, runStudy, simulateTwinBundle, ORGANS } from "@eliminate/sim-core";
import { mixRgb, ratVisualState, rgbToHex, tumorRadiusFromVolume } from "./ratState";

describe("rat visual state", () => {
  const design = defaultDesign(ARCHETYPES.hepatotoxin!, { nPerSexPerGroup: 3, durationDays: 14, seed: 8, disease: { cancer: {} } });
  const study = runStudy(design);
  const high = study.animals.find((a) => a.group === "G4" && a.sex === "M")!;
  const tw = simulateTwinBundle(configForAnimal(design, high));

  it("keeps every field in its documented range on every day", () => {
    for (const bundle of [tw.treated, tw.untreated]) {
      for (let d = 0; d <= bundle.days; d++) {
        const v = ratVisualState(bundle, d);
        for (const o of ORGANS) { expect(v.organs[o].damage).toBeGreaterThanOrEqual(0); expect(v.organs[o].damage).toBeLessThanOrEqual(1); expect(v.organs[o].grade).toBeGreaterThanOrEqual(0); expect(v.organs[o].grade).toBeLessThanOrEqual(5); }
        for (const k of ["jaundice", "piloerection", "hunch", "tremor", "convulsion", "ataxia", "tears", "cataract", "dehydration", "lethargy", "grimace"] as const) { expect(v[k]).toBeGreaterThanOrEqual(0); expect(v[k]).toBeLessThanOrEqual(1); }
        expect(v.size).toBeGreaterThanOrEqual(0.6); expect(v.size).toBeLessThanOrEqual(1.5);
        expect(v.wasting).toBeGreaterThanOrEqual(0); expect(v.wasting).toBeLessThanOrEqual(0.5);
        expect(Number.isFinite(v.heartRateBpm)).toBe(true);
      }
    }
  });

  it("shows liver injury in the treated animal at the end and none in the untreated twin", () => {
    const t = ratVisualState(tw.treated, 14), u = ratVisualState(tw.untreated, 14);
    expect(t.organs.liver.grade).toBeGreaterThanOrEqual(2);
    expect(u.organs.liver.grade).toBe(0);
    expect(t.organs.liver.finding).not.toBe("No finding");
  });

  it("shows a tumor that grows in the untreated twin", () => {
    expect(ratVisualState(tw.untreated, 14).tumorRadius).toBeGreaterThan(ratVisualState(tw.untreated, 0).tumorRadius);
    expect(ratVisualState(tw.untreated, 0).tumorRadius).toBeGreaterThan(0);
  });

  it("clamps the requested day into the study", () => {
    expect(ratVisualState(tw.treated, -5).day).toBe(0);
    expect(ratVisualState(tw.treated, 999).day).toBe(14);
  });
});

describe("helpers", () => {
  it("maps tumor volume to a monotone, bounded radius", () => {
    expect(tumorRadiusFromVolume(0)).toBe(0);
    expect(tumorRadiusFromVolume(100)).toBeLessThan(tumorRadiusFromVolume(1000));
    expect(tumorRadiusFromVolume(1e9)).toBeLessThanOrEqual(0.75);
  });
  it("mixes colours and formats hex", () => {
    expect(rgbToHex(mixRgb("#000000", "#ffffff", 0.5))).toBe("#808080");
    expect(rgbToHex(mixRgb("#ff0000", "#0000ff", 0))).toBe("#ff0000");
    expect(rgbToHex(mixRgb("#ff0000", "#0000ff", 5))).toBe("#0000ff");
  });
});
