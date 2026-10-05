import { describe, it, expect } from "vitest";
import { ARCHETYPES, defaultDesign, runStudy } from "@eliminate/sim-core";
import { defaultFocusId, defaultSetup, sameSetup, COMPOUNDS } from "./setup";
import { fmt, fmtP, fmtPct, fmtSmart } from "../design/format";
import { GRADE_HEX, gradeVar } from "../design/damage";

describe("default study and focus animal", () => {
  it("defaults to the heart-toxic anticancer compound in tumour-bearing rats, 28 days, 10 per sex per group", () => {
    const s = defaultSetup();
    expect(s.compoundKey).toBe("cardiotoxin");
    expect(s.disease).toBe("cancer");
    expect(s.durationDays).toBe(28);
    expect(s.nPerSex).toBe(10);
  });

  it("focuses the high-dose recovery animal when recovery groups exist, so the timeline covers recovery", () => {
    const withRec = runStudy(defaultDesign(ARCHETYPES.reference!, { nPerSexPerGroup: 2, durationDays: 7, recovery: true, sexes: ["M"], seed: 1 }));
    expect(defaultFocusId(withRec)).toMatch(/^R4-/);
    const noRec = runStudy(defaultDesign(ARCHETYPES.reference!, { nPerSexPerGroup: 2, durationDays: 7, sexes: ["M"], seed: 1 }));
    expect(defaultFocusId(noRec)).toMatch(/^G4-M/);
  });

  it("detects when the setup on screen differs from the setup that ran", () => {
    const a = defaultSetup();
    expect(sameSetup(a, { ...a })).toBe(true);
    expect(sameSetup(a, { ...a, durationDays: 90 })).toBe(false);
    expect(sameSetup(a, null)).toBe(false);
  });

  it("names every compound in plain language without archetype codes", () => {
    for (const c of COMPOUNDS) { expect(c.name).not.toMatch(/·|archetype/i); expect(ARCHETYPES[c.key]).toBeDefined(); }
  });
});

describe("formatting never shows NaN or Infinity", () => {
  it("formats non-finite values as n/a", () => {
    for (const v of [NaN, Infinity, -Infinity, null, undefined]) { expect(fmt(v as number)).toBe("n/a"); expect(fmtSmart(v as number)).toBe("n/a"); expect(fmtPct(v as number)).toBe("n/a"); }
    expect(fmtP(NaN)).toBe("n/a");
    expect(fmtP(0.0001)).toBe("<0.001");
  });
  it("keeps the requested decimals", () => {
    expect(fmt(1.23456, 2)).toMatch(/^1[.,]23$/);
  });
});

describe("damage scale", () => {
  it("has six grades in both palettes and clamps out-of-range grades", () => {
    expect(GRADE_HEX.standard.length).toBe(6);
    expect(GRADE_HEX.cb.length).toBe(6);
    expect(gradeVar(-3)).toBe("var(--g0)");
    expect(gradeVar(9)).toBe("var(--g5)");
  });
});
