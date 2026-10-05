import { describe, it, expect } from "vitest";
import {
  ARCHETYPES, analyseEndpoints, defaultDesign, determineNoael, histopathTable, runStudy, relevanceThresholdPct, type StudyDesign,
} from "../src";

const small = (c = ARCHETYPES.hepatotoxin!, over: Partial<Parameters<typeof defaultDesign>[1]> = {}) => defaultDesign(c, { nPerSexPerGroup: 4, durationDays: 14, seed: 9, ...over });

describe("study design and allocation", () => {
  it("builds a control plus three dose groups, with optional recovery and TK satellites", () => {
    const d = defaultDesign(ARCHETYPES.hepatotoxin!, { recovery: true, tk: true, nPerSexPerGroup: 10 });
    expect(d.groups.filter((g) => g.kind === "main").length).toBe(4);
    expect(d.groups.filter((g) => g.kind === "recovery").map((g) => g.id)).toEqual(["R1", "R4"]);
    expect(d.groups.filter((g) => g.kind === "tk").length).toBe(3);
    expect(d.groups[0]!.doseMgPerKg).toBe(0);
    const doses = d.groups.filter((g) => g.kind === "main").map((g) => g.doseMgPerKg);
    expect(doses).toEqual([...doses].sort((a, b) => a - b));
  });

  it("creates the requested number of animals per sex and group, and is deterministic by seed", () => {
    const d = small();
    const a = runStudy(d), b = runStudy(d);
    expect(a.animals.length).toBe(4 * 2 * 4);
    for (const g of d.groups) for (const sex of ["M", "F"]) expect(a.animals.filter((x) => x.group === g.id && x.sex === sex).length).toBe(4);
    expect(a.animals.map((x) => x.endpoints.bodyWeightG)).toEqual(b.animals.map((x) => x.endpoints.bodyWeightG));
    expect(runStudy({ ...d, seed: 10 }).animals[0]!.endpoints.bodyWeightG).not.toBe(a.animals[0]!.endpoints.bodyWeightG);
  });

  it("spreads littermates across groups and gives littermates correlated body weight", () => {
    const d: StudyDesign = { ...small(ARCHETYPES.reference!, { nPerSexPerGroup: 8 }), litterSize: 4, litterCv: { bw: 0.15, cyp: 0.1 } };
    const s = runStudy(d);
    const males = s.animals.filter((a) => a.sex === "M");
    const litters = new Map<string, typeof males>();
    for (const a of males) litters.set(a.litter, [...(litters.get(a.litter) ?? []), a]);
    expect([...litters.values()].some((l) => new Set(l.map((x) => x.group)).size > 1)).toBe(true);
    const wByLitter = [...litters.values()].filter((l) => l.length > 1).map((l) => l.map((x) => x.endpoints.bodyWeightG!));
    const within = wByLitter.reduce((acc, w) => { const m = w.reduce((a, b) => a + b, 0) / w.length; return acc + w.reduce((a, b) => a + (b - m) ** 2, 0); }, 0);
    const all = males.map((a) => a.endpoints.bodyWeightG!);
    const gm = all.reduce((a, b) => a + b, 0) / all.length;
    const total = all.reduce((a, b) => a + (b - gm) ** 2, 0);
    expect(within / total).toBeLessThan(0.95);
  });

  it("schedules recovery animals later and ends humane animals early", () => {
    const d = defaultDesign(ARCHETYPES.cardiotoxin!, { nPerSexPerGroup: 3, durationDays: 28, recovery: true, disease: { cancer: {} }, seed: 4 });
    const s = runStudy(d);
    expect(s.animals.filter((a) => a.kind === "recovery").every((a) => a.scheduledDay === 42)).toBe(true);
    const control = s.animals.filter((a) => a.group === "G1");
    expect(control.some((a) => a.terminalReason === "humane" && a.terminalDay < 28)).toBe(true);
    for (const a of s.animals) if (a.terminalReason === "humane") expect(a.terminalDay).toBeLessThan(a.scheduledDay);
  });
});

