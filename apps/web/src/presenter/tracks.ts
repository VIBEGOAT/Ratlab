/**
 * Scripted demo tracks. Each slide scrolls the Story to a chapter and, for some, drifts through it
 * (so day counters advance and the humane-endpoint lines appear in order). Speaker notes are shown
 * on the second-screen notes window. Notes state caveats plainly so they get said out loud.
 */
export type SlideKind = "plain" | "ask" | "reveal";

export interface Slide {
  id: string;
  title: string;
  /** story chapter index, 0 to 11 */
  chapter: number;
  /** progress within the chapter at the start and the end of the slide, 0 to 1 */
  from: number;
  to: number;
  /** planned dwell time in seconds */
  seconds: number;
  notes: string;
  kind?: SlideKind;
}

export type TrackId = "3min" | "8min";

const hero: Slide = { id: "hero", title: "Every animal we spare", chapter: 0, from: 0.05, to: 0.1, seconds: 12, notes: "Open with the line on screen. One sentence: a virtual laboratory rat that shows what a compound would do before any animal is dosed. Say once, early, that this is a prototype and that it does not replace animal studies; it aims to reduce and refine their use." };
const meet: Slide = { id: "meet", title: "Meet the rat", chapter: 1, from: 0.1, to: 0.7, seconds: 12, notes: "The X-ray sweep runs head to tail. Point out that it is one body: the drug moves through 17 compartments and six organs are watched for injury. Everything you see is generated from equations, and every run is reproducible from a seed." };
const choose: Slide = { id: "choose", title: "Choose a compound and dose", chapter: 2, from: 0.3, to: 0.5, seconds: 12, notes: "Five fictional compounds, each harming a different organ. Nothing here is a real substance. Turn the dial to show the dose changing; the study re-runs in the background." };
const dose: Slide = { id: "dose", title: "Dose day", chapter: 3, from: 0.1, to: 0.9, seconds: 20, notes: "Follow the capsule to the stomach, then the glowing particles through the gut, the portal vein and the liver, into the blood. The glow is concentration from the PBPK model, scaled to each organ's own peak. This is the mechanistic part of the model." };
const ask: Slide = { id: "ask", title: "Which organ fails first?", chapter: 3, from: 0.95, to: 0.95, seconds: 12, kind: "ask", notes: "Ask the room: which organ will show injury first? Take a show of hands for each organ and tap the matching button to count it. There is no backend, so this is a manual tally. Do not reveal yet." };
const damage: Slide = { id: "damage", title: "Damage unfolds", chapter: 4, from: 0.02, to: 0.85, seconds: 26, notes: "Twenty-eight days compressed. Watch the grade pills and the blood tests: troponin climbs while liver and kidney markers stay normal. Visible signs appear as injury and the tumour grow. If a Hy's Law banner shows, explain it: liver enzymes and bilirubin both high." };
const reveal: Slide = { id: "reveal", title: "The answer", chapter: 4, from: 0.85, to: 0.85, seconds: 12, kind: "reveal", notes: "Reveal the first organ to show injury and read out the share of the room that guessed it. Keep it light on the quiz and serious on the subject: these are injuries that would be happening to a living animal." };
const moment: Slide = { id: "moment", title: "The humane endpoint", chapter: 5, from: 0.05, to: 0.8, seconds: 24, notes: "Pause. Do not talk over the text; let the room read each line. Tone: serious and dignified. The point is that this is the day a living animal would have suffered, and here no one did. The number that follows is how many virtual rats this single study used instead." };
const twin: Slide = { id: "twin", title: "The untreated twin", chapter: 6, from: 0.3, to: 0.6, seconds: 14, notes: "The same rat with and without treatment. Drag the divider. A real animal can only ever be one of these, which is why this comparison is impossible in a laboratory." };
const forecast: Slide = { id: "forecast", title: "A thousand rats", chapter: 7, from: 0.25, to: 0.8, seconds: 14, notes: "A thousand virtual rats, each with its own body. Treated against untreated humane endpoints, with 95% ranges. Say what the ranges cover: chance only, not uncertainty in the model's parameters, which are still unverified." };
const behaviour: Slide = { id: "behaviour", title: "How it behaves", chapter: 8, from: 0.2, to: 0.5, seconds: 20, notes: "Behaviour is the least validated part. It is a modelled endpoint, not a claim about what the animal feels. Use it to show the pieces connecting, not to predict real behaviour." };
const humans: Slide = { id: "humans", title: "Toward humans", chapter: 9, from: 0.1, to: 0.8, seconds: 25, notes: "Doses scale by body surface area, not weight. This is arithmetic on a simulated NOAEL of a fictional compound. The conversion factors are still marked unverified. It must never guide a real dose." };
const trust: Slide = { id: "trust", title: "How far to trust it", chapter: 10, from: 0.4, to: 0.4, seconds: 10, notes: "Say it plainly: no part of this has been validated against animal data, and most parameters are unverified placeholders. Click through the uses: teaching passes, screening and replacing an animal study do not. That honesty is the credibility." };
const finale: Slide = { id: "finale", title: "What it could spare", chapter: 11, from: 0.3, to: 0.3, seconds: 12, notes: "The number depends entirely on the assumptions, which you can edit live. Close with the next step: validate one organ against real rat data. Invite questions." };

export const TRACKS: Record<TrackId, { label: string; slides: Slide[] }> = {
  "3min": {
    label: "3 minutes",
    slides: [hero, meet, choose, dose, ask, damage, reveal, moment, twin, { ...forecast, seconds: 14 }, trust, finale],
  },
  "8min": {
    label: "8 minutes",
    slides: [
      { ...hero, seconds: 20 }, { ...meet, seconds: 30, notes: meet.notes + " Mention the six organs by name as the labels fly in." },
      { ...choose, seconds: 30 }, { ...dose, seconds: 45 }, { ...ask, seconds: 35 }, { ...damage, seconds: 55 },
      { ...reveal, seconds: 25 }, { ...moment, seconds: 45 }, { ...twin, seconds: 35, to: 0.7 }, { ...forecast, seconds: 45 },
      { ...behaviour, seconds: 20 }, { ...humans, seconds: 25 }, { ...trust, seconds: 40 }, { ...finale, seconds: 30 },
    ],
  },
};

export function trackSeconds(id: TrackId): number {
  return TRACKS[id].slides.reduce((s, x) => s + x.seconds, 0);
}

/** Seconds elapsed before slide `index` starts. */
export function secondsBefore(id: TrackId, index: number): number {
  return TRACKS[id].slides.slice(0, index).reduce((s, x) => s + x.seconds, 0);
}
