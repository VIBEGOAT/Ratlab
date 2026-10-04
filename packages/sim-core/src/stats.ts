import { chi2Sf, fSf, lgamma, normalCdf, tCdf, tQuantile } from "./specialfns";

/**
 * Statistics for study analysis.
 *  - one-way ANOVA, Dunnett's many-to-one test (exact joint t distribution by
 *    numerical integration, equal or unequal group sizes)
 *  - Kruskal-Wallis with tie correction, Dunn's test against a control with Holm adjustment
 *  - linear-trend (contrast) test, Jonckheere-Terpstra trend test
 *  - Fisher's exact test for incidence, Hedges' g
 * Tested against hand-computed examples and by simulation (see test/stats.test.ts).
 */

export const mean = (a: readonly number[]): number => a.reduce((s, x) => s + x, 0) / a.length;
export function variance(a: readonly number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
}
export const sd = (a: readonly number[]): number => Math.sqrt(variance(a));
export function skewness(a: readonly number[]): number {
  const n = a.length;
  if (n < 3) return 0;
  const m = mean(a), s = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / n);
  return s === 0 ? 0 : a.reduce((x, y) => x + ((y - m) / s) ** 3, 0) / n;
}
export function median(a: readonly number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function hedgesG(a: readonly number[], b: readonly number[]): number {
  const n1 = a.length, n2 = b.length;
  if (n1 < 2 || n2 < 2) return 0;
  const sp = Math.sqrt(((n1 - 1) * variance(a) + (n2 - 1) * variance(b)) / (n1 + n2 - 2));
  if (sp === 0) return 0;
  const d = (mean(a) - mean(b)) / sp;
  return d * (1 - 3 / (4 * (n1 + n2) - 9));
}

// ---------------------------------------------------------------- ANOVA

export interface Anova { f: number; df1: number; df2: number; p: number; mse: number }
export function oneWayAnova(groups: ReadonlyArray<readonly number[]>): Anova {
  const k = groups.length, N = groups.reduce((s, g) => s + g.length, 0);
  const grand = groups.reduce((s, g) => s + g.reduce((x, y) => x + y, 0), 0) / N;
  let ssb = 0, ssw = 0;
  for (const g of groups) { const m = mean(g); ssb += g.length * (m - grand) ** 2; ssw += g.reduce((s, x) => s + (x - m) ** 2, 0); }
  const df1 = k - 1, df2 = N - k;
  const mse = ssw / df2;
  const f = mse === 0 ? Infinity : ssb / df1 / mse;
  return { f, df1, df2, p: Number.isFinite(f) ? fSf(f, df1, df2) : 0, mse };
}

// ---------------------------------------------------------------- Dunnett

// Phi lookup for speed in the nested integral: linear interpolation on a fine grid.
const PHI_LO = -10, PHI_HI = 10, PHI_STEP = 0.0005;
const PHI_TABLE = (() => {
  const n = Math.round((PHI_HI - PHI_LO) / PHI_STEP) + 1;
  const t = new Float64Array(n);
  for (let i = 0; i < n; i++) t[i] = normalCdf(PHI_LO + i * PHI_STEP);
  return t;
})();
function phi(x: number): number {
  if (x <= PHI_LO) return 0;
  if (x >= PHI_HI) return 1;
  const u = (x - PHI_LO) / PHI_STEP, i = Math.floor(u), f = u - i;
  return PHI_TABLE[i]! * (1 - f) + PHI_TABLE[i + 1]! * f;
}

function logChiDensityS(s: number, nu: number): number {
  // density of S = sqrt(chi2_nu / nu)
  return Math.log(2) + (nu / 2) * Math.log(nu / 2) - lgamma(nu / 2) + (nu - 1) * Math.log(s) - (nu * s * s) / 2;
}

/**
 * P(all |T_i| < d) (two-sided) or P(all T_i < d) (one-sided), where T_i compares treatment i
 * with a shared control using the pooled standard error. Exact up to numerical integration.
 */
export function dunnettJointProb(d: number, nControl: number, nTreated: readonly number[], df: number, twoSided = true): number {
  const k = nTreated.length;
  const sHi = 1 + 9 / Math.sqrt(df) + 12 / df;
  const nS = 160, nZ = 120, zMax = 7;
  const hS = sHi / nS, hZ = (2 * zMax) / nZ;
  let total = 0;
  for (let a = 0; a <= nS; a++) {
    const s = Math.max(a * hS, 1e-9);
    const wS = a === 0 || a === nS ? 1 : a % 2 ? 4 : 2;
    const dens = Math.exp(logChiDensityS(s, df));
    let inner = 0;
    for (let b = 0; b <= nZ; b++) {
      const z = -zMax + b * hZ;
      const wZ = b === 0 || b === nZ ? 1 : b % 2 ? 4 : 2;
      let prod = 1;
      for (let i = 0; i < k; i++) {
        const r = nTreated[i]! / nControl;
        const up = Math.sqrt(r) * z + d * s * Math.sqrt(1 + r);
        if (twoSided) {
          const lo = Math.sqrt(r) * z - d * s * Math.sqrt(1 + r);
          prod *= phi(up) - phi(lo);
        } else prod *= phi(up);
        if (prod === 0) break;
      }
      inner += wZ * Math.exp(-0.5 * z * z) * prod;
    }
    total += wS * dens * inner * (hZ / 3) / Math.sqrt(2 * Math.PI);
  }
  return Math.min(1, Math.max(0, total * (hS / 3)));
}

export interface DunnettRow { group: number; diff: number; t: number; pAdj: number; pUnadjusted: number; ciLow: number; ciHigh: number }
export interface DunnettResult { df: number; mse: number; rows: DunnettRow[] }

export function dunnett(control: readonly number[], treated: ReadonlyArray<readonly number[]>, opts: { twoSided?: boolean; alpha?: number } = {}): DunnettResult {
  const twoSided = opts.twoSided ?? true;
  const groups = [control, ...treated];
  const { df2: df, mse } = oneWayAnova(groups);
  const n0 = control.length, ns = treated.map((g) => g.length);
  const m0 = mean(control);
  const crit = dunnettCritical(n0, ns, df, opts.alpha ?? 0.05, twoSided);
  const rows = treated.map((g, i) => {
    const diff = mean(g) - m0;
    const se = Math.sqrt(mse * (1 / g.length + 1 / n0));
    const t = se === 0 ? (diff === 0 ? 0 : Infinity) : diff / se;
    const pAdj = !Number.isFinite(t) ? 0 : 1 - dunnettJointProb(Math.abs(t), n0, ns, df, twoSided);
    const pUnadj = twoSided ? 2 * (1 - tCdf(Math.abs(t), df)) : 1 - tCdf(t, df);
    return { group: i + 1, diff, t, pAdj: Math.min(1, Math.max(0, pAdj)), pUnadjusted: pUnadj, ciLow: diff - crit * se, ciHigh: diff + crit * se };
  });
  return { df, mse, rows };
}

/** Critical value d with P(max |T| < d) = 1 - alpha, by bisection. */
const critCache = new Map<string, number>();
export function dunnettCritical(nControl: number, nTreated: readonly number[], df: number, alpha = 0.05, twoSided = true): number {
  const key = `${nControl}|${[...nTreated].sort().join(",")}|${df}|${alpha}|${twoSided}`;
  const hit = critCache.get(key);
  if (hit !== undefined) return hit;
  const v = dunnettCriticalUncached(nControl, nTreated, df, alpha, twoSided);
  critCache.set(key, v);
  return v;
}

function dunnettCriticalUncached(nControl: number, nTreated: readonly number[], df: number, alpha: number, twoSided: boolean): number {
  let lo = 0.5, hi = 12;
  for (let i = 0; i < 50; i++) {
    const m = 0.5 * (lo + hi);
    if (dunnettJointProb(m, nControl, nTreated, df, twoSided) < 1 - alpha) lo = m; else hi = m;
  }
  return 0.5 * (lo + hi);
}

// ---------------------------------------------------------------- rank tests

export function rank(values: readonly number[]): { ranks: number[]; tieTerm: number } {
  const idx = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(values.length);
  let tieTerm = 0;
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k]![1]] = r;
    const t = j - i + 1;
    tieTerm += t ** 3 - t;
    i = j + 1;
  }
  return { ranks, tieTerm };
}

