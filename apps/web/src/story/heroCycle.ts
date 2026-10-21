export const HERO_HOLD = 4;
export const HERO_TRANSITION = 4;
export const HERO_STARTS = [0, 8, 24] as const;
export const HERO_CYCLE = 32;
const HOLDS = [4, 12, 4];
export function heroCycle(seconds: number) {
  const time = ((seconds % HERO_CYCLE) + HERO_CYCLE) % HERO_CYCLE;
  const stage = time < 8 ? 0 : time < 24 ? 1 : 2;
  const localTime = time - HERO_STARTS[stage];
  const progress = Math.max(0, (localTime - HOLDS[stage]!) / HERO_TRANSITION);
  const blend = progress * progress * (3 - 2 * progress);
  return {
    stage, progress, localTime,
    natural: stage === 0 ? 1 - blend : stage === 1 ? 0 : blend,
    organs: stage === 0 ? blend : stage === 1 ? 1 - blend : 0,
    nerves: stage === 1 ? blend : stage === 2 ? 1 - blend : 0,
  };
}

/** Four-second shots: fast approach, readable close-up, then a full pullback. */
export function organShot(localTime: number) {
  if (localTime >= 12) return { index: -1, zoom: 0 };
  const index = Math.floor(localTime / 4);
  const t = localTime % 4;
  const smooth = (x: number) => { const n = Math.min(1, Math.max(0, x)); return n * n * (3 - 2 * n); };
  return { index, zoom: smooth(t / .8) * (1 - smooth((t - 2.9) / 1.1)) };
}
