/**
 * Seeded, forkable random number generator.
 * Every simulated animal gets its own forked stream, so adding or removing animals
 * never changes the draws of the others (reproducibility under study redesign).
 */

function hashString(s: string): number {
  // FNV-1a, 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private spare: number | null = null;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    const sm = splitmix32(this.seed);
    this.a = sm();
    this.b = sm();
    this.c = sm();
    this.d = sm();
    for (let i = 0; i < 12; i++) this.nextU32(); // warm up
  }

  /** sfc32 */
  nextU32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Uniform in [0, 1) */
  uniform(): number {
    return this.nextU32() / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.uniform();
  }

  int(loInclusive: number, hiExclusive: number): number {
    return loInclusive + Math.floor(this.uniform() * (hiExclusive - loInclusive));
  }

  /** Standard normal (Box-Muller, with cached spare) */
  normal(): number {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = this.uniform();
    const v = this.uniform();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  /** Log-normal factor with mean 1 and coefficient of variation ~cv (for small to moderate cv). */
  lognormalFactor(cv: number): number {
    if (cv <= 0) return 1;
    const sigma = Math.sqrt(Math.log(1 + cv * cv));
    return Math.exp(sigma * this.normal() - (sigma * sigma) / 2);
  }

  bernoulli(p: number): boolean {
    return this.uniform() < p;
  }

  /** Independent child stream, stable for a given (parent seed, label). */
  fork(label: string): Rng {
    return new Rng((hashString(label) ^ Math.imul(this.seed, 0x9e3779b1)) >>> 0);
  }
}
