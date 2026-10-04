import { create } from "zustand";
import { configForAnimal, type ForecastResult, type HistoricalRow, type MorrisResult, type Organ, type TwinBundle } from "@eliminate/sim-core";
import { call } from "./worker/client";
import type { StudyPayload, ValidationPayload } from "./worker/protocol";
import { buildDesign, defaultSetup, designProblems, type Setup } from "./lib/setup";

export type Theme = "system" | "light" | "dark";
type Status = "idle" | "running" | "done" | "error";
interface Job<T> { status: Status; progress: number; error?: string; data: T | null }
const idle = <T,>(): Job<T> => ({ status: "idle", progress: 0, data: null });

interface State {
  setup: Setup;
  setSetup: (p: Partial<Setup>) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  tab: string;
  setTab: (t: string) => void;

  study: Job<StudyPayload>;
  runStudy: () => Promise<void>;

  focusId: string | null;
  twin: Job<TwinBundle>;
  setFocus: (id: string) => Promise<void>;

  forecast: Job<ForecastResult[]> & { n: number };
  runForecast: (n: number) => Promise<void>;

  morris: Job<MorrisResult[]> & { organ: Organ };
  runMorris: (organ: Organ) => Promise<void>;

  historical: HistoricalRow[];
  setHistorical: (rows: HistoricalRow[]) => void;
  validation: Job<ValidationPayload>;
  runValidation: () => Promise<void>;
}

let studyToken = 0;
let twinToken = 0;

const savedTheme = ((): Theme => { try { const t = localStorage.getItem("theme"); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } })();

export const useStore = create<State>((set, get) => ({
  setup: defaultSetup(),
  setSetup: (p) => set((s) => ({ setup: { ...s.setup, ...p } })),
  theme: savedTheme,
  setTheme: (t) => {
    try { localStorage.setItem("theme", t); } catch { /* ignore */ }
    set({ theme: t });
  },
  tab: (typeof location !== "undefined" && location.hash.slice(1)) || "design",
  setTab: (t) => { if (typeof history !== "undefined") history.replaceState(null, "", `#${t}`); set({ tab: t }); },

  study: idle(),
  runStudy: async () => {
    const setup = get().setup;
    const problems = designProblems(setup);
    if (problems.length) { set({ study: { status: "error", progress: 0, error: problems[0], data: get().study.data } }); return; }
    const token = ++studyToken;
    set((s) => ({ study: { status: "running", progress: 0, data: s.study.data }, forecast: { ...idle<ForecastResult[]>(), n: s.forecast.n } }));
    try {
      const payload = await call("study", { design: buildDesign(setup) }, (done, total) => { if (token === studyToken) set((s) => ({ study: { ...s.study, progress: done / total } })); });
      if (token !== studyToken) return;
      set({ study: { status: "done", progress: 1, data: payload } });
      const main = payload.study.design.groups.filter((g) => g.kind === "main").sort((a, b) => b.doseMgPerKg - a.doseMgPerKg);
      const pick = payload.study.animals.find((a) => a.group === main[0]!.id && a.sex === "M") ?? payload.study.animals.find((a) => a.group === main[0]!.id) ?? payload.study.animals[0];
      if (pick) await get().setFocus(pick.id);
    } catch (e) {
      if (token === studyToken) set((s) => ({ study: { status: "error", progress: 0, error: e instanceof Error ? e.message : String(e), data: s.study.data } }));
    }
  },

  focusId: null,
  twin: idle(),
  setFocus: async (id) => {
    const payload = get().study.data;
    if (!payload) return;
    const animal = payload.study.animals.find((a) => a.id === id);
    if (!animal) return;
    const token = ++twinToken;
    set((s) => ({ focusId: id, twin: { status: "running", progress: 0, data: s.twin.data } }));
    try {
      const bundle = await call("twin", { cfg: configForAnimal(payload.study.design, animal) });
      if (token === twinToken) set({ twin: { status: "done", progress: 1, data: bundle } });
    } catch (e) {
      if (token === twinToken) set((s) => ({ twin: { status: "error", progress: 0, error: e instanceof Error ? e.message : String(e), data: s.twin.data } }));
    }
  },

  forecast: { ...idle<ForecastResult[]>(), n: 100 },
  runForecast: async (n) => {
    const payload = get().study.data;
    if (!payload) return;
    const design = payload.study.design;
    const base = configForAnimal(design, payload.study.animals.find((a) => a.group === "G1") ?? payload.study.animals[0]!);
    const doses = design.groups.filter((g) => g.kind === "main" && g.doseMgPerKg > 0).map((g) => g.doseMgPerKg);
    set({ forecast: { status: "running", progress: 0, data: null, n } });
    try {
      const data = await call("forecast", { base: { ...base, durationDays: design.durationDays }, doses, n }, (d, t) => set((s) => ({ forecast: { ...s.forecast, progress: d / t } })));
      set({ forecast: { status: "done", progress: 1, data, n } });
    } catch (e) { set({ forecast: { status: "error", progress: 0, data: null, n, error: e instanceof Error ? e.message : String(e) } }); }
  },

  morris: { ...idle<MorrisResult[]>(), organ: "liver" },
  runMorris: async (organ) => {
    const payload = get().study.data;
    if (!payload) return;
    const design = payload.study.design;
    const high = payload.study.animals.filter((a) => a.group !== "G1" && a.kind === "main").sort((a, b) => b.doseMgPerKg - a.doseMgPerKg)[0];
    if (!high) return;
    set({ morris: { status: "running", progress: 0, data: null, organ } });
    try {
      const data = await call("morris", { cfg: { ...configForAnimal(design, high), durationDays: Math.min(14, design.durationDays), regimen: { ...configForAnimal(design, high).regimen, nDoses: Math.min(14, design.durationDays) } }, organ, r: 8 });
      set({ morris: { status: "done", progress: 1, data, organ } });
    } catch (e) { set({ morris: { status: "error", progress: 0, data: null, organ, error: e instanceof Error ? e.message : String(e) } }); }
  },

  historical: [],
  setHistorical: (rows) => set({ historical: rows }),
  validation: idle(),
  runValidation: async () => {
    const payload = get().study.data;
    if (!payload) return;
    set({ validation: { status: "running", progress: 0, data: null } });
    try {
      const data = await call("validation", { design: payload.study.design, nPerSex: 10, historical: get().historical });
      set({ validation: { status: "done", progress: 1, data } });
    } catch (e) { set({ validation: { status: "error", progress: 0, data: null, error: e instanceof Error ? e.message : String(e) } }); }
  },
}));
