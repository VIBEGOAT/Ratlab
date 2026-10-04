import { describe, it, expect } from "vitest";
import {
  ARCHETYPES, DISCLAIMER, SIM_VERSION, analyseEndpoints, defaultDesign, determineNoael, histopathTable, runStudy,
} from "@eliminate/sim-core";
import { parseHistoricalCsv, toCsv } from "./csv";
import { studyToCsv, studyToHtml, studyToJson } from "./export";
import { buildDesign, defaultSetup, designProblems, guidelineChecks } from "./setup";

describe("historical control CSV", () => {
  const head = "dataset,source,strain,sex,ageWeeks,endpoint,n,mean,sd";
  it("parses valid rows", () => {
    const r = parseHistoricalCsv(`${head}\nV1,"Vendor, Inc",SD,M,8,bodyWeightG,300,285,22\nV1,Vendor,SD,F,8,chem.alt,300,40,10`);
    expect(r.errors).toEqual([]);
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]).toMatchObject({ source: "Vendor, Inc", sex: "M", mean: 285, provenance: "real" });
  });
  it("reports missing columns and bad rows without throwing", () => {
    expect(parseHistoricalCsv("a,b\n1,2").errors[0]).toMatch(/Missing column/);
    const r = parseHistoricalCsv(`${head}\nV1,x,SD,Q,8,bodyWeightG,300,285,22\nV1,x,SD,M,8,bodyWeightG,abc,285,22`);
    expect(r.rows.length).toBe(0);
    expect(r.errors.length).toBe(2);
    expect(parseHistoricalCsv("").errors.length).toBe(1);
  });
  it("escapes commas and quotes on output", () => {
    expect(toCsv([{ a: 'x,"y"', b: 1 }])).toBe('a,b\n"x,""y""",1');
  });
});

describe("setup", () => {
  it("builds a valid default design and flags problems", () => {
    const s = defaultSetup();
    expect(designProblems(s)).toEqual([]);
    const d = buildDesign(s);
    expect(d.groups.filter((g) => g.kind === "main").length).toBe(4);
    expect(designProblems({ ...s, sexes: [] }).length).toBeGreaterThan(0);
    expect(designProblems({ ...s, fractions: [0.5, 0.3, 1] }).length).toBeGreaterThan(0);
  });
  it("checks the TG 407 minimum group size using the verified constant", () => {
    const c = (k: string) => ({ "study.tg407.minAnimalsPerGroup": 10, "study.tg407.minDoseGroups": 3 } as Record<string, number>)[k]!;
    const small = guidelineChecks({ ...defaultSetup(), nPerSex: 3 }, c);
    expect(small[0]!.ok).toBe(false);
    expect(guidelineChecks({ ...defaultSetup(), nPerSex: 5 }, c)[0]!.ok).toBe(true);
  });
});

describe("exports", () => {
  const study = runStudy(defaultDesign(ARCHETYPES.hepatotoxin!, { nPerSexPerGroup: 4, durationDays: 14, seed: 3 }));
  const rows = analyseEndpoints(study), histo = histopathTable(study);
  const payload = { study, rows, histo, noael: determineNoael(study, rows, histo) };
  it("writes one CSV row per animal with seed and version", () => {
    const lines = studyToCsv(study).split("\n");
    expect(lines.length).toBe(study.animals.length + 1);
    expect(lines[0]).toContain("simVersion");
    expect(lines[1]).toContain(SIM_VERSION);
  });
  it("writes JSON that includes the disclaimer, seed and fidelity labels", () => {
    const j = JSON.parse(studyToJson(payload));
    expect(j.disclaimer).toBe(DISCLAIMER);
    expect(j.seed).toBe(3);
    expect(j.fidelity.length).toBeGreaterThan(5);
  });
  it("writes a self-contained HTML report with the disclaimer and escapes content", () => {
    const html = studyToHtml(payload);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain(DISCLAIMER);
    expect(html).toContain("NOAEL");
    expect(html).not.toContain("<script");
  });
});
