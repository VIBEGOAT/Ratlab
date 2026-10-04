import { describe, it, expect } from "vitest";
import { SIGNS, evaluateHumaneEndpoint, type Observables, type Sign } from "../src";

function fake(days: number, over: Partial<Record<keyof Observables, Float64Array>> = {}): Observables {
  const z = () => new Float64Array(days + 1);
  const signIntensity = {} as Record<Sign, Float64Array>;
  const signObserved = {} as Record<Sign, Uint8Array>;
  for (const s of SIGNS) { signIntensity[s] = z(); signObserved[s] = new Uint8Array(days + 1); }
  const bw = z().fill(300);
  return {
    days, stepsPerDay: 96, damage: {} as Observables["damage"], bodyWeightG: bw, weightChangeFraction: z(), foodG: z(), waterMl: z(),
    sickness: z(), pain: z(), grimace: z(), cnsEffect: z(), cnsPeak: z(), signIntensity, signObserved, tumorVolume: z(), glucose: z(),
    ...over,
  } as Observables;
}

describe("humane endpoint engine", () => {
  it("returns null for a healthy animal", () => {
    expect(evaluateHumaneEndpoint(fake(28))).toBeNull();
  });

  it("triggers on weight loss measured from the peak weight", () => {
    const bw = new Float64Array(11);
    for (let d = 0; d <= 10; d++) bw[d] = d <= 5 ? 300 + 10 * d : 350 - 14 * (d - 5);
    const e = evaluateHumaneEndpoint(fake(10, { bodyWeightG: bw }))!;
    expect(e.criteria).toContain("weight-loss");
    expect(e.day).toBe(10);
    const justBelow = new Float64Array(11).fill(300);
    justBelow[10] = 241; // 19.7% loss
    expect(evaluateHumaneEndpoint(fake(10, { bodyWeightG: justBelow }))).toBeNull();
    justBelow[10] = 240; // exactly 20%
    expect(evaluateHumaneEndpoint(fake(10, { bodyWeightG: justBelow }))!.day).toBe(10);
  });

  it("triggers on each other criterion on the day it is first met", () => {
    const g = new Float64Array(11); g[6] = 1.6;
    expect(evaluateHumaneEndpoint(fake(10, { grimace: g }))).toMatchObject({ day: 6, criteria: ["grimace"] });
    const s = new Float64Array(11); s[4] = 0.9;
    expect(evaluateHumaneEndpoint(fake(10, { sickness: s }))).toMatchObject({ day: 4, criteria: ["moribund"] });
    const v = new Float64Array(11); v[8] = 2100;
    expect(evaluateHumaneEndpoint(fake(10, { tumorVolume: v }))).toMatchObject({ day: 8, criteria: ["tumor-burden"] });
    const o = fake(10); o.signIntensity.convulsions[3] = 0.95;
    expect(evaluateHumaneEndpoint(o)).toMatchObject({ day: 3, criteria: ["convulsions"] });
  });

  it("reports the earliest day and lists every criterion met that day", () => {
    const g = new Float64Array(11), s = new Float64Array(11);
    g[5] = 1.7; s[5] = 0.9; s[7] = 0.95;
    const e = evaluateHumaneEndpoint(fake(10, { grimace: g, sickness: s }))!;
    expect(e.day).toBe(5);
    expect(e.criteria.sort()).toEqual(["grimace", "moribund"]);
  });

  it("writes the required banner text", () => {
    const v = new Float64Array(11); v[2] = 2500;
    const e = evaluateHumaneEndpoint(fake(10, { tumorVolume: v }))!;
    expect(e.banner).toContain("HUMANE ENDPOINT REACHED");
    expect(e.banner).toContain("euthanised on day 2");
  });
});
