import { Rng } from "./rng";
import { constant } from "./reference";

export type Sex = "M" | "F";
export type Strain = "SD" | "WI";

/** Tissue compartments of the PBPK model (blood pools and sinks are handled in pbpk.ts). */
export const TISSUES = ["gut", "liver", "kidney", "heart", "brain", "lung", "muscle", "fat", "marrow", "spleen", "rest"] as const;
export type Tissue = (typeof TISSUES)[number];

export interface Physiology {
  sex: Sex;
  strain: Strain;
  ageWeeks: number;
  bwKg: number;
  /** tissue volumes, L (density 1 kg/L) */
  vol: Record<Tissue, number>;
  volArt: number;
  volVen: number;
  /** blood flows, L/h */
  flow: {
    gut: number; spleen: number; hepaticArtery: number; kidney: number; heart: number;
    brain: number; muscle: number; fat: number; marrow: number; rest: number;
  };
  /** cardiac output, L/h */
  co: number;
  /** individual multipliers (mean 1) */
  cypFactor: number;
  renalFactor: number;
}

export interface PhysiologyInput {
  sex: Sex;
  strain: Strain;
  ageWeeks: number;
  rng: Rng;
}

const ORGAN_FRACTION: Record<Exclude<Tissue, "rest">, string> = {
  gut: "rat.organVolume.gut", liver: "rat.organVolume.liver", kidney: "rat.organVolume.kidney",
  heart: "rat.organVolume.heart", brain: "rat.organVolume.brain", lung: "rat.organVolume.lung",
  muscle: "rat.organVolume.muscle", fat: "rat.organVolume.fat", marrow: "rat.organVolume.boneMarrow",
  spleen: "rat.organVolume.spleen",
};

export function meanBodyWeightG(sex: Sex, strain: Strain, ageWeeks: number): number {
  let w = constant("rat.bodyWeight.asymptote.male") * (1 - Math.exp(-constant("rat.bodyWeight.growthRatePerWeek") * ageWeeks));
  if (sex === "F") w *= constant("rat.bodyWeight.femaleFactor");
  if (strain === "WI") w *= constant("rat.bodyWeight.wistarFactor");
  return w;
}

export function buildPhysiology(inp: PhysiologyInput): Physiology {
  const { rng, sex, strain, ageWeeks } = inp;
  const bwG = meanBodyWeightG(sex, strain, ageWeeks) * rng.lognormalFactor(constant("rat.bodyWeight.cv"));
  const bw = bwG / 1000;
  const organCv = constant("rat.organVolume.cv");

  const vol = {} as Record<Tissue, number>;
  let used = 0;
  for (const t of Object.keys(ORGAN_FRACTION) as Exclude<Tissue, "rest">[]) {
    const v = constant(ORGAN_FRACTION[t]) * bw * rng.lognormalFactor(organCv);
    vol[t] = v;
    used += v;
  }
  const bloodL = (constant("rat.plasmaVolume") / (1 - constant("rat.hematocrit"))) * bw;
  const artFrac = constant("rat.blood.arterialFraction");
  const volArt = bloodL * artFrac;
  const volVen = bloodL * (1 - artFrac);
  vol.rest = bw - used - bloodL;
  if (vol.rest <= 0) throw new Error("Organ fractions exceed body mass");

  const co = constant("rat.cardiacOutput.scalingCoefficient") * Math.pow(bw, constant("rat.cardiacOutput.exponent"));
  const fl = (k: string) => constant(k) * co;
  const gut = fl("rat.bloodFlow.gut");
  const spleen = fl("rat.bloodFlow.spleen");
  const liverTotal = fl("rat.bloodFlow.liverTotal");
  const hepaticArtery = liverTotal - gut - spleen;
  if (hepaticArtery <= 0) throw new Error("Portal flows exceed total liver flow");
  const kidney = fl("rat.bloodFlow.kidney");
  const heart = fl("rat.bloodFlow.heart");
  const brain = fl("rat.bloodFlow.brain");
  const muscle = fl("rat.bloodFlow.muscle");
  const fat = fl("rat.bloodFlow.fat");
  const marrow = fl("rat.bloodFlow.boneMarrow");
  const rest = co - (liverTotal + kidney + heart + brain + muscle + fat + marrow);
  if (rest <= 0) throw new Error("Tissue flows exceed cardiac output");

  const cypCv = strain === "WI" ? constant("rat.cyp.cv.wistar") : constant("rat.cyp.cv.sd");
  return {
    sex, strain, ageWeeks, bwKg: bw, vol, volArt, volVen,
    flow: { gut, spleen, hepaticArtery, kidney, heart, brain, muscle, fat, marrow, rest },
    co,
    cypFactor: rng.lognormalFactor(cypCv),
    renalFactor: rng.lognormalFactor(constant("rat.renal.cv")),
  };
}
