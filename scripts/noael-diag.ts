import { ARCHETYPES, defaultDesign, runStudy, analyseEndpoints, histopathTable, determineNoael } from "../packages/sim-core/src";
const c = ARCHETYPES.cardiotoxin!;
const s = runStudy(defaultDesign(c, { nPerSexPerGroup: 10, durationDays: 28, seed: 42, disease: { cancer: {} } }));
const rows = analyseEndpoints(s), histo = histopathTable(s);
const n = determineNoael(s, rows, histo);
console.log("NOAEL", n.noael, "LOAEL", n.loael);
for (const g of n.groups) console.log(g.groupId, g.dose.toFixed(1), g.adverse, g.reasons.slice(0, 6).join(" | "));
