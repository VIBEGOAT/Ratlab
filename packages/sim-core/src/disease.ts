import { Rng } from "./rng";
import { constant } from "./reference";

/**
 * Switchable disease overlays that share the toxicodynamic state vector.
 *
 * Cancer (xenograft): Gompertz growth (Laird 1964) of a sensitive and a resistant
 * population. Drug kill acts on the sensitive population by a saturating
 * (Emax-type) log-cell-kill rate. Resistant clones arise from sensitive cells at a
 * small rate, so tumors can regrow under therapy.
 *
 * Diabetes: STZ-like (fast) or type-2-like (slow) hyperglycaemia, an HbA1c-like slow
 * marker, and complications (nephropathy, neuropathy, cataract) driven by sustained
 * hyperglycaemia. Nephropathy sensitises the kidney to nephrotoxins.
 *
 * Other modules (CKD, NASH, heart failure, neurodegeneration, sepsis-like response)
 * are not implemented. Add them by returning another DiseaseInstance.
 */

export interface CancerConfig { v0Mm3?: number }
export interface DiabetesConfig { kind: "stz" | "type2"; severity: number; onsetDay?: number }
export interface DiseaseConfig { cancer?: CancerConfig; diabetes?: DiabetesConfig }
export interface Efficacy { kmaxPerH: number; ec50: number; hill: number }

export interface DiseaseInstance {
  nStates: number;
  init(y: Float64Array, off: number): void;
  deriv(tH: number, y: Float64Array, off: number, dy: Float64Array, plasmaC: number): void;
  /** named outputs, all in natural units */
  read(y: Float64Array, off: number): DiseaseReading;
}

export interface DiseaseReading {
  tumorVolume: number;
  tumorResistantFraction: number;
  glucose: number;
  hba1c: number;
  nephropathy: number;
  neuropathy: number;
  cataract: number;
}

export const DISEASE_SERIES: ReadonlyArray<keyof DiseaseReading> = [
  "tumorVolume", "tumorResistantFraction", "glucose", "hba1c", "nephropathy", "neuropathy", "cataract",
];

export const EMPTY_READING: DiseaseReading = {
  tumorVolume: 0, tumorResistantFraction: 0, glucose: constant("rat.clinchem.glucose.mean"),
  hba1c: constant("disease.diabetes.hba1cBase"), nephropathy: 0, neuropathy: 0, cataract: 0,
};

export function makeDisease(cfg: DiseaseConfig | undefined, eff: Efficacy | undefined, rng: Rng): DiseaseInstance | null {
  if (!cfg || (!cfg.cancer && !cfg.diabetes)) return null;

  // ---- individual parameters (drawn once, so treated and untreated twins share them)
  const r = rng.fork("disease");
  const hasC = !!cfg.cancer;
  const hasD = !!cfg.diabetes;
  const growth = (constant("disease.tumor.growthPerDay") / 24) * r.lognormalFactor(0.25);
  const vmax = constant("disease.tumor.vmax") * r.lognormalFactor(0.1);
  const v0 = (cfg.cancer?.v0Mm3 ?? constant("disease.tumor.v0")) * r.lognormalFactor(0.1);
  const mu = (constant("disease.tumor.resistanceRatePerDay") / 24) * r.lognormalFactor(0.5);
  const kScale = r.lognormalFactor(0.2);
  const sev = Math.min(1, (cfg.diabetes?.severity ?? 0) * r.lognormalFactor(0.1));

  const gBase = constant("rat.clinchem.glucose.mean");
  const gMax = constant("disease.diabetes.glucoseMax");
  const aBase = constant("disease.diabetes.hba1cBase");
  const aPer = constant("disease.diabetes.hba1cPerMgDl");
  const aTau = constant("disease.diabetes.hba1cTauDays") * 24;
  const t2Tau = constant("disease.diabetes.type2RampTauDays");
  const nThr = constant("disease.diabetes.nephropathyThreshold"), nK = constant("disease.diabetes.nephropathyRatePerH");
  const pThr = constant("disease.diabetes.neuropathyThreshold"), pK = constant("disease.diabetes.neuropathyRatePerH");
  const cK = constant("disease.diabetes.cataractRatePerH");

  // state layout: [Vs, Vr] (if cancer) then [G, A, N, Np, Cat] (if diabetes)
  const iC = 0;
  const iD = hasC ? 2 : 0;
  const n = (hasC ? 2 : 0) + (hasD ? 5 : 0);

  return {
    nStates: n,
    init(y, o) {
      if (hasC) { y[o + iC] = v0; y[o + iC + 1] = 0; }
      if (hasD) { y[o + iD] = gBase; y[o + iD + 1] = aBase; y[o + iD + 2] = 0; y[o + iD + 3] = 0; y[o + iD + 4] = 0; }
    },
    deriv(tH, y, o, dy, C) {
      if (hasC) {
        const Vs = Math.max(0, y[o + iC]!), Vr = Math.max(0, y[o + iC + 1]!);
        const V = Math.max(1e-6, Vs + Vr);
        const g = growth * Math.log(vmax / V);
        let kill = 0;
        if (eff && C > 0) {
          const x = Math.pow(C, eff.hill);
          kill = eff.kmaxPerH * kScale * x / (Math.pow(eff.ec50, eff.hill) + x);
        }
        dy[o + iC] = Vs * (g - kill) - mu * Vs;
        dy[o + iC + 1] = Vr * g + mu * Vs;
      }
      if (hasD) {
        const day = tH / 24 - (cfg.diabetes!.onsetDay ?? 0);
        const ramp = day <= 0 ? 0 : cfg.diabetes!.kind === "stz" ? 1 - Math.exp(-day / 1.0) : 1 - Math.exp(-day / t2Tau);
        const gTarget = gBase + sev * (gMax - gBase) * ramp;
        const G = y[o + iD]!, A = y[o + iD + 1]!, N = y[o + iD + 2]!, Np = y[o + iD + 3]!, Cat = y[o + iD + 4]!;
        dy[o + iD] = (gTarget - G) / 24;
        dy[o + iD + 1] = (aBase + aPer * Math.max(0, G - gBase) - A) / aTau;
        dy[o + iD + 2] = nK * Math.max(0, G / nThr - 1) * (1 - N);
        dy[o + iD + 3] = pK * Math.max(0, G / pThr - 1) * (1 - Np);
        dy[o + iD + 4] = cK * Math.max(0, A - 6.5) * (1 - Cat);
      }
    },
    read(y, o) {
      const out: DiseaseReading = { ...EMPTY_READING };
      if (hasC) {
        const Vs = Math.max(0, y[o + iC]!), Vr = Math.max(0, y[o + iC + 1]!);
        out.tumorVolume = Vs + Vr;
        out.tumorResistantFraction = Vs + Vr > 0 ? Vr / (Vs + Vr) : 0;
      }
      if (hasD) {
        out.glucose = y[o + iD]!; out.hba1c = y[o + iD + 1]!;
        out.nephropathy = Math.min(1, Math.max(0, y[o + iD + 2]!));
        out.neuropathy = Math.min(1, Math.max(0, y[o + iD + 3]!));
        out.cataract = Math.min(1, Math.max(0, y[o + iD + 4]!));
      }
      return out;
    },
  };
}

/** Diabetic kidneys are more sensitive to nephrotoxins: lower threshold and faster injury. */
export function kidneySensitivity(nephropathy: number): { thrScale: number; kinjScale: number } {
  return { thrScale: 1 / (1 + 1.5 * nephropathy), kinjScale: 1 + nephropathy };
}
