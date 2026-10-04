import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { FIDELITY } from "../src";

describe("generated documents stay in sync", () => {
  it("fidelity-table.md lists every subsystem in the registry", () => {
    const md = readFileSync(new URL("../../../docs/fidelity-table.md", import.meta.url), "utf8");
    for (const f of FIDELITY) expect(md).toContain(f.name);
  });
  it("the expert review checklist covers every reviewer role", () => {
    const md = readFileSync(new URL("../../../docs/expert-review-checklist.md", import.meta.url), "utf8");
    for (const role of ["Toxicologist", "Pathologist", "Pharmacokineticist", "Behavioural neuroscientist", "Biostatistician", "Regulatory affairs"]) expect(md).toContain(`## ${role}`);
  });
});
