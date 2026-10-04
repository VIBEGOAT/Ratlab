import { describe, it, expect } from "vitest";
import { Rk45, makePd, sigmoidEmax, type PdSpec } from "../src";

function run(spec: PdSpec, drive: (t: number) => number, tEnd: number) {
  const pd = makePd(spec);
  const y = new Float64Array(pd.nStates);
  pd.init(y, 0);
  const solver = new Rk45(Math.max(1, pd.nStates));
  const out: Array<{ t: number; e: number }> = [];
  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const t = (tEnd * i) / steps;
    out.push({ t, e: pd.effect(y, 0, drive(t)) });
    if (i === steps) break;
    const t1 = (tEnd * (i + 1)) / steps;
    if (pd.nStates > 0) solver.integrate((tt, yy, dy) => pd.deriv(yy, 0, dy, drive(tt)), y, t, t1, { rtol: 1e-8, atol: 1e-11 });
  }
  return out;
}

describe("sigmoid Emax", () => {
  it("gives half of Emax at EC50 and approaches Emax at high concentration", () => {
    expect(sigmoidEmax(2, 10, 2)).toBeCloseTo(5, 12);
    expect(sigmoidEmax(2, 10, 2, 3)).toBeCloseTo(5, 12);
    expect(sigmoidEmax(1e6, 10, 2)).toBeCloseTo(10, 4);
    expect(sigmoidEmax(0, 10, 2)).toBe(0);
  });
  it("gets steeper with a larger Hill coefficient", () => {
    expect(sigmoidEmax(1, 1, 2, 4)).toBeLessThan(sigmoidEmax(1, 1, 2, 1));
  });
});

describe("effect compartment", () => {
  const spec: PdSpec = { id: "e", label: "e", driver: "plasma", model: { kind: "effect-compartment", ke0: 0.5, emax: 1, ec50: 1 } };
  it("lags a constant drive and converges to the direct effect", () => {
    const out = run(spec, () => 2, 30);
    expect(out[2]!.e).toBeLessThan(sigmoidEmax(2, 1, 1) * 0.5);
    expect(out.at(-1)!.e).toBeCloseTo(sigmoidEmax(2, 1, 1), 5);
  });
});

describe("indirect response models (Dayneka)", () => {
  const base = { kin: 10, kout: 0.5, max: 0.8, c50: 1 };
  const steady = (type: 1 | 2 | 3 | 4, c: number) =>
    run({ id: "i", label: "i", driver: "plasma", model: { kind: "indirect", type, ...base } }, () => c, 80).at(-1)!.e;
  const h = sigmoidEmax(1, 0.8, 1);

  it("starts at baseline kin/kout when there is no drug", () => { expect(steady(1, 0)).toBeCloseTo(20, 6); });
  it("type I (inhibit production) falls to kin(1-h)/kout", () => { expect(steady(1, 1)).toBeCloseTo((10 * (1 - h)) / 0.5, 4); });
  it("type II (inhibit loss) rises to kin/(kout(1-h))", () => { expect(steady(2, 1)).toBeCloseTo(10 / (0.5 * (1 - h)), 4); });
  it("type III (stimulate production) rises to kin(1+h)/kout", () => { expect(steady(3, 1)).toBeCloseTo((10 * (1 + h)) / 0.5, 4); });
  it("type IV (stimulate loss) falls to kin/(kout(1+h))", () => { expect(steady(4, 1)).toBeCloseTo(10 / (0.5 * (1 + h)), 4); });

  it("shows slow onset: the maximal change comes after the drug peak and the response recovers", () => {
    const spec: PdSpec = { id: "i", label: "i", driver: "plasma", model: { kind: "indirect", type: 1, ...base } };
    const out = run(spec, (t) => 5 * Math.exp(-0.8 * t), 30);
    let minI = 0;
    out.forEach((p, i) => { if (p.e < out[minI]!.e) minI = i; });
    expect(out[minI]!.t).toBeGreaterThan(0.5);
    expect(out.at(-1)!.e).toBeCloseTo(20, 1);
  });
});

describe("transit compartments", () => {
  const spec: PdSpec = { id: "t", label: "t", driver: "plasma", model: { kind: "transit", n: 3, ktr: 1, emax: 1, ec50: 1 } };
  it("delays the response and converges to the direct effect", () => {
    const out = run(spec, () => 3, 30);
    expect(out[2]!.e).toBeLessThan(0.05);
    expect(out.at(-1)!.e).toBeCloseTo(sigmoidEmax(3, 1, 1), 5);
  });
});

describe("tolerance", () => {
  const spec: PdSpec = {
    id: "tol", label: "tol", driver: "plasma",
    model: { kind: "sigmoid-emax", emax: 1, ec50: 1 },
    tolerance: { kt: 0.1, alpha: 0.7 },
  };
  it("lets the effect decline under constant exposure and recover after withdrawal", () => {
    const out = run(spec, (t) => (t < 60 ? 5 : 0), 200);
    expect(out.find((p) => p.t >= 55)!.e).toBeLessThan(out[2]!.e * 0.9);
    const pd = makePd(spec);
    const y = new Float64Array(pd.nStates);
    pd.init(y, 0);
    const solver = new Rk45(1);
    solver.integrate((_t, yy, dy) => pd.deriv(yy, 0, dy, 5), y, 0, 60);
    const tolAtEnd = y[0]!;
    expect(tolAtEnd).toBeGreaterThan(0.5);
    solver.integrate((_t, yy, dy) => pd.deriv(yy, 0, dy, 0), y, 60, 200);
    expect(y[0]!).toBeLessThan(tolAtEnd * 0.01);
  });
});
