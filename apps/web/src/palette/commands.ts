import { COMPOUNDS, type DiseaseChoice } from "../lib/setup";
import { CHAPTERS, SECTIONS, type ViewId } from "../lib/nav";
import type { LabSection, Theme } from "../store";

export interface Command {
  id: string;
  title: string;
  group: string;
  /** extra words that should find this command */
  keywords?: string;
  /** short note shown on the right, such as the current value */
  hint?: string;
  run: () => void;
}

/** Everything the palette can do, supplied by the app so this file stays free of the DOM and the store. */
export interface PaletteActions {
  goToxicity: () => void;
  goLearn: () => void;
  goStory: (chapter: number) => void;
  goLab: (section: LabSection, view: ViewId) => void;
  setCompound: (key: string) => void;
  setDisease: (d: DiseaseChoice) => void;
  startPresenter: (track: "3min" | "8min") => void;
  openNotes: () => void;
  setTheme: (t: Theme) => void;
  toggleCb: () => void;
  cbOn: boolean;
  setQuality: (q: "auto" | "low" | "high") => void;
  toggleSound: () => void;
  soundOn: boolean;
  hasData: boolean;
  exportCsv: () => void;
  exportJson: () => void;
  exportHtml: () => void;
  rerun: () => void;
  detail: "simple" | "expert";
  toggleDetail: () => void;
}

const DISEASES: Array<[DiseaseChoice, string]> = [
  ["none", "Healthy rats"],
  ["cancer", "Tumour-bearing rats"],
  ["diabetes-stz", "Diabetic rats (STZ)"],
  ["diabetes-type2", "Diabetic rats (type 2)"],
];

export function buildCommands(a: PaletteActions): Command[] {
  const out: Command[] = [
    { id: "toxicity", title: "Toxicity workbench", group: "VAST", keywords: "dose organ injury pharmacokinetics HED experiment", run: a.goToxicity },
    { id: "learn", title: "Guided learning practical", group: "VAST", keywords: "classroom student notebook education", run: a.goLearn },
  ];
  CHAPTERS.forEach((title, i) => out.push({ id: `story-${i}`, title: `${String(i + 1).padStart(2, "0")} · ${title}`, group: "Story", keywords: "chapter scroll go to", run: () => a.goStory(i) }));
  for (const sec of SECTIONS) {
    for (const [view, label] of sec.views) out.push({ id: `lab-${view}`, title: label, group: `Lab · ${sec.label}`, keywords: `${sec.hint} open go to`, run: () => a.goLab(sec.id, view) });
  }
  for (const c of COMPOUNDS) out.push({ id: `compound-${c.key}`, title: `Compound: ${c.name}`, group: "Study", keywords: `${c.sub} drug choose`, run: () => a.setCompound(c.key) });
  for (const [d, label] of DISEASES) out.push({ id: `disease-${d}`, title: `Disease model: ${label}`, group: "Study", keywords: "disease condition", run: () => a.setDisease(d) });
  out.push({ id: "rerun", title: "Re-run the study", group: "Study", keywords: "simulate refresh", run: a.rerun });
  out.push({ id: "present-3", title: "Present: 3-minute demo", group: "Present", keywords: "presenter mode talk slides", run: () => a.startPresenter("3min") });
  out.push({ id: "present-8", title: "Present: 8-minute demo", group: "Present", keywords: "presenter mode talk slides", run: () => a.startPresenter("8min") });
  out.push({ id: "notes", title: "Open speaker notes window", group: "Present", keywords: "second screen", run: a.openNotes });
  out.push({ id: "theme-dark", title: "Theme: dark", group: "Appearance", keywords: "colour color mode", run: () => a.setTheme("dark") });
  out.push({ id: "theme-light", title: "Theme: light", group: "Appearance", keywords: "colour color mode", run: () => a.setTheme("light") });
  out.push({ id: "theme-system", title: "Theme: follow the system", group: "Appearance", keywords: "auto colour color mode", run: () => a.setTheme("system") });
  out.push({ id: "cb", title: a.cbOn ? "Turn off the colour-blind-safe palette" : "Turn on the colour-blind-safe palette", group: "Appearance", keywords: "accessibility colour color", run: a.toggleCb });
  for (const q of ["auto", "high", "low"] as const) out.push({ id: `quality-${q}`, title: `3D quality: ${q}`, group: "Appearance", keywords: "graphics performance", run: () => a.setQuality(q) });
  out.push({ id: "detail", title: a.detail === "simple" ? "Lab: show expert detail" : "Lab: simple view", group: "Appearance", keywords: "simple expert detail tables advanced", run: a.toggleDetail });
  out.push({ id: "sound", title: a.soundOn ? "Turn sound off" : "Turn sound on", group: "Appearance", keywords: "audio mute heartbeat", run: a.toggleSound });
  if (a.hasData) {
    out.push({ id: "export-csv", title: "Export animal data (CSV)", group: "Export", keywords: "download", run: a.exportCsv });
    out.push({ id: "export-json", title: "Export the full run (JSON)", group: "Export", keywords: "download", run: a.exportJson });
    out.push({ id: "export-html", title: "Export the study report (HTML)", group: "Export", keywords: "download", run: a.exportHtml });
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** True when every character of `q` appears in `s` in order. */
function subsequence(q: string, s: string): boolean {
  let i = 0;
  for (const ch of s) if (ch === q[i] && ++i === q.length) return true;
  return q.length === 0;
}

/** 0 means no match. Every word of the query must match; earlier and whole-word matches in the title score higher. */
export function score(query: string, c: Pick<Command, "title" | "group" | "keywords">): number {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  const title = norm(c.title), rest = norm(`${c.group} ${c.keywords ?? ""}`);
  let total = 0;
  for (const w of words) {
    let s = 0;
    if (title.startsWith(w)) s = 40;
    else if (new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(title)) s = 30;
    else if (title.includes(w)) s = 18;
    else if (rest.includes(w)) s = 8;
    else if (w.length >= 3 && subsequence(w, title)) s = 3;
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

export function filterCommands(query: string, cmds: Command[], limit = 50): Command[] {
  if (!norm(query).trim()) return cmds.slice(0, limit);
  return cmds
    .map((c, i) => ({ c, i, s: score(query, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.c);
}