export interface KruskalWallis { h: number; df: number; p: number; meanRanks: number[]; n: number; tieTerm: number }
export function kruskalWallis(groups: ReadonlyArray<readonly number[]>): KruskalWallis {
  const all = groups.flat();
  const N = all.length;
  const { ranks, tieTerm } = rank(all);
  let pos = 0, h = 0;
  const meanRanks: number[] = [];
  for (const g of groups) {
    const r = ranks.slice(pos, pos + g.length);
    pos += g.length;
    const sum = r.reduce((a, b) => a + b, 0);
    meanRanks.push(sum / g.length);
    h += (sum * sum) / g.length;
  }
  h = (12 / (N * (N + 1))) * h - 3 * (N + 1);
  h /= 1 - tieTerm / (N ** 3 - N);
  const df = groups.length - 1;
  return { h, df, p: chi2Sf(h, df), meanRanks, n: N, tieTerm };
}

export function holm(p: readonly number[]): number[] {
  const m = p.length;
  const order = p.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(m);
  let running = 0;
  order.forEach(([v, i], k) => { running = Math.max(running, Math.min(1, (m - k) * v)); out[i] = running; });
  return out;
}

export interface DunnRow { group: number; z: number; pRaw: number; pAdj: number }
/** Dunn's test of each treated group against the control, Holm adjusted. */
export function dunnVsControl(control: readonly number[], treated: ReadonlyArray<readonly number[]>): { kw: KruskalWallis; rows: DunnRow[] } {
  const kw = kruskalWallis([control, ...treated]);
  const N = kw.n;
  const sigma2 = (N * (N + 1)) / 12 - kw.tieTerm / (12 * (N - 1));
  const raw = treated.map((g, i) => {
    const z = (kw.meanRanks[i + 1]! - kw.meanRanks[0]!) / Math.sqrt(sigma2 * (1 / g.length + 1 / control.length));
    return { group: i + 1, z, pRaw: 2 * (1 - normalCdf(Math.abs(z))) };
  });
  const adj = holm(raw.map((r) => r.pRaw));
  return { kw, rows: raw.map((r, i) => ({ ...r, pAdj: adj[i]! })) };
}

