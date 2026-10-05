import { describe, it, expect } from "vitest";
import { axisWidth, nearestIndex, runs, sampleIndices, spreadLabels, valueAt } from "./chartMath";

describe("chart maths", () => {
  it("finds the nearest point", () => {
    expect(nearestIndex([0, 1, 2, 3], 2.4)).toBe(2);
    expect(nearestIndex([], 1)).toBe(-1);
  });

  it("reads each series at the same x, using steps for survival curves", () => {
    const smooth = { x: [0, 7, 14, 21], y: [10, 20, 30, 40] };
    const steps = { x: [0, 9, 20], y: [1, 0.8, 0.5], step: true };
    expect(valueAt(smooth, 13)).toEqual({ x: 14, y: 30 });
    expect(valueAt(steps, 13)).toEqual({ x: 9, y: 0.8 });
    expect(valueAt(steps, 20)).toEqual({ x: 20, y: 0.5 });
    expect(valueAt(steps, -5)).toEqual({ x: 0, y: 1 });
    expect(valueAt({ x: [], y: [] }, 1)).toBeNull();
    expect(valueAt({ x: [0, 1], y: [NaN, 3] }, 0)).toBeNull();
  });

  it("different series lengths no longer share an index", () => {
    const a = { x: [0, 1, 2, 3, 4, 5, 6, 7], y: [0, 1, 2, 3, 4, 5, 6, 7] };
    const b = { x: [0, 7], y: [100, 200] };
    expect(valueAt(a, 7)!.y).toBe(7);
    expect(valueAt(b, 7)!.y).toBe(200);
  });

  it("breaks lines at missing values instead of joining across them", () => {
    expect(runs([1, 2, NaN, 4, 5], [0, 1, 2, 3, 4], false)).toEqual([[0, 1], [3, 4]]);
    expect(runs([1, 0, 3], [0, 1, 2], true)).toEqual([[0], [2]]);
    expect(runs([], [], false)).toEqual([]);
  });

  it("spreads end labels apart without reordering them or leaving the plot", () => {
    const out = spreadLabels([100, 102, 104], 14, 0, 200);
    expect(out[1]! - out[0]!).toBeGreaterThanOrEqual(14);
    expect(out[2]! - out[1]!).toBeGreaterThanOrEqual(14);
    expect(out[0]).toBeLessThan(out[1]!);
    const low = spreadLabels([196, 198, 199], 14, 0, 200);
    expect(Math.max(...low)).toBeLessThanOrEqual(200);
    expect(low[2]! - low[0]!).toBeGreaterThanOrEqual(28);
    // input order is preserved in the output
    const mixed = spreadLabels([50, 10, 30], 5, 0, 100);
    expect(mixed).toEqual([50, 10, 30]);
  });

  it("samples long series for the data table", () => {
    expect(sampleIndices(5, 40)).toEqual([0, 1, 2, 3, 4]);
    const s = sampleIndices(1000, 40);
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s[0]).toBe(0);
    expect(s[s.length - 1]).toBe(999);
  });

  it("sizes the y axis to its labels", () => {
    expect(axisWidth(["0", "5"])).toBeGreaterThanOrEqual(38);
    expect(axisWidth(["0", "1,000,000"])).toBeGreaterThan(axisWidth(["0", "10"]));
  });
});
