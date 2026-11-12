import type { LabSection } from "../store";

/** Every Lab view. The view components themselves are loaded lazily in LabShell. */
export type ViewId =
  | "overview" | "design" | "rat" | "behaviour" | "clinobs" | "pkpd" | "disease" | "clinpath" | "necropsy"
  | "stats" | "twin" | "population" | "uncertainty" | "calculator" | "translation" | "validation" | "fidelity" | "pitch";

export type SectionIcon = "overview" | "design" | "animal" | "data" | "population" | "trust";
export interface SectionDef {
  id: LabSection;
  label: string;
  hint: string;
  question: string;
  icon: SectionIcon;
  views: Array<[ViewId, string]>;
  /** Views needed for the undergraduate, step-by-step path. The others stay in Research mode. */
  coreViews: ViewId[];
}

/** An overview, then five sections that hold every analysis view. Nothing is lost, only regrouped. */
export const SECTIONS: SectionDef[] = [
  { id: "design", icon: "design", label: "Design the study", hint: "Compound, dose and groups", question: "What are you testing, at what dose, and for how long?", views: [["design", "Study groups"]], coreViews: ["design"] },
  { id: "overview", label: "Read the answer", hint: "Findings at a glance", question: "What happened, and at what dose did harm begin?", icon: "overview", views: [["overview", "Study answer"]], coreViews: ["overview"] },
  { id: "animal", icon: "animal", label: "Follow one rat", hint: "Organs, signs and behaviour", question: "How did exposure become a change in one animal?", views: [["rat", "Interactive rat"], ["clinobs", "Daily observations"], ["behaviour", "Behaviour (advanced)"]], coreViews: ["rat", "clinobs"] },
  { id: "data", icon: "data", label: "Compare groups", hint: "Exposure, pathology and NOAEL", question: "Which findings change consistently as dose increases?", views: [["pkpd", "Exposure (PK/PD)"], ["stats", "Dose-response & NOAEL"], ["clinpath", "Clinical pathology"], ["necropsy", "Histopathology"], ["disease", "Disease model"]], coreViews: ["pkpd", "stats"] },
  { id: "population", icon: "population", label: "Test population risk", hint: "Twin, endpoints and variability", question: "How variable is the response, and when is a humane endpoint reached?", views: [["twin", "Treated vs untreated"], ["population", "Population & endpoints"], ["uncertainty", "Uncertainty (advanced)"]], coreViews: ["twin", "population"] },
  { id: "trust", icon: "trust", label: "Translate & judge", hint: "Human scaling, limits and evidence", question: "What can be translated to humans, and how far should you trust it?", views: [["calculator", "Dose scaling"], ["translation", "Human translation"], ["fidelity", "Model limits"], ["validation", "Validation (advanced)"], ["pitch", "References (advanced)"]], coreViews: ["calculator", "translation", "fidelity"] },
];

/** The twelve Story chapters, in order. */
export const CHAPTERS = [
  "Every animal we spare", "Meet the rat", "Choose a compound", "Dose day", "Days, compressed", "The humane endpoint",
  "Meet the twin", "A thousand rats", "How it behaves", "Toward humans", "How far to trust it", "What we could spare",
] as const;
