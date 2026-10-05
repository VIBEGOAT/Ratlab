import type { RatOutcome, TwinBundle } from "@eliminate/sim-core";
import type { StudyPayload } from "../worker/protocol";

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
        const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
        const res = await fetch(`${base}prewarm/default.json`, { cache: "force-cache" });
        if (!res.ok) return null;
        const j = (await res.json()) as PrewarmFile;
        return j && j.payload && j.twin && j.population ? j : null;
      } catch { return null; }
    })();
  }
  return pending;
}

/** Values the store can serve without touching IndexedDB or the worker. */
export const memo = new Map<string, unknown>();
