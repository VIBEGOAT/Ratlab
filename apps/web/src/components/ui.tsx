import type { ReactNode } from "react";
import { FIDELITY } from "@eliminate/sim-core";
import { useStore } from "../store";

/** Short subsystem names so each chip says what it labels, not only the label. */
const SHORT: Record<string, string> = {
  rng: "Randomness", pbpk: "PBPK", pd: "PD models", physiology: "Physiology", toxicodynamics: "Organ damage", clinpath: "Blood tests",
  disease: "Disease", humane: "Humane endpoints", twin: "Twin", behaviour: "Behaviour", statistics: "Statistics", noael: "NOAEL",
  montecarlo: "Forecast", validation: "Validation", translation: "Translation",
};
const WORD: Record<string, string> = { MECHANISTIC: "Mechanistic", "SEMI-QUANTITATIVE": "Semi-quantitative", ILLUSTRATIVE: "Illustrative" };

/** One fidelity chip per subsystem, with the justification on hover or keyboard focus. */
export function Fidelity({ id }: { id: string }) {
  const f = FIDELITY.find((x) => x.id === id);
  if (!f) return null;
  return (
    <span className="hovercard">
      <button type="button" className={`chip ${f.label}`} aria-label={`${f.name}: ${f.label}. ${f.justification}`}>{SHORT[id] ?? f.name} · {WORD[f.label]}</button>
      <span className="card" role="tooltip"><b>{f.name}</b><br />{f.justification}</span>
    </span>
  );
}

export function Chip({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`chip ${kind}`}>{children}</span>;
}

export function TabHead({ title, blurb, fidelity }: { title: string; blurb: string; fidelity?: string[] }) {
  const ids = fidelity ? [...new Set(fidelity)] : [];
  return (
    <div className="head">
      <div>
        <h2>{title}</h2>
        <p>{blurb}</p>
      </div>
      {ids.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{ids.map((f) => <Fidelity key={f} id={f} />)}</div>}
    </div>
  );
}

export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: "good" | "warn" | "bad"; hint?: string }) {
  return <div className={`stat ${tone ?? ""}`}><span>{label}</span><b>{value}</b>{hint && <span>{hint}</span>}</div>;
}

export function Banner({ tone, children }: { tone: "bad" | "warn" | "good" | "info"; children: ReactNode }) {
  return <div className={`banner ${tone}`} role={tone === "bad" ? "alert" : undefined}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Panel({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="panel">
      {(title || right) && <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", flexWrap: "wrap", minWidth: 0 }}>{title && <h3>{title}</h3>}{right}</div>}
      {children}
    </section>
  );
}

/** Wrap content that needs a finished study. Shows progress or an explanation otherwise. */
export function NeedsStudy({ children }: { children: (p: NonNullable<ReturnType<typeof useStore.getState>["study"]["data"]>) => ReactNode }) {
  const study = useStore((s) => s.study);
  if (study.data) return <>{children(study.data)}</>;
  if (study.status === "running") return <Empty>Running the study… {Math.round(study.progress * 100)}%</Empty>;
  if (study.status === "error") return <Banner tone="bad">{study.error}</Banner>;
  return <Empty>The study starts automatically. Open Lab, Design to change it.</Empty>;
}

/** Wrap content that needs the focus animal and its untreated twin. */
export function NeedsTwin({ children }: { children: (t: NonNullable<ReturnType<typeof useStore.getState>["twin"]["data"]>) => ReactNode }) {
  const twin = useStore((s) => s.twin);
  const study = useStore((s) => s.study);
  if (twin.data) return <>{children(twin.data)}</>;
  if (twin.status === "running" || study.status === "running") return <Empty>Preparing the selected animal and its untreated twin…</Empty>;
  if (twin.status === "error") return <Banner tone="bad">{twin.error}</Banner>;
  return <Empty>The study is starting. The animal view appears when it finishes.</Empty>;
}

export const f1 = (x: number | null | undefined, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? "n/a" : x.toFixed(d));
export const pfmt = (p: number) => (p < 0.001 ? "<0.001" : p.toFixed(3));
export const ORGAN_COLOR: Record<string, string> = { liver: "var(--c3)", kidney: "var(--c1)", heart: "var(--c6)", brain: "var(--c2)", gut: "var(--c4)", marrow: "var(--c5)" };
