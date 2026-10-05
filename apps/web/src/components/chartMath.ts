/** Pure helpers for LineChart, kept separate so they can be tested without a DOM. */

export interface XY { x: ArrayLike<number>; y: ArrayLike<number>; step?: boolean }

/** Index of the entry in a sorted-or-unsorted x array that is closest to `v`, or -1 when empty. */
export function nearestIndex(xs: ArrayLike<number>, v: number): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < xs.length; i++) {
    const d = Math.abs(xs[i]! - v);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/**
 * The value of a series at x. A step series (survival) holds its last value until the next change;
 * other series use the nearest point. Returns null when the series has nothing there.
 */
export function valueAt(s: XY, x: number): { x: number; y: number } | null {
  const n = s.x.length;
  if (n === 0) return null;
  if (s.step) {
    let j = -1;
    for (let i = 0; i < n; i++) if (s.x[i]! <= x + 1e-9) j = i;
    if (j < 0) j = 0;
    return Number.isFinite(s.y[j]!) ? { x: s.x[j]!, y: s.y[j]! } : null;
  }
  const j = nearestIndex(s.x, x);
  return j >= 0 && Number.isFinite(s.y[j]!) ? { x: s.x[j]!, y: s.y[j]! } : null;
}

/**
 * Runs of consecutive plottable indices. A missing (NaN or non-positive on a log axis) value ends a run,
 * so the line has a visible gap instead of joining across it.
 */
export function runs(y: ArrayLike<number>, x: ArrayLike<number>, logY: boolean): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const ok = Number.isFinite(y[i]!) && Number.isFinite(x[i]!) && (!logY || y[i]! > 0);
    if (ok) cur.push(i);
    else if (cur.length) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Spread label positions so none are closer than `gap`, keeping order and staying inside [min, max]. */
export function spreadLabels(ys: number[], gap: number, min: number, max: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const pos = order.map((o) => Math.min(max, Math.max(min, o.y)));
  for (let k = 1; k < pos.length; k++) if (pos[k]! - pos[k - 1]! < gap) pos[k] = pos[k - 1]! + gap;
  // if pushing ran past the bottom, pull the stack back up
  for (let k = pos.length - 1; k >= 0; k--) {
    const limit = k === pos.length - 1 ? max : pos[k + 1]! - gap;
    if (pos[k]! > limit) pos[k] = limit;
  }
  const out = new Array<number>(ys.length);
  order.forEach((o, k) => { out[o.i] = pos[k]!; });
  return out;
}

/** At most `max` evenly spaced indices from 0 to n-1, always including the first and last. */
export function sampleIndices(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < max; k++) out.push(Math.round((k * (n - 1)) / (max - 1)));
  return Array.from(new Set(out));
}

/** Width in pixels the y-axis needs for its tick labels (monospace, 11 px). */
export function axisWidth(labels: string[]): number {
  const longest = labels.reduce((m, l) => Math.max(m, l.length), 1);
  return Math.max(38, Math.round(longest * 6.6 + 16));
}
