import { simulateAnimal, peakDamage, type AnimalConfig } from "./study";
import { deriveObservables } from "./observables";
import { evaluateHumaneEndpoint } from "./humane";
import { ORGANS, gradeFromDamage, type Organ } from "./toxicodynamics";

/**
 * One outcome per virtual rat, for population views (the dot field and survival curves).
 * Each rat has its own physiology, metabolism and sensitivity because its id differs.
 * `offset` lets a long run be split into chunks that together equal one run.
 */
export interface RatOutcome {
  index: number;
  sex: "M" | "F";
  /** worst pathology grade (0 to 5) over all organs at any point in the study */
  worstGrade: 0 | 1 | 2 | 3 | 4 | 5;
  /** organ with that worst grade, or null when every organ stayed at grade 0 */
  worstOrgan: Organ | null;
  /** day of the first humane endpoint, or null if none was reached */
  humaneDay: number | null;
  /** tumour volume on the last day, mm3 (0 when there is no tumour model) */
  tumourEndMm3: number;
}

export interface PopulationOptions {
  n: number;
  offset?: number;
  /** model time step in hours; 0.5 is about twice as fast as the default 0.25 */
  dtH?: number;
  /** prefix for animal ids; use a different prefix for a separate population */
  idPrefix?: string;
}

export function simulatePopulation(base: AnimalConfig, o: PopulationOptions, onProgress?: (done: number, total: number) => void): RatOutcome[] {
  const out: RatOutcome[] = [];
  const offset = o.offset ?? 0;
  for (let i = 0; i < o.n; i++) {
    const index = offset + i;
    const sex: "M" | "F" = index % 2 === 0 ? "M" : "F";
    const r = simulateAnimal({ ...base, animalId: `${o.idPrefix ?? "pop"}${index}`, sex, dtH: o.dtH ?? base.dtH });
    const obs = deriveObservables(r);
    const peaks = peakDamage(r);
    let worst = 0, organ: Organ | null = null;
    for (const og of ORGANS) {
      const g = gradeFromDamage(peaks[og] ?? 0);
      if (g > worst) { worst = g; organ = og; }
    }
    const h = evaluateHumaneEndpoint(obs);
    out.push({ index, sex, worstGrade: worst as RatOutcome["worstGrade"], worstOrgan: organ, humaneDay: h ? h.day : null, tumourEndMm3: obs.tumorVolume[obs.days] ?? 0 });
    onProgress?.(i + 1, o.n);
  }
  return out;
}
