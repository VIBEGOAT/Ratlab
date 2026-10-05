/**
 * Pre-bakes the default study so the very first visit opens instantly instead of waiting for the simulation.
 * Output: apps/web/public/prewarm/default.json, keyed by SIM_VERSION and the default setup, so the app only
 * uses it when both match. A unit test fails if this file goes stale. Run: npm run gen:prewarm
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  SIM_VERSION, analyseEndpoints, configForAnimal, determineNoael, histopathTable, runStudy, simulatePopulation, simulateTwinBundle,
} from "../packages/sim-core/src";
import { buildDesign, defaultFocusId, defaultSetup } from "../apps/web/src/lib/setup";

const setup = defaultSetup();
const study = runStudy(buildDesign(setup));
const rows = analyseEndpoints(study);
const histo = histopathTable(study);
const noael = determineNoael(study, rows, histo);
const focusId = defaultFocusId(study);
const animal = study.animals.find((a) => a.id === focusId);
if (!focusId || !animal) throw new Error("no focus animal for the default study");
const twin = simulateTwinBundle(configForAnimal(study.design, animal));

const top = study.animals.filter((a) => a.kind === "main").sort((a, b) => b.doseMgPerKg - a.doseMgPerKg)[0]!;
const baseT = { ...configForAnimal(study.design, top), durationDays: study.design.durationDays };
const baseU = { ...baseT, regimen: { ...baseT.regimen, doseMgPerKg: 0 } };
const N = 1000;
const treated = simulatePopulation(baseT, { n: N, dtH: 0.5, idPrefix: "pop" });
const untreated = simulatePopulation(baseU, { n: N, dtH: 0.5, idPrefix: "pop" });

const out = {
  simVersion: SIM_VERSION,
  setupKey: JSON.stringify(setup),
  payload: { study, rows, histo, noael },
  focusId,
  twin,
  population: { n: N, doseMgPerKg: top.doseMgPerKg, treated, untreated },
};
mkdirSync("apps/web/public/prewarm", { recursive: true });
const text = JSON.stringify(out);
writeFileSync("apps/web/public/prewarm/default.json", text);
console.log(`wrote apps/web/public/prewarm/default.json, ${(text.length / 1e6).toFixed(2)} MB, sim ${SIM_VERSION}`);
