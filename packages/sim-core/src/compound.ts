import type { Tissue } from "./physiology";
import type { Organ, TdOrganParams } from "./toxicodynamics";
import type { PdSpec } from "./pd";

/**
 * A compound is a set of generic ADME and toxicity parameters.
 * All shipped compounds are FICTIONAL ARCHETYPES. Parameter values are design
 * placeholders chosen to give each archetype a recognisable profile; they are
 * not measurements of any real substance.
 */
export interface Compound {
  id: string;
  name: string;
  archetype: "hepatotoxin" | "nephrotoxin" | "cardiotoxin" | "neurotoxin" | "myelotoxin" | "reference" | "custom";
  description: string;
  fictional: true;
  /** oral absorption rate, 1/h */
  ka: number;
  /** fraction of the oral dose absorbed from the gut lumen */
  fAbs: number;
  /** fraction unbound in plasma */
  fu: number;
  /** blood to plasma concentration ratio */
  bp: number;
  /** tissue to plasma partition coefficients */
  kp: Record<Tissue, number>;
  /** intrinsic hepatic clearance, L/h per kg body weight (applied to unbound drug) */
  clIntLPerHPerKg: number;
  /** renal clearance, L/h per kg body weight */
  clRenalLPerHPerKg: number;
  /** fraction of hepatic metabolism that forms a reactive metabolite */
  fReactive: number;
  /** multiplier on hepatic clearance in females (sex-dependent metabolism) */
  femaleClFactor: number;
  /** fraction unbound in tissue (scales concentration into the toxic exposure driver) */
  fuTissue: number;
  td: Partial<Record<Organ, TdOrganParams>>;
  pd?: PdSpec[];
  /** dose range (mg/kg/day) the archetype was tuned for; outside it results are extrapolation */
  tunedDoseRange: [number, number];
  defaultDoseMgPerKg: number;
}

const KP_BASE: Record<Tissue, number> = {
  gut: 2, liver: 3, kidney: 2, heart: 1.2, brain: 0.3, lung: 1.5,
  muscle: 0.8, fat: 1.5, marrow: 1.2, spleen: 1.5, rest: 0.8,
};

const NO_DEFENCE = { kdefUse: 0, kdefSyn: 0, gate0: 1 } as const;

