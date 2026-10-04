/// <reference lib="webworker" />
import {
  analyseEndpoints, controlEndpointValues, determineNoael, forecastToxicity, histopathTable, matchHistorical, morrisCompound,
  runStudy, runVirtualControls, simulatedHistoricalDataset, simulateTwinBundle, validateControls, virtualControlEligibility,
} from "@eliminate/sim-core";
import type { Request, Response } from "./protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const send = (r: Response) => ctx.postMessage(r);

ctx.onmessage = (ev: MessageEvent<Request>) => {
  const req = ev.data;
  try {
    switch (req.type) {
      case "study": {
        const study = runStudy(req.design, (done, total) => send({ id: req.id, type: "progress", done, total }));
        const rows = analyseEndpoints(study);
        const histo = histopathTable(study);
        send({ id: req.id, type: "result", payload: { study, rows, histo, noael: determineNoael(study, rows, histo) } });
        break;
      }
      case "twin":
        send({ id: req.id, type: "result", payload: simulateTwinBundle(req.cfg) });
        break;
      case "forecast": {
        const out = req.doses.map((d, i) => {
          const f = forecastToxicity({ ...req.base, regimen: { ...req.base.regimen, doseMgPerKg: d } }, { nAnimals: req.n });
          send({ id: req.id, type: "progress", done: i + 1, total: req.doses.length });
          return f;
        });
        send({ id: req.id, type: "result", payload: out });
        break;
      }
      case "morris":
        send({ id: req.id, type: "result", payload: morrisCompound(req.cfg, { kind: "peakDamage", organ: req.organ }, req.organ, req.r, 1) });
        break;
      case "validation": {
        const usedDemo = req.historical.length === 0;
        const hist = usedDemo ? simulatedHistoricalDataset(req.design, 5, req.nPerSex, 500) : req.historical;
        const control = runVirtualControls(req.design, req.nPerSex, 4242);
        const sim = controlEndpointValues(control);
        const report = validateControls(sim, hist);
        const m = new Map<string, number[]>();
        for (const [k, v] of sim) if (k.startsWith("M|")) m.set(k.slice(2), v);
        const eligibility = hist.length ? virtualControlEligibility(m, matchHistorical(hist, { strain: req.design.strain, sex: "M", ageWeeks: req.design.ageWeeks })) : null;
        send({ id: req.id, type: "result", payload: { report, eligibility, usedDemo } });
        break;
      }
    }
  } catch (e) {
    send({ id: req.id, type: "error", message: e instanceof Error ? e.message : String(e) });
  }
};
