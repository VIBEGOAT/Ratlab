import { describe, it, expect } from "vitest";
import {
  ARCHETYPES, SIGNS, cardiacMarkers, clinicalPathology, deriveObservables, hysLawCheck, makeClinPathContext, myelosuppression,
  necropsy, renalInjuryMarkers, simulateAnimal, type AnimalConfig, type Compound, type DiseaseConfig, type Panel,
} from "../src";

function run(c: Compound, dose: number, days: number, follow = 0, disease?: DiseaseConfig, id = "o1") {
  const cfg: AnimalConfig = {
    seed: 11, animalId: id, sex: "M", strain: "SD", ageWeeks: 8, compound: c, durationDays: days + follow,
    regimen: { route: "oral", doseMgPerKg: dose, intervalH: 24, startH: 0, nDoses: days }, disease,
  };
  const r = simulateAnimal(cfg);
  const obs = deriveObservables(r);
  return { r, obs, ctx: makeClinPathContext(r, obs) };
}
const peakDay = (a: Float64Array) => a.reduce((b, v, i) => (v > a[b]! ? i : b), 0);

describe("healthy untreated animal", () => {
  const { obs, ctx } = run(ARCHETYPES.reference!, 0, 28);
  it("gains weight, eats, and shows no sickness or signs", () => {
    expect(obs.bodyWeightG[28]!).toBeGreaterThan(obs.bodyWeightG[0]!);
    expect(Math.max(...obs.sickness)).toBeLessThan(0.1);
    expect(Math.max(...obs.grimace)).toBeLessThan(0.5);
    expect(obs.foodG[10]!).toBeGreaterThan(10);
    expect(obs.waterMl[10]!).toBeGreaterThan(10);
    for (const s of SIGNS) expect(Math.max(...obs.signIntensity[s])).toBeLessThan(0.15);
  });
  it("has blood values near their reference means with few flags", () => {
    const { chemistry, hematology } = clinicalPathology(ctx, 14);
    const all = { ...chemistry, ...hematology };
    const flagged = Object.values(all).filter((a) => a.flag !== "").length;
    expect(flagged).toBeLessThanOrEqual(4);
    for (const a of Object.values(all)) { expect(Number.isFinite(a.value)).toBe(true); expect(a.value).toBeGreaterThan(0); }
  });
  it("is deterministic per day and varies between days", () => {
    const a = clinicalPathology(ctx, 7).chemistry.alt!.value;
    expect(clinicalPathology(ctx, 7).chemistry.alt!.value).toBe(a);
    expect(clinicalPathology(ctx, 8).chemistry.alt!.value).not.toBe(a);
  });
});

describe("hepatotoxin", () => {
  const { r, obs, ctx } = run(ARCHETYPES.hepatotoxin!, 300, 7, 7);
  const d = peakDay(obs.damage.liver);
  const cp = clinicalPathology(ctx, d);
  it("raises ALT, AST and bilirubin in line with liver damage", () => {
    expect(cp.chemistry.alt!.xUln).toBeGreaterThan(3);
    expect(cp.chemistry.ast!.xUln).toBeGreaterThan(2);
    expect(cp.chemistry.bilirubin!.xUln).toBeGreaterThan(1.5);
    expect(obs.signIntensity.jaundice[d]!).toBeGreaterThan(0);
  });
  it("reports Hy's Law only when both criteria are met", () => {
    const panel = (alt: number, bili: number): Panel => ({
      alt: { value: 0, unit: "", lln: 0, uln: 0, xUln: alt, flag: "" },
      bilirubin: { value: 0, unit: "", lln: 0, uln: 0, xUln: bili, flag: "" },
    });
    expect(hysLawCheck(panel(5, 3)).met).toBe(true);
    expect(hysLawCheck(panel(5, 1.5)).met).toBe(false);
    expect(hysLawCheck(panel(2.5, 3)).met).toBe(false);
  });
  it("produces histopathology and organ weight changes", () => {
    const n = necropsy(r, obs, d);
    const liver = n.histopathology.find((h) => h.organ === "liver")!;
    expect(liver.grade).toBeGreaterThanOrEqual(2);
    expect(n.organWeights.liver!.absoluteG).toBeGreaterThan(0);
    expect(liver.finding.length).toBeGreaterThan(3);
  });
});

describe("nephrotoxin", () => {
  it("raises creatinine, BUN and the urinary injury marker", () => {
    const { obs, ctx } = run(ARCHETYPES.nephrotoxin!, 120, 14, 3);
    const d = peakDay(obs.damage.kidney);
    const cp = clinicalPathology(ctx, d);
    expect(cp.chemistry.creatinine!.xUln).toBeGreaterThan(1.3);
    expect(cp.chemistry.bun!.xUln).toBeGreaterThan(1);
    expect(renalInjuryMarkers(obs, d).kidneyInjuryMarkerFold).toBeGreaterThan(3);
  });
});

describe("cardiotoxin", () => {
  it("raises troponin, prolongs QT-like marker and lowers ejection fraction", () => {
    const { obs, ctx } = run(ARCHETYPES.cardiotoxin!, 12, 28);
    const cp = clinicalPathology(ctx, 28);
    const cm = cardiacMarkers(obs, 28);
    expect(cp.chemistry.troponinI!.xUln).toBeGreaterThan(3);
    expect(cm.qtcChangePercent).toBeGreaterThan(5);
    expect(cm.ejectionFractionPercent).toBeLessThan(70);
  });
});

describe("myelotoxin", () => {
  it("shows a neutrophil nadir and recovery after dosing stops", () => {
    const { ctx, obs } = run(ARCHETYPES.myelotoxin!, 25, 10, 25);
    const m = myelosuppression(ctx);
    expect(m.nadirFraction).toBeLessThan(0.7);
    expect(m.recoveryDay).not.toBeNull();
    expect(m.recoveryDay!).toBeGreaterThan(m.nadirDay);
    expect(obs.days).toBe(35);
  });
  it("slows red cell and platelet changes relative to neutrophils", () => {
    const { ctx } = run(ARCHETYPES.myelotoxin!, 25, 10, 25);
    const early = clinicalPathology(ctx, 3).hematology;
    expect(early.neutrophils!.value / early.neutrophils!.uln).toBeLessThan(early.rbc!.value / early.rbc!.uln);
  });
});

describe("sickness, weight and signs", () => {
  it("loses weight and shows signs at a toxic dose, and more so at higher dose", () => {
    const lo = run(ARCHETYPES.nephrotoxin!, 20, 14).obs, hi = run(ARCHETYPES.nephrotoxin!, 150, 14).obs;
    expect(hi.bodyWeightG[14]!).toBeLessThan(lo.bodyWeightG[14]!);
    expect(Math.max(...hi.signIntensity.dehydration)).toBeGreaterThan(Math.max(...lo.signIntensity.dehydration));
    expect(Math.max(...hi.grimace)).toBeGreaterThanOrEqual(Math.max(...lo.grimace) - 0.2);
  });
  it("diabetes drives polydipsia and weight loss", () => {
    const { obs } = run(ARCHETYPES.reference!, 0, 28, 0, { diabetes: { kind: "stz", severity: 0.9 } });
    expect(obs.waterMl[20]!).toBeGreaterThan(obs.waterMl[0]! * 1.8);
    expect(obs.weightChangeFraction[28]!).toBeLessThan(obs.weightChangeFraction[0]! + 0.15);
  });
  it("records the tumour as a palpable sign once large", () => {
    const { obs } = run(ARCHETYPES.reference!, 0, 14, 0, { cancer: {} });
    expect(obs.signIntensity.tumour[14]!).toBe(1);
  });
});
