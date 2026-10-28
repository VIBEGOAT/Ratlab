import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { SIM_VERSION } from "@eliminate/sim-core";
import { defaultSetup, defaultFocusId } from "./setup";
import { prewarmApplies, type PopulationPrewarmFile, type PrewarmFile } from "./prewarm";

const path = new URL("../prewarm/default.json", import.meta.url);
const populationPath = new URL("../prewarm/population.json", import.meta.url);

describe("pre-baked default study", () => {
  it("applies only when the version and the whole setup match", () => {
    const f = { simVersion: "1", setupKey: "{}" };
    expect(prewarmApplies(f, "1", "{}")).toBe(true);
    expect(prewarmApplies(f, "2", "{}")).toBe(false);
    expect(prewarmApplies(f, "1", "{\"a\":1}")).toBe(false);
    expect(prewarmApplies(null, "1", "{}")).toBe(false);
  });

  it("is up to date: run `npm run gen:prewarm` after changing the simulator or the default setup", () => {
    expect(existsSync(path)).toBe(true);
    const f = JSON.parse(readFileSync(path, "utf8")) as PrewarmFile;
    expect(f.simVersion).toBe(SIM_VERSION);
    expect(f.setupKey).toBe(JSON.stringify(defaultSetup()));
    expect(f.focusId).toBe(defaultFocusId(f.payload.study));
    expect(f.payload.study.animals.length).toBeGreaterThan(50);
    expect(f.twin.treated.days).toBe(f.payload.study.design.durationDays);
    const population = JSON.parse(readFileSync(populationPath, "utf8")) as PopulationPrewarmFile;
    expect(population.simVersion).toBe(SIM_VERSION);
    expect(population.setupKey).toBe(JSON.stringify(defaultSetup()));
    expect(population.population.treated.length).toBe(population.population.n);
    expect(population.population.untreated.length).toBe(population.population.n);
  });
});

describe("pre-baked file shape", () => {
  it("has no number arrays that JSON turned into {\"0\": …} objects (typed arrays must be written as arrays)", () => {
    const f = JSON.parse(readFileSync(path, "utf8")) as unknown;
    const bad: string[] = [];
    const walk = (v: unknown, at: string) => {
      if (bad.length > 5 || v === null || typeof v !== "object") return;
      if (Array.isArray(v)) { v.forEach((x, i) => { if (i < 3) walk(x, `${at}[${i}]`); }); return; }
      const keys = Object.keys(v);
      if (keys.length > 0 && keys[0] === "0" && keys.every((k, i) => k === String(i))) { bad.push(at); return; }
      for (const k of keys) walk((v as Record<string, unknown>)[k], `${at}.${k}`);
    };
    walk(f, "file");
    expect(bad).toEqual([]);
  });
});
