import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { SIM_VERSION } from "@eliminate/sim-core";
import { defaultSetup, defaultFocusId } from "./setup";
import { prewarmApplies, type PrewarmFile } from "./prewarm";

const path = new URL("../../public/prewarm/default.json", import.meta.url);

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
    expect(f.population.treated.length).toBe(f.population.n);
    expect(f.population.untreated.length).toBe(f.population.n);
    expect(f.twin.treated.days).toBe(f.payload.study.design.durationDays);
  });
});
