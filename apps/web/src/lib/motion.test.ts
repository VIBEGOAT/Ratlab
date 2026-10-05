import { describe, it, expect } from "vitest";
import { easeOut } from "./motion";

describe("easing", () => {
  it("starts at 0, ends at 1, never goes backwards and clamps out-of-range input", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(-3)).toBe(0);
    expect(easeOut(4)).toBe(1);
    let last = -1;
    for (let i = 0; i <= 100; i++) { const v = easeOut(i / 100); expect(v).toBeGreaterThanOrEqual(last); last = v; }
  });
  it("decelerates: more than half done by the half-way point", () => {
    expect(easeOut(0.5)).toBeGreaterThan(0.9);
  });
});
