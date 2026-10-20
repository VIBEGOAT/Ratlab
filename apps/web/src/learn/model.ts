/** Teaching model v1: linear one-compartment oral PK, not the rat PBPK engine.
 * All parameters are fictional teaching values, normalized by body weight.
 * Exact Bateman solution; first-order absorption/elimination; linear superposition.
 */
export const MODEL_VERSION = "vast-teaching-pk-1";
export interface Regimen { dose: number; clearance: number; interval: number; repeated: boolean }
export const BASE: Regimen = { dose: 10, clearance: 0.2, interval: 24, repeated: false };
export const VOLUME = 1; // L/kg
export const BIOAVAILABILITY = 0.8;
export const ABSORPTION = 1; // /h
export const HORIZON = 72;
export type Prediction = "higher" | "same" | "lower";
export const EXPERIMENTS = [
  { id: "dose", title: "Change the dose", question: "If the oral dose doubles, what happens to AUC over 72 hours?", variable: "Dose", control: BASE, treatment: { ...BASE, dose: 20 }, answer: "higher", insight: "Doubling dose doubles every concentration and AUC in this linear model. Clearance and half-life stay the same. Real compounds can depart from this relationship when processes saturate.", prompt: "Use the AUC ratio to explain your prediction. Which assumption makes this proportional relationship possible?" },
  { id: "clearance", title: "Change clearance", question: "If clearance halves while volume stays fixed, what happens to elimination half-life?", variable: "Clearance", control: BASE, treatment: { ...BASE, clearance: 0.1 }, answer: "higher", insight: "Half-life = ln(2) × volume / clearance. Halving clearance doubles half-life. Total single-dose AUC to infinity doubles; AUC within a finite 72-hour window is slightly less than twice the control because some exposure remains after the window.", prompt: "Explain why half-life changes even though the administered dose does not. Why is AUC to infinity different from AUC over 72 hours?" },
  { id: "interval", title: "Change the interval", question: "If doses are given every 12 rather than 24 hours, does elimination half-life change?", variable: "Dosing interval", control: { ...BASE, repeated: true }, treatment: { ...BASE, repeated: true, interval: 12 }, answer: "same", insight: "The dosing interval changes input, not clearance or volume, so elimination half-life stays the same. Giving the same dose twice as often doubles the daily dose and the theoretical steady-state average concentration. This is not a comparison at equal daily dose.", prompt: "Why can exposure increase while half-life stays the same? State how the total dose differs between these experiments." },
] as const;
export const QUESTIONS = [
  { question: "Two regimens give the same mg/kg per dose. Must their exposure be equal?", options: ["Yes, dose alone determines exposure", "No, clearance, bioavailability, and timing also matter", "Only the number of organs matters"], correct: 1, explanation: "Dose describes the input. Exposure also depends on how much reaches circulation, how it is eliminated, and the dosing schedule." },
  { question: "A new fictional compound has twice the distribution volume at the same clearance. What happens to elimination half-life?", options: ["It halves", "It stays the same", "It doubles"], correct: 2, explanation: "Half-life = ln(2) × V / CL. Doubling V at fixed CL doubles half-life. This is a transfer question; volume was fixed in the experiments." },
  { question: "Why did the 12-hour regimen produce more exposure than the 24-hour regimen?", options: ["It delivered more drug over the same period", "The model automatically reduced clearance", "Its half-life was doubled"], correct: 0, explanation: "At the same dose per administration, shortening the interval increases dose rate. Clearance and volume were unchanged." },
  { question: "What do these simulations establish about real animal safety?", options: ["The highest simulated concentration is a safe limit", "Nothing by themselves; biological safety requires appropriate evidence", "A good-looking curve proves the model is validated"], correct: 1, explanation: "This teaching model has no validated toxicity endpoint or safety threshold. Its outputs illustrate mathematical relationships, not safe doses." },
] as const;

export function simulate(p: Regimen) {
  if (![p.dose, p.clearance, p.interval].every((x) => Number.isFinite(x) && x > 0) || p.interval < 1) throw new Error("Dose, clearance, and interval must be positive; interval must be at least one hour.");
  const k = p.clearance / VOLUME;
  const doses = p.repeated ? Array.from({ length: Math.ceil(HORIZON / p.interval) }, (_, i) => i * p.interval) : [0];
  const times = Array.from({ length: HORIZON * 10 + 1 }, (_, i) => i / 10);
  const concentration = (t: number) => doses.reduce((sum, d) => {
    const dt = t - d;
    if (dt <= 0) return sum;
    const factor = Math.abs(ABSORPTION - k) < 1e-8 ? k * dt * Math.exp(-k * dt) : ABSORPTION / (ABSORPTION - k) * (Math.exp(-k * dt) - Math.exp(-ABSORPTION * dt));
    return sum + BIOAVAILABILITY * p.dose / VOLUME * factor;
  }, 0);
  const values = times.map(concentration);
  const auc = doses.reduce((sum, d) => {
    const dt = HORIZON - d;
    const fraction = Math.abs(ABSORPTION - k) < 1e-8 ? 1 - (1 + k * dt) * Math.exp(-k * dt) : 1 - (ABSORPTION * Math.exp(-k * dt) - k * Math.exp(-ABSORPTION * dt)) / (ABSORPTION - k);
    return sum + BIOAVAILABILITY * p.dose / p.clearance * fraction;
  }, 0);
  return { times, values, auc, peak: Math.max(...values), halfLife: Math.LN2 / k, totalDose: p.dose * doses.length, doses, steadyAverage: p.repeated ? BIOAVAILABILITY * p.dose / (p.clearance * p.interval) : null };
}