export const ARCHETYPES: Record<string, Compound> = {
  hepatotoxin: {
    id: "archetype-hepatotoxin",
    name: "Archetype H (hepatotoxin)",
    archetype: "hepatotoxin",
    description: "Cleared by the liver. A fraction becomes a reactive metabolite that exhausts liver defences at high exposure.",
    fictional: true,
    ka: 1.5, fAbs: 0.9, fu: 0.7, bp: 1.0,
    kp: { ...KP_BASE, liver: 4 },
    clIntLPerHPerKg: 0.5, clRenalLPerHPerKg: 0.05,
    fReactive: 0.12, femaleClFactor: 0.8, fuTissue: 0.7,
    td: {
      liver: { driver: "reactive", thr: 40, kinj: 0.25, kreg: 0.004, kdefUse: 0.6, kdefSyn: 0.04, gate0: 0.02, kad: 0.002, kadDecay: 0.001, adMax: 1.0 },
    },
    tunedDoseRange: [10, 300], defaultDoseMgPerKg: 150,
  },
  nephrotoxin: {
    id: "archetype-nephrotoxin",
    name: "Archetype N (nephrotoxin)",
    archetype: "nephrotoxin",
    description: "Eliminated by the kidney and concentrated in kidney tissue, where it injures tubule cells.",
    fictional: true,
    ka: 0.6, fAbs: 0.5, fu: 0.9, bp: 1.0,
    kp: { ...KP_BASE, kidney: 8 },
    clIntLPerHPerKg: 0.1, clRenalLPerHPerKg: 0.2,
    fReactive: 0, femaleClFactor: 1.0, fuTissue: 0.6,
    td: {
      kidney: { driver: "conc", thr: 40, kinj: 0.02, kreg: 0.004, ...NO_DEFENCE, kad: 0.002, kadDecay: 0.001, adMax: 0.5 },
    },
    tunedDoseRange: [5, 150], defaultDoseMgPerKg: 60,
  },
  cardiotoxin: {
    id: "archetype-cardiotoxin",
    name: "Archetype C (cardiotoxin)",
    archetype: "cardiotoxin",
    description: "Long half-life with heart accumulation. Myocyte loss is cumulative and barely reverses.",
    fictional: true,
    ka: 0.8, fAbs: 0.8, fu: 0.5, bp: 1.0,
    kp: { ...KP_BASE, heart: 6, spleen: 3 },
    clIntLPerHPerKg: 0.1, clRenalLPerHPerKg: 0.01,
    fReactive: 0, femaleClFactor: 1.0, fuTissue: 0.5,
    td: {
      heart: { driver: "conc", thr: 6, kinj: 0.0015, kreg: 0.00005, ...NO_DEFENCE, kad: 0, kadDecay: 0, adMax: 0 },
    },
    tunedDoseRange: [1, 30], defaultDoseMgPerKg: 8,
  },
  neurotoxin: {
    id: "archetype-neurotoxin",
    name: "Archetype K (neurotoxin)",
    archetype: "neurotoxin",
    description: "Crosses the blood-brain barrier. High brain exposure drives acute CNS excitation and neuronal injury.",
    fictional: true,
    ka: 2.0, fAbs: 0.95, fu: 0.4, bp: 1.0,
    kp: { ...KP_BASE, brain: 2.5 },
    clIntLPerHPerKg: 1.0, clRenalLPerHPerKg: 0.05,
    fReactive: 0, femaleClFactor: 0.9, fuTissue: 0.6,
    td: {
      brain: { driver: "conc", thr: 15, kinj: 0.02, kreg: 0.0005, ...NO_DEFENCE, kad: 0, kadDecay: 0, adMax: 0 },
    },
    pd: [
      { id: "cns-activation", label: "CNS activation", driver: "brain",
        model: { kind: "effect-compartment", ke0: 1.2, emax: 1, ec50: 3, hill: 2 } },
    ],
    tunedDoseRange: [5, 120], defaultDoseMgPerKg: 40,
  },
  myelotoxin: {
    id: "archetype-myelotoxin",
    name: "Archetype M (myelotoxin)",
    archetype: "myelotoxin",
    description: "Accumulates in bone marrow and gut epithelium. Damage is substantial but marrow regenerates after dosing stops.",
    fictional: true,
    ka: 1.0, fAbs: 0.7, fu: 0.6, bp: 1.0,
    kp: { ...KP_BASE, marrow: 5, gut: 3 },
    clIntLPerHPerKg: 0.5, clRenalLPerHPerKg: 0.05,
    fReactive: 0, femaleClFactor: 1.0, fuTissue: 0.6,
    td: {
      marrow: { driver: "conc", thr: 3, kinj: 0.03, kreg: 0.012, ...NO_DEFENCE, kad: 0, kadDecay: 0, adMax: 0 },
      gut: { driver: "conc", thr: 4, kinj: 0.015, kreg: 0.02, ...NO_DEFENCE, kad: 0, kadDecay: 0, adMax: 0 },
    },
    tunedDoseRange: [2, 60], defaultDoseMgPerKg: 20,
  },
  reference: {
    id: "archetype-reference",
    name: "Archetype S (safe reference)",
    archetype: "reference",
    description: "Well tolerated. Toxicity thresholds sit far above any exposure in the tuned dose range.",
    fictional: true,
    ka: 1.2, fAbs: 0.85, fu: 0.8, bp: 1.0,
    kp: { ...KP_BASE },
    clIntLPerHPerKg: 1.0, clRenalLPerHPerKg: 0.1,
    fReactive: 0.01, femaleClFactor: 1.0, fuTissue: 0.8,
    td: {
      liver: { driver: "reactive", thr: 5000, kinj: 0.1, kreg: 0.004, kdefUse: 0.3, kdefSyn: 0.05, gate0: 0.05, kad: 0, kadDecay: 0, adMax: 0 },
    },
    tunedDoseRange: [10, 500], defaultDoseMgPerKg: 100,
  },
};

export function validateCompound(c: Compound): string[] {
  const p: string[] = [];
  const pos = (name: string, v: number) => { if (!(v > 0) || !Number.isFinite(v)) p.push(`${name} must be positive`); };
  pos("ka", c.ka); pos("fu", c.fu); pos("bp", c.bp);
  if (c.fAbs <= 0 || c.fAbs > 1) p.push("fAbs must be in (0,1]");
  if (c.fu > 1) p.push("fu must be <= 1");
  if (c.fReactive < 0 || c.fReactive > 1) p.push("fReactive must be in [0,1]");
  if (c.clIntLPerHPerKg < 0 || c.clRenalLPerHPerKg < 0) p.push("clearances must be non-negative");
  for (const [t, k] of Object.entries(c.kp)) if (!(k > 0)) p.push(`kp.${t} must be positive`);
  for (const [o, td] of Object.entries(c.td)) {
    if (!td) continue;
    if (!(td.thr > 0)) p.push(`td.${o}.thr must be positive`);
    if (td.kinj < 0 || td.kreg < 0) p.push(`td.${o} rates must be non-negative`);
    if (td.gate0 < 0 || td.gate0 > 1) p.push(`td.${o}.gate0 must be in [0,1]`);
  }
  return p;
}
