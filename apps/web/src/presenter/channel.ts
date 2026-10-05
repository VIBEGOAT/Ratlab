import type { Organ } from "@eliminate/sim-core";
import type { TrackId } from "./tracks";
import type { Votes } from "./prediction";

/** Same-origin link between the main window and the speaker-notes window. Nothing leaves the browser. */
export const CHANNEL_NAME = "eliminate-presenter";

export interface SyncState {
  active: boolean;
  track: TrackId;
  index: number;
  playing: boolean;
  slideElapsed: number;
  votes: Votes;
  revealed: boolean;
  /** the real answer to "which organ fails first", for the presenter's eyes only */
  answer: Organ | null;
}

export type Cmd = "next" | "prev" | "toggle" | "exit" | "start3" | "start8";

export type Msg =
  | { type: "state"; state: SyncState }
  | { type: "cmd"; cmd: Cmd }
  | { type: "hello" };

export function openChannel(): BroadcastChannel | null {
  try { return typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME); } catch { return null; }
}

export const isNotesWindow = () => typeof location !== "undefined" && location.hash === "#notes";

export function openNotesWindow(): Window | null {
  const url = `${location.pathname}${location.search}#notes`;
  return window.open(url, "eliminate-notes", "popup=yes,width=980,height=720");
}
