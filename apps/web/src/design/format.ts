/** Locale-aware number formatting. All numbers shown to people go through here. */
const cache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number): Intl.NumberFormat {
  const k = `${min}|${max}`;
  let f = cache.get(k);
  if (!f) { f = new Intl.NumberFormat(undefined, { minimumFractionDigits: min, maximumFractionDigits: max }); cache.set(k, f); }
  return f;
}

/** Fixed decimals; non-finite values become "n/a" so NaN or Infinity never reach the screen. */
export function fmt(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "n/a";
  return nf(digits, digits).format(x);
}

/** Up to `digits` significant decimals, trimming zeros. */
export function fmtSmart(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "n/a";
  const a = Math.abs(x);
  if (a !== 0 && (a < 0.001 || a >= 1e6)) return x.toExponential(1);
  return nf(0, a >= 100 ? 0 : a >= 10 ? Math.min(1, digits) : digits).format(x);
}

export function fmtInt(x: number | null | undefined): string { return fmt(x, 0); }
export function fmtPct(x: number | null | undefined, digits = 0): string { return x === null || x === undefined || !Number.isFinite(x) ? "n/a" : `${fmt(x * 100, digits)}%`; }
export function fmtP(p: number): string { return !Number.isFinite(p) ? "n/a" : p < 0.001 ? "<0.001" : fmt(p, 3); }
