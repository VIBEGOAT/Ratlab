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
  /** The only sandbox organ that may be shown beside this evidence case. */
  sandboxOrgan: "liver" | "kidney" | "heart" | "brain" | "marrow";
  /** What the cited source can support in this website. It is deliberately narrower than a drug label. */
  evidenceScope: string;
  /** Exact protocol properties required before a sandbox can be described as protocol-aligned. */
  comparison: {
    route: "oral" | "ip" | "im";
    assessmentDay: number;
    doseBasis: "single" | "cumulative" | "repeat";
    quantitativeEndpoints: string[];
    qualitativeEndpoints: string[];
    unavailable: string[];
  };
  evidenceState: EvidenceState;
  protocolSnapshot?: string[];
  publishedDoseGroups?: number[];
  publishedFindings?: Array<{ dose: number; time: string; finding: string }>;
  source: { label: string; citation: string; url: string };
}

export interface SandboxEvidenceInput {
  route: string;
  durationDays: number;
  highDose: number;
}

export interface SandboxEvidenceGuard {
  verdict: "protocol-aligned" | "related-question";
  title: string;
  detail: string;
}

/**
 * Protects the teaching sandbox from being presented as a fitted drug model.
 * Alignment means the route and observed assessment day match; it never means
 * that the model has been externally validated.
 */
export function assessSandboxEvidence(caseStudy: ReferenceCase, sandbox: SandboxEvidenceInput): SandboxEvidenceGuard {
  const routeMatches = caseStudy.comparison.route === sandbox.route;
  const dayMatches = caseStudy.comparison.assessmentDay === sandbox.durationDays;
  if (routeMatches && dayMatches) {
    return {
      verdict: "protocol-aligned",
      title: "Protocol-aligned teaching comparison",
      detail: `The sandbox route and day ${sandbox.durationDays} match this source. Its ${sandbox.highDose} mg/kg/day model setting is still a prediction, not a reproduced published dose-response.`,
    };
  }
  const differences = [!routeMatches && `route differs (source: ${caseStudy.comparison.route.toUpperCase()})`, !dayMatches && `assessment differs (source: day ${caseStudy.comparison.assessmentDay})`].filter(Boolean).join("; ");
  return {
    verdict: "related-question",
    title: "Related biological question — not directly comparable",
    detail: `The sandbox is a model proxy: ${differences}. Do not compare its numbers with the source as though they were the same experiment.`,
  };
}

