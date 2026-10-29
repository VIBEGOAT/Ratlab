export const HERO_HOLD = 7;
export const HERO_TRANSITION = 2;
export const HERO_STARTS = [0, 9, 14] as const;
export const HERO_CYCLE = 20;
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
export function heroCycle(seconds: number) {
  const time = ((seconds % HERO_CYCLE) + HERO_CYCLE) % HERO_CYCLE;
  const dive = smooth((time - 7) / 2), exit = smooth((time - 18) / 2);
  const neural = smooth((time - 13.5) / .5);
  const inside = dive * (1 - exit);
  const stage = time < 7 || time >= 18 ? 0 : time < 14 ? 1 : 2;
  return { stage, progress: time >= 18 ? exit : dive, localTime: time - HERO_STARTS[stage], natural: 1 - inside, organs: inside * (1 - neural), nerves: inside * neural, timeScale: 1 - .65 * inside };
}
export function organShot(localTime: number) {
  return { index: localTime < 2.5 ? 0 : 2, zoom: 1 };
}
