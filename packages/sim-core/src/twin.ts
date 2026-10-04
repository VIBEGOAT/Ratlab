import { simulateAnimal, type AnimalConfig, type AnimalResult } from "./study";
import { deriveObservables, type Observables } from "./observables";
import { evaluateHumaneEndpoint, type HumaneEvent } from "./humane";

export interface TwinArm {
  result: AnimalResult;
  obs: Observables;
  humane: HumaneEvent | null;
}

export interface TwinPair {
  treated: TwinArm;
  /** same animal (same seed, id, physiology and disease parameters) with no dose */
  untreated: TwinArm;
  /** days the treatment moved the first humane endpoint (positive means later), null if neither reached one */
  humaneDelayDays: number | null;
}

function arm(cfg: AnimalConfig): TwinArm {
  const result = simulateAnimal(cfg);
  const obs = deriveObservables(result);
  return { result, obs, humane: evaluateHumaneEndpoint(obs) };
}

/** Run the treated animal and its untreated twin. The twin shares every random draw except the dose. */
export function simulateTwin(cfg: AnimalConfig): TwinPair {
  const treated = arm(cfg);
  const untreated = arm({ ...cfg, regimen: { ...cfg.regimen, doseMgPerKg: 0 } });
  let delay: number | null = null;
  const t = treated.humane?.day ?? null, u = untreated.humane?.day ?? null;
  if (t !== null && u !== null) delay = t - u;
  else if (u !== null && t === null) delay = Infinity;
  else if (t !== null && u === null) delay = -Infinity;
  return { treated, untreated, humaneDelayDays: delay };
}
