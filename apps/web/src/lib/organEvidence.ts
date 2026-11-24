import type { Organ } from "@eliminate/sim-core";

export type OrganEvidenceLevel = "data-backed" | "proxy" | "research" | "anatomy";

export interface OrganEvidence {
  level: OrganEvidenceLevel;
  label: string;
  detail: string;
}

/** Student-facing release gate for organ predictions. */
export const ORGAN_EVIDENCE: Record<Organ, OrganEvidence> = {
  liver: {
    level: "data-backed",
    label: "Data-backed estimate",
    detail: "Calibrated with Open TG-GATEs liver chemistry, organ weight and pathology observations.",
  },
  kidney: {
    level: "data-backed",
    label: "Data-backed estimate",
    detail: "Calibrated with Open TG-GATEs renal chemistry, kidney weight and pathology observations.",
  },
  marrow: {
    level: "proxy",
    label: "Blood-count proxy",
    detail: "Estimated from measured white-cell, red-cell and platelet responses; direct marrow histology is unavailable.",
  },
  heart: {
    level: "research",
    label: "Research model",
    detail: "DrugMatrix heart pathology was trained, but held-out performance did not pass the release gate. The grade below is mechanistic and exploratory.",
  },
  gut: {
    level: "research",
    label: "Sparse evidence",
    detail: "DrugMatrix intestinal pathology is too sparse for a released predictor. The grade below is mechanistic and exploratory.",
  },
  brain: {
    level: "anatomy",
    label: "Anatomy only",
    detail: "No direct brain pathology or validated neurobehavior outcome is present in the current training datasets.",
  },
};

export function organPredictionReleased(organ: Organ): boolean {
  return ORGAN_EVIDENCE[organ].level === "data-backed" || ORGAN_EVIDENCE[organ].level === "proxy";
}
