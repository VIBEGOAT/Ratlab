import { constant } from "./reference";
import type { Observables } from "./observables";

/**
 * Humane endpoint logic after the concepts in OECD Guidance Document 19: the earliest
 * indicator of severe pain, distress, suffering or impending death. The numeric
 * thresholds are placeholders (UNVERIFIED in reference.json) and institutional policy
 * must replace them. The virtual animal keeps being simulated after the trigger so the
 * trajectory can still be inspected.
 */
export type HumaneCriterion = "weight-loss" | "grimace" | "moribund" | "tumor-burden" | "convulsions";

export interface HumaneEvent {
  day: number;
  criteria: HumaneCriterion[];
  reason: string;
  banner: string;
}

const LABEL: Record<HumaneCriterion, string> = {
  "weight-loss": "body weight loss over the limit",
  grimace: "grimace score over the limit",
  moribund: "moribund state",
  "tumor-burden": "tumour burden over the limit",
  convulsions: "severe convulsions",
};

export function evaluateHumaneEndpoint(obs: Observables): HumaneEvent | null {
  const wl = constant("humane.weightLossFraction");
  const gr = constant("humane.grimaceScoreLimit");
  const mo = constant("humane.moribundSickness");
  const tv = constant("humane.tumorVolumeLimit");
  const cv = constant("humane.convulsionIndex");
  let peak = obs.bodyWeightG[0]!;
  for (let d = 0; d <= obs.days; d++) {
    peak = Math.max(peak, obs.bodyWeightG[d]!);
    const hit: HumaneCriterion[] = [];
    if ((peak - obs.bodyWeightG[d]!) / peak >= wl) hit.push("weight-loss");
    if (obs.grimace[d]! >= gr) hit.push("grimace");
    if (obs.sickness[d]! >= mo) hit.push("moribund");
    if (obs.tumorVolume[d]! >= tv) hit.push("tumor-burden");
    if (obs.signIntensity.convulsions[d]! >= cv) hit.push("convulsions");
    if (hit.length) {
      const reason = hit.map((h) => LABEL[h]).join(", ");
      return {
        day: d, criteria: hit, reason,
        banner: `HUMANE ENDPOINT REACHED – a live animal would have been euthanised on day ${d} (${reason}). This virtual animal was not harmed.`,
      };
    }
  }
  return null;
}
