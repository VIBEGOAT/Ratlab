import { constant } from "./reference";

/**
 * Dose conversion between species by body surface area, for the calculator.
 *
 * Source: US FDA, "Estimating the Maximum Safe Starting Dose in Initial Clinical Trials for Therapeutics in Adult
 * Healthy Volunteers" (July 2005). The numbers below were read from Table 3 of that PDF on 2026-10-08. Rat and human
 * km come from data/reference.json (VERIFIED against the same tables); the other species' km, reference weights and
 * working weight ranges are the table values and are checked against each other in the tests.
 *
 * ILLUSTRATIVE for any real use. The guidance is nonbinding, written for first-in-human trials of therapeutics, and
 * these functions are arithmetic. They do not establish that any dose is safe for a person or an animal.
 */

export type SpeciesId =
  | "mouse" | "hamster" | "rat" | "ferret" | "guineaPig" | "rabbit" | "dog" | "monkey" | "marmoset" | "squirrelMonkey" | "baboon" | "microPig" | "miniPig" | "human";

export interface Species {
  id: SpeciesId;
  name: string;
  /** km: converts a mg/kg dose to mg/m2 (body weight divided by surface area, kg/m2) */
  km: number;
  /** reference body weight in kg, as listed in the guidance */
  referenceKg: number;
  /** weights for which the standard km stays within 20% of the exact-weight value; null for the human row */
  workingKg: [number, number] | null;
  /** body surface area in m2 at the reference weight */
  bsaM2: number;
}

export const SPECIES: Species[] = [
  { id: "mouse", name: "Mouse", km: 3, referenceKg: 0.02, workingKg: [0.011, 0.034], bsaM2: 0.007 },
  { id: "hamster", name: "Hamster", km: 5, referenceKg: 0.08, workingKg: [0.047, 0.157], bsaM2: 0.016 },
  { id: "rat", name: "Rat", km: constant("translation.km.rat"), referenceKg: 0.15, workingKg: [0.08, 0.27], bsaM2: 0.025 },
  { id: "ferret", name: "Ferret", km: 7, referenceKg: 0.3, workingKg: [0.16, 0.54], bsaM2: 0.043 },
  { id: "guineaPig", name: "Guinea pig", km: 8, referenceKg: 0.4, workingKg: [0.208, 0.7], bsaM2: 0.05 },
  { id: "rabbit", name: "Rabbit", km: 12, referenceKg: 1.8, workingKg: [0.9, 3.0], bsaM2: 0.15 },
  { id: "dog", name: "Dog", km: 20, referenceKg: 10, workingKg: [5, 17], bsaM2: 0.5 },
  { id: "monkey", name: "Monkey (cynomolgus, rhesus, stumptail)", km: 12, referenceKg: 3, workingKg: [1.4, 4.9], bsaM2: 0.25 },
  { id: "marmoset", name: "Marmoset", km: 6, referenceKg: 0.35, workingKg: [0.14, 0.72], bsaM2: 0.06 },
  { id: "squirrelMonkey", name: "Squirrel monkey", km: 7, referenceKg: 0.6, workingKg: [0.29, 0.97], bsaM2: 0.09 },
  { id: "baboon", name: "Baboon", km: 20, referenceKg: 12, workingKg: [7, 23], bsaM2: 0.6 },
  { id: "microPig", name: "Micro-pig", km: 27, referenceKg: 20, workingKg: [10, 33], bsaM2: 0.74 },
  { id: "miniPig", name: "Mini-pig", km: 35, referenceKg: 40, workingKg: [25, 64], bsaM2: 1.14 },
  { id: "human", name: "Human (adult)", km: constant("translation.km.human"), referenceKg: 60, workingKg: null, bsaM2: 1.62 },
];

export const speciesById = (id: SpeciesId): Species => SPECIES.find((s) => s.id === id)!;

/** Default safety factor applied to a human equivalent dose, from the same guidance (it says to evaluate it case by case). */
export const DEFAULT_SAFETY_FACTOR = 10;

const ok = (x: number) => Number.isFinite(x) && x > 0;

/** Dose in mg/kg for species `to` that equals `doseMgPerKg` given to species `from`, matched on body surface area. */
export function convertDoseMgPerKg(doseMgPerKg: number, from: SpeciesId, to: SpeciesId): number {
  return (doseMgPerKg * speciesById(from).km) / speciesById(to).km;
}

/**
 * The guidance's alternative for weights outside the working range or species not in the table:
 * HED = animal dose (mg/kg) x (animal weight / human weight) ^ 0.33.
 */
export function hedByWeight(animalDoseMgPerKg: number, animalKg: number, humanKg: number): number {
  return animalDoseMgPerKg * Math.pow(animalKg / humanKg, 0.33);
}

export type WeightFit = "within" | "below" | "above";

export function weightFit(species: SpeciesId, animalKg: number): WeightFit {
  const r = speciesById(species).workingKg;
  if (!r || (animalKg >= r[0] && animalKg <= r[1])) return "within";
  return animalKg < r[0] ? "below" : "above";
}

export interface AnimalToHumanInput {
  species: SpeciesId;
  animalKg: number;
  /** the dose as given: per kg of body weight, or in total for one animal */
  dose: number;
  doseUnit: "mgPerKg" | "mgTotal";
  humanKg?: number;
  safetyFactor?: number;
  /** concentration of the dosing solution in mg/mL, optional */
  concentrationMgPerMl?: number;
}

