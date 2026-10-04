import { Rng } from "./rng";
import { ARCHETYPES, type Compound } from "./compound";
import { simulateAnimal, peakDamage, type AnimalConfig } from "./study";
import type { Organ } from "./toxicodynamics";

/**
 * Morris elementary-effects screening (Morris 1991). Inputs are scaled to the unit cube.
 * mu* (mean absolute elementary effect) ranks influence, sigma flags nonlinearity or interaction.
 */
export interface MorrisParam { name: string; low: number; high: number; log?: boolean }
export interface MorrisResult { name: string; muStar: number; mu: number; sigma: number }

export function morris(model: (x: number[]) => number, k: number, r: number, seed: number, levels = 4): MorrisResult[] {
  const rng = new Rng(seed);
  const delta = levels / (2 * (levels - 1));
  const grid = Array.from({ length: levels / 2 }, (_, i) => i / (levels - 1)); // starting points keep x + delta <= 1
  const ee: number[][] = Array.from({ length: k }, () => []);
  for (let t = 0; t < r; t++) {
    const x = Array.from({ length: k }, () => grid[rng.int(0, grid.length)]!);
    const order = Array.from({ length: k }, (_, i) => i);
    for (let i = k - 1; i > 0; i--) { const j = rng.int(0, i + 1); [order[i], order[j]] = [order[j]!, order[i]!]; }
    let y0 = model(x);
    for (const i of order) {
      const x1 = [...x];
      x1[i] = x[i]! + delta;
      const y1 = model(x1);
      ee[i]!.push((y1 - y0) / delta);
      x[i] = x1[i]!;
      y0 = y1;
    }
  }
  return ee.map((e, i) => {
    const mu = e.reduce((a, b) => a + b, 0) / e.length;
    const muStar = e.reduce((a, b) => a + Math.abs(b), 0) / e.length;
    const sigma = Math.sqrt(e.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, e.length - 1));
    return { name: `p${i}`, muStar, mu, sigma };
  });
}

export type SensitivityTarget = { kind: "cmax" } | { kind: "auc" } | { kind: "peakDamage"; organ: Organ };

/** Compound parameters that can be perturbed, with a multiplier range around the nominal value. */
export const DEFAULT_PERTURBATIONS = ["ka", "fu", "clIntLPerHPerKg", "clRenalLPerHPerKg", "fReactive", "fuTissue", "td.thr", "td.kinj", "td.kreg", "kp.target"] as const;
export type Perturbation = (typeof DEFAULT_PERTURBATIONS)[number];

function perturb(c: Compound, p: Perturbation, m: number, organ: Organ): Compound {
  const out: Compound = { ...c, kp: { ...c.kp }, td: { ...c.td } };
  const td = out.td[organ];
  switch (p) {
    case "ka": out.ka = c.ka * m; break;
    case "fu": out.fu = Math.min(1, c.fu * m); break;
    case "clIntLPerHPerKg": out.clIntLPerHPerKg = c.clIntLPerHPerKg * m; break;
    case "clRenalLPerHPerKg": out.clRenalLPerHPerKg = c.clRenalLPerHPerKg * m; break;
    case "fReactive": out.fReactive = Math.min(1, c.fReactive * m); break;
    case "fuTissue": out.fuTissue = Math.min(1, c.fuTissue * m); break;
    case "td.thr": if (td) out.td[organ] = { ...td, thr: td.thr * m }; break;
    case "td.kinj": if (td) out.td[organ] = { ...td, kinj: td.kinj * m }; break;
    case "td.kreg": if (td) out.td[organ] = { ...td, kreg: td.kreg * m }; break;
    case "kp.target": { const t = organ === "marrow" ? "marrow" : organ; out.kp[t] = c.kp[t] * m; break; }
  }
  return out;
}

/** Morris screening of a compound's parameters against a simulated output. Multipliers span a factor of 3 either way (log scale). */
export function morrisCompound(base: AnimalConfig, target: SensitivityTarget, organ: Organ, r = 12, seed = 1, params: readonly Perturbation[] = DEFAULT_PERTURBATIONS, spread = 3): MorrisResult[] {
  const model = (x: number[]) => {
    let c = base.compound;
    params.forEach((p, i) => { const m = Math.exp(Math.log(spread) * (2 * x[i]! - 1)); c = perturb(c, p, m, organ); });
    const res = simulateAnimal({ ...base, compound: c });
    if (target.kind === "cmax") return res.pk.cmax;
    if (target.kind === "auc") return res.pk.aucAll;
    return peakDamage(res)[target.organ] ?? 0;
  };
  return morris(model, params.length, r, seed).map((m, i) => ({ ...m, name: params[i]! }));
}

export { ARCHETYPES };
