import type { RatOutcome, TwinBundle } from "@eliminate/sim-core";
import type { StudyPayload } from "../worker/protocol";
// imported as a URL, so the built file name carries a content hash and a changed file is never served from an old cache
import prewarmUrl from "../prewarm/default.json?url";
import populationUrl from "../prewarm/population.json?url";

/**
 * The default study, pre-baked at build time (scripts/gen-prewarm.ts) so a first-ever visit opens instantly.
 * It is used only when both the simulator version and the whole setup match exactly; anything else computes live.
 */
export interface PrewarmFile {
  simVersion: string;
  setupKey: string;
  payload: StudyPayload;
  focusId: string;
  twin: TwinBundle;
}

export interface PopulationPrewarmFile {
  simVersion: string;
  setupKey: string;
  population: { n: number; doseMgPerKg: number; treated: RatOutcome[]; untreated: RatOutcome[] };
}

/** True when a pre-baked file applies to this simulator version and setup. */
export function prewarmApplies(f: Pick<PrewarmFile, "simVersion" | "setupKey"> | null, simVersion: string, setupJson: string): boolean {
  return !!f && f.simVersion === simVersion && f.setupKey === setupJson;
}

let pending: Promise<PrewarmFile | null> | null = null;

/** Fetches the pre-baked file once. Fails soft: any problem means "no pre-baked study". */
export function fetchPrewarm(): Promise<PrewarmFile | null> {
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(prewarmUrl);
        if (!res.ok) return null;
        const j = (await res.json()) as PrewarmFile;
        return j && j.payload && j.twin ? j : null;
      } catch { return null; }
    })();
  }
  return pending;
}

let populationPending: Promise<PopulationPrewarmFile | null> | null = null;

/** Loads the larger forecast population only when the population chapter/view is opened. */
export function fetchPopulationPrewarm(): Promise<PopulationPrewarmFile | null> {
  if (!populationPending) {
    populationPending = (async () => {
      try {
        const res = await fetch(populationUrl);
        if (!res.ok) return null;
        const j = (await res.json()) as PopulationPrewarmFile;
        return j && j.population ? j : null;
      } catch { return null; }
    })();
  }
  return populationPending;
}

/** Values the store can serve without touching IndexedDB or the worker. */
export const memo = new Map<string, unknown>();
