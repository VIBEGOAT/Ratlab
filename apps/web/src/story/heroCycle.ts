export const HERO_HOLD = 5.5;
export const HERO_TRANSITION = 5.5;
export const HERO_CYCLE = 3 * (HERO_HOLD + HERO_TRANSITION);
export function heroCycle(seconds: number) {
  const time = ((seconds % HERO_CYCLE) + HERO_CYCLE) % HERO_CYCLE;
  const stage = Math.floor(time / 11);
  const progress = Math.max(0, (time % 11 - HERO_HOLD) / HERO_TRANSITION);
  const blend = progress * progress * (3 - 2 * progress);
  return {
    stage, progress,
    natural: stage === 0 ? 1 - blend : stage === 1 ? 0 : blend,
    organs: stage === 0 ? blend : stage === 1 ? 1 - blend : 0,
    nerves: stage === 1 ? blend : stage === 2 ? 1 - blend : 0,
  };
}
