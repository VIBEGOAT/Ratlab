import type { LabSection } from "../store";

/** Every Lab view. The view components themselves are loaded lazily in LabShell. */
export type ViewId =
  | "design" | "rat" | "behaviour" | "clinobs" | "pkpd" | "disease" | "clinpath" | "necropsy"
  | "stats" | "twin" | "population" | "uncertainty" | "translation" | "validation" | "fidelity" | "pitch";

export interface SectionDef { id: LabSection; label: string; hint: string; picker: boolean; views: Array<[ViewId, string]> }

/** Five sections replace the old sixteen tabs. Nothing is lost, only regrouped. */
export const SECTIONS: SectionDef[] = [
  { id: "design", label: "Design", hint: "Compound, dose, groups", picker: false, views: [["design", "Study design"]] },
  { id: "animal", label: "Animal", hint: "3D rat, behaviour, signs", picker: true, views: [["rat", "3D rat"], ["behaviour", "Behaviour"], ["clinobs", "Clinical observations"]] },
  { id: "data", label: "Data", hint: "PK/PD, pathology, statistics", picker: true, views: [["pkpd", "PK/PD"], ["clinpath", "Clinical pathology"], ["necropsy", "Necropsy and histopathology"], ["stats", "Statistics and NOAEL"], ["disease", "Disease"]] },
  { id: "population", label: "Population", hint: "Twin, humane endpoints, forecast", picker: true, views: [["twin", "Untreated twin"], ["population", "Humane endpoints and forecast"], ["uncertainty", "Uncertainty and credibility"]] },
  { id: "trust", label: "Translate & Trust", hint: "Human outlook, validation, sources", picker: false, views: [["translation", "Human translation"], ["validation", "Validation"], ["fidelity", "Fidelity and parameters"], ["pitch", "Pitch and references"]] },
];

/** The twelve Story chapters, in order. */
export const CHAPTERS = [
  "Every animal we spare", "Meet the rat", "Choose a compound", "Dose day", "Days, compressed", "The humane endpoint",
  "Meet the twin", "A thousand rats", "How it behaves", "Toward humans", "How far to trust it", "What we could spare",
] as const;
