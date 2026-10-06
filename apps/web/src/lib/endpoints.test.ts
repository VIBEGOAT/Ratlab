import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { endpointLabel, readableFinding } from "./endpoints";

describe("plain-language endpoint names", () => {
  it("names the common endpoints", () => {
    expect(endpointLabel("chem.troponinI")).toBe("Troponin I (heart damage)");
    expect(endpointLabel("bodyWeightChangePct")).toBe("Body-weight gain");
    expect(endpointLabel("organ.heart.relative")).toBe("Heart weight (relative to body)");
    expect(endpointLabel("organ.liver.absolute")).toBe("Liver weight");
    expect(endpointLabel("histo.heart.grade")).toBe("Heart damage under the microscope");
  });

  it("never shows a raw dotted key for any endpoint the study produces", () => {
    const f = JSON.parse(readFileSync(new URL("../prewarm/default.json", import.meta.url), "utf8")) as { payload: { rows: Array<{ endpoint: string }> } };
    const keys = [...new Set(f.payload.rows.map((r) => r.endpoint))];
    expect(keys.length).toBeGreaterThan(30);
    for (const k of keys) {
      const label = endpointLabel(k);
      expect(label, k).not.toMatch(/\./);
      expect(label, k).not.toMatch(/[a-z][A-Z]/);
      expect(label.length, k).toBeGreaterThan(2);
    }
  });

  it("turns unknown keys into words instead of showing them raw", () => {
    expect(endpointLabel("chem.newMarkerX")).toBe("New marker x");
  });
});

describe("plain-language adverse findings", () => {
  it("rewrites change, histopathology and humane-endpoint notes", () => {
    expect(readableFinding("chem.ast (M) +416%")).toBe("AST (liver and muscle enzyme) in males, up 416%");
    expect(readableFinding("organ.heart.relative (F) -20%")).toBe("Heart weight (relative to body) in females, down 20%");
    expect(readableFinding("histopathology heart (F) grade 2+ in 6/10")).toBe("Heart damage (grade 2 or worse) in 6 of 10 females");
    expect(readableFinding("humane endpoints in 3/20")).toBe("Humane endpoint reached by 3 of 20 animals");
  });
  it("passes anything else through unchanged", () => {
    expect(readableFinding("something else")).toBe("something else");
  });
});

describe("blood marker names", () => {
  it("names bare chemistry and haematology keys", async () => {
    const { markerLabel } = await import("./endpoints");
    expect(markerLabel("alt")).toBe("ALT (liver enzyme)");
    expect(markerLabel("rbc")).toBe("Red blood cells");
    expect(markerLabel("troponinI")).toBe("Troponin I (heart damage)");
  });
});
