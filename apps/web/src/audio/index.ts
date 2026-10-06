import type { Engine } from "./engine";
import type { SoundPlan } from "./soundPlan";

/**
 * Thin, always-loaded front for the sound engine. The engine itself is a separate chunk that is fetched
 * only when sound is first turned on. Until then every call here does nothing.
 */
let engine: Engine | null = null;
let loading: Promise<boolean> | null = null;
const listeners = new Set<(on: boolean) => void>();
const emit = () => listeners.forEach((l) => l(engine !== null));

export const soundIsOn = () => engine !== null;
export function onSoundChange(l: (on: boolean) => void): () => void { listeners.add(l); return () => listeners.delete(l); }

export async function enableSound(): Promise<boolean> {
  if (engine) return true;
  if (!loading) {
    loading = import("./engine").then((m) => m.createEngine()).then((e) => { engine = e; loading = null; emit(); return e !== null; }).catch(() => { loading = null; return false; });
  }
  return loading;
}

export function disableSound(): void {
  engine?.dispose();
  engine = null;
  emit();
}

export function setSoundPlan(p: SoundPlan): void { engine?.setPlan(p); }
export function uiTick(): void { engine?.tick(); }
export function ratChirp(): void { engine?.chirp(); }
export function ratSniff(strength = 1): void { engine?.sniff(strength); }
export function ratPatter(steps: number): void { engine?.patter(steps); }
/** Plays the heart at `bpm` for `seconds`, turning sound on first if needed (the click is the viewer's choice). */
export async function listenHeart(bpm: number, seconds = 4): Promise<boolean> {
  const ok = await enableSound();
  if (ok) engine?.heart(bpm, seconds);
  return ok;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (document.hidden) engine?.suspend(); else engine?.resume(); });
}
