/**
 * Pharmacodynamic building blocks.
 *  - sigmoid Emax (direct effect)
 *  - effect compartment (Sheiner et al. 1979)
 *  - indirect response models I to IV (Dayneka, Garg and Jusko 1993)
 *  - transit compartments (delay)
 *  - tolerance (counter-regulation) with rebound after withdrawal
 * Each model is stateful through a slice of a shared state vector so it can be
 * integrated together with the toxicodynamics by the adaptive solver.
 */

export const sigmoidEmax = (c: number, emax: number, ec50: number, hill = 1): number => {
  const x = Math.pow(Math.max(c, 0), hill);
  return (emax * x) / (Math.pow(ec50, hill) + x);
};

export type PdModel =
  | { kind: "sigmoid-emax"; emax: number; ec50: number; hill?: number }
  | { kind: "effect-compartment"; ke0: number; emax: number; ec50: number; hill?: number }
  | { kind: "indirect"; type: 1 | 2 | 3 | 4; kin: number; kout: number; max: number; c50: number; hill?: number }
  | { kind: "transit"; n: number; ktr: number; emax: number; ec50: number; hill?: number };

export interface PdSpec {
  id: string;
  label: string;
  /** which concentration drives the model */
  driver: "plasma" | "brain" | "liver" | "kidney" | "heart";
  model: PdModel;
  /** Optional tolerance: T relaxes toward the current effect fraction; drive is scaled by (1 - alpha*T). */
  tolerance?: { kt: number; alpha: number };
}

export interface PdInstance {
  nStates: number;
  init(y: Float64Array, off: number): void;
  deriv(y: Float64Array, off: number, dy: Float64Array, drive: number): void;
  /** the reported response (a fraction of Emax, or the response variable R for indirect models) */
  effect(y: Float64Array, off: number, drive: number): number;
}

function baseInstance(model: PdModel): PdInstance {
  switch (model.kind) {
    case "sigmoid-emax":
      return {
        nStates: 0,
        init() {},
        deriv() {},
        effect: (_y, _o, c) => sigmoidEmax(c, model.emax, model.ec50, model.hill),
      };
    case "effect-compartment":
      return {
        nStates: 1,
        init: (y, o) => { y[o] = 0; },
        deriv: (y, o, dy, c) => { dy[o] = model.ke0 * (c - y[o]!); },
        effect: (y, o) => sigmoidEmax(y[o]!, model.emax, model.ec50, model.hill),
      };
    case "indirect": {
      const r0 = model.kin / model.kout;
      return {
        nStates: 1,
        init: (y, o) => { y[o] = r0; },
        deriv: (y, o, dy, c) => {
          const h = sigmoidEmax(c, model.max, model.c50, model.hill);
          const R = y[o]!;
          if (model.type === 1) dy[o] = model.kin * (1 - h) - model.kout * R;
          else if (model.type === 2) dy[o] = model.kin - model.kout * (1 - h) * R;
          else if (model.type === 3) dy[o] = model.kin * (1 + h) - model.kout * R;
          else dy[o] = model.kin - model.kout * (1 + h) * R;
        },
        effect: (y, o) => y[o]!,
      };
    }
    case "transit":
      return {
        nStates: model.n,
        init: (y, o) => { for (let i = 0; i < model.n; i++) y[o + i] = 0; },
        deriv: (y, o, dy, c) => {
          dy[o] = model.ktr * (c - y[o]!);
          for (let i = 1; i < model.n; i++) dy[o + i] = model.ktr * (y[o + i - 1]! - y[o + i]!);
        },
        effect: (y, o) => sigmoidEmax(y[o + model.n - 1]!, model.emax, model.ec50, model.hill),
      };
  }
}

/** Wrap a model with optional tolerance. Tolerance adds one state at the end of the slice. */
export function makePd(spec: PdSpec): PdInstance {
  const base = baseInstance(spec.model);
  const tol = spec.tolerance;
  if (!tol) return base;
  const nb = base.nStates;
  const scaled = (y: Float64Array, o: number, c: number) => c * (1 - tol.alpha * Math.min(1, Math.max(0, y[o + nb]!)));
  return {
    nStates: nb + 1,
    init: (y, o) => { base.init(y, o); y[o + nb] = 0; },
    deriv: (y, o, dy, c) => {
      const cs = scaled(y, o, c);
      base.deriv(y, o, dy, cs);
      const e = base.effect(y, o, cs);
      const emax = "emax" in spec.model ? spec.model.emax : "max" in spec.model ? spec.model.max : 1;
      const frac = emax !== 0 ? Math.min(1, Math.max(0, e / emax)) : 0;
      dy[o + nb] = tol.kt * (frac - y[o + nb]!);
    },
    effect: (y, o, c) => base.effect(y, o, scaled(y, o, c)),
  };
}
