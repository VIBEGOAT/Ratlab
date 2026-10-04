import { describe, it, expect } from "vitest";
import { Rng } from "../src/rng";

describe("Rng determinism", () => {
  it("same seed gives identical sequences", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) expect(a.uniform()).toBe(b.uniform());
  });

  it("different seeds give different sequences", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const same = Array.from({ length: 50 }, () => a.uniform() === b.uniform()).filter(Boolean).length;
    expect(same).toBeLessThan(2);
  });

  it("forked streams are stable and independent of draw order on the parent", () => {
    const p1 = new Rng(7);
    const p2 = new Rng(7);
    p2.uniform();
    p2.uniform(); // parent advanced; fork must not care
    const f1 = p1.fork("animal-3");
    const f2 = p2.fork("animal-3");
    for (let i = 0; i < 100; i++) expect(f1.normal()).toBe(f2.normal());
  });

  it("different fork labels give different streams", () => {
    const p = new Rng(7);
    expect(p.fork("animal-1").uniform()).not.toBe(p.fork("animal-2").uniform());
  });
});

describe("Rng statistics", () => {
  it("uniform is in [0,1) with mean near 0.5", () => {
    const r = new Rng(123);
    let s = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const u = r.uniform();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      s += u;
    }
    expect(s / n).toBeGreaterThan(0.49);
    expect(s / n).toBeLessThan(0.51);
  });

  it("normal has mean ~0 and sd ~1", () => {
    const r = new Rng(99);
    const n = 40000;
    const xs = Array.from({ length: n }, () => r.normal());
    const m = xs.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / n);
    expect(Math.abs(m)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
  });

  it("lognormal factor has mean ~1 and cv ~ requested", () => {
    const r = new Rng(5);
    const cv = 0.25;
    const n = 40000;
    const xs = Array.from({ length: n }, () => r.lognormalFactor(cv));
    const m = xs.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / n);
    expect(Math.abs(m - 1)).toBeLessThan(0.02);
    expect(Math.abs(sd / m - cv)).toBeLessThan(0.02);
    expect(Math.min(...xs)).toBeGreaterThan(0);
  });
});
