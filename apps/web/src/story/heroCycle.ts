export const HERO_HOLD = 2.5;
export const HERO_TRANSITION = .75;
export const HERO_STARTS = [0, 3.25, 6.5] as const;
export const HERO_CYCLE = 9.75;

/** The same cubic-bezier(.16, 1, .3, 1) used by the mode controls. */
export function cinemaEase(value: number) {
  const x = Math.max(0, Math.min(1, value));
  if (x === 0 || x === 1) return x;
  let low = 0, high = 1, t = x;
  for (let i = 0; i < 14; i++) {
    const sampled = 3 * (1 - t) ** 2 * t * .16 + 3 * (1 - t) * t * t * .3 + t ** 3;
    if (sampled < x) low = t; else high = t;
    t = (low + high) / 2;
  }
  return 1 - (1 - t) ** 3;
}

export function heroCycle(seconds: number) {
  const time = ((seconds % HERO_CYCLE) + HERO_CYCLE) % HERO_CYCLE;
  const slot = Math.floor(time / (HERO_HOLD + HERO_TRANSITION));
  const localTime = time - HERO_STARTS[slot]!;
  const progress = cinemaEase((localTime - HERO_HOLD) / HERO_TRANSITION);
  const stage = localTime < HERO_HOLD ? slot : (slot + 1) % 3;
  const weights = [0, 0, 0];
  weights[slot] = 1 - progress;
  weights[(slot + 1) % 3] = progress;
  const [natural, organs, nerves] = weights as [number, number, number];
  return { stage, progress, localTime: Math.max(0, time - HERO_STARTS[stage]!), natural, organs, nerves, timeScale: 1 - .65 * (1 - natural) };
}
export function organShot(localTime: number) {
  return { index: localTime < 1.5 ? 0 : 2, zoom: 1 };
}
