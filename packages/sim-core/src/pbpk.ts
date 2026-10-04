import type { Compound } from "./compound";
import type { Physiology, Tissue } from "./physiology";

/**
 * Whole-body flow-limited PBPK, assembled as a linear system dx/dt = A x
 * in drug AMOUNTS (mg). Because the structure is linear for fixed parameters,
 * it is propagated exactly over each time step with a matrix exponential.
 * Sinks (eliminated drug, faeces) are explicit states, so total mass is conserved
 * and every column of A sums to zero (tested).
 *
 * Plasma-equivalent tissue concentration: Ct / Kp, with Ct = amount / volume.
 * Blood leaving a tissue has concentration Ct / Kp * BP.
 */
export const IDX = {
  gutLumen: 0, gut: 1, liver: 2, kidney: 3, heart: 4, brain: 5, lung: 6,
  muscle: 7, fat: 8, marrow: 9, spleen: 10, rest: 11,
  art: 12, ven: 13,
  elimHepatic: 14, elimRenal: 15, fecal: 16,
} as const;
export const N_PK = 17;

export const TISSUE_INDEX: Record<Tissue, number> = {
  gut: IDX.gut, liver: IDX.liver, kidney: IDX.kidney, heart: IDX.heart, brain: IDX.brain,
  lung: IDX.lung, muscle: IDX.muscle, fat: IDX.fat, marrow: IDX.marrow, spleen: IDX.spleen, rest: IDX.rest,
};

export interface ClearanceFactors {
  /** product of DDI, organ-function feedback and any other multiplier on hepatic clearance */
  hepatic: number;
  renal: number;
}

export interface PkRates {
  clHepatic: number; // L/h, effective intrinsic clearance on unbound drug
  clRenal: number; // L/h
}

export function effectiveClearances(phys: Physiology, c: Compound, f: ClearanceFactors): PkRates {
  const sex = phys.sex === "F" ? c.femaleClFactor : 1;
  return {
    clHepatic: c.clIntLPerHPerKg * phys.bwKg * phys.cypFactor * sex * f.hepatic,
    clRenal: c.clRenalLPerHPerKg * phys.bwKg * phys.renalFactor * f.renal,
  };
}

/** Build the rate matrix A (row = to, column = from). */
export function buildRateMatrix(phys: Physiology, c: Compound, f: ClearanceFactors): Float64Array {
  const n = N_PK;
  const A = new Float64Array(n * n);
  const move = (from: number, to: number, rate: number) => {
    if (!(rate > 0)) return;
    A[to * n + from] = A[to * n + from]! + rate;
    A[from * n + from] = A[from * n + from]! - rate;
  };

  const V = phys.vol;
  const Q = phys.flow;
  const qLiver = Q.hepaticArtery + Q.gut + Q.spleen;
  const out = (t: Tissue, q: number) => (q * c.bp) / (V[t] * c.kp[t]);

  // arterial supply to each systemic tissue
  const supply: Array<[number, number]> = [
    [IDX.gut, Q.gut], [IDX.spleen, Q.spleen], [IDX.liver, Q.hepaticArtery], [IDX.kidney, Q.kidney],
    [IDX.heart, Q.heart], [IDX.brain, Q.brain], [IDX.muscle, Q.muscle], [IDX.fat, Q.fat],
    [IDX.marrow, Q.marrow], [IDX.rest, Q.rest],
  ];
  for (const [idx, q] of supply) move(IDX.art, idx, q / phys.volArt);

  // venous return from systemic tissues
  move(IDX.kidney, IDX.ven, out("kidney", Q.kidney));
  move(IDX.heart, IDX.ven, out("heart", Q.heart));
  move(IDX.brain, IDX.ven, out("brain", Q.brain));
  move(IDX.muscle, IDX.ven, out("muscle", Q.muscle));
  move(IDX.fat, IDX.ven, out("fat", Q.fat));
  move(IDX.marrow, IDX.ven, out("marrow", Q.marrow));
  move(IDX.rest, IDX.ven, out("rest", Q.rest));

  // portal circulation
  move(IDX.gut, IDX.liver, out("gut", Q.gut));
  move(IDX.spleen, IDX.liver, out("spleen", Q.spleen));
  move(IDX.liver, IDX.ven, out("liver", qLiver));

  // lungs in series
  move(IDX.ven, IDX.lung, phys.co / phys.volVen);
  move(IDX.lung, IDX.art, out("lung", phys.co));

  // oral absorption
  move(IDX.gutLumen, IDX.gut, c.ka * c.fAbs);
  move(IDX.gutLumen, IDX.fecal, c.ka * (1 - c.fAbs));

  // elimination
  const cl = effectiveClearances(phys, c, f);
  move(IDX.liver, IDX.elimHepatic, (cl.clHepatic * c.fu) / (V.liver * c.kp.liver));
  move(IDX.kidney, IDX.elimRenal, cl.clRenal / (V.kidney * c.kp.kidney));
  return A;
}

/** Plasma concentration (mg/L) from the arterial blood pool. */
export function plasmaConc(x: Float64Array, phys: Physiology, c: Compound): number {
  return x[IDX.art]! / phys.volArt / c.bp;
}

/** Tissue concentration (mg/L tissue). */
export function tissueConc(x: Float64Array, phys: Physiology, t: Tissue): number {
  return x[TISSUE_INDEX[t]]! / phys.vol[t];
}

/** Reactive-metabolite formation per litre of liver, mg/h/L. */
export function reactiveMetaboliteDensity(x: Float64Array, phys: Physiology, c: Compound, f: ClearanceFactors): number {
  const cl = effectiveClearances(phys, c, f);
  const rate = (cl.clHepatic * c.fu * x[IDX.liver]!) / (phys.vol.liver * c.kp.liver);
  return (c.fReactive * rate) / phys.vol.liver;
}

export function totalMass(x: Float64Array): number {
  let s = 0;
  for (let i = 0; i < N_PK; i++) s += x[i]!;
  return s;
}
