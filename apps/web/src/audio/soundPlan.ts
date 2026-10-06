/**
 * What the optional sound should be doing at a point in the story. Pure, so it is tested without audio.
 * Sound is off by default, never plays by itself, and is silent for the humane endpoint moment.
 */
export interface SoundPlan {
  /** low ambient bed level, 0 to 1 */
  bed: number;
  /** heartbeat level, 0 to 1 */
  beat: number;
  /** heartbeat rate in beats per minute, scaled down from the rat's so it reads as a heartbeat */
  beatBpm: number;
}

/** A rat's heart beats about five times faster than the sound can usefully carry. */
export function audibleBpm(ratBpm: number): number {
  return Math.min(110, Math.max(48, ratBpm / 5));
}

export function soundPlan(chapter: number, progress: number, ratHeartRateBpm: number): SoundPlan {
  const bpm = audibleBpm(ratHeartRateBpm);
  const p = Math.min(1, Math.max(0, progress));
  if (chapter === 3) return { bed: 0.3, beat: 0, beatBpm: bpm };
  if (chapter === 4) return { bed: 0.55, beat: 0.5, beatBpm: bpm };
  // the humane endpoint: the heartbeat fades first, then the bed, until silence
  if (chapter === 5) return { bed: Math.max(0, 0.55 * (1 - p / 0.7)), beat: Math.max(0, 0.5 * (1 - p / 0.4)), beatBpm: bpm * (1 - 0.35 * Math.min(1, p / 0.4)) };
  return { bed: 0, beat: 0, beatBpm: bpm };
}

/** How the rat itself sounds, from its modelled condition. Never a distress call: sicker means quieter, not louder. */
export interface AmbiencePlan {
  /** seconds between sniffing bouts, as a range; null means silence */
  sniffEvery: [number, number] | null;
  /** sniff loudness, 0 to 1 */
  sniffStrength: number;
  /** whether clicking the rat gives a curious chirp */
  chirp: boolean;
  /** footsteps per bout in the arena, from activity */
  steps: number;
}

export function ambiencePlan(sickness: number, humaneReached: boolean, activity = 1): AmbiencePlan {
  const s = Math.min(1, Math.max(0, Number.isFinite(sickness) ? sickness : 0));
  if (humaneReached || s >= 0.85) return { sniffEvery: null, sniffStrength: 0, chirp: false, steps: 0 };
  const a = Math.min(1.5, Math.max(0, Number.isFinite(activity) ? activity : 1));
  return {
    sniffEvery: [2.5 + 6 * s, 6 + 10 * s],
    sniffStrength: 1 - 0.75 * s,
    chirp: s < 0.4,
    steps: Math.round(5 * a * (1 - s)),
  };
}
