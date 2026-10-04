/** Small dense linear algebra helpers (row-major, square). */

export function identity(n: number): Float64Array {
  const m = new Float64Array(n * n);
  for (let i = 0; i < n; i++) m[i * n + i] = 1;
  return m;
}

export function matMul(a: Float64Array, b: Float64Array, n: number): Float64Array {
  const c = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const aik = a[i * n + k]!;
      if (aik === 0) continue;
      for (let j = 0; j < n; j++) c[i * n + j] = c[i * n + j]! + aik * b[k * n + j]!;
    }
  }
  return c;
}

export function matVec(a: Float64Array, x: Float64Array, n: number, out: Float64Array): void {
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += a[i * n + j]! * x[j]!;
    out[i] = s;
  }
}

function norm1(a: Float64Array, n: number): number {
  let best = 0;
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(a[i * n + j]!);
    if (s > best) best = s;
  }
  return best;
}

/** exp(A * t) by scaling and squaring with a Taylor series. */
export function expm(A: Float64Array, n: number, t: number): Float64Array {
  const B = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) B[i] = A[i]! * t;
  const nrm = norm1(B, n);
  const s = nrm > 0.5 ? Math.ceil(Math.log2(nrm / 0.5)) : 0;
  const scale = Math.pow(2, -s);
  for (let i = 0; i < n * n; i++) B[i] = B[i]! * scale;

  let result = identity(n);
  let term = identity(n);
  for (let k = 1; k <= 18; k++) {
    term = matMul(term, B, n);
    const f = 1 / k;
    for (let i = 0; i < n * n; i++) term[i] = term[i]! * f;
    for (let i = 0; i < n * n; i++) result[i] = result[i]! + term[i]!;
  }
  for (let i = 0; i < s; i++) result = matMul(result, result, n);
  return result;
}
