import { EXPERIMENTS, MODEL_VERSION, QUESTIONS, simulate, type Prediction } from "./model";
export const STORAGE_KEY = "vast-practical-01-v1";
export interface Entry { prediction: Prediction; reflection: string }
export interface Notebook { version: 1; entries: Record<string, Entry>; answers: number[]; submitted: boolean }
export const emptyNotebook = (): Notebook => ({ version: 1, entries: {}, answers: [], submitted: false });
export function parseNotebook(raw: string | null): Notebook {
  if (!raw) return emptyNotebook();
  try {
    const n = JSON.parse(raw) as Notebook;
    if (n.version !== 1 || !n.entries || typeof n.entries !== "object" || !Array.isArray(n.answers) || typeof n.submitted !== "boolean") return emptyNotebook();
    const entries: Record<string, Entry> = {};
    for (const exp of EXPERIMENTS) {
      const e = n.entries[exp.id];
      if (e && ["higher", "same", "lower"].includes(e.prediction) && typeof e.reflection === "string") entries[exp.id] = { prediction: e.prediction, reflection: e.reflection.slice(0, 4000) };
    }
    const answers = QUESTIONS.map((q, i) => Number.isInteger(n.answers[i]) && n.answers[i]! >= 0 && n.answers[i]! < q.options.length ? n.answers[i]! : -1);
    return { version: 1, entries, answers, submitted: n.submitted && answers.every((x) => x >= 0) && Object.keys(entries).length === EXPERIMENTS.length };
  } catch { return emptyNotebook(); }
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function reportHtml(n: Notebook): string {
  const complete = EXPERIMENTS.every((e) => n.entries[e.id]?.reflection.trim());
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>VAST practical notebook</title><style>body{font:16px/1.6 system-ui;max-width:850px;margin:32px auto;padding:0 20px;color:#142d29}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:8px;text-align:left}h2{margin-top:32px}p{white-space:pre-wrap}@media print{body{margin:0}}</style><h1>VAST · Dose, exposure & repeated dosing</h1><p>Model: ${MODEL_VERSION}. Fictional compound; one-compartment oral teaching model. Simulated data, not measured rat data. No safety threshold is inferred. Reflection prompts are self-assessed, not automatically graded.</p><p>Notebook: ${complete && n.submitted ? "completed" : "in progress"}. Exported ${new Date().toISOString()}. Print this page or save it as PDF using your browser.</p>${EXPERIMENTS.map((e) => {
    const entry = n.entries[e.id];
    if (!entry) return `<h2>${e.title}</h2><p>Not run.</p>`;
    const a = simulate(e.control), b = simulate(e.treatment);
    return `<h2>${e.title}</h2><p>${e.question}</p><p>Initial prediction: ${escapeHtml(entry.prediction)}. Expected: ${e.answer}.</p><table><tr><th>Measure</th><th>Control</th><th>Changed</th></tr><tr><td>AUC 0–72 h (mg·h/L)</td><td>${a.auc.toFixed(2)}</td><td>${b.auc.toFixed(2)}</td></tr><tr><td>Half-life (h)</td><td>${a.halfLife.toFixed(2)}</td><td>${b.halfLife.toFixed(2)}</td></tr><tr><td>Total dose (mg/kg)</td><td>${a.totalDose}</td><td>${b.totalDose}</td></tr></table><p>Control settings: ${escapeHtml(JSON.stringify(e.control))}\nChanged settings: ${escapeHtml(JSON.stringify(e.treatment))}</p><p>Reflection: ${escapeHtml(entry.reflection || "Not answered.")}</p>`;
  }).join("")}<h2>Knowledge check</h2>${n.submitted ? `<p>Score: ${QUESTIONS.filter((q, i) => q.correct === n.answers[i]).length} / ${QUESTIONS.length}. Formative practice, not a certified assessment.</p>${QUESTIONS.map((q, i) => `<p>${q.question}\nYour answer: ${q.options[n.answers[i]!] ?? "Not answered"}\n${q.explanation}</p>`).join("")}` : "<p>Not submitted.</p>"}`;
}
