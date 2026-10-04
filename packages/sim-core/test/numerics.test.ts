import { describe, it, expect } from "vitest";
import { Rk45 } from "../src/ode";
import { expm, identity, matMul } from "../src/linalg";

describe("Rk45", () => {
  it("integrates exponential decay accurately", () => {
    const y = new Float64Array([1]);
    new Rk45(1).integrate((_t, yy, dy) => { dy[0] = -yy[0]!; }, y, 0, 5, { rtol: 1e-9, atol: 1e-12 });
    expect(Math.abs(y[0]! - Math.exp(-5)) / Math.exp(-5)).toBeLessThan(1e-7);
  });

  it("conserves the energy of a harmonic oscillator", () => {
    const y = new Float64Array([1, 0]);
    new Rk45(2).integrate((_t, yy, dy) => { dy[0] = yy[1]!; dy[1] = -yy[0]!; }, y, 0, 20, { rtol: 1e-9, atol: 1e-12 });
    expect(y[0]! ** 2 + y[1]! ** 2).toBeCloseTo(1, 6);
    expect(y[0]!).toBeCloseTo(Math.cos(20), 6);
  });

  it("handles a zero-length interval", () => {
    const y = new Float64Array([3]);
    new Rk45(1).integrate(() => { throw new Error("should not be called"); }, y, 1, 1);
    expect(y[0]).toBe(3);
  });
});

describe("expm", () => {
  it("matches the exponential of a diagonal matrix", () => {
    const A = new Float64Array([-1, 0, 0, -3]);
    const E = expm(A, 2, 0.7);
    expect(E[0]).toBeCloseTo(Math.exp(-0.7), 12);
    expect(E[3]).toBeCloseTo(Math.exp(-2.1), 12);
    expect(E[1]).toBe(0);
  });

  it("gives a rotation for an antisymmetric generator", () => {
    const A = new Float64Array([0, -1, 1, 0]);
    const E = expm(A, 2, 1.3);
    expect(E[0]).toBeCloseTo(Math.cos(1.3), 12);
    expect(E[2]).toBeCloseTo(Math.sin(1.3), 12);
  });

  it("is the identity at t = 0 and satisfies the semigroup property", () => {
    const A = new Float64Array([-2, 1, 0.5, -1]);
    const I = expm(A, 2, 0);
    expect(I[0]).toBeCloseTo(1, 14);
    const a = matMul(expm(A, 2, 0.3), expm(A, 2, 0.5), 2);
    const b = expm(A, 2, 0.8);
    for (let i = 0; i < 4; i++) expect(a[i]).toBeCloseTo(b[i]!, 12);
    expect(identity(2)[3]).toBe(1);
  });

  it("stays accurate for large norms (stiff rates)", () => {
    const A = new Float64Array([-700, 0, 700, -0.1]);
    const E = expm(A, 2, 0.25);
    expect(E[0]!).toBeCloseTo(Math.exp(-175), 12);
    expect(E[3]!).toBeCloseTo(Math.exp(-0.025), 12);
  });
});
