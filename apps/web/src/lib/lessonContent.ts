import type { Organ } from "@eliminate/sim-core";

export interface LessonContent {
  target: Organ;
  mechanismTitle: string;
  mechanism: string[];
  markers: Array<{ key: string; label: string; unit: string }>;
  question: string;
  options: Array<{ key: string; label: string }>;
  correct: string;
  explanation: string;
}

export const LESSON_CONTENT: Record<string, LessonContent> = {
  hepatotoxin: {
    target: "liver", mechanismTitle: "Why the liver responds",
    mechanism: ["The liver converts the drug", "A reactive metabolite forms", "Cell defences are depleted", "Hepatocytes become injured"],
    markers: [{ key: "chem__ALT(IU/L)", label: "ALT", unit: "IU/L" }, { key: "chem__AST(IU/L)", label: "AST", unit: "IU/L" }, { key: "organ__LIVER(g)", label: "Liver weight", unit: "g" }],
    question: "What makes liver injury more likely as exposure rises?", options: [{ key: "defence", label: "Protective defences are overwhelmed" }, { key: "size", label: "The liver becomes physically smaller first" }, { key: "route", label: "Every route causes identical exposure" }], correct: "defence",
    explanation: "Correct: injury becomes more likely when reactive-metabolite formation outpaces the liver's protective defences.",
  },
  nephrotoxin: {
    target: "kidney", mechanismTitle: "Why the kidneys respond",
    mechanism: ["The drug reaches the circulation", "Renal tubules concentrate exposure", "Tubular cells become stressed", "Filtration markers change"],
    markers: [{ key: "chem__BUN(mg/dL)", label: "Blood urea nitrogen", unit: "mg/dL" }, { key: "chem__CRE(mg/dL)", label: "Creatinine", unit: "mg/dL" }, { key: "organ__KIDNEY_TOTAL(g)", label: "Kidney weight", unit: "g" }],
    question: "Why can renal tubules be especially vulnerable?", options: [{ key: "concentrate", label: "They can concentrate drug exposure" }, { key: "none", label: "They receive no blood flow" }, { key: "immune", label: "They make all circulating immune cells" }], correct: "concentrate",
    explanation: "Correct: renal handling can concentrate a compound in tubular cells, increasing local stress.",
  },
  cardiotoxin: {
    target: "heart", mechanismTitle: "How cumulative heart stress develops",
    mechanism: ["Drug reaches heart muscle", "Repeated exposure adds cellular stress", "Repair cannot fully keep pace", "Cardiac function may change"],
    markers: [{ key: "heart_rate", label: "Heart rate", unit: "bpm" }, { key: "qtc", label: "QTc interval", unit: "ms" }, { key: "heart_grade", label: "Heart injury grade", unit: "0–5" }],
    question: "Why does study length matter for this model?", options: [{ key: "cumulative", label: "Cardiac stress can accumulate" }, { key: "instant", label: "Only the first minute matters" }, { key: "unrelated", label: "Time never affects toxicity" }], correct: "cumulative",
    explanation: "Correct: this teaching model represents cardiac stress accumulating across repeated exposure.",
  },
  neurotoxin: {
    target: "brain", mechanismTitle: "How nervous-system effects appear",
    mechanism: ["Drug reaches neural tissue", "Neuronal signalling is disturbed", "Coordination or sensation changes", "Behaviour reveals functional effects"],
    markers: [{ key: "activity", label: "Activity", unit: "% baseline" }, { key: "tremor", label: "Tremor score", unit: "0–5" }, { key: "brain_grade", label: "Neural injury grade", unit: "0–5" }],
    question: "Which observation best connects neural exposure to function?", options: [{ key: "behaviour", label: "A change in coordinated behaviour" }, { key: "weight", label: "Bottle weight alone" }, { key: "colour", label: "Cage colour" }], correct: "behaviour",
    explanation: "Correct: functional behaviour is a useful teaching readout for altered nervous-system signalling.",
  },
  myelotoxin: {
    target: "marrow", mechanismTitle: "Why blood-cell counts fall",
    mechanism: ["Drug reaches bone marrow", "Dividing precursor cells are injured", "Fewer mature cells are produced", "Blood counts decline"],
    markers: [{ key: "hema__WBC(x10_2/uL)", label: "White blood cells", unit: "×10²/µL" }, { key: "hema__RBC(x10_4/ul)", label: "Red blood cells", unit: "×10⁴/µL" }, { key: "hema__Plat(x10_4/uL)", label: "Platelets", unit: "×10⁴/µL" }],
    question: "Why is marrow sensitive to some toxicants?", options: [{ key: "division", label: "Its precursor cells divide rapidly" }, { key: "empty", label: "It contains no living cells" }, { key: "isolated", label: "Drugs cannot reach it" }], correct: "division",
    explanation: "Correct: rapidly dividing blood-cell precursors are vulnerable to agents that disrupt cell division.",
  },
};

export function severityFromGrade(grade: number): "low" | "moderate" | "severe" {
  return grade <= 1 ? "low" : grade <= 3 ? "moderate" : "severe";
}
