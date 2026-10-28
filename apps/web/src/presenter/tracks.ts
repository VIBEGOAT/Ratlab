import { CHAPTER_IDS, JOURNEY_TITLES } from '../story/journey';

export type SlideKind = 'plain' | 'ask' | 'reveal';
export interface Slide {
  id: string; title: string; chapter: number; from: number; to: number;
  seconds: number; notes: string; kind?: SlideKind;
}
export type TrackId = '3min' | '8min';
const notes = [
  'Introduce the two fictional profiles. Invite a prediction before changing dose. This teaching model does not replace animal studies; its parameters are unverified.',
  'Move the dose slider. A single oral dose is shared across all six stations. The capsule size is a visual cue; it is not a claim about what the animal feels.',
  'Trace the one-compartment curve. Absorption is 1/h, bioavailability is 80%, and elimination depends on the selected profile. These are illustrative assumptions, not measured PK.',
  'Inspect each organ. Only the selected target has an injury relationship. The other organs show exposure only. The response index is not a pathology grade or a probability of harm.',
  'Drag dose and compare the response with the dashed midpoint. The midpoint is 50% model response, not a safety threshold. This is a fictional Hill relationship.',
  'Explain the adult reference Km factors: rat 6 and human 37. Change body weight to see total dose. This arithmetic must never guide a real dose; there is no safety factor or validated NOAEL. Open the workbench to continue.',
];
const slides = (seconds: number): Slide[] => CHAPTER_IDS.map((id, chapter) => ({
  id, chapter, title: JOURNEY_TITLES[chapter]!, from: .4, to: .85, seconds, notes: notes[chapter]!,
}));
export const TRACKS: Record<TrackId, { label: string; slides: Slide[] }> = {
  '3min': { label: '3 minutes', slides: slides(30) },
  '8min': { label: '8 minutes', slides: slides(80) },
};
export const trackSeconds = (id: TrackId) => TRACKS[id].slides.reduce((sum, slide) => sum + slide.seconds, 0);
export const secondsBefore = (id: TrackId, index: number) => TRACKS[id].slides.slice(0, index).reduce((sum, slide) => sum + slide.seconds, 0);
