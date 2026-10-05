import { ARCHETYPES, defaultDesign, runStudy } from "../packages/sim-core/src";
for (const k of ["hepatotoxin", "nephrotoxin", "cardiotoxin", "neurotoxin", "myelotoxin"]) {
  for (const mult of [1, 1.5, 2]) {
    const c = ARCHETYPES[k]!;
    const s = runStudy(defaultDesign(c, { nPerSexPerGroup: 10, durationDays: 28, seed: 42, highDoseMgPerKg: c.defaultDoseMgPerKg * mult }));
    const h = s.animals.filter((a) => a.terminalReason === "humane");
    const days = h.map((a) => a.terminalDay).sort((a, b) => a - b);
    console.log(k, "x" + mult, "humane", h.length, "first day", days[0] ?? "-", "reasons", [...new Set(h.map((a) => a.humane!.criteria.join("+")))].join(","));
  }
}
