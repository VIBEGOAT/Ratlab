import { describe, it, expect } from "vitest";
import { ARCHETYPES, configForAnimal, defaultDesign, runStudy, simulateAnimal, simulateTwinBundle } from "../src";

describe("animal rebuild and bundle", () => {
  const design = defaultDesign(ARCHETYPES.cardiotoxin!, { nPerSexPerGroup: 3, durationDays: 14, seed: 6, disease: { cancer: {} } });
  const study = runStudy(design);

  it("rebuilds a study animal exactly from its record", () => {
    for (const a of [study.animals[0]!, study.animals[study.animals.length - 1]!]) {
      const r = simulateAnimal(configForAnimal(design, a));
      expect(r.pk.cmax).toBeCloseTo(a.pk.cmax, 10);
    }
  });

  it("builds a plain, structured-clone-safe twin bundle", () => {
    const high = study.animals.find((a) => a.group === "G4" && a.sex === "M")!;
    const b = simulateTwinBundle(configForAnimal(design, high));
    expect(b.treated.days).toBe(14);
    expect(b.treated.plasma.length).toBe(b.treated.hoursH.length);
    expect(b.treated.clinpath.length).toBe(15);
    expect(b.treated.homeCage[3]!.activity.length).toBe(96);
    expect(structuredClone(b).treated.id).toBe(high.id);
    expect(b.untreated.daily.tumorVolume[14]!).toBeGreaterThan(b.treated.daily.tumorVolume[14]!);
    expect(JSON.stringify(b)).not.toContain("NaN");
  });
});
