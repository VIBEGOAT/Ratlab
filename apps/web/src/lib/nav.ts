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
  { id: "design", icon: "design", label: "Design study", hint: "Model, dose, duration", question: "What are you testing?", views: [["design", "Study groups"]], coreViews: ["design"] },
  { id: "overview", label: "Results", hint: "The main finding", question: "What happened?", icon: "overview", views: [["overview", "Study answer"]], coreViews: ["overview"] },
  { id: "animal", icon: "animal", label: "Animal", hint: "Organs and signs", question: "What changed inside the animal?", views: [["rat", "Interactive rat"], ["clinobs", "Daily observations"], ["behaviour", "Behaviour (advanced)"]], coreViews: ["rat", "clinobs"] },
  { id: "data", icon: "data", label: "Compare doses", hint: "Exposure and injury", question: "How did the groups differ?", views: [["pkpd", "Exposure"], ["stats", "Dose response"], ["clinpath", "Blood tests"], ["necropsy", "Tissue findings"], ["disease", "Disease model"]], coreViews: ["pkpd", "stats"] },
  { id: "population", icon: "population", label: "Variability", hint: "Different responses", question: "Did every virtual animal respond alike?", views: [["twin", "Treated vs untreated"], ["population", "Population"], ["uncertainty", "Uncertainty (advanced)"]], coreViews: ["twin", "population"] },
  { id: "trust", icon: "trust", label: "Limits", hint: "What this can tell us", question: "How far should you trust this simulation?", views: [["calculator", "Dose scaling"], ["translation", "Human translation"], ["fidelity", "Model limits"], ["validation", "Validation (advanced)"], ["pitch", "References (advanced)"]], coreViews: ["calculator", "translation", "fidelity"] },
];

/** The twelve Story chapters, in order. */
export const CHAPTERS = [
  "Every animal we spare", "Meet the rat", "Choose a compound", "Dose day", "Days, compressed", "The humane endpoint",
  "Meet the twin", "A thousand rats", "How it behaves", "Toward humans", "How far to trust it", "What we could spare",
] as const;
