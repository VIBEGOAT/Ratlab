/**
 * Organ toxicodynamics.
 * For each organ three states:
 *   D   damage in [0,1]
 *   Def defence capacity in [0,1] (for example glutathione); 1 is intact
 *   Ad  adaptation (raises the effective threshold)
 *
 *   thrEff = thr * (1 + Ad)
 *   x      = max(0, E / thrEff - 1)           exposure above threshold
 *   sat    = x / (1 + x)                      saturating dose-response
 *   gate   = g0 + (1 - g0) * (1 - Def)        injury needs depleted defences unless g0 = 1
 *   dD/dt  = kinj * sat * gate * (1 - D) - kreg * D
 *   dDef/dt= kdefSyn * (1 - Def) - kdefUse * (E / thr) * Def
 *   dAd/dt = kad * sat * (adMax - Ad) - kadDecay * Ad
 *
 * E is the exposure driver: unbound tissue concentration, or reactive-metabolite
 * formation per litre of liver (see compound.td[organ].driver).
 * All rates are per hour. Parameters are archetype values, not fitted to data.
 */

export const ORGANS = ["liver", "kidney", "heart", "brain", "gut", "marrow"] as const;
export type Organ = (typeof ORGANS)[number];

export interface TdOrganParams {
  driver: "conc" | "reactive";
  thr: number;
  kinj: number;
  kreg: number;
  kdefUse: number;
  kdefSyn: number;
  /** baseline susceptibility: 1 means no defence gating */
  gate0: number;
  kad: number;
  kadDecay: number;
  adMax: number;
}

export const TD_STATES_PER_ORGAN = 3;

export function tdDeriv(p: TdOrganParams, E: number, y: Float64Array, off: number, dy: Float64Array): void {
  const D = y[off]!, Def = y[off + 1]!, Ad = y[off + 2]!;
  const thrEff = p.thr * (1 + Ad);
  const x = Math.max(0, E / thrEff - 1);
  const sat = x / (1 + x);
  const gate = p.gate0 + (1 - p.gate0) * (1 - Def);
  dy[off] = p.kinj * sat * gate * (1 - D) - p.kreg * D;
  dy[off + 1] = p.kdefSyn * (1 - Def) - p.kdefUse * (E / p.thr) * Def;
  dy[off + 2] = p.kad * sat * (p.adMax - Ad) - p.kadDecay * Ad;
}

export function tdInit(y: Float64Array, off: number): void {
  y[off] = 0;
  y[off + 1] = 1;
  y[off + 2] = 0;
}

/** Pathology grade 0 to 5 from damage D. */
export const GRADE_CUTS = [0.05, 0.15, 0.3, 0.5, 0.75] as const;
export function gradeFromDamage(D: number): 0 | 1 | 2 | 3 | 4 | 5 {
  let g = 0;
  for (const c of GRADE_CUTS) if (D >= c) g++;
  return g as 0 | 1 | 2 | 3 | 4 | 5;
}

export const GRADE_SEVERITY = ["none", "minimal", "mild", "moderate", "marked", "severe"] as const;

/** Finding names by organ and grade. Illustrative vocabulary, to be reviewed by a pathologist. */
export const FINDINGS: Record<Organ, readonly [string, string, string, string, string, string]> = {
  liver: ["No finding", "Hepatocellular vacuolation", "Single-cell hepatocyte necrosis", "Centrilobular necrosis", "Bridging necrosis", "Massive hepatic necrosis"],
  kidney: ["No finding", "Tubular basophilia", "Tubular degeneration", "Tubular necrosis", "Extensive tubular necrosis with casts", "Cortical necrosis"],
  heart: ["No finding", "Myocyte vacuolation", "Myocardial degeneration", "Myocardial necrosis with inflammation", "Extensive myocardial necrosis and fibrosis", "Diffuse cardiomyopathy"],
  brain: ["No finding", "Neuronal chromatolysis", "Single-neuron necrosis", "Multifocal neuronal necrosis", "Extensive neuronal loss", "Diffuse neuronal necrosis"],
  gut: ["No finding", "Villous blunting", "Mucosal atrophy", "Mucosal erosion", "Ulceration", "Transmural necrosis"],
  marrow: ["No finding", "Mild hypocellularity", "Hypocellularity", "Marked hypocellularity", "Severe hypocellularity, aplasia risk", "Marrow aplasia"],
};
