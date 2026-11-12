export type EvidenceState = "source-needed" | "source-mapped" | "curating" | "reviewed" | "ready";

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
  { id: "cisplatin-kidney", compoundKey: "nephrotoxin", drug: "Cisplatin", organ: "Kidneys", organShort: "Renal", teachingQuestion: "How does renal accumulation separate efficacy from tubular injury?", mechanism: "Tubular accumulation, oxidative stress and impaired filtration", endpoints: ["Reported renal histology", "Graphical creatinine / urea", "Model PK (not observed)", "Protocol comparison"], evidenceState: "curating", protocolSnapshot: ["Male Sprague–Dawley rat", "Single 7 mg/kg intraperitoneal cisplatin", "n = 6 per arm", "Day 14 renal assessment"], publishedDoseGroups: [0, 7], publishedFindings: [{ dose: 7, time: "Day 14", finding: "Moderate tubular degeneration and necrosis" }, { dose: 7, time: "Day 14", finding: "Moderate cast formation" }, { dose: 7, time: "Day 14", finding: "Mild loss of brush border and tubular dilation" }], source: { label: "Open-access rat study · curating", citation: "Khallaf et al., Scientific Reports 16 (2026) 15227 · CC BY 4.0", url: "https://doi.org/10.1038/s41598-026-50755-0" } },
  { id: "doxorubicin-heart", compoundKey: "cardiotoxin", drug: "Doxorubicin", organ: "Heart", organShort: "Cardiac", teachingQuestion: "Can antitumour effect be retained below cumulative cardiac injury?", mechanism: "Topoisomerase-II activity with cumulative myocardial oxidative injury", endpoints: ["Reported ECG changes", "Observed cardiac-motion score", "Model PK (not observed)", "Protocol comparison"], evidenceState: "curating", protocolSnapshot: ["Male Sprague–Dawley rat", "2.5 mg/kg IP every 48 h", "15 mg/kg cumulative · n = 5 DOX arm", "Day 14 cardiac assessment"], publishedDoseGroups: [0, 15], publishedFindings: [{ dose: 15, time: "Day 14", finding: "Lower heart rate; prolonged QRS, PR, QT and QTc" }, { dose: 15, time: "Day 14", finding: "Reduced R-wave and negative T-wave morphology" }, { dose: 15, time: "Day 14", finding: "All DOX hearts >7.3 on cohort-relative optical score" }], source: { label: "Open-access rat study · curating", citation: "Goje et al., Medical Sciences 14 (2026) 342 · CC BY 4.0", url: "https://doi.org/10.3390/medsci14030342" } },
  { id: "paclitaxel-nerves", compoundKey: "neurotoxin", drug: "Paclitaxel", organ: "Peripheral nerves", organShort: "Neural", teachingQuestion: "How does cumulative exposure translate into sensory neuropathy?", mechanism: "Microtubule stabilisation and length-dependent peripheral axon injury", endpoints: ["Plasma exposure", "Sensory response", "Gait", "Nerve histology"], evidenceState: "source-needed", source: { label: "Primary source not selected", citation: "Paclitaxel is absent from the mapped Open TG-GATEs rat in-vivo records; current values remain an educational model proxy", url: "https://doi.org/10.1093/nar/gku955" } },
  { id: "cyclophosphamide-marrow", compoundKey: "myelotoxin", drug: "Cyclophosphamide", organ: "Bone marrow", organShort: "Marrow", teachingQuestion: "How quickly does marrow suppression appear and recover after dosing?", mechanism: "Metabolic activation, DNA cross-linking and suppression of proliferating marrow", endpoints: ["Plasma exposure", "Neutrophils", "Reticulocytes", "Marrow histology"], evidenceState: "source-mapped", source: { label: "Protocol mapped · endpoint data pending", citation: "Open TG-GATEs E-MTAB-799/800 contains rat liver transcriptomic protocol metadata; marrow observations are not imported", url: "https://doi.org/10.1093/nar/gku955" } },
];

export function referenceCaseForCompound(compoundKey: string): ReferenceCase | undefined {
  return REFERENCE_CASES.find((item) => item.compoundKey === compoundKey);
}
