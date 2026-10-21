/**
 * Rat anatomy as a signed distance field (SDF). Negative inside, positive outside, in model units
 * (1 unit is about 4 cm for a 300 g rat). Axis: +x towards the nose, +y up, z sideways. Floor at y = 0.
 *
 * The body is ONE continuous surface built from smoothly blended primitives, so limbs, head and
 * snout are attached by construction. Organ, eye, ear and tumour positions are placed relative to
 * this field and checked by tests (anatomy.test.ts).
 */

export type Vec3 = [number, number, number];

const len = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);

/** Approximate ellipsoid distance (Quilez). Good enough for blending and meshing. */
export function sdEllipsoid(p: Vec3, c: Vec3, r: Vec3): number {
  const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2];
  const k0 = len(x, y, z);
  const k1 = len(x / r[0], y / r[1], z / r[2]);
  return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
}

/** Capsule with radius tapering from ra (at a) to rb (at b). */
export function sdRoundCone(p: Vec3, a: Vec3, b: Vec3, ra: number, rb: number): number {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const pax = p[0] - a[0], pay = p[1] - a[1], paz = p[2] - a[2];
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
  return len(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}

/** Polynomial smooth minimum: blends surfaces over a distance k. */
export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Body parts. Kept as data so tests and the mesher share one definition. */
const TORSO = { c: [-0.35, 0.92, 0] as Vec3, r: [1.25, 0.6, 0.62] as Vec3 };
const CHEST = { c: [0.85, 0.93, 0] as Vec3, r: [0.82, 0.5, 0.5] as Vec3 };
export const HEAD = { c: [1.92, 1.02, 0] as Vec3, r: [0.64, 0.46, 0.42] as Vec3 };
const SNOUT = { a: [2.2, 0.96, 0] as Vec3, b: [3.0, 0.86, 0] as Vec3, ra: 0.32, rb: 0.095 };
export const LEGS: Array<{ upper: [Vec3, Vec3, number, number]; paw: { c: Vec3; r: Vec3 } }> = ([1, -1] as const).flatMap((s) => [
  // front legs: shoulder to wrist, with a small forward paw
  { upper: [[1.05, 0.7, 0.3 * s], [1.22, 0.1, 0.36 * s], 0.13, 0.065] as [Vec3, Vec3, number, number], paw: { c: [1.32, 0.045, 0.37 * s] as Vec3, r: [0.15, 0.045, 0.08] as Vec3 } },
  // hind legs: hip to heel, with a long hind paw
  { upper: [[-1.0, 0.62, 0.42 * s], [-1.12, 0.1, 0.46 * s], 0.24, 0.07] as [Vec3, Vec3, number, number], paw: { c: [-0.92, 0.045, 0.47 * s] as Vec3, r: [0.27, 0.045, 0.09] as Vec3 } },
]);

export const BODY_BOUNDS = { min: [-1.9, -0.02, -0.85] as Vec3, max: [3.15, 1.62, 0.85] as Vec3 };

/** Signed distance from p to the rat's skin. `wasting` thins the trunk (0 to 0.5). */
export function ratSdf(p: Vec3, wasting = 0): number {
  const thin = 1 - 0.38 * wasting;
  let d = sdEllipsoid(p, TORSO.c, [TORSO.r[0], TORSO.r[1] * thin, TORSO.r[2] * thin]);
  d = smin(d, sdEllipsoid(p, CHEST.c, [CHEST.r[0], CHEST.r[1] * thin, CHEST.r[2] * thin]), 0.35);
  d = smin(d, sdEllipsoid(p, HEAD.c, HEAD.r), 0.3);
  d = smin(d, sdRoundCone(p, SNOUT.a, SNOUT.b, SNOUT.ra, SNOUT.rb), 0.18);
  // Rounded hindquarters and shoulder musculature soften the straight tubular silhouette.
  for (const side of [-1, 1]) {
    d = smin(d, sdEllipsoid(p, [-.95, .68, side * .35], [.42, .48, .32]), .18);
    d = smin(d, sdEllipsoid(p, [1.02, .75, side * .28], [.25, .34, .24]), .14);
  }
  for (const l of LEGS) {
    d = smin(d, sdRoundCone(p, l.upper[0], l.upper[1], l.upper[2], l.upper[3]), 0.16);
    d = smin(d, sdEllipsoid(p, l.paw.c, l.paw.r), 0.07);
  }
  return d;
}

export function sdfNormal(p: Vec3, wasting = 0): Vec3 {
  const e = 0.003;
  const nx = ratSdf([p[0] + e, p[1], p[2]], wasting) - ratSdf([p[0] - e, p[1], p[2]], wasting);
  const ny = ratSdf([p[0], p[1] + e, p[2]], wasting) - ratSdf([p[0], p[1] - e, p[2]], wasting);
  const nz = ratSdf([p[0], p[1], p[2] + e], wasting) - ratSdf([p[0], p[1], p[2] - e], wasting);
  const l = len(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

/**
 * Seat a feature on the skin: march from `from` along `dir` in small fixed steps until the sign of the
 * field changes, then bisect. Works whether `from` starts inside or outside the body.
 */
export function projectToSurface(from: Vec3, dir: Vec3, wasting = 0): Vec3 {
  const l = len(...dir) || 1;
  const d: Vec3 = [dir[0] / l, dir[1] / l, dir[2] / l];
  const at = (t: number): Vec3 => [from[0] + d[0] * t, from[1] + d[1] * t, from[2] + d[2] * t];
  const s0 = ratSdf(from, wasting) < 0;
  let a = 0, b = -1;
  for (let t = 0.01; t < 4; t += 0.01) { if ((ratSdf(at(t), wasting) < 0) !== s0) { a = t - 0.01; b = t; break; } }
  if (b < 0) return from;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if ((ratSdf(at(m), wasting) < 0) === s0) a = m; else b = m; }
  return at((a + b) / 2);
}

/** Organs, placed in rat-like topography: brain in the skull, heart between the lungs, liver behind the diaphragm, kidneys dorsal, gut ventral. */
export interface OrganShape { center: Vec3; radii: Vec3; rot?: Vec3 }
export const ORGAN_SHAPES = {
  brain: [{ center: [1.88, 1.08, 0], radii: [0.27, 0.16, 0.19] }],
  heart: [{ center: [1.02, 0.82, 0.04], radii: [0.15, 0.17, 0.14], rot: [0, 0, 0.5] }],
  lungs: [{ center: [0.98, 0.98, 0.2], radii: [0.34, 0.2, 0.15] }, { center: [0.98, 0.98, -0.2], radii: [0.34, 0.2, 0.15] }],
  liver: [{ center: [0.5, 0.82, 0.04], radii: [0.2, 0.24, 0.38], rot: [0, 0, -0.25] }, { center: [0.44, 0.76, 0.26], radii: [0.16, 0.16, 0.14] }],
  stomach: [{ center: [0.2, 0.8, -0.22], radii: [0.2, 0.15, 0.15] }],
  kidney: [{ center: [-0.25, 1.06, 0.24], radii: [0.15, 0.09, 0.085], rot: [0, 0.3, 0] }, { center: [-0.18, 1.08, -0.24], radii: [0.15, 0.09, 0.085], rot: [0, -0.3, 0] }],
  spleen: [{ center: [0.05, 0.86, -0.4], radii: [0.2, 0.05, 0.08], rot: [0, 0.4, 0] }],
  bladder: [{ center: [-1.05, 0.68, 0], radii: [0.09, 0.07, 0.07] }],
} satisfies Record<string, OrganShape[]>;

/** Gut as a coiled tube in the abdomen: a path for a tube mesh. */
export function gutPath(): Vec3[] {
  const pts: Vec3[] = [[0.2, 0.75, -0.18]];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const ang = t * Math.PI * 7;
    const x = 0.05 - t * 1.05;
    pts.push([x + 0.08 * Math.cos(ang * 1.3), 0.64 + 0.09 * Math.sin(ang * 1.7), 0.22 * Math.cos(ang)]);
  }
  pts.push([-1.15, 0.72, 0]);
  return pts;
}

/** Major vessels: aorta and vena cava along the spine, portal vein gut to liver, renal branches. */
export const VESSELS: Array<{ id: string; kind: "artery" | "vein" | "portal"; path: Vec3[]; radius: number }> = [
  { id: "aorta", kind: "artery", path: [[1.02, 0.9, 0.03], [0.95, 1.15, 0.02], [0.6, 1.2, 0.02], [0, 1.18, 0.02], [-0.7, 1.12, 0.02], [-1.3, 1.0, 0.02]], radius: 0.028 },
  { id: "vena-cava", kind: "vein", path: [[-1.3, 0.96, -0.05], [-0.7, 1.08, -0.06], [0, 1.12, -0.06], [0.45, 0.95, -0.03], [0.9, 0.82, -0.02]], radius: 0.032 },
  { id: "portal", kind: "portal", path: [[-0.3, 0.68, 0], [0.05, 0.72, 0.02], [0.35, 0.76, 0.05]], radius: 0.022 },
  { id: "renal-l", kind: "artery", path: [[-0.2, 1.15, 0.02], [-0.22, 1.1, 0.16]], radius: 0.014 },
  { id: "renal-r", kind: "artery", path: [[-0.15, 1.15, 0.02], [-0.16, 1.1, -0.16]], radius: 0.014 },
  { id: "femoral-l", kind: "artery", path: [[-1.3, 1.0, 0.02], [-1.05, 0.7, 0.35], [-1.08, 0.35, 0.44]], radius: 0.012 },
  { id: "femoral-r", kind: "artery", path: [[-1.3, 1.0, 0.02], [-1.05, 0.7, -0.35], [-1.08, 0.35, -0.44]], radius: 0.012 },
];

/** Bone marrow sites shown for the marrow layer: femurs and lumbar vertebrae. */
export const MARROW_SITES: Array<{ a: Vec3; b: Vec3; r: number }> = [
  { a: [-0.95, 0.6, 0.43], b: [-1.07, 0.22, 0.45], r: 0.045 },
  { a: [-0.95, 0.6, -0.43], b: [-1.07, 0.22, -0.45], r: 0.045 },
  { a: [-0.4, 1.28, 0], b: [-1.0, 1.24, 0], r: 0.035 },
];

export const SPINE_PATH: Vec3[] = [[1.75, 1.15, 0], [1.2, 1.3, 0], [0.4, 1.38, 0], [-0.4, 1.36, 0], [-1.1, 1.22, 0], [-1.6, 0.95, 0]];

/** Tail centre line, from the rump outward. Radius tapers from TAIL_BASE to TAIL_TIP. */
export const TAIL_PATH: Vec3[] = [[-1.45, 0.82, 0], [-2.1, 0.62, 0.05], [-2.9, 0.42, -0.12], [-3.7, 0.3, 0.12], [-4.4, 0.24, 0.0], [-4.9, 0.26, -0.1]];
export const TAIL_BASE = 0.11;
export const TAIL_TIP = 0.018;

/** Surface-seated features, computed from the field so they sit on the skin. */
export function features(wasting = 0) {
  const eyeL = projectToSurface([2.15, 1.12, 0], [0.55, 0.25, 1], wasting);
  const eyeR = projectToSurface([2.15, 1.12, 0], [0.55, 0.25, -1], wasting);
  const earL = projectToSurface([1.82, 1.15, 0], [-0.1, 1, 0.75], wasting);
  const earR = projectToSurface([1.82, 1.15, 0], [-0.1, 1, -0.75], wasting);
  const nose = projectToSurface([2.6, 0.9, 0], [1, -0.05, 0], wasting);
  const tumour = projectToSurface([-0.4, 0.85, 0], [0, 0.15, 1], wasting);
  const tearL = projectToSurface([2.12, 1.02, 0], [0.5, 0.0, 1], wasting);
  const tearR = projectToSurface([2.12, 1.02, 0], [0.5, 0.0, -1], wasting);
  return { eyeL, eyeR, earL, earR, nose, tumour, tearL, tearR };
}
