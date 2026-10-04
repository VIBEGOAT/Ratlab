import { describe, it, expect } from "vitest";
import { BODY_BOUNDS, MARROW_SITES, ORGAN_SHAPES, VESSELS, features, gutPath, ratSdf, type Vec3 } from "./anatomy";
import { connectedComponents, surfaceNets } from "./surfaceNets";

describe("rat body mesh", () => {
  const t0 = performance.now();
  const mesh = surfaceNets((p) => ratSdf(p), BODY_BOUNDS.min, BODY_BOUNDS.max, 0.04);
  const ms = performance.now() - t0;

  it("is one continuous piece (head, snout and all four legs attached)", () => {
    expect(mesh.indices.length).toBeGreaterThan(3000);
    expect(connectedComponents(mesh)).toBe(1);
  });

  it("stands on the floor: the lowest point is the paws, at floor level", () => {
    let minY = Infinity;
    for (let i = 1; i < mesh.positions.length; i += 3) minY = Math.min(minY, mesh.positions[i]!);
    expect(minY).toBeGreaterThan(-0.01);
    expect(minY).toBeLessThan(0.03);
  });

  it("has unit normals and no NaN", () => {
    for (let i = 0; i < mesh.normals.length; i += 3) {
      const l = Math.hypot(mesh.normals[i]!, mesh.normals[i + 1]!, mesh.normals[i + 2]!);
      expect(Math.abs(l - 1)).toBeLessThan(1e-3);
    }
    expect(Array.from(mesh.positions).every(Number.isFinite)).toBe(true);
  });

  it("builds fast enough to run on page load", () => {
    expect(ms).toBeLessThan(4000);
  });
});

describe("anatomical placement", () => {
  it("keeps every organ inside the body, including when the animal is wasted", () => {
    for (const waste of [0, 0.5]) {
      for (const [name, parts] of Object.entries(ORGAN_SHAPES)) {
        for (const part of parts) {
          // the centre and the six extreme points of each organ must be inside the skin
          const pts: Vec3[] = [part.center];
          for (let a = 0; a < 3; a++) for (const s of [1, -1]) { const q: Vec3 = [...part.center]; q[a] = q[a]! + s * part.radii[a]! * 0.9; pts.push(q); }
          for (const p of pts) expect(ratSdf(p, waste), `${name} at waste ${waste}`).toBeLessThan(0);
        }
      }
    }
  });

  it("keeps the gut, vessels and marrow inside the body", () => {
    for (const p of gutPath()) expect(ratSdf(p, 0.5)).toBeLessThan(0);
    for (const v of VESSELS) for (const p of v.path) expect(ratSdf(p), v.id).toBeLessThan(0);
    for (const m of MARROW_SITES) { expect(ratSdf(m.a)).toBeLessThan(0); expect(ratSdf(m.b)).toBeLessThan(0); }
  });

  it("seats eyes, ears, nose, tears and tumour on the skin, mirrored left and right", () => {
    const f = features(0);
    for (const [k, p] of Object.entries(f)) expect(Math.abs(ratSdf(p)), k).toBeLessThan(0.005);
    expect(f.eyeL[2]).toBeCloseTo(-f.eyeR[2], 3);
    expect(f.earL[1]).toBeGreaterThan(f.eyeL[1]);
    expect(f.nose[0]).toBeGreaterThan(f.eyeL[0]);
  });

  it("puts the brain in the head, the heart forward of the liver, and the kidneys dorsal", () => {
    expect(ORGAN_SHAPES.brain[0]!.center[0]).toBeGreaterThan(1.6);
    expect(ORGAN_SHAPES.heart[0]!.center[0]).toBeGreaterThan(ORGAN_SHAPES.liver[0]!.center[0]);
    for (const k of ORGAN_SHAPES.kidney) expect(k.center[1]).toBeGreaterThan(ORGAN_SHAPES.liver[0]!.center[1]);
  });
});
