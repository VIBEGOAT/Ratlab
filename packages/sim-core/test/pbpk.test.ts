import { describe, it, expect } from "vitest";
import {
  ARCHETYPES, Rng, buildPhysiology, buildRateMatrix, expm, matVec, Rk45, N_PK, IDX, simulateAnimal,
  validateCompound, type AnimalConfig, type Compound, type Route,
} from "../src";

const phys = () => buildPhysiology({ sex: "M", strain: "SD", ageWeeks: 8, rng: new Rng(11) });

function cfg(c: Compound, over: Partial<AnimalConfig> & { dose?: number; route?: Route; nDoses?: number } = {}): AnimalConfig {
  const { dose, route, nDoses, ...rest } = over;
  return {
    seed: 1, animalId: "a", sex: "M", strain: "SD", ageWeeks: 8, compound: c, durationDays: 10,
    regimen: { route: route ?? "oral", doseMgPerKg: dose ?? c.defaultDoseMgPerKg, intervalH: 24, startH: 0, nDoses: nDoses ?? 5 },
    ...rest,
  };
}

describe("physiology", () => {
  it("is deterministic by seed and varies between animals", () => {
    const a = buildPhysiology({ sex: "M", strain: "SD", ageWeeks: 8, rng: new Rng(5) });
    const b = buildPhysiology({ sex: "M", strain: "SD", ageWeeks: 8, rng: new Rng(5) });
    const c = buildPhysiology({ sex: "M", strain: "SD", ageWeeks: 8, rng: new Rng(6) });
    expect(a).toEqual(b);
    expect(a.bwKg).not.toBe(c.bwKg);
  });

  it("gives positive volumes that fit inside body mass, and flows that sum to cardiac output", () => {
    const p = phys();
    let v = p.volArt + p.volVen;
    for (const x of Object.values(p.vol)) { expect(x).toBeGreaterThan(0); v += x; }
    expect(v).toBeCloseTo(p.bwKg, 9);
    const f = p.flow;
    const sum = f.gut + f.spleen + f.hepaticArtery + f.kidney + f.heart + f.brain + f.muscle + f.fat + f.marrow + f.rest;
    expect(sum).toBeCloseTo(p.co, 9);
    for (const x of Object.values(f)) expect(x).toBeGreaterThan(0);
  });

  it("makes females lighter than males and weight rise with age", () => {
    const m = buildPhysiology({ sex: "M", strain: "SD", ageWeeks: 8, rng: new Rng(1) });
    const f = buildPhysiology({ sex: "F", strain: "SD", ageWeeks: 8, rng: new Rng(1) });
    const old = buildPhysiology({ sex: "M", strain: "SD", ageWeeks: 20, rng: new Rng(1) });
    expect(f.bwKg).toBeLessThan(m.bwKg);
    expect(old.bwKg).toBeGreaterThan(m.bwKg);
  });
});

describe("PBPK rate matrix", () => {
  for (const [name, c] of Object.entries(ARCHETYPES)) {
    it(`${name}: valid compound, zero column sums, mass-preserving propagator`, () => {
      expect(validateCompound(c)).toEqual([]);
      const A = buildRateMatrix(phys(), c, { hepatic: 1, renal: 1 });
      for (let j = 0; j < N_PK; j++) {
        let s = 0, scale = 0;
        for (let i = 0; i < N_PK; i++) { s += A[i * N_PK + j]!; scale += Math.abs(A[i * N_PK + j]!); }
        expect(Math.abs(s)).toBeLessThan(1e-9 * Math.max(1, scale));
      }
      const E = expm(A, N_PK, 0.25);
      for (let j = 0; j < N_PK; j++) {
        let s = 0;
        for (let i = 0; i < N_PK; i++) s += E[i * N_PK + j]!;
        expect(s).toBeCloseTo(1, 9);
      }
    });
  }

  it("matrix exponential agrees with the adaptive ODE solver on the same system", () => {
    const p = phys();
    const A = buildRateMatrix(p, ARCHETYPES.hepatotoxin!, { hepatic: 1, renal: 1 });
    const x0 = new Float64Array(N_PK);
    x0[IDX.gutLumen] = 10;
    x0[IDX.ven] = 5;
    const viaExpm = new Float64Array(N_PK);
    matVec(expm(A, N_PK, 2), x0, N_PK, viaExpm);
    const viaRk = Float64Array.from(x0);
    new Rk45(N_PK).integrate((_t, y, dy) => matVec(A, y, N_PK, dy), viaRk, 0, 2, { rtol: 1e-10, atol: 1e-13, maxSteps: 2_000_000 });
    for (let i = 0; i < N_PK; i++) expect(viaExpm[i]).toBeCloseTo(viaRk[i]!, 6);
  });
});

