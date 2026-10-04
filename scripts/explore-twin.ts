import { ARCHETYPES, simulateTwin, behaviourDaily, makeClinPathContext, clinicalPathology, hysLawCheck, myelosuppression } from "../packages/sim-core/src";
const name = process.argv[2] ?? "cardiotoxin";
const dis = process.argv[3] ?? "cancer";
const dose = Number(process.argv[4] ?? ARCHETYPES[name]!.defaultDoseMgPerKg);
const c = ARCHETYPES[name]!;
const t = performance.now();
const tw = simulateTwin({ seed: 7, animalId: "r1", sex: "M", strain: "SD", ageWeeks: 8, compound: c, durationDays: 35,
  regimen: { route: "oral", doseMgPerKg: dose, intervalH: 24, startH: 0, nDoses: 28 },
  disease: dis === "cancer" ? { cancer: {} } : dis === "diabetes" ? { diabetes: { kind: "stz", severity: 0.8 } } : undefined });
console.log("ms", (performance.now() - t).toFixed(0));
for (const d of [0, 7, 14, 21, 28, 35]) {
  const a = tw.treated.obs, b = tw.untreated.obs;
  console.log(`day ${d}: BW ${a.bodyWeightG[d]!.toFixed(0)} vs ${b.bodyWeightG[d]!.toFixed(0)} | tumor ${a.tumorVolume[d]!.toFixed(0)} vs ${b.tumorVolume[d]!.toFixed(0)} | S ${a.sickness[d]!.toFixed(2)} vs ${b.sickness[d]!.toFixed(2)} | glc ${a.glucose[d]!.toFixed(0)} | heart ${a.damage.heart[d]!.toFixed(2)} | grim ${a.grimace[d]!.toFixed(2)}`);
}
console.log("humane treated:", tw.treated.humane?.banner ?? "none");
console.log("humane untreated:", tw.untreated.humane?.banner ?? "none");
const ctx = makeClinPathContext(tw.treated.result, tw.treated.obs);
const cp = clinicalPathology(ctx, 28);
console.log("ALT xULN", cp.chemistry.alt!.xUln.toFixed(1), "BUN", cp.chemistry.bun!.xUln.toFixed(1), "TnI", cp.chemistry.troponinI!.xUln.toFixed(1), "neut", cp.hematology.neutrophils!.value.toFixed(2), "hys", hysLawCheck(cp.chemistry).met, JSON.stringify(myelosuppression(ctx)));
