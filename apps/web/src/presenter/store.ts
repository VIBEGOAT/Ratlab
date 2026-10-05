import { create } from "zustand";
import type { Organ } from "@eliminate/sim-core";
import { TRACKS, trackSeconds, type TrackId } from "./tracks";
import { addVote, emptyVotes, type Votes } from "./prediction";

interface PresenterState {
  active: boolean;
  track: TrackId;
  index: number;
  /** auto-advance is running */
  playing: boolean;
  /** seconds spent on the current slide */
  slideElapsed: number;
  votes: Votes;
  /** the answer has been shown */
  revealed: boolean;
  start: (track?: TrackId) => void;
  stop: () => void;
  setTrack: (t: TrackId) => void;
  goto: (index: number) => void;
  next: () => void;
  prev: () => void;
  setPlaying: (on: boolean) => void;
  tickElapsed: (dt: number) => void;
  vote: (o: Organ, delta?: number) => void;
  clearVotes: () => void;
}

const last = (t: TrackId) => TRACKS[t].slides.length - 1;

export const usePresenter = create<PresenterState>((set, get) => ({
  active: false,
  track: "3min",
  index: 0,
  playing: false,
  slideElapsed: 0,
  votes: emptyVotes(),
  revealed: false,
  start: (track) => set((s) => ({ active: true, track: track ?? s.track, index: 0, playing: false, slideElapsed: 0, revealed: false })),
  stop: () => set({ active: false, playing: false }),
  setTrack: (track) => set({ track, index: 0, slideElapsed: 0, playing: false, revealed: false }),
  goto: (index) => {
    const { track } = get();
    const i = Math.max(0, Math.min(last(track), index));
    const kind = TRACKS[track].slides[i]!.kind;
    set((s) => ({ index: i, slideElapsed: 0, revealed: kind === "reveal" ? true : kind === "ask" ? false : s.revealed && i > s.index }));
  },
  next: () => {
    const { index, track } = get();
    if (index >= last(track)) set({ playing: false });
    else get().goto(index + 1);
  },
  prev: () => get().goto(get().index - 1),
  setPlaying: (playing) => set({ playing }),
  tickElapsed: (dt) => {
    const { slideElapsed, index, track, playing } = get();
    if (!playing) return;
    const e = slideElapsed + dt;
    if (e >= TRACKS[track].slides[index]!.seconds) get().next();
    else set({ slideElapsed: e });
  },
  vote: (o, delta = 1) => set((s) => ({ votes: addVote(s.votes, o, delta) })),
  clearVotes: () => set({ votes: emptyVotes() }),
}));

/** Fraction of the whole track completed, 0 to 1. */
export function trackProgress(track: TrackId, index: number, slideElapsed: number): number {
  const slides = TRACKS[track].slides;
  let done = 0;
  for (let i = 0; i < index; i++) done += slides[i]!.seconds;
  done += Math.min(slides[index]?.seconds ?? 0, slideElapsed);
  return done / trackSeconds(track);
}
