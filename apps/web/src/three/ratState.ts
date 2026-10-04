import { FINDINGS, GRADE_SEVERITY, ORGANS, gradeFromDamage, type AnimalBundle, type Organ } from "@eliminate/sim-core";

/**
 * Everything the 3D rat needs to look the way the simulated animal is on one day.
 * The model component only reads this, so a glTF model can replace the procedural one
 * without touching the simulation.
 */
export interface OrganVisual { damage: number; grade: 0 | 1 | 2 | 3 | 4 | 5; severity: string; finding: string }

export interface RatVisualState {
  day: number;
  organs: Record<Organ, OrganVisual>;
  /** body size relative to a 300 g rat */
  size: number;
  /** thinning, 0 to 0.5 */
  wasting: number;
  jaundice: number;
  piloerection: number;
  hunch: number;
  tremor: number;
  convulsion: number;
  ataxia: number;
  tears: number;
  cataract: number;
  dehydration: number;
  lethargy: number;
  /** 0 to 1, from the 0 to 2 grimace score */
  grimace: number;
  /** tumor radius in model units, 0 when there is none */
  tumorRadius: number;
  heartRateBpm: number;
  /** breaths per minute, illustrative */
  respirationBpm: number;
  /** home-cage activity relative to baseline */
  activity: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function tumorRadiusFromVolume(v: number): number {
  if (!(v > 0)) return 0;
  return Math.min(0.75, 0.06 + 0.5 * Math.cbrt(v / 2000));
}

export function ratVisualState(b: AnimalBundle, dayFloat: number): RatVisualState {
  const day = Math.min(b.days, Math.max(0, Math.round(dayFloat)));
  const d = b.daily;
  const sign = (k: string) => d.signIntensity[k]?.[day] ?? 0;
  const organs = {} as Record<Organ, OrganVisual>;
  for (const o of ORGANS) {
    const D = clamp01(d.damage[o][day] ?? 0);
    const g = gradeFromDamage(D);
    organs[o] = { damage: D, grade: g, severity: GRADE_SEVERITY[g], finding: FINDINGS[o][g] };
  }
  const bw = d.bodyWeightG[day] ?? 300;
  const sickness = d.sickness[day] ?? 0;
  const cp = b.clinpath[day];
  return {
    day, organs,
    size: Math.min(1.5, Math.max(0.6, Math.cbrt(bw / 300))),
    wasting: Math.min(0.5, Math.max(0, d.wasting[day] ?? 0)),
    jaundice: sign("jaundice"), piloerection: sign("ruffledFur"), hunch: sign("hunchedPosture"), tremor: sign("tremor"), convulsion: sign("convulsions"),
    ataxia: sign("ataxia"), tears: sign("chromodacryorrhoea"), cataract: sign("cataract"), dehydration: sign("dehydration"), lethargy: sign("lethargy"),
    grimace: clamp01((d.grimace[day] ?? 0) / 2),
    tumorRadius: tumorRadiusFromVolume(d.tumorVolume[day] ?? 0),
    heartRateBpm: cp?.cardiac.heartRateBpm ?? 360,
    respirationBpm: 85 * (1 + 0.4 * organs.heart.damage - 0.4 * clamp01(sickness)),
    activity: d.behaviour.activityIndex?.[day] ?? 1,
  };
}

/** Blend two hex colours, t from 0 (a) to 1 (b). Returns [r, g, b] in 0 to 1. */
export function mixRgb(a: string, b: string, t: number): [number, number, number] {
  const pa = parseHex(a), pb = parseHex(b), k = clamp01(t);
  return [pa[0] + (pb[0] - pa[0]) * k, pa[1] + (pb[1] - pa[1]) * k, pa[2] + (pb[2] - pa[2]) * k];
}

function parseHex(h: string): [number, number, number] {
  const v = h.replace("#", "");
  return [parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255];
}

export const rgbToHex = (c: [number, number, number]): string =>
  "#" + c.map((x) => Math.round(clamp01(x) * 255).toString(16).padStart(2, "0")).join("");

/** Which simulated tissue and which blood markers belong to each organ, for the click-through detail panel. */
export const ORGAN_DETAIL: Record<Organ, { tissue: "liver" | "kidney" | "heart" | "brain" | "gut" | "marrow"; markers: Array<{ key: string; panel: "chemistry" | "hematology" }> }> = {
  liver: { tissue: "liver", markers: [{ key: "alt", panel: "chemistry" }, { key: "ast", panel: "chemistry" }, { key: "bilirubin", panel: "chemistry" }, { key: "albumin", panel: "chemistry" }] },
  kidney: { tissue: "kidney", markers: [{ key: "creatinine", panel: "chemistry" }, { key: "bun", panel: "chemistry" }, { key: "potassium", panel: "chemistry" }] },
  heart: { tissue: "heart", markers: [{ key: "troponinI", panel: "chemistry" }, { key: "ck", panel: "chemistry" }] },
  brain: { tissue: "brain", markers: [{ key: "ck", panel: "chemistry" }] },
  gut: { tissue: "gut", markers: [{ key: "albumin", panel: "chemistry" }, { key: "sodium", panel: "chemistry" }] },
  marrow: { tissue: "marrow", markers: [{ key: "neutrophils", panel: "hematology" }, { key: "platelets", panel: "hematology" }, { key: "rbc", panel: "hematology" }, { key: "reticulocytes", panel: "hematology" }] },
};
