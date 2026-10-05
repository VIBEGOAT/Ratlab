import { ARCHETYPES, configForAnimal, defaultDesign, runStudy, simulateTwinBundle } from "../packages/sim-core/src";
const c = ARCHETYPES.cardiotoxin!;
for (const mult of [1, 1.5]) {
  const d = defaultDesign(c, { nPerSexPerGroup: 10, durationDays: 28, seed: 42, disease: { cancer: {} }, highDoseMgPerKg: c.defaultDoseMgPerKg * mult });
  const s = runStudy(d);
  for (const g of d.groups) { const a = s.animals.filter((x) => x.group === g.id); const h = a.filter((x) => x.terminalReason === "humane"); console.log("x" + mult, g.id, g.doseMgPerKg.toFixed(1), "humane", h.length, "/", a.length, "days", h.map((x) => x.terminalDay).sort((p, q) => p - q).slice(0, 4).join(",")); }
  const hi = s.animals.find((a) => a.group === "G4" && a.sex === "M")!;
  const tw = simulateTwinBundle(configForAnimal(d, hi));
  console.log(" story animal", hi.id, "treated humane", tw.treated.humane?.day ?? "none", "twin humane", tw.untreated.humane?.day ?? "none", "heart grade end", tw.treated.daily.damage.heart[28]!.toFixed(2), "tumour end", tw.treated.daily.tumorVolume[28]!.toFixed(0), "vs", tw.untreated.daily.tumorVolume[28]!.toFixed(0));
}