// ---------------------------------------------------------------- trend tests

/** Linear-trend contrast across ordered doses using the pooled within-group variance. */
export function linearTrend(groups: ReadonlyArray<readonly number[]>, scores: readonly number[]): { slope: number; t: number; df: number; p: number } {
  const { df2: df, mse } = oneWayAnova(groups);
  const sbar = mean(scores);
  const c = scores.map((s) => s - sbar);
  const L = c.reduce((a, ci, i) => a + ci * mean(groups[i]!), 0);
  const denom = c.reduce((a, ci, i) => a + (ci * ci) / groups[i]!.length, 0);
  const se = Math.sqrt(mse * denom);
  const t = se === 0 ? 0 : L / se;
  const slope = L / c.reduce((a, ci) => a + ci * ci, 0);
  return { slope, t, df, p: 2 * (1 - tCdf(Math.abs(t), df)) };
}

/** Jonckheere-Terpstra test for an ordered alternative (groups in increasing dose order), normal approximation, tie-corrected. */
export function jonckheereTerpstra(groups: ReadonlyArray<readonly number[]>): { statistic: number; z: number; pIncreasing: number; pTwoSided: number } {
  let J = 0;
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) for (const a of groups[i]!) for (const b of groups[j]!) J += b > a ? 1 : b === a ? 0.5 : 0;
  const ns = groups.map((g) => g.length);
  const N = ns.reduce((a, b) => a + b, 0);
  const mu = (N * N - ns.reduce((a, n) => a + n * n, 0)) / 4;
  const all = groups.flat();
  const counts = new Map<number, number>();
  for (const v of all) counts.set(v, (counts.get(v) ?? 0) + 1);
  const tie = [...counts.values()];
  const v0 = (N * (N - 1) * (2 * N + 5) - ns.reduce((a, n) => a + n * (n - 1) * (2 * n + 5), 0) - tie.reduce((a, t) => a + t * (t - 1) * (2 * t + 5), 0)) / 72;
  const v1 = (ns.reduce((a, n) => a + n * (n - 1) * (n - 2), 0) * tie.reduce((a, t) => a + t * (t - 1) * (t - 2), 0)) / (36 * N * (N - 1) * (N - 2) || 1);
  const v2 = (ns.reduce((a, n) => a + n * (n - 1), 0) * tie.reduce((a, t) => a + t * (t - 1), 0)) / (8 * N * (N - 1) || 1);
  const variance = v0 + v1 + v2;
  const z = (J - mu) / Math.sqrt(variance);
  return { statistic: J, z, pIncreasing: 1 - normalCdf(z), pTwoSided: 2 * (1 - normalCdf(Math.abs(z))) };
}

// ---------------------------------------------------------------- incidence

function logChoose(n: number, k: number): number { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1); }

/** Fisher's exact test for a 2 x 2 table [[a, b], [c, d]], two-sided by the sum of probabilities not exceeding the observed one. */
export function fisherExact(a: number, b: number, c: number, d: number): number {
  const r1 = a + b, r2 = c + d, c1 = a + c, n = a + b + c + d;
  const lp = (x: number) => logChoose(r1, x) + logChoose(r2, c1 - x) - logChoose(n, c1);
  const obs = lp(a);
  let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) { const v = lp(x); if (v <= obs + 1e-9) p += Math.exp(v); }
  return Math.min(1, p);
}

/** Wilson score interval for a proportion. */
export function wilson(k: number, n: number, z = 1.96): { p: number; low: number; high: number } {
  if (n === 0) return { p: 0, low: 0, high: 1 };
  const p = k / n, den = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return { p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export { tQuantile, tCdf };
