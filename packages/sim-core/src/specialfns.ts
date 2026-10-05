/** Special functions needed by the statistics module. Accuracy is checked in tests. */

export function lgamma(x: number): number {
  // Lanczos approximation, g = 7, n = 9
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0]!;
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i]! / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularised lower incomplete gamma P(a, x). */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a, term = sum, n = a;
    for (let i = 0; i < 500; i++) { n += 1; term *= x / n; sum += term; if (Math.abs(term) < Math.abs(sum) * 1e-16) break; }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  return 1 - gammaQcf(a, x);
}

function gammaQcf(a: number, x: number): number {
  const tiny = 1e-300;
  let b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

export const gammaQ = (a: number, x: number): number => (x < a + 1 ? 1 - gammaP(a, x) : gammaQcf(a, x));

/** Regularised incomplete beta I_x(a, b). */
export function betaInc(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

function betacf(a: number, b: number, x: number): number {
  const tiny = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

export function erf(x: number): number {
  const ax = Math.abs(x);
  let r: number;
  if (ax < 2.5) {
    let sum = ax, term = ax;
    for (let n = 1; n < 100; n++) { term *= (-ax * ax) / n; const add = term / (2 * n + 1); sum += add; if (Math.abs(add) < 1e-17) break; }
    r = (2 / Math.sqrt(Math.PI)) * sum;
  } else {
    r = 1 - erfcLarge(ax);
  }
  return x < 0 ? -r : r;
}

function erfcLarge(x: number): number {
  // continued fraction for x >= 2.5
  const tiny = 1e-300;
  let f = tiny, c = f, d = 0;
  // Lentz on  erfc(x) = exp(-x^2)/sqrt(pi) * 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + ...))))
  const b = x;
  f = b; c = b; d = 0;
  for (let n = 1; n < 300; n++) {
    const a = n / 2;
    d = x + a * d; if (Math.abs(d) < tiny) d = tiny;
    c = x + a / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = c * d;
    f *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}

export const normalPdf = (x: number): number => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
export const normalCdf = (x: number): number => (x < -6 ? 0.5 * erfcLarge(-x / Math.SQRT2) * 1 : 0.5 * (1 + erf(x / Math.SQRT2)));

/** Standard normal quantile (Acklam, refined with one Halley step). */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  let x: number;
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  else { const q = p - 0.5, r = q * q; x = ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1); }
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

export function tCdf(t: number, df: number): number {
  const x = df / (df + t * t);
  const tail = 0.5 * betaInc(df / 2, 0.5, x);
  return t > 0 ? 1 - tail : tail;
}

export function tQuantile(p: number, df: number): number {
  if (p === 0.5) return 0;
  let lo = -200, hi = 200;
  for (let i = 0; i < 200; i++) { const m = 0.5 * (lo + hi); if (tCdf(m, df) < p) lo = m; else hi = m; }
  return 0.5 * (lo + hi);
}

export const chi2Cdf = (x: number, df: number): number => gammaP(df / 2, x / 2);
export const chi2Sf = (x: number, df: number): number => gammaQ(df / 2, x / 2);
export const fSf = (f: number, d1: number, d2: number): number => betaInc(d2 / 2, d1 / 2, d2 / (d2 + d1 * f));
