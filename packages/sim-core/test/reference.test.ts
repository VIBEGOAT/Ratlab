import { describe, it, expect } from "vitest";
import {
  validateReferenceData, constant, CONSTANTS, REFERENCES,
  listUnverifiedConstants, listUnverifiedReferences, FIDELITY, DISCLAIMER, SIM_VERSION,
} from "../src";

describe("reference data schema", () => {
  it("has no schema problems", () => {
    expect(validateReferenceData()).toEqual([]);
  });

  it("throws on an unknown constant key", () => {
    expect(() => constant("rat.organVolume.nonsense")).toThrow();
  });

  it("reads a known verified constant", () => {
    expect(constant("rat.organVolume.kidney")).toBeCloseTo(0.0073, 6);
    expect(CONSTANTS["rat.organVolume.kidney"]?.status).toBe("VERIFIED");
  });

  it("every UNVERIFIED constant is documented in needs-expert-check.md", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const md = fs.readFileSync(path.resolve(path.dirname((await import("node:url")).fileURLToPath(import.meta.url)), "../../../data/needs-expert-check.md"), "utf8");
    const missing = [...listUnverifiedConstants(), ...listUnverifiedReferences()].filter((k) => !md.includes(k));
    expect(missing).toEqual([]);
  });

  it("has no fabricated-looking duplicates and at least 20 references", () => {
    expect(new Set(REFERENCES.map((r) => r.id)).size).toBe(REFERENCES.length);
    expect(REFERENCES.length).toBeGreaterThanOrEqual(20);
  });
});

describe("fidelity registry", () => {
  it("uses only allowed labels and gives a justification for each subsystem", () => {
    for (const f of FIDELITY) {
      expect(["MECHANISTIC", "SEMI-QUANTITATIVE", "ILLUSTRATIVE"]).toContain(f.label);
      expect(f.justification.length).toBeGreaterThan(10);
    }
  });
  it("behaviour is never labelled above ILLUSTRATIVE", () => {
    expect(FIDELITY.find((f) => f.id === "behaviour")?.label).toBe("ILLUSTRATIVE");
  });
  it("exposes the disclaimer and a version", () => {
    expect(DISCLAIMER).toMatch(/Not validated/);
    expect(SIM_VERSION).toBeTruthy();
  });
});
