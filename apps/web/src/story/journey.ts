export const CHAPTER_IDS = ['compound', 'dose', 'distribution', 'organs', 'response', 'human'] as const;
export const JOURNEY_TITLES = ['Meet the compound', 'Choose the dose', 'Follow the exposure', 'Read the organ response', 'Explore dose–response', 'Make the human connection'] as const;
export const JOURNEY_PATH = 'M150 270 C185 270 200 240 235 240 S290 300 325 300 S380 240 415 240 S470 300 505 300 S550 270 580 270';
export const PROFILES = [
  { name: 'V-01 · Liver-focused', target: 'Liver', clearance: .2, midpoint: 80, question: 'How does a larger dose change exposure and the liver response?' },
  { name: 'V-02 · Kidney-focused', target: 'Kidneys', clearance: .1, midpoint: 50, question: 'What changes when clearance slows and kidneys are more sensitive?' },
] as const;
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export function journeyState(progress: number) {
  const p = clamp(progress), scaled = p * 6, chapter = Math.min(5, Math.floor(scaled));
  const local = p === 1 ? 1 : scaled - chapter;
  const travel = clamp(local / .35), eased = travel * travel * (3 - 2 * travel);
  return { progress: p, chapter, local, pathProgress: chapter === 0 ? 0 : (chapter - 1 + eased) / 5, pose: local < .35 && chapter > 0 ? 'walk' : chapter === 3 ? 'react' : 'pause' };
}
export const sectionProgress = (top: number, height: number, viewport: number) => clamp(-top / Math.max(1, height - viewport));
export const chapterProgress = (chapter: number) => (clamp(chapter, 0, 5) + .55) / 6;
// Fictional teaching models: oral one-compartment PK (F=.8, V=1 L/kg, ka=1/h), and a Hill response index.
export const concentration = (t: number, dose: number, clearance: number) => .8 * dose / (1 - clearance) * (Math.exp(-clearance * t) - Math.exp(-t));
export const injury = (dose: number, midpoint: number) => dose ** 2 / (midpoint ** 2 + dose ** 2);
