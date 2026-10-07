import { describe, it, expect } from "vitest";
import { SPECIES, animalToHuman, convertDoseMgPerKg, hedByWeight, humanToAnimal, speciesById, weightFit } from "../src/doseConversion";
import { listUnverifiedConstants } from "../src/reference";

/** Table 1 of the FDA guidance (July 2005): divide by / multiply by columns, as printed. */
const TABLE1: Record<string, { divide: number; multiply: number }> = {
  mouse: { divide: 12.3, multiply: 0.08 }, hamster: { divide: 7.4, multiply: 0.13 }, rat: { divide: 6.2, multiply: 0.16 },
  ferret: { divide: 5.3, multiply: 0.19 }, guineaPig: { divide: 4.6, multiply: 0.22 }, rabbit: { divide: 3.1, multiply: 0.32 },
  dog: { divide: 1.8, multiply: 0.54 }, monkey: { divide: 3.1, multiply: 0.32 }, marmoset: { divide: 6.2, multiply: 0.16 },
  squirrelMonkey: { divide: 5.3, multiply: 0.19 }, baboon: { divide: 1.8, multiply: 0.54 }, microPig: { divide: 1.4, multiply: 0.73 }, miniPig: { divide: 1.1, multiply: 0.95 },
};

describe("species table agrees with the guidance's own columns", () => {
  it("km reproduces both printed conversion columns for every species", () => {
    for (const [id, t] of Object.entries(TABLE1)) {
      const km = speciesById(id as never).km;
      expect(37 / km, `${id} divisor`).toBeCloseTo(t.divide, 0);
      expect(Math.abs(37 / km - t.divide), `${id} divisor`).toBeLessThan(0.06);
      expect(Math.abs(km / 37 - t.multiply), `${id} multiplier`).toBeLessThan(0.011);
    }
  });
  it("human is km 37 at 60 kg and the rat and human constants are verified", () => {
    expect(speciesById("human").km).toBe(37);
    expect(speciesById("human").referenceKg).toBe(60);
    expect(speciesById("rat").km).toBe(6);
    const unverified = listUnverifiedConstants().map((c) => (typeof c === "string" ? c : (c as { key: string }).key));
    expect(unverified).not.toContain("translation.km.rat");
    expect(unverified).not.toContain("translation.km.human");
  });
  it("surface area times km is consistent with weight for each species (km = weight / area, within rounding)", () => {
    for (const s of SPECIES) expect(Math.abs(s.referenceKg / s.bsaM2 - s.km) / s.km, s.id).toBeLessThan(0.1);
  });
  it("working ranges contain the reference weight", () => {
    for (const s of SPECIES) if (s.workingKg) { expect(s.referenceKg).toBeGreaterThanOrEqual(s.workingKg[0]); expect(s.referenceKg).toBeLessThanOrEqual(s.workingKg[1]); }
  });
});

describe("conversions", () => {
  it("rat dose to human: 100 mg/kg becomes 16.2 mg/kg", () => {
    expect(convertDoseMgPerKg(100, "rat", "human")).toBeCloseTo(16.216, 3);
  });
  it("is reversible between any two species", () => {
    for (const a of SPECIES) for (const b of SPECIES) expect(convertDoseMgPerKg(convertDoseMgPerKg(7.5, a.id, b.id), b.id, a.id)).toBeCloseTo(7.5, 10);
  });
  it("matches the guidance's worked example: 25 mg/kg in a 4.0 kg rabbit", () => {
    // the guidance rounds: 10 mg/kg by the weight formula, 8.1 mg/kg by the standard factor
    expect(hedByWeight(25, 4.0, 60)).toBeCloseTo(10.1, 0);
    expect(convertDoseMgPerKg(25, "rabbit", "human")).toBeCloseTo(8.1, 0);
    const r = animalToHuman({ species: "rabbit", animalKg: 4.0, dose: 25, doseUnit: "mgPerKg" });
    if (!("result" in r)) throw new Error("expected a result");
    expect(r.result.fit).toBe("above");
    expect(r.result.preferred).toBe("weightFormula");
  });
  it("classifies weights against the working range", () => {
    expect(weightFit("rat", 0.15)).toBe("within");
    expect(weightFit("rat", 0.3)).toBe("above");
    expect(weightFit("rat", 0.05)).toBe("below");
    expect(weightFit("human", 200)).toBe("within");
  });
});

