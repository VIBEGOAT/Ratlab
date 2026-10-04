/**
 * Adaptive Dormand-Prince RK45 integrator for small nonlinear systems
 * (toxicodynamics, PD, disease). Not used for the stiff PBPK block, which is
 * propagated exactly with a matrix exponential (see linalg.ts and pbpk.ts).
 */
export type Deriv = (t: number, y: Float64Array, dy: Float64Array) => void;

export interface OdeOptions {
  rtol?: number;
  atol?: number;
  hInit?: number;
  hMax?: number;
  maxSteps?: number;
}

const A21 = 1 / 5;
const A31 = 3 / 40, A32 = 9 / 40;
const A41 = 44 / 45, A42 = -56 / 15, A43 = 32 / 9;
const A51 = 19372 / 6561, A52 = -25360 / 2187, A53 = 64448 / 6561, A54 = -212 / 729;
const A61 = 9017 / 3168, A62 = -355 / 33, A63 = 46732 / 5247, A64 = 49 / 176, A65 = -5103 / 18656;
const B1 = 35 / 384, B3 = 500 / 1113, B4 = 125 / 192, B5 = -2187 / 6784, B6 = 11 / 84;
// difference between 5th and 4th order weights
const E1 = 71 / 57600, E3 = -71 / 16695, E4 = 71 / 1920, E5 = -17253 / 339200, E6 = 22 / 525, E7 = -1 / 40;

export class Rk45 {
  private readonly n: number;
  private k1: Float64Array; private k2: Float64Array; private k3: Float64Array;
  private k4: Float64Array; private k5: Float64Array; private k6: Float64Array; private k7: Float64Array;
  private yt: Float64Array; private y5: Float64Array;

  constructor(n: number) {
    this.n = n;
    const m = () => new Float64Array(n);
    this.k1 = m(); this.k2 = m(); this.k3 = m(); this.k4 = m(); this.k5 = m(); this.k6 = m(); this.k7 = m();
    this.yt = m(); this.y5 = m();
  }

  /** Integrate y in place from t0 to t1. */
  integrate(f: Deriv, y: Float64Array, t0: number, t1: number, o: OdeOptions = {}): void {
    const n = this.n;
    const rtol = o.rtol ?? 1e-6;
    const atol = o.atol ?? 1e-9;
    const maxSteps = o.maxSteps ?? 200000;
    const span = t1 - t0;
    if (span <= 0) return;
    const hMax = o.hMax ?? span;
    let h = Math.min(o.hInit ?? span / 10, span);
    let t = t0;
    let steps = 0;
    const { k1, k2, k3, k4, k5, k6, k7, yt, y5 } = this;

    f(t, y, k1);
    while (t < t1 - 1e-13 * Math.max(1, Math.abs(t1))) {
      if (t + h > t1) h = t1 - t;
      for (let i = 0; i < n; i++) yt[i] = y[i]! + h * A21 * k1[i]!;
      f(t + h / 5, yt, k2);
      for (let i = 0; i < n; i++) yt[i] = y[i]! + h * (A31 * k1[i]! + A32 * k2[i]!);
      f(t + (3 * h) / 10, yt, k3);
      for (let i = 0; i < n; i++) yt[i] = y[i]! + h * (A41 * k1[i]! + A42 * k2[i]! + A43 * k3[i]!);
      f(t + (4 * h) / 5, yt, k4);
      for (let i = 0; i < n; i++) yt[i] = y[i]! + h * (A51 * k1[i]! + A52 * k2[i]! + A53 * k3[i]! + A54 * k4[i]!);
      f(t + (8 * h) / 9, yt, k5);
      for (let i = 0; i < n; i++) yt[i] = y[i]! + h * (A61 * k1[i]! + A62 * k2[i]! + A63 * k3[i]! + A64 * k4[i]! + A65 * k5[i]!);
      f(t + h, yt, k6);
      for (let i = 0; i < n; i++) y5[i] = y[i]! + h * (B1 * k1[i]! + B3 * k3[i]! + B4 * k4[i]! + B5 * k5[i]! + B6 * k6[i]!);
      f(t + h, y5, k7);

      let err = 0;
      for (let i = 0; i < n; i++) {
        const e = h * (E1 * k1[i]! + E3 * k3[i]! + E4 * k4[i]! + E5 * k5[i]! + E6 * k6[i]! + E7 * k7[i]!);
        const sc = atol + rtol * Math.max(Math.abs(y[i]!), Math.abs(y5[i]!));
        err += (e / sc) * (e / sc);
      }
      err = Math.sqrt(err / n);

      if (err <= 1) {
        t += h;
        for (let i = 0; i < n; i++) y[i] = y5[i]!;
        // FSAL: k7 is the derivative at the new point
        k1.set(k7);
      }
      const fac = err === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * Math.pow(err, -0.2)));
      h = Math.min(h * fac, hMax);
      if (++steps > maxSteps) throw new Error("Rk45: maximum steps exceeded");
    }
  }
}
