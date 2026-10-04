import { listUnverifiedConstants, CONSTANTS } from "./reference";

/**
 * Credibility assessment structured after the ASME V&V 40-2018 risk-informed framework:
 * context of use, model risk, credibility factors, and gaps against the level the risk demands.
 * V&V 40 was written for medical devices; applying it here is by analogy. The risk matrix
 * and level scales below are an illustrative mapping, not text from the standard.
 */

export type Level = "low" | "medium" | "high";

export interface ContextOfUse {
  question: string;
  /** what the model result is used for */
  role: string;
  /** how much the decision relies on the model alone: low means other evidence also supports it */
  modelInfluence: Level;
  /** harm if the model is wrong */
  decisionConsequence: Level;
}

export const CONTEXT_PRESETS: Record<string, ContextOfUse> = {
  education: { question: "Teach how dose, exposure and organ injury relate in a repeated-dose rat study.", role: "Demonstration only", modelInfluence: "low", decisionConsequence: "low" },
  screening: { question: "Rank fictional or early compounds by expected liver and kidney liability before choosing which to test in animals.", role: "Prioritisation, supported by in vitro data", modelInfluence: "medium", decisionConsequence: "medium" },
  designAid: { question: "Choose dose levels and group sizes for a planned animal study.", role: "Study design support, reviewed by a toxicologist", modelInfluence: "medium", decisionConsequence: "medium" },
  replacement: { question: "Replace a regulatory repeated-dose animal study.", role: "Sole basis for a safety decision", modelInfluence: "high", decisionConsequence: "high" },
};

const SCORE: Record<Level, number> = { low: 1, medium: 2, high: 3 };

/** Illustrative risk matrix: higher influence and higher consequence give higher risk. */
export function modelRisk(influence: Level, consequence: Level): Level {
  const s = SCORE[influence] + SCORE[consequence];
  return s <= 3 ? "low" : s <= 4 ? "medium" : "high";
}

export const REQUIRED_LEVEL: Record<Level, number> = { low: 1, medium: 2, high: 3 };

/** Validation and applicability evidence is not demanded for low-risk uses such as teaching. */
export function requiredLevelFor(category: CredibilityFactor["category"], risk: Level): number {
  if ((category === "validation" || category === "applicability") && risk === "low") return 0;
  return REQUIRED_LEVEL[risk];
}

export interface CredibilityFactor {
  id: string;
  category: "verification" | "validation" | "applicability" | "uncertainty";
  name: string;
  /** 0 not addressed, 1 basic, 2 good, 3 rigorous */
  achieved: 0 | 1 | 2 | 3;
  evidence: string[];
  gap: string;
}

export interface CredibilityReport {
  context: ContextOfUse;
  risk: Level;
  requiredLevel: number;
  factors: Array<CredibilityFactor & { required: number; shortfall: number }>;
  adequate: boolean;
  summary: string;
}

/** Factors and the evidence that exists in this repository today. Update as work is done. */
export function currentFactors(): CredibilityFactor[] {
  const nUnverified = listUnverifiedConstants().length;
  const nConst = Object.keys(CONSTANTS).length;
  return [
    { id: "v-sqa", category: "verification", name: "Software quality assurance", achieved: 2, evidence: ["Unit tests run in CI", "Seeded, deterministic runs and a version string on every output", "Type-checked TypeScript"], gap: "No independent code review yet" },
    { id: "v-code", category: "verification", name: "Numerical code verification", achieved: 2, evidence: ["Matrix exponential agrees with an adaptive ODE solver", "Mass balance to 1e-9 for every route", "PD models match analytic steady states", "Statistics match hand-computed examples and simulation"], gap: "No comparison with an independent PBPK platform such as PK-Sim" },
    { id: "v-disc", category: "verification", name: "Discretisation error", achieved: 1, evidence: ["Fixed 0.25 h step with exact linear PK propagation"], gap: "No systematic time-step convergence study for the toxicodynamics" },
    { id: "v-solver", category: "verification", name: "Numerical solver error", achieved: 2, evidence: ["Adaptive RK45 with error control", "Exact matrix exponential for the linear block"], gap: "" },
    { id: "v-use", category: "verification", name: "Use error", achieved: 1, evidence: ["Fidelity labels and disclaimers in every output"], gap: "No usability testing with toxicologists" },
    { id: "val-form", category: "validation", name: "Model form", achieved: 1, evidence: ["Flow-limited PBPK, damage-repair equations, standard PD and growth models"], gap: "Mechanisms chosen by design, not compared with alternatives" },
    { id: "val-inputs", category: "validation", name: "Model inputs", achieved: 0, evidence: [`${nUnverified} of ${nConst} constants are UNVERIFIED`, "All compounds are fictional archetypes"], gap: "Needs verified physiology tables and compound parameters from data" },
    { id: "val-samples", category: "validation", name: "Comparator test samples", achieved: 0, evidence: [], gap: "No animal data loaded" },
    { id: "val-conditions", category: "validation", name: "Comparator test conditions", achieved: 0, evidence: [], gap: "No animal data loaded" },
    { id: "val-equiv", category: "validation", name: "Equivalence of input parameters", achieved: 0, evidence: [], gap: "Needs matched strain, age, sex and dosing" },
    { id: "val-output", category: "validation", name: "Output comparison (agreement and rigor)", achieved: 0, evidence: ["Harness exists and reports NO_DATA"], gap: "Needs real control and treated-group data" },
    { id: "app-rel", category: "applicability", name: "Relevance of validation to the context of use", achieved: 0, evidence: [], gap: "Nothing validated yet" },
    { id: "uq", category: "uncertainty", name: "Uncertainty quantification", achieved: 1, evidence: ["Inter-animal variability by Monte Carlo", "Morris sensitivity screening"], gap: "Parameter uncertainty is not propagated from calibration data" },
  ];
}

export function assessCredibility(context: ContextOfUse, factors: CredibilityFactor[] = currentFactors()): CredibilityReport {
  const risk = modelRisk(context.modelInfluence, context.decisionConsequence);
  const req = REQUIRED_LEVEL[risk];
  const rows = factors.map((f) => { const required = requiredLevelFor(f.category, risk); return { ...f, required, shortfall: Math.max(0, required - f.achieved) }; });
  const short = rows.filter((r) => r.shortfall > 0);
  return {
    context, risk, requiredLevel: req, factors: rows, adequate: short.length === 0,
    summary: short.length === 0
      ? "All credibility factors meet the level required for this context of use."
      : `Not yet credible for this context of use: ${short.length} of ${rows.length} factors fall short of level ${req}. The largest gaps are ${short.sort((a, b) => b.shortfall - a.shortfall).slice(0, 3).map((r) => r.name.toLowerCase()).join(", ")}.`,
  };
}