describe("animal to human calculator", () => {
  const run = (over: Partial<Parameters<typeof animalToHuman>[0]> = {}) => {
    const r = animalToHuman({ species: "rat", animalKg: 0.2, dose: 50, doseUnit: "mgPerKg", ...over });
    if (!("result" in r)) throw new Error(`problem: ${r.problem}`);
    return r.result;
  };
  it("converts a rat NOAEL to the human equivalent dose, the starting dose and a total for the person", () => {
    const r = run({ humanKg: 70 });
    expect(r.animalDoseMgTotal).toBeCloseTo(10, 10);
    expect(r.animalDoseMgPerM2).toBe(300);
    expect(r.hedMgPerKg).toBeCloseTo(8.108, 3);
    expect(r.hedMgTotal).toBeCloseTo(567.57, 1);
    expect(r.mrsdMgPerKg).toBeCloseTo(0.8108, 3);
    expect(r.mrsdMgTotal).toBeCloseTo(56.757, 2);
    expect(r.safetyFactor).toBe(10);
    expect(r.fit).toBe("within");
    expect(r.preferred).toBe("kmFactor");
  });
  it("accepts a total dose per animal and gives the same answer as the per-kg dose", () => {
    const a = run({ dose: 50, doseUnit: "mgPerKg", animalKg: 0.25 });
    const b = run({ dose: 12.5, doseUnit: "mgTotal", animalKg: 0.25 });
    expect(b.animalDoseMgPerKg).toBeCloseTo(a.animalDoseMgPerKg, 10);
    expect(b.hedMgPerKg).toBeCloseTo(a.hedMgPerKg, 10);
  });
  it("gives a dosing volume when a concentration is supplied, and none otherwise", () => {
    expect(run().volumeMl).toBeNull();
    const r = run({ concentrationMgPerMl: 5 });
    expect(r.volumeMl).toBeCloseTo(2, 10);
    expect(r.volumeMlPerKg).toBeCloseTo(10, 10);
  });
  it("shows the same surface-area dose in every species", () => {
    const r = run();
    const mouse = r.acrossSpecies.find((s) => s.id === "mouse")!;
    expect(mouse.mgPerKg).toBeCloseTo(100, 10);
    const human = r.acrossSpecies.find((s) => s.id === "human")!;
    expect(human.mgPerKg).toBeCloseTo(r.hedMgPerKg, 10);
    expect(r.acrossSpecies.length).toBe(SPECIES.length);
    for (const s of r.acrossSpecies) expect(s.mgPerKg * speciesById(s.id).km).toBeCloseTo(r.animalDoseMgPerM2, 8);
  });
  it("names the bad input instead of returning nonsense", () => {
    expect(animalToHuman({ species: "rat", animalKg: 0, dose: 5, doseUnit: "mgPerKg" })).toEqual({ problem: "animalWeight" });
    expect(animalToHuman({ species: "rat", animalKg: 0.2, dose: -1, doseUnit: "mgPerKg" })).toEqual({ problem: "dose" });
    expect(animalToHuman({ species: "rat", animalKg: 0.2, dose: NaN, doseUnit: "mgPerKg" })).toEqual({ problem: "dose" });
    expect(animalToHuman({ species: "rat", animalKg: 0.2, dose: 5, doseUnit: "mgPerKg", humanKg: 0 })).toEqual({ problem: "humanWeight" });
    expect(animalToHuman({ species: "rat", animalKg: 0.2, dose: 5, doseUnit: "mgPerKg", safetyFactor: 0 })).toEqual({ problem: "safetyFactor" });
    expect(animalToHuman({ species: "rat", animalKg: 0.2, dose: 5, doseUnit: "mgPerKg", concentrationMgPerMl: -2 })).toEqual({ problem: "concentration" });
    expect(animalToHuman({ species: "rat", animalKg: Infinity, dose: 5, doseUnit: "mgPerKg" })).toEqual({ problem: "animalWeight" });
  });
});

describe("human to animal calculator", () => {
  it("inverts the animal-to-human conversion", () => {
    const fwd = animalToHuman({ species: "rat", animalKg: 0.25, dose: 30, doseUnit: "mgPerKg", humanKg: 60 });
    if (!("result" in fwd)) throw new Error("x");
    const back = humanToAnimal({ species: "rat", animalKg: 0.25, humanDose: fwd.result.hedMgPerKg, humanDoseUnit: "mgPerKg", humanKg: 60 });
    if (!("result" in back)) throw new Error("x");
    expect(back.result.animalDoseMgPerKg).toBeCloseTo(30, 10);
    expect(back.result.animalDoseMgTotal).toBeCloseTo(7.5, 10);
  });
  it("accepts a total human dose and the person's weight", () => {
    const r = humanToAnimal({ species: "mouse", animalKg: 0.025, humanDose: 600, humanDoseUnit: "mgTotal", humanKg: 60, concentrationMgPerMl: 2 });
    if (!("result" in r)) throw new Error("x");
    expect(r.result.humanDoseMgPerKg).toBe(10);
    expect(r.result.animalDoseMgPerKg).toBeCloseTo(123.333, 3);
    expect(r.result.volumeMl).toBeCloseTo((123.333 * 0.025) / 2, 3);
  });
  it("names bad input", () => {
    expect(humanToAnimal({ species: "rat", animalKg: -1, humanDose: 5, humanDoseUnit: "mgPerKg" })).toEqual({ problem: "animalWeight" });
    expect(humanToAnimal({ species: "rat", animalKg: 0.2, humanDose: 0, humanDoseUnit: "mgPerKg" })).toEqual({ problem: "dose" });
  });
});
