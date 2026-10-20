import { describe, expect, it } from "vitest";
import { BASE, EXPERIMENTS, simulate } from "./model";
import { emptyNotebook, parseNotebook, reportHtml } from "./notebook";

describe("teaching pharmacokinetics", () => {
  it("has the analytic single-dose half-life and total exposure limit", () => {
    const r = simulate(BASE);
    expect(r.halfLife).toBeCloseTo(Math.log(2) / 0.2, 10);
    expect(r.auc).toBeCloseTo(0.8 * 10 / 0.2, 3);
    expect(r.values[0]).toBe(0);
    expect(r.values.every((x) => Number.isFinite(x) && x >= 0)).toBe(true);
  });
  it("doubles concentrations and AUC with dose, not half-life", () => {
    const a = simulate(BASE), b = simulate({ ...BASE, dose: 20 });
    expect(b.auc / a.auc).toBeCloseTo(2, 12);
    expect(b.halfLife).toBe(a.halfLife);
    a.values.forEach((v, i) => expect(b.values[i]).toBeCloseTo(v * 2, 10));
  });
  it("agrees with independently integrated concentrations, including equal absorption and elimination rates", () => {
    for (const clearance of [0.1, 0.2, 1, 2]) {
      const r = simulate({ ...BASE, clearance, repeated: true, interval: 12 });
      const trapezoid = r.values.slice(1).reduce((sum, c, i) => sum + (c + r.values[i]!) * 0.05, 0);
      expect(Math.abs(trapezoid - r.auc) / r.auc).toBeLessThan(0.002);
      expect(r.values.every((x) => Number.isFinite(x) && x >= 0)).toBe(true);
    }
  });
  it("keeps dose timing and dose-rate comparisons explicit", () => {
    const e = EXPERIMENTS[2];
    const a = simulate(e.control), b = simulate(e.treatment);
    expect(a.doses).toEqual([0, 24, 48]);
    expect(b.doses).toEqual([0, 12, 24, 36, 48, 60]);
    expect(b.totalDose).toBe(2 * a.totalDose);
    expect(b.halfLife).toBe(a.halfLife);
    expect(b.steadyAverage! / a.steadyAverage!).toBeCloseTo(2);
  });
  it("rejects invalid inputs instead of generating misleading curves", () => {
    for (const clearance of [0, -1, NaN, Infinity]) expect(() => simulate({ ...BASE, clearance })).toThrow();
    expect(() => simulate({ ...BASE, interval: 0 })).toThrow();
  });
});
describe("student notebooks", () => {
  it("recovers safely from stale or malformed storage", () => {
    for (const raw of [null, "broken", "null", '{"version":2}']) expect(parseNotebook(raw)).toEqual(emptyNotebook());
    const n = parseNotebook(JSON.stringify({ version: 1, entries: { dose: { prediction: "invalid", reflection: "x" } }, answers: [99], submitted: true }));
    expect(n.entries).toEqual({});
    expect(n.submitted).toBe(false);
  });
  it("retains predictions and escapes user reflections in standalone reports", () => {
    const n = emptyNotebook();
    n.entries.dose = { prediction: "lower", reflection: '<script>alert("x")</script>' };
    const restored = parseNotebook(JSON.stringify(n));
    expect(restored.entries.dose).toEqual(n.entries.dose);
    const html = reportHtml(restored);
    expect(html).toContain("Initial prediction: lower");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("in progress");
  });
});
