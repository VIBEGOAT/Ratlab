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
  { id: "pbpk", name: "PBPK solver and mass balance", label: "MECHANISTIC", justification: "Flow-limited whole-body model propagated exactly with a matrix exponential; mass conservation and agreement with an adaptive ODE solver are unit-tested. Compound parameters are fictional archetypes." },
  { id: "pd", name: "PD models (Emax, effect compartment, indirect response, transit, tolerance)", label: "MECHANISTIC", justification: "Textbook model forms checked against their analytic steady states. Parameters are archetype placeholders." },
  { id: "physiology", name: "Rat physiology parameters", label: "SEMI-QUANTITATIVE", justification: "Taken from the literature; several values still UNVERIFIED and not matched to a specific strain or vendor." },
  { id: "toxicodynamics", name: "Organ damage D(t)", label: "SEMI-QUANTITATIVE", justification: "Mechanism-shaped equations with archetype parameters that are not fitted to data." },
  { id: "clinpath", name: "Clinical pathology mapping from damage", label: "SEMI-QUANTITATIVE", justification: "Reference ranges come from the literature; the damage-to-marker mapping is assumed." },
  { id: "disease", name: "Tumor and diabetes overlays", label: "SEMI-QUANTITATIVE", justification: "Gompertz tumor growth with log-cell-kill and resistance, and glucose, HbA1c-like and complication states. Standard model forms with uncalibrated parameters. Other disease modules are not implemented." },
  { id: "humane", name: "Humane endpoint logic", label: "SEMI-QUANTITATIVE", justification: "Criteria follow the concepts in OECD GD 19. Threshold values are placeholders and must be replaced with institutional policy." },
  { id: "twin", name: "Untreated twin", label: "MECHANISTIC", justification: "Same seed, physiology and disease parameters with zero dose, so differences are due to treatment alone. The model it runs on is SEMI-QUANTITATIVE." },
  { id: "behaviour", name: "Behaviour, sickness, grimace, FOB", label: "ILLUSTRATIVE", justification: "Modelled endpoints derived from organ state. No claim about subjective experience." },
  { id: "translation", name: "Human translation", label: "ILLUSTRATIVE", justification: "Scaling rules only; no validation against human data." },
] as const;
