import { describe, expect, it } from "vitest";
import { assessSandboxEvidence, referenceCaseForCompound } from "./referenceStudies";

describe("sandbox evidence guard", () => {
  it("never treats a shared organ name as validation", () => {
    const cisplatin = referenceCaseForCompound("nephrotoxin")!;
    const result = assessSandboxEvidence(cisplatin, { route: "oral", durationDays: 28, highDose: 150 });
    expect(result.verdict).toBe("related-question");
    expect(result.detail).toContain("not compare its numbers");
  });

  it("only describes matching route and assessment day as protocol-aligned", () => {
    const acetaminophen = referenceCaseForCompound("hepatotoxin")!;
    const result = assessSandboxEvidence(acetaminophen, { route: "oral", durationDays: 29, highDose: 1000 });
    expect(result.verdict).toBe("protocol-aligned");
    expect(result.detail).toContain("still a prediction");
  });

  it("maps every case to its intended sandbox organ", () => {
    expect(referenceCaseForCompound("hepatotoxin")!.sandboxOrgan).toBe("liver");
    expect(referenceCaseForCompound("nephrotoxin")!.sandboxOrgan).toBe("kidney");
    expect(referenceCaseForCompound("cardiotoxin")!.sandboxOrgan).toBe("heart");
    expect(referenceCaseForCompound("neurotoxin")!.sandboxOrgan).toBe("brain");
    expect(referenceCaseForCompound("myelotoxin")!.sandboxOrgan).toBe("marrow");
  });
});