describe("study analysis", () => {
  const d = defaultDesign(ARCHETYPES.hepatotoxin!, { nPerSexPerGroup: 8, durationDays: 28, seed: 5 });
  const s = runStudy(d);
  const rows = analyseEndpoints(s);

  it("finds the expected liver signature at the high dose in both sexes", () => {
    for (const sex of ["M", "F"] as const) {
      const alt = rows.find((r) => r.endpoint === "chem.alt" && r.sex === sex && r.groupId === "G4")!;
      expect(alt.significant).toBe(true);
      expect(alt.pctChange).toBeGreaterThan(200);
      expect(alt.trendP).toBeLessThan(0.001);
    }
  });

  it("shows ALT rising with dose", () => {
    const m = ["G2", "G3", "G4"].map((g) => rows.find((r) => r.endpoint === "chem.alt" && r.sex === "M" && r.groupId === g)!.meanTreated);
    expect(m[2]!).toBeGreaterThan(m[1]!);
    expect(m[1]!).toBeGreaterThanOrEqual(m[0]! * 0.8);
  });

  it("reports histopathology incidence with a significant increase in the high group", () => {
    const h = histopathTable(s).find((x) => x.organ === "liver" && x.sex === "M" && x.groupId === "G4")!;
    expect(h.incidenceGrade2).toBeGreaterThan(0);
    expect(h.pAdj).toBeLessThan(0.05);
    const c = histopathTable(s).find((x) => x.organ === "liver" && x.sex === "M" && x.groupId === "G1")!;
    expect(c.incidenceGrade2).toBe(0);
  });

  it("derives NOAEL, LOAEL and MTD", () => {
    const n = determineNoael(s, rows);
    expect(n.loael).toBeCloseTo(d.groups[3]!.doseMgPerKg, 6);
    expect(n.noael).toBeCloseTo(d.groups[2]!.doseMgPerKg, 6);
    expect(n.noaelIsAtLeast).toBe(false);
    expect(n.groups[2]!.reasons.join(" ")).toMatch(/chem\.alt/);
    expect(n.mtd.doseMgPerKg).not.toBeNull();
  });

  it("gives every relevance threshold as a positive percentage", () => {
    for (const e of ["bodyWeightG", "organ.liver.relative", "chem.alt", "heme.rbc", "foodGPerDay", "x"]) expect(relevanceThresholdPct(e)).toBeGreaterThan(0);
  });
});

describe("false positives", () => {
  it("finds no adverse effect when every group receives vehicle", () => {
    const base = defaultDesign(ARCHETYPES.reference!, { nPerSexPerGroup: 8, durationDays: 28, seed: 31 });
    const d: StudyDesign = { ...base, groups: base.groups.map((g) => ({ ...g, doseMgPerKg: 0 })) };
    const s = runStudy(d);
    const n = determineNoael(s);
    expect(n.groups.every((g) => !g.adverse)).toBe(true);
    expect(n.noaelIsAtLeast).toBe(true);
    const rows = analyseEndpoints(s);
    const sig = rows.filter((r) => r.significant).length;
    expect(sig / rows.length).toBeLessThan(0.12);
  });

  it("a well-tolerated compound has no adverse effect up to its top tuned dose", () => {
    const c = ARCHETYPES.reference!;
    const s = runStudy(defaultDesign(c, { nPerSexPerGroup: 8, durationDays: 28, highDoseMgPerKg: c.tunedDoseRange[1], seed: 12 }));
    const n = determineNoael(s);
    expect(n.loael).toBeNull();
    expect(n.noael).toBeCloseTo(c.tunedDoseRange[1], 6);
  });
});

describe("NOAEL in a disease model", () => {
  it("does not call benefit harm: tumour-bearing controls make treated animals look heavier, and that is not adverse", () => {
    const c = ARCHETYPES.cardiotoxin!;
    const s = runStudy(defaultDesign(c, { nPerSexPerGroup: 10, durationDays: 28, seed: 42, disease: { cancer: {} } }));
    const n = determineNoael(s);
    const all = n.groups.flatMap((g) => g.reasons).join(" ");
    expect(all).not.toMatch(/bodyWeightG \([MF]\) \+/);
    expect(all).not.toMatch(/\.absolute/);
    // the real signal is cardiac and only at the top dose
    expect(n.loael).toBeCloseTo(c.defaultDoseMgPerKg, 6);
    expect(n.noael).not.toBeNull();
    expect(n.noael!).toBeLessThan(c.defaultDoseMgPerKg);
    expect(n.groups.at(-1)!.reasons.join(" ")).toMatch(/troponin|chem\.ast|chem\.ck|organ\.heart/);
  }, 60000);
});
