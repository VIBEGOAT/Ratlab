/** Single source of truth for subsystem fidelity labels. The UI panel and reports read this. */
export type FidelityLabel = "MECHANISTIC" | "SEMI-QUANTITATIVE" | "ILLUSTRATIVE";

export interface FidelityEntry {
  id: string;
  name: string;
  label: FidelityLabel;
  justification: string;
}

export const FIDELITY: readonly FidelityEntry[] = [
  { id: "rng", name: "Random number generation", label: "MECHANISTIC", justification: "Deterministic seeded generator; behaviour is fully testable." },
  { id: "pbpk", name: "PBPK ODE solver and mass balance", label: "MECHANISTIC", justification: "Standard equations; mass conservation is unit-tested." },
  { id: "physiology", name: "Rat physiology parameters", label: "SEMI-QUANTITATIVE", justification: "Taken from the literature; several values still UNVERIFIED and not matched to a specific strain or vendor." },
  { id: "toxicodynamics", name: "Organ damage D(t)", label: "SEMI-QUANTITATIVE", justification: "Mechanism-shaped equations with archetype parameters that are not fitted to data." },
  { id: "clinpath", name: "Clinical pathology mapping from damage", label: "SEMI-QUANTITATIVE", justification: "Reference ranges come from the literature; the damage-to-marker mapping is assumed." },
  { id: "disease", name: "Tumor and diabetes overlays", label: "SEMI-QUANTITATIVE", justification: "Standard model forms with uncalibrated parameters." },
  { id: "behaviour", name: "Behaviour, sickness, grimace, FOB", label: "ILLUSTRATIVE", justification: "Modelled endpoints derived from organ state. No claim about subjective experience." },
  { id: "translation", name: "Human translation", label: "ILLUSTRATIVE", justification: "Scaling rules only; no validation against human data." },
] as const;
