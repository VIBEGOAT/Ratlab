import { ARCHETYPES, simulateAnimal, peakDamage, type AnimalConfig } from "../packages/sim-core/src";
const arg = process.argv[2] ?? "hepatotoxin";
const c = ARCHETYPES[arg]!;
const days = Number(process.argv[3] ?? 28);
const doses = (process.argv[4] ?? "").split(",").filter(Boolean).map(Number);
const list = doses.length ? doses : [0.1, 0.3, 1, 2].map((m) => m * c.defaultDoseMgPerKg);
console.log(arg, "tuned", c.tunedDoseRange);
for (const d of list) {
  const cfg: AnimalConfig = { seed: 1, animalId: "a1", sex: "M", strain: "SD", ageWeeks: 8, compound: c, durationDays: days + 14,
    regimen: { route: "oral", doseMgPerKg: d, intervalH: 24, startH: 0, nDoses: days } };
  const t = performance.now();
  const r = simulateAnimal(cfg);
  const pk = r.pk;
  const pd = peakDamage(r);
  const E:any={}; for (const o of Object.keys(c.td)) { const tdp:any=(c.td as any)[o]; if(tdp.driver==='conc'){E[o]=+(r.pk.organCmax[o as any]*c.fuTissue).toFixed(2)} else {const clH=c.clIntLPerHPerKg*r.physiology.bwKg*r.physiology.cypFactor; let m=0; for(let i=0;i<r.timesH.length;i++){const v=c.fReactive*clH*c.fu*r.tissue.liver[i]!/(c.kp.liver*r.physiology.vol.liver); if(v>m)m=v;} E[o]=+m.toFixed(0)} }
  const last = (o: string) => (r.damage as any)[o]?.at(-1)?.toFixed(2);
  console.log(`dose ${d.toFixed(1)}: Cmax ${pk.cmax.toFixed(2)} thalf ${pk.terminalHalfLifeH?.toFixed(1)} acc ${pk.accumulationRatio?.toFixed(2)} peakD ${JSON.stringify(Object.fromEntries(Object.entries(pd).map(([k,v])=>[k,+(v as number).toFixed(2)])))} end ${Object.keys(pd).map(o=>o+':'+last(o)).join(' ')} Epk ${JSON.stringify(E)} thr ${JSON.stringify(Object.fromEntries(Object.entries(c.td).map(([k,v]:any)=>[k,v.thr])))} mb ${r.massBalanceRelError.toExponential(1)} ${(performance.now()-t).toFixed(0)}ms`);
}