describe("mass balance", () => {
  const routes: Route[] = ["oral", "iv", "diet"];
  for (const route of routes) {
    for (const [name, c] of Object.entries(ARCHETYPES)) {
      it(`${name} via ${route}: dose equals the sum of all compartments`, () => {
        const r = simulateAnimal(cfg(c, { route, nDoses: route === "diet" ? 5 : 4 }));
        expect(r.doseTotalMg).toBeGreaterThan(0);
        expect(r.massBalanceRelError).toBeLessThan(1e-9);
      });
    }
  }
});

describe("pharmacokinetics", () => {
  const H = ARCHETYPES.hepatotoxin!;
  const pure = (dose: number) => simulateAnimal(cfg(H, { dose, toxicodynamics: false, organFeedback: false }));

  it("is dose proportional when toxicodynamics and feedback are off", () => {
    const a = pure(20), b = pure(40);
    expect(b.pk.cmax / a.pk.cmax).toBeCloseTo(2, 6);
    expect(b.pk.aucAll / a.pk.aucAll).toBeCloseTo(2, 6);
  });

  it("IV bolus peaks earlier than oral", () => {
    const iv = simulateAnimal(cfg(H, { route: "iv", dose: 20, nDoses: 1 }));
    const po = simulateAnimal(cfg(H, { route: "oral", dose: 20, nDoses: 1 }));
    expect(iv.pk.tmaxH).toBeLessThan(po.pk.tmaxH);
    expect(po.pk.tmaxH).toBeGreaterThan(0);
  });

  it("accumulates more for a long half-life compound than for a short one", () => {
    const run = (c: Compound) => simulateAnimal(cfg(c, { durationDays: 22, nDoses: 20, dose: c.defaultDoseMgPerKg / 4, toxicodynamics: false }));
    const long = run(ARCHETYPES.cardiotoxin!), short = run(ARCHETYPES.neurotoxin!);
    expect(long.pk.accumulationRatio!).toBeGreaterThan(1.1);
    expect(short.pk.accumulationRatio!).toBeLessThan(1.05);
    expect(long.pk.terminalHalfLifeH!).toBeGreaterThan(short.pk.terminalHalfLifeH! * 3);
  });

  it("gives plausible rat half-lives (0.5 to 30 h) for every archetype", () => {
    for (const c of Object.values(ARCHETYPES)) {
      const r = simulateAnimal(cfg(c, { durationDays: 14, nDoses: 3, dose: c.defaultDoseMgPerKg / 4, toxicodynamics: false }));
      expect(r.pk.terminalHalfLifeH!).toBeGreaterThan(0.5);
      expect(r.pk.terminalHalfLifeH!).toBeLessThan(30);
    }
  });

  it("shows higher exposure in females for a compound with lower female clearance", () => {
    const mean = (sex: "M" | "F") => {
      let s = 0;
      for (let i = 0; i < 20; i++) {
        const r = simulateAnimal({ ...cfg(H, { toxicodynamics: false, organFeedback: false, dose: 20, nDoses: 1 }), sex, animalId: `x${i}` });
        s += r.pk.aucAll;
      }
      return s / 20;
    };
    expect(mean("F")).toBeGreaterThan(mean("M"));
  });

  it("raises exposure with a CYP inhibitor and lowers it with an inducer", () => {
    const base = pure(20).pk.aucAll;
    const inh = simulateAnimal(cfg(H, { dose: 20, toxicodynamics: false, organFeedback: false, ddi: [{ kind: "inhibition", factor: 0.5, fromH: 0, toH: 1e6 }] })).pk.aucAll;
    const ind = simulateAnimal(cfg(H, { dose: 20, toxicodynamics: false, organFeedback: false, ddi: [{ kind: "induction", factor: 2, fromH: 0, toH: 1e6 }] })).pk.aucAll;
    expect(inh).toBeGreaterThan(base * 1.3);
    expect(ind).toBeLessThan(base * 0.8);
  });

  it("is deterministic by seed and differs between animals", () => {
    const a = simulateAnimal(cfg(H)), b = simulateAnimal(cfg(H));
    expect(Array.from(a.plasma)).toEqual(Array.from(b.plasma));
    const c = simulateAnimal({ ...cfg(H), animalId: "other" });
    expect(c.pk.cmax).not.toBe(a.pk.cmax);
  });
});
