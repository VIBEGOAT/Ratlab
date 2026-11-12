export type EvidenceState = "source-mapped" | "curating" | "ready";

export interface ReferenceCase {
  id: string;
  compoundKey: string;
  drug: string;
  organ: string;
  organShort: string;
  teachingQuestion: string;
  mechanism: string;
  endpoints: string[];
  evidenceState: EvidenceState;
  protocolSnapshot?: string[];
  publishedDoseGroups?: number[];
  publishedFindings?: Array<{ dose: number; time: string; finding: string }>;
  source: { label: string; citation: string; url: string };
}

/** Curriculum map, not a numerical dataset. `ready` requires checked protocol and observation tables. */
export const REFERENCE_CASES: ReferenceCase[] = [
  { id: "acetaminophen-liver", compoundKey: "hepatotoxin", drug: "Acetaminophen", organ: "Liver", organShort: "Hepatic", teachingQuestion: "When does reactive-metabolite formation overwhelm hepatic defence?", mechanism: "Bioactivation, glutathione depletion and hepatocellular injury", endpoints: ["Transcriptomic response", "Discretized pathology", "Protocol comparison", "Model PK (not observed)"], evidenceState: "curating", protocolSnapshot: ["Male SD rat · 6 weeks", "Gavage", "0 · 300 · 600 · 1,000 mg/kg", "Single + repeat studies"], publishedDoseGroups: [0, 300, 600, 1000], publishedFindings: [{ dose: 1000, time: "9 h · single", finding: "Eosinophilic change" }, { dose: 600, time: "24 h · single", finding: "Cellular infiltration and eosinophilic change" }, { dose: 1000, time: "Day 4 · repeat", finding: "Necrosis, increased mitosis, infiltration and eosinophilic change" }, { dose: 600, time: "Day 15 · repeat", finding: "Ground-glass appearance" }, { dose: 1000, time: "Day 29 · repeat", finding: "Swelling and ground-glass appearance" }], source: { label: "Open TG-GATEs · E-MTAB-799/800", citation: "Igarashi et al., Nucleic Acids Research 43 (2015), D921–D927", url: "https://doi.org/10.1093/nar/gku955" } },
  { id: "cisplatin-kidney", compoundKey: "nephrotoxin", drug: "Cisplatin", organ: "Kidneys", organShort: "Renal", teachingQuestion: "How does renal accumulation separate efficacy from tubular injury?", mechanism: "Tubular accumulation, oxidative stress and impaired filtration", endpoints: ["Plasma exposure", "Creatinine / BUN", "Kidney weight", "Tubular histology"], evidenceState: "source-mapped", source: { label: "Open TG-GATEs + primary-study curation", citation: "Dataset framework: Igarashi et al. (2015)", url: "https://doi.org/10.1093/nar/gku955" } },
  { id: "doxorubicin-heart", compoundKey: "cardiotoxin", drug: "Doxorubicin", organ: "Heart", organShort: "Cardiac", teachingQuestion: "Can antitumour effect be retained below cumulative cardiac injury?", mechanism: "Topoisomerase-II activity with cumulative myocardial oxidative injury", endpoints: ["Plasma exposure", "Troponin", "Cardiac function", "Heart histology"], evidenceState: "source-mapped", source: { label: "Open TG-GATEs + primary-study curation", citation: "Dataset framework: Igarashi et al. (2015)", url: "https://doi.org/10.1093/nar/gku955" } },
  { id: "paclitaxel-nerves", compoundKey: "neurotoxin", drug: "Paclitaxel", organ: "Peripheral nerves", organShort: "Neural", teachingQuestion: "How does cumulative exposure translate into sensory neuropathy?", mechanism: "Microtubule stabilisation and length-dependent peripheral axon injury", endpoints: ["Plasma exposure", "Sensory response", "Gait", "Nerve histology"], evidenceState: "source-mapped", source: { label: "Primary-study curation required", citation: "Protocol and endpoint tables not yet imported", url: "https://pubmed.ncbi.nlm.nih.gov/" } },
  { id: "cyclophosphamide-marrow", compoundKey: "myelotoxin", drug: "Cyclophosphamide", organ: "Bone marrow", organShort: "Marrow", teachingQuestion: "How quickly does marrow suppression appear and recover after dosing?", mechanism: "Metabolic activation, DNA cross-linking and suppression of proliferating marrow", endpoints: ["Plasma exposure", "Neutrophils", "Reticulocytes", "Marrow histology"], evidenceState: "source-mapped", source: { label: "Open TG-GATEs + primary-study curation", citation: "Dataset framework: Igarashi et al. (2015)", url: "https://doi.org/10.1093/nar/gku955" } },
];

export function referenceCaseForCompound(compoundKey: string): ReferenceCase | undefined {
  return REFERENCE_CASES.find((item) => item.compoundKey === compoundKey);
}
