import { ARCHETYPES, defaultDesign, runStudy } from "../packages/sim-core/src";
const c = ARCHETYPES.reference!;
const s = runStudy(defaultDesign(c, { nPerSexPerGroup: 8, durationDays: 28, highDoseMgPerKg: c.tunedDoseRange[1], seed: 12 }));
for (const g of ["G1", "G4"]) for (const sex of ["M", "F"]) {
  const a = s.animals.filter((x) => x.group === g && x.sex === sex);
  const m = (k: string) => (a.reduce((t, x) => t + x.endpoints[k]!, 0) / a.length).toFixed(3);
  console.log(g, sex, "S", m("sicknessIndex"), "liverD", m("histo.liver.grade"), "neut", m("heme.neutrophils"), "wbc", m("heme.wbc"), "ALT", m("chem.alt"));
}
