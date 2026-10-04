import { create } from "zustand";
import { SIM_VERSION, configForAnimal, type ForecastResult, type HistoricalRow, type MorrisResult, type Organ, type TwinBundle } from "@eliminate/sim-core";
import { call, cancelLane, CancelledError } from "./worker/client";
import type { StudyPayload, ValidationPayload } from "./worker/protocol";
import { buildDesign, defaultFocusId, defaultSetup, designProblems, sameSetup, type Setup } from "./lib/setup";
import { cacheGet, cacheSet } from "./lib/cache";

export type Theme = "system" | "light" | "dark";
export type Mode = "story" | "lab";
export type LabSection = "design" | "animal" | "data" | "population" | "trust";
type Status = "idle" | "running" | "done" | "error";
interface Job<T> { status: Status; progress: number; error?: string; data: T | null }
const idle = <T,>(): Job<T> => ({ status: "idle", progress: 0, data: null });

interface State {
  mode: Mode;
  setMode: (m: Mode) => void;
  labSection: LabSection;
  labView: string;
  goLab: (section: LabSection, view?: string) => void;

  theme: Theme;
  setTheme: (t: Theme) => void;
  cbPalette: boolean;
  setCbPalette: (on: boolean) => void;

  setup: Setup;
  /** the setup that produced the current results; null until the first run finishes */
  ranSetup: Setup | null;
  setSetup: (p: Partial<Setup>) => void;

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
let rerunTimer: ReturnType<typeof setTimeout> | undefined;

const ls = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* storage may be blocked */ } },
};
const savedTheme = ((): Theme => { const t = ls.get("theme"); return t === "light" || t === "dark" ? t : "system"; })();
const savedMode = ((): Mode => { const h = typeof location !== "undefined" ? location.hash : ""; if (h.startsWith("#lab")) return "lab"; return ls.get("mode") === "lab" ? "lab" : "story"; })();
const cacheKey = (s: Setup) => `${SIM_VERSION}|${JSON.stringify(s)}`;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useStore = create<State>((set, get) => ({
  mode: savedMode,
  setMode: (m) => { ls.set("mode", m); if (typeof history !== "undefined") history.replaceState(null, "", m === "lab" ? `#lab/${get().labSection}` : "#"); set({ mode: m }); },
  labSection: "design",
  labView: "",
  goLab: (section, view = "") => { ls.set("mode", "lab"); if (typeof history !== "undefined") history.replaceState(null, "", `#lab/${section}`); set({ mode: "lab", labSection: section, labView: view }); },

  theme: savedTheme,
  setTheme: (t) => { ls.set("theme", t); set({ theme: t }); },
  cbPalette: ls.get("palette") === "cb",
  setCbPalette: (on) => { ls.set("palette", on ? "cb" : "standard"); set({ cbPalette: on }); },

  setup: defaultSetup(),
  ranSetup: null,
  setSetup: (p) => {
    set((s) => ({ setup: { ...s.setup, ...p } }));
    // results follow the configuration: re-run shortly after the last change
    clearTimeout(rerunTimer);
    rerunTimer = setTimeout(() => { if (designProblems(get().setup).length === 0) void get().runStudy(); }, 650);
  },

  study: idle(),
  runStudy: async () => {
    const setup = get().setup;
    const problems = designProblems(setup);
    if (problems.length) { set((s) => ({ study: { status: "error", progress: 0, error: problems[0], data: s.study.data } })); return; }
    const token = ++studyToken;
    cancelLane("study"); // stop any run that is still going
    set((s) => ({ study: { status: "running", progress: 0, data: s.study.data }, forecast: { ...idle<ForecastResult[]>(), n: s.forecast.n } }));
    try {
      const key = cacheKey(setup);
      let payload = await cacheGet<StudyPayload>(key);
      if (!payload) {
        payload = await call("study", { design: buildDesign(setup) }, (done, total) => { if (token === studyToken) set((s) => ({ study: { ...s.study, progress: done / total } })); });
        void cacheSet(key, payload);
      }
      if (token !== studyToken) return;
      set({ study: { status: "done", progress: 1, data: payload }, ranSetup: setup });
      const id = defaultFocusId(payload.study);
      if (id) await get().setFocus(id);
    } catch (e) {
      if (e instanceof CancelledError || token !== studyToken) return;
      set((s) => ({ study: { status: "error", progress: 0, error: msg(e), data: s.study.data } }));
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
      const key = `${cacheKey(get().ranSetup ?? get().setup)}|twin|${id}`;
      let bundle = await cacheGet<TwinBundle>(key);
      if (!bundle) { bundle = await call("twin", { cfg: configForAnimal(payload.study.design, animal) }); void cacheSet(key, bundle); }
      if (token === twinToken) set({ twin: { status: "done", progress: 1, data: bundle } });
    } catch (e) {
      if (e instanceof CancelledError || token !== twinToken) return;
      set((s) => ({ twin: { status: "error", progress: 0, error: msg(e), data: s.twin.data } }));
    }
  },

  forecast: { ...idle<ForecastResult[]>(), n: 100 },
  runForecast: async (n) => {
    const payload = get().study.data;
    if (!payload) return;
    cancelLane("aux");
    const design = payload.study.design;
    const base = configForAnimal(design, payload.study.animals.find((a) => a.group === "G1") ?? payload.study.animals[0]!);
    const doses = design.groups.filter((g) => g.kind === "main" && g.doseMgPerKg > 0).map((g) => g.doseMgPerKg);
    set({ forecast: { status: "running", progress: 0, data: null, n } });
    try {
      const data = await call("forecast", { base: { ...base, durationDays: design.durationDays }, doses, n }, (d, t) => set((s) => ({ forecast: { ...s.forecast, progress: d / t } })));
      set({ forecast: { status: "done", progress: 1, data, n } });
    } catch (e) { if (!(e instanceof CancelledError)) set({ forecast: { status: "error", progress: 0, data: null, n, error: msg(e) } }); }
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
      const cfg = configForAnimal(design, high);
      const days = Math.min(14, design.durationDays);
      const data = await call("morris", { cfg: { ...cfg, durationDays: days, regimen: { ...cfg.regimen, nDoses: days } }, organ, r: 8 });
      set({ morris: { status: "done", progress: 1, data, organ } });
    } catch (e) { if (!(e instanceof CancelledError)) set({ morris: { status: "error", progress: 0, data: null, organ, error: msg(e) } }); }
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
    } catch (e) { if (!(e instanceof CancelledError)) set({ validation: { status: "error", progress: 0, data: null, error: msg(e) } }); }
  },
}));

/** True when the visible results were produced by a different setup than the one on screen. */
export function useResultsStale(): boolean {
  return useStore((s) => s.ranSetup !== null && !sameSetup(s.setup, s.ranSetup));
}