/** Curriculum map, not a numerical dataset. `ready` requires checked protocol and observation tables. */
export const REFERENCE_CASES: ReferenceCase[] = [
  { id: "acetaminophen-liver", compoundKey: "hepatotoxin", drug: "Acetaminophen", organ: "Liver", organShort: "Hepatic", teachingQuestion: "When does reactive-metabolite formation overwhelm hepatic defence?", mechanism: "Bioactivation, glutathione depletion and hepatocellular injury", endpoints: ["Transcriptomic response", "Discretized pathology", "Protocol comparison", "Model PK (not observed)"], sandboxOrgan: "liver", evidenceScope: "Rat liver pathology and source-linked transcriptomic context; not measured PK or a human dose threshold.", comparison: { route: "oral", assessmentDay: 29, doseBasis: "repeat", quantitativeEndpoints: [], qualitativeEndpoints: ["dose–time hepatic pathology pattern"], unavailable: ["plasma PK", "ALT/AST from the primary TG-GATEs protocol", "numerical NOAEL"] }, evidenceState: "curating", protocolSnapshot: ["Male SD rat · 6 weeks", "Gavage", "0 · 300 · 600 · 1,000 mg/kg", "Single + repeat studies"], publishedDoseGroups: [0, 300, 600, 1000], publishedFindings: [{ dose: 1000, time: "9 h · single", finding: "Eosinophilic change" }, { dose: 600, time: "24 h · single", finding: "Cellular infiltration and eosinophilic change" }, { dose: 1000, time: "Day 4 · repeat", finding: "Necrosis, increased mitosis, infiltration and eosinophilic change" }, { dose: 600, time: "Day 15 · repeat", finding: "Ground-glass appearance" }, { dose: 1000, time: "Day 29 · repeat", finding: "Swelling and ground-glass appearance" }], source: { label: "Open TG-GATEs · E-MTAB-799/800", citation: "Igarashi et al., Nucleic Acids Research 43 (2015), D921–D927", url: "https://doi.org/10.1093/nar/gku955" } },
  { id: "cisplatin-kidney", compoundKey: "nephrotoxin", drug: "Cisplatin", organ: "Kidneys", organShort: "Renal", teachingQuestion: "How does renal accumulation separate efficacy from tubular injury?", mechanism: "Tubular accumulation, oxidative stress and impaired filtration", endpoints: ["Observed renal pathology scores", "Reported urea / creatinine significance", "Protocol comparison", "Model PK (not observed)"], sandboxOrgan: "kidney", evidenceScope: "Acute, day-3 renal pathology scores in male Wistar rats; chemistry direction is graph-only.", comparison: { route: "ip", assessmentDay: 3, doseBasis: "single", quantitativeEndpoints: ["renal histopathology score (0–4)"], qualitativeEndpoints: ["urea and creatinine elevation"], unavailable: ["plasma PK", "long-term renal recovery", "human risk quantification"] }, evidenceState: "curating", protocolSnapshot: ["Male Wistar rat · 8–12 weeks", "Single 5 · 7.5 · 12 mg/kg IP cisplatin", "n = 8 control; 10 / dose", "Day 3 renal assessment"], publishedDoseGroups: [0, 5, 7.5, 12], publishedFindings: [{ dose: 5, time: "Day 3", finding: "Hydropic degeneration score 1.33 ± 0.17; necrosis 1.41 ± 0.20" }, { dose: 7.5, time: "Day 3", finding: "Hydropic degeneration score 1.67 ± 0.17; necrosis 1.50 ± 0.18" }, { dose: 12, time: "Day 3", finding: "Hydropic degeneration score 2.33 ± 0.40; necrosis 2.25 ± 0.25" }, { dose: 7.5, time: "Day 3", finding: "Urea and creatinine significantly elevated versus control" }], source: { label: "Open-access rat dose-response study · curating", citation: "Kaya et al., Biomedicines 14 (2026) 1490 · CC BY 4.0", url: "https://doi.org/10.3390/biomedicines14071490" } },
  { id: "doxorubicin-heart", compoundKey: "cardiotoxin", drug: "Doxorubicin", organ: "Heart", organShort: "Cardiac", teachingQuestion: "Can antitumour effect be retained below cumulative cardiac injury?", mechanism: "Topoisomerase-II activity with cumulative myocardial oxidative injury", endpoints: ["Reported ECG changes", "Observed cardiac-motion score", "Model PK (not observed)", "Protocol comparison"], sandboxOrgan: "heart", evidenceScope: "Cumulative doxorubicin rat cardiac injury: study-specific ECG and pathology teaching, not ejection fraction or clinical translation.", comparison: { route: "ip", assessmentDay: 14, doseBasis: "cumulative", quantitativeEndpoints: ["cohort-relative optical cardiac score"], qualitativeEndpoints: ["ECG morphology and interval changes"], unavailable: ["ejection fraction", "validated PK", "human dose translation"] }, evidenceState: "curating", protocolSnapshot: ["Male Sprague–Dawley rat", "2.5 mg/kg IP every 48 h", "15 mg/kg cumulative · n = 5 DOX arm", "Day 14 cardiac assessment"], publishedDoseGroups: [0, 15], publishedFindings: [{ dose: 15, time: "Day 14", finding: "Lower heart rate; prolonged QRS, PR, QT and QTc" }, { dose: 15, time: "Day 14", finding: "Reduced R-wave and negative T-wave morphology" }, { dose: 15, time: "Day 14", finding: "All DOX hearts >7.3 on cohort-relative optical score" }], source: { label: "Open-access rat study · curating", citation: "Goje et al., Medical Sciences 14 (2026) 342 · CC BY 4.0", url: "https://doi.org/10.3390/medsci14030342" } },
  { id: "paclitaxel-nerves", compoundKey: "neurotoxin", drug: "Paclitaxel", organ: "Peripheral nerves", organShort: "Neural", teachingQuestion: "How does cumulative exposure translate into sensory neuropathy?", mechanism: "Microtubule stabilisation and length-dependent peripheral axon injury", endpoints: ["Observed open-field activity", "Observed rearing behaviour", "Protocol comparison", "Model PK (not observed)"], sandboxOrgan: "brain", evidenceScope: "Rat behavioural and sensory peripheral-neuropathy phenotype; it is not a brain-histology or PK dataset.", comparison: { route: "ip", assessmentDay: 8, doseBasis: "cumulative", quantitativeEndpoints: [], qualitativeEndpoints: ["open-field distance", "rearing frequency", "delayed sensory phenotype"], unavailable: ["nerve histology", "plasma PK", "numeric graph estimates"] }, evidenceState: "curating", protocolSnapshot: ["Male + female Sprague–Dawley rats · 8–10 weeks", "6 mg/kg IP every other day × 4", "24 mg/kg cumulative · n = 6 / sex / arm", "Day 8 open-field assessment"], publishedDoseGroups: [0, 24], publishedFindings: [{ dose: 24, time: "Day 8", finding: "Distance travelled decreased in both male and female rats" }, { dose: 24, time: "Day 8", finding: "Male rearing frequency decreased versus baseline and vehicle" }, { dose: 24, time: "Day 8", finding: "No significant female rearing change was reported" }], source: { label: "Open-access rat pilot study · curating", citation: "Kim et al., Journal of Pain Research 19 (2026) 565512 · CC BY-NC 4.0", url: "https://doi.org/10.2147/JPR.S565512" } },
  { id: "cyclophosphamide-marrow", compoundKey: "myelotoxin", drug: "Cyclophosphamide", organ: "Bone marrow", organShort: "Marrow", teachingQuestion: "How quickly does marrow suppression appear and recover after dosing?", mechanism: "Metabolic activation, DNA cross-linking and suppression of proliferating marrow", endpoints: ["Observed white-cell counts", "Observed lymphocyte counts", "Protocol comparison", "Model PK (not observed)"], sandboxOrgan: "marrow", evidenceScope: "Day-15 peripheral-blood suppression in female Sprague–Dawley rats; no source marrow histology or recovery curve.", comparison: { route: "im", assessmentDay: 15, doseBasis: "cumulative", quantitativeEndpoints: ["WBC", "lymphocytes", "RBC", "haemoglobin", "platelets"], qualitativeEndpoints: ["peripheral-blood suppression"], unavailable: ["marrow histology", "clinical recovery", "NOAEL", "plasma PK"] }, evidenceState: "curating", protocolSnapshot: ["Female Sprague–Dawley rat · 8–9 weeks", "30 mg/kg IM on days 1, 3 & 5", "90 mg/kg cumulative · n = 6", "Day 15 blood assessment"], publishedDoseGroups: [0, 90], publishedFindings: [{ dose: 90, time: "Day 15", finding: "WBC 3.8 ± 0.9 × 10⁹/L versus 10.7 ± 1.1 in intact controls" }, { dose: 90, time: "Day 15", finding: "Lymphocytes 1.5 ± 0.1 × 10⁹/L versus 6.7 ± 1.5 in intact controls" }, { dose: 90, time: "Day 15", finding: "Reported marked leukocyte and lymphocyte suppression" }], source: { label: "Open-access rat study · curating", citation: "Ten et al., Frontiers in Pharmacology 17 (2026) 1852779 · CC BY 4.0", url: "https://doi.org/10.3389/fphar.2026.1852779" } },
];

export function referenceCaseForCompound(compoundKey: string): ReferenceCase | undefined {
  return REFERENCE_CASES.find((item) => item.compoundKey === compoundKey);
}