export interface AnimalToHumanResult {
  /** the animal's dose both ways */
  animalDoseMgPerKg: number;
  animalDoseMgTotal: number;
  animalDoseMgPerM2: number;
  /** volume of dosing solution for one animal, when a concentration was given */
  volumeMl: number | null;
  volumeMlPerKg: number | null;
  /** standard method: surface-area factors from Table 1 */
  hedMgPerKg: number;
  hedMgTotal: number;
  /** weight-based alternative from the guidance */
  hedByWeightMgPerKg: number;
  hedByWeightMgTotal: number;
  fit: WeightFit;
  /** the method the guidance prefers for these weights */
  preferred: "kmFactor" | "weightFormula";
  /** if the dose is a NOAEL: the maximum recommended starting dose after the safety factor */
  mrsdMgPerKg: number;
  mrsdMgTotal: number;
  safetyFactor: number;
  humanKg: number;
  /** the same body-surface-area dose in every species, mg/kg and mg for one animal at the reference weight */
  acrossSpecies: Array<{ id: SpeciesId; name: string; mgPerKg: number; referenceKg: number; mgAtReference: number }>;
}

export type CalcProblem = "animalWeight" | "dose" | "humanWeight" | "safetyFactor" | "concentration";

/** Converts an animal dose to a human equivalent dose. Returns the problem when an input is not a positive number. */
export function animalToHuman(i: AnimalToHumanInput): { problem: CalcProblem } | { result: AnimalToHumanResult } {
  const humanKg = i.humanKg ?? 60;
  const sf = i.safetyFactor ?? DEFAULT_SAFETY_FACTOR;
  if (!ok(i.animalKg)) return { problem: "animalWeight" };
  if (!ok(i.dose)) return { problem: "dose" };
  if (!ok(humanKg)) return { problem: "humanWeight" };
  if (!ok(sf)) return { problem: "safetyFactor" };
  if (i.concentrationMgPerMl !== undefined && i.concentrationMgPerMl !== 0 && !ok(i.concentrationMgPerMl)) return { problem: "concentration" };
  const sp = speciesById(i.species);
  const perKg = i.doseUnit === "mgPerKg" ? i.dose : i.dose / i.animalKg;
  const total = i.doseUnit === "mgTotal" ? i.dose : i.dose * i.animalKg;
  const hed = convertDoseMgPerKg(perKg, i.species, "human");
  const byWeight = hedByWeight(perKg, i.animalKg, humanKg);
  const fit = weightFit(i.species, i.animalKg);
  const conc = i.concentrationMgPerMl && i.concentrationMgPerMl > 0 ? i.concentrationMgPerMl : null;
  return {
    result: {
      animalDoseMgPerKg: perKg,
      animalDoseMgTotal: total,
      animalDoseMgPerM2: perKg * sp.km,
      volumeMl: conc ? total / conc : null,
      volumeMlPerKg: conc ? perKg / conc : null,
      hedMgPerKg: hed,
      hedMgTotal: hed * humanKg,
      hedByWeightMgPerKg: byWeight,
      hedByWeightMgTotal: byWeight * humanKg,
      fit,
      preferred: fit === "within" ? "kmFactor" : "weightFormula",
      mrsdMgPerKg: hed / sf,
      mrsdMgTotal: (hed / sf) * humanKg,
      safetyFactor: sf,
      humanKg,
      acrossSpecies: SPECIES.map((s) => {
        const mgPerKg = convertDoseMgPerKg(perKg, i.species, s.id);
        return { id: s.id, name: s.name, mgPerKg, referenceKg: s.referenceKg, mgAtReference: mgPerKg * s.referenceKg };
      }),
    },
  };
}

export interface HumanToAnimalInput {
  species: SpeciesId;
  animalKg: number;
  humanDose: number;
  humanDoseUnit: "mgPerKg" | "mgTotal";
  humanKg?: number;
  concentrationMgPerMl?: number;
}

export interface HumanToAnimalResult {
  humanDoseMgPerKg: number;
  humanDoseMgTotal: number;
  animalDoseMgPerKg: number;
  animalDoseMgTotal: number;
  animalDoseMgPerM2: number;
  volumeMl: number | null;
  fit: WeightFit;
  humanKg: number;
}

/** The animal dose that matches a human dose by body surface area (the reverse of the standard conversion). */
export function humanToAnimal(i: HumanToAnimalInput): { problem: CalcProblem } | { result: HumanToAnimalResult } {
  const humanKg = i.humanKg ?? 60;
  if (!ok(i.animalKg)) return { problem: "animalWeight" };
  if (!ok(i.humanDose)) return { problem: "dose" };
  if (!ok(humanKg)) return { problem: "humanWeight" };
  if (i.concentrationMgPerMl !== undefined && i.concentrationMgPerMl !== 0 && !ok(i.concentrationMgPerMl)) return { problem: "concentration" };
  const hPerKg = i.humanDoseUnit === "mgPerKg" ? i.humanDose : i.humanDose / humanKg;
  const aPerKg = convertDoseMgPerKg(hPerKg, "human", i.species);
  const total = aPerKg * i.animalKg;
  const conc = i.concentrationMgPerMl && i.concentrationMgPerMl > 0 ? i.concentrationMgPerMl : null;
  return {
    result: {
      humanDoseMgPerKg: hPerKg,
      humanDoseMgTotal: i.humanDoseUnit === "mgTotal" ? i.humanDose : hPerKg * humanKg,
      animalDoseMgPerKg: aPerKg,
      animalDoseMgTotal: total,
      animalDoseMgPerM2: aPerKg * speciesById(i.species).km,
      volumeMl: conc ? total / conc : null,
      fit: weightFit(i.species, i.animalKg),
      humanKg,
    },
  };
}
