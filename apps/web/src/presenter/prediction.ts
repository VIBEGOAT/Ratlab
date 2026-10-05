import { ORGANS, type AnimalBundle, type Organ } from "@eliminate/sim-core";

/** The five organs offered to the audience. The gut is left out to keep the choice to five big buttons. */
export const PREDICT_ORGANS: Organ[] = ["liver", "kidney", "heart", "brain", "marrow"];

export interface FirstToFail {
  organ: Organ;
  /** day the organ first reached grade 2 (mild injury), or null when none did */
  day: number | null;
  /** how the answer was decided */
  basis: "first to reach mild injury" | "highest peak injury";
}

/** Grade 2 starts at damage 0.15 in the pathology scale. */
const MILD = 0.15;

/**
 * Which organ shows injury first. The earliest day an organ reaches mild injury wins; ties go to the larger
 * damage on that day. If no offered organ ever reaches mild injury, the organ with the highest peak wins.
 */
export function firstToFail(b: Pick<AnimalBundle, "daily" | "days">): FirstToFail {
  let best: { organ: Organ; day: number; d: number } | null = null;
  for (const organ of PREDICT_ORGANS) {
    const series = b.daily.damage[organ];
    for (let day = 0; day <= b.days; day++) {
      const d = series[day] ?? 0;
      if (d >= MILD) {
        if (!best || day < best.day || (day === best.day && d > best.d)) best = { organ, day, d };
        break;
      }
    }
  }
  if (best) return { organ: best.organ, day: best.day, basis: "first to reach mild injury" };
  let peakOrgan: Organ = PREDICT_ORGANS[0]!, peak = -1;
  for (const organ of PREDICT_ORGANS) {
    const m = Math.max(0, ...b.daily.damage[organ]);
    if (m > peak) { peak = m; peakOrgan = organ; }
  }
  return { organ: peakOrgan, day: null, basis: "highest peak injury" };
}

export type Votes = Record<Organ, number>;
export const emptyVotes = (): Votes => Object.fromEntries(ORGANS.map((o) => [o, 0])) as Votes;

export function totalVotes(v: Votes): number {
  return PREDICT_ORGANS.reduce((s, o) => s + v[o], 0);
}

/** Share of recorded votes that picked the answer, or null when nobody voted. */
export function shareCorrect(v: Votes, answer: Organ): number | null {
  const t = totalVotes(v);
  return t === 0 ? null : v[answer] / t;
}

export function addVote(v: Votes, organ: Organ, delta = 1): Votes {
  return { ...v, [organ]: Math.max(0, v[organ] + delta) };
}
