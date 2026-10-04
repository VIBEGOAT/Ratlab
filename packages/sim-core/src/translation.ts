import { constant } from "./reference";

/**
 * Human translation outlook. ILLUSTRATIVE. Not validated against human data.
 * Body-surface-area dose conversion follows the approach in the FDA 2005 guidance on the
 * maximum safe starting dose. Km values and the safety factor are marked UNVERIFIED in
 * reference.json and must be checked against the guidance tables.
 */

export function humanEquivalentDose(ratDoseMgPerKg: number): number {
  return ratDoseMgPerKg * (constant("translation.km.rat") / constant("translation.km.human"));
}

export interface StartingDose {
  hedMgPerKg: number;
  safetyFactor: number;
  mrsdMgPerKg: number;
  mrsdMgFor60Kg: number;
}

/** Maximum recommended starting dose from a rat NOAEL: HED divided by a safety factor (10 unless justified otherwise). */
export function maxRecommendedStartingDose(noaelMgPerKg: number, safetyFactor = 10): StartingDose {
  const hed = humanEquivalentDose(noaelMgPerKg);
  const mrsd = hed / safetyFactor;
  return { hedMgPerKg: hed, safetyFactor, mrsdMgPerKg: mrsd, mrsdMgFor60Kg: mrsd * 60 };
}

/** Simple allometric exposure projection: clearance scales with body weight^0.75. */
export function projectedHumanExposure(ratClearanceLPerH: number, ratBodyWeightKg: number, humanDoseMg: number, humanBodyWeightKg = 60, fAbs = 1): { clearanceLPerH: number; aucMgHPerL: number } {
  const cl = ratClearanceLPerH * Math.pow(humanBodyWeightKg / ratBodyWeightKg, 0.75);
  return { clearanceLPerH: cl, aucMgHPerL: (humanDoseMg * fAbs) / cl };
}

/** Exposure-based safety margin: rat exposure at the NOAEL divided by projected human exposure. */
export function safetyMargin(ratNoaelAuc: number, humanAuc: number): number {
  return humanAuc > 0 ? ratNoaelAuc / humanAuc : Infinity;
}

/** Therapeutic index as the ratio of a toxic dose to an effective dose (both in mg/kg). */
export function therapeuticIndex(toxicDose: number, effectiveDose: number): number {
  return effectiveDose > 0 ? toxicDose / effectiveDose : Infinity;
}

/** MABEL is a receptor-occupancy and in vitro concept. Only the interface is provided: the caller supplies the in vitro EC10 or similar. */
export function mabelStub(inVitroEc10Conc: number, humanVolumeOfDistributionLPerKg: number): { doseMgPerKg: number; note: string } {
  return { doseMgPerKg: inVitroEc10Conc * humanVolumeOfDistributionLPerKg, note: "Stub: needs in vitro pharmacology data and a human PK projection. Not a validated MABEL calculation." };
}
