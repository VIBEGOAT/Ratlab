import { describe, it, expect } from "vitest";
import { computeBodyMesh, skinWeightsOf } from "./bodyMesh";

describe("rat body mesh (built in a worker in the app)", () => {
  const m = computeBodyMesh(0.06);
  it("is a real mesh with matching attribute sizes and finite numbers", () => {
    expect(m.positions.length).toBeGreaterThan(3000);
    expect(m.normals.length).toBe(m.positions.length);
    expect(m.skinW.length).toBe(m.positions.length / 3);
    expect(m.indices.length % 3).toBe(0);
    expect(m.positions.every(Number.isFinite)).toBe(true);
    expect(Math.max(...m.indices)).toBeLessThan(m.positions.length / 3);
  });
  it("shows bare skin at the paws and nose, fur elsewhere", () => {
    expect(skinWeightsOf(new Float32Array([0, 0.0, 0]))[0]).toBeCloseTo(1, 5);
    expect(skinWeightsOf(new Float32Array([3.0, 1.0, 0]))[0]).toBeCloseTo(1, 5);
    expect(skinWeightsOf(new Float32Array([0, 1.0, 0]))[0]).toBe(0);
    expect(Math.max(...m.skinW)).toBeLessThanOrEqual(1);
    expect(Math.min(...m.skinW)).toBeGreaterThanOrEqual(0);
  });
});
