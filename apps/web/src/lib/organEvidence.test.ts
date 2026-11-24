import { describe, expect, it } from "vitest";
import { ORGANS } from "@eliminate/sim-core";
import { ORGAN_EVIDENCE, organPredictionReleased } from "./organEvidence";

describe("organ prediction release gates", () => {
  it("classifies every organ shown in the toxicity interface", () => {
    expect(Object.keys(ORGAN_EVIDENCE).sort()).toEqual([...ORGANS].sort());
  });

  it("releases only organs supported by measurements or an explicit blood proxy", () => {
    expect(ORGANS.filter(organPredictionReleased)).toEqual(["liver", "kidney", "marrow"]);
    expect(ORGAN_EVIDENCE.heart.level).toBe("research");
    expect(ORGAN_EVIDENCE.gut.level).toBe("research");
    expect(ORGAN_EVIDENCE.brain.level).toBe("anatomy");
  });
});
