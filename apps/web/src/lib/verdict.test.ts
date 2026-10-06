import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { doseLadder, doseText, studyVerdict } from "./verdict";

const g = (groupId: string, dose: number, adverse: boolean, reasons: string[] = []) => ({ groupId, dose, adverse, reasons });

describe("study verdict", () => {
  it("states the NOAEL and where harm starts, with the first finding in plain words", () => {
    const v = studyVerdict({ noael: 2.4, loael: 8, noaelIsAtLeast: false, groups: [g("G2", 0.8, false), g("G3", 2.4, false), g("G4", 8, true, ["chem.ast (M) +416%"])] });
    expect(v.headline).toBe("No adverse effect up to 2.4 mg/kg/day. Adverse from 8 mg/kg/day.");
    expect(v.reason).toBe("AST (liver and muscle enzyme) in males, up 416%");
    expect(v.tone).toBe("warn");
  });
  it("says so when no dose was adverse", () => {
    const v = studyVerdict({ noael: 8, loael: null, noaelIsAtLeast: true, groups: [g("G2", 0.8, false), g("G4", 8, false)] });
    expect(v.headline).toBe("No adverse effect at any dose tested, up to 8 mg/kg/day.");
    expect(v.tone).toBe("good");
    expect(v.reason).toBeNull();
  });
  it("says so when even the lowest dose was adverse", () => {
    const v = studyVerdict({ noael: null, loael: 0.8, noaelIsAtLeast: false, groups: [g("G2", 0.8, true, ["humane endpoints in 3/20"]), g("G4", 8, true)] });
    expect(v.headline).toBe("Adverse effects even at the lowest dose, 0.8 mg/kg/day.");
    expect(v.reason).toBe("Humane endpoint reached by 3 of 20 animals");
    expect(v.tone).toBe("bad");
  });
  it("formats doses without trailing zeros", () => {
    expect(doseText(2.4)).toBe("2.4");
    expect(doseText(8)).toBe("8");
    expect(doseText(0.75)).toBe("0.75");
    expect(doseText(120)).toBe("120");
    expect(doseText(NaN)).toBe("n/a");
  });
});

describe("dose ladder", () => {
  it("orders control then doses, marks each group, and leaves out satellite groups", () => {
    const groups = [{ id: "G4", label: "High dose", doseMgPerKg: 8, kind: "main" }, { id: "G1", label: "Vehicle control", doseMgPerKg: 0, kind: "main" }, { id: "G2", label: "Low dose", doseMgPerKg: 0.8, kind: "main" }, { id: "T1", label: "TK", doseMgPerKg: 8, kind: "tk" }];
    const steps = doseLadder(groups, [g("G2", 0.8, false), g("G4", 8, true, ["chem.ck (F) +303%"])]);
    expect(steps.map((s) => s.id)).toEqual(["G1", "G2", "G4"]);
    expect(steps.map((s) => s.status)).toEqual(["control", "clear", "adverse"]);
    expect(steps[2]!.finding).toBe("CK (muscle enzyme) in females, up 303%");
  });
  it("works on the real default study", () => {
    const f = JSON.parse(readFileSync(new URL("../prewarm/default.json", import.meta.url), "utf8"));
    const steps = doseLadder(f.payload.study.design.groups, f.payload.noael.groups);
    expect(steps.length).toBe(4);
    expect(steps[0]!.status).toBe("control");
    expect(steps.at(-1)!.status).toBe("adverse");
    const v = studyVerdict(f.payload.noael);
    expect(v.headline).toMatch(/^No adverse effect up to 2\.4 mg\/kg\/day/);
  });
});
