import { useEffect, useMemo, useRef } from "react";
import type { RatOutcome } from "@eliminate/sim-core";
import { GRADE_HEX, GRADE_WORD } from "../design/damage";
import { fmtInt } from "../design/format";

/** Draggable divider for the treated / untreated split. A real slider: pointer, arrow keys, Home and End. */
export function SplitDivider({ split, onChange, stage }: { split: number; onChange: (v: number) => void; stage: React.RefObject<HTMLDivElement> }) {
  const fromPointer = (e: React.PointerEvent) => {
    const r = stage.current?.getBoundingClientRect();
    if (!r) return;
    onChange(Math.min(0.96, Math.max(0.04, (e.clientX - r.left) / r.width)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const k: Record<string, number> = { ArrowLeft: -0.03, ArrowDown: -0.03, ArrowRight: 0.03, ArrowUp: 0.03, PageDown: -0.15, PageUp: 0.15 };
    if (e.key in k) { onChange(Math.min(0.96, Math.max(0.04, split + k[e.key]!))); e.preventDefault(); }
    if (e.key === "Home") { onChange(0.04); e.preventDefault(); }
    if (e.key === "End") { onChange(0.96); e.preventDefault(); }
  };
  return (
    <>
      <span className="split-label" style={{ left: 14 }}>Treated</span>
      <span className="split-label" style={{ right: 14 }}>Untreated twin</span>
      <div className="split-line" style={{ left: `${split * 100}%` }}>
        <div className="split-handle" role="slider" tabIndex={0} aria-label="Compare treated and untreated" aria-orientation="horizontal"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split * 100)} aria-valuetext={`${Math.round(split * 100)} percent treated`}
          onKeyDown={onKey} onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); fromPointer(e); }} onPointerMove={(e) => { if (e.buttons) fromPointer(e); }}>
          <span aria-hidden="true">‹ ›</span>
        </div>
      </div>
    </>
  );
}

export function outcomeCounts(o: RatOutcome[]): number[] {
  const c = [0, 0, 0, 0, 0, 0];
  for (const r of o) c[r.worstGrade] = c[r.worstGrade]! + 1;
  return c;
}

/**
 * One dot per virtual rat, drawn on a canvas. Colour is the worst organ injury grade the rat reached;
 * a white ring marks a rat that reached a humane endpoint. Rats not yet simulated show as faint dots.
 */
export function ForecastField({ outcomes, total, mode, palette, sorted }: { outcomes: RatOutcome[]; total: number; mode: "treated" | "untreated"; palette: "standard" | "cb"; sorted: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const order = useMemo(() => {
    const idx = outcomes.map((_, i) => i);
    if (sorted) idx.sort((a, b) => (mode === "untreated"
      ? Number(outcomes[b]!.humaneDay !== null) - Number(outcomes[a]!.humaneDay !== null) || (outcomes[a]!.humaneDay ?? 99) - (outcomes[b]!.humaneDay ?? 99)
      : outcomes[a]!.worstGrade - outcomes[b]!.worstGrade || Number(outcomes[a]!.humaneDay !== null) - Number(outcomes[b]!.humaneDay !== null)));
    return idx;
  }, [outcomes, sorted, mode]);

  useEffect(() => {
    const cv = ref.current, box = wrap.current;
    if (!cv || !box) return;
    const draw = () => {
      const w = box.clientWidth, h = box.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const c = cv.getContext("2d")!;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const cols = Math.max(10, Math.round(Math.sqrt(total * (w / h))));
      const rows = Math.ceil(total / cols);
      const cell = Math.min(w / cols, h / rows);
      const ox = (w - cell * cols) / 2, oy = (h - cell * rows) / 2;
      const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#fff";
      const grid = getComputedStyle(document.documentElement).getPropertyValue("--grid").trim() || "#333";
      const r = Math.max(1.2, cell * 0.36);
      for (let k = 0; k < total; k++) {
        const x = ox + (k % cols) * cell + cell / 2, y = oy + Math.floor(k / cols) * cell + cell / 2;
        const i = order[k];
        const o = i === undefined ? undefined : outcomes[i];
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        if (!o) { c.fillStyle = grid; c.fill(); continue; }
        c.fillStyle = mode === "untreated" ? (o.humaneDay !== null ? GRADE_HEX[palette][4]! : GRADE_HEX[palette][0]!) : GRADE_HEX[palette][o.worstGrade]!;
        c.fill();
        if (o.humaneDay !== null && mode === "treated") { c.lineWidth = Math.max(1, cell * 0.12); c.strokeStyle = ink; c.stroke(); }
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(box);
    return () => ro.disconnect();
  }, [outcomes, order, total, mode, palette]);

  const counts = outcomeCounts(outcomes);
  const humane = outcomes.filter((o) => o.humaneDay !== null).length;
  const label = mode === "treated"
    ? `${outcomes.length} of ${total} virtual rats simulated. Worst organ injury: ${counts.map((n, g) => `${n} ${GRADE_WORD[g]!.toLowerCase()}`).join(", ")}. ${humane} reached a humane endpoint.`
    : `${outcomes.length} of ${total} virtual rats without treatment. ${humane} reached a humane endpoint.`;
  return <div ref={wrap} className="field-wrap"><canvas ref={ref} role="img" aria-label={label} /></div>;
}

/** Rat to human scale-up. The number moves from the rat dose to the human equivalent dose as the reader scrolls. */
export function HumanScale({ progress, ratDose, hedDose, ratLabel }: { progress: number; ratDose: number | null; hedDose: number | null; ratLabel: string }) {
  const p = Math.min(1, Math.max(0, progress));
  const shown = ratDose !== null && hedDose !== null ? ratDose + (hedDose - ratDose) * p : null;
  return (
    <svg viewBox="0 0 400 300" role="img" aria-label={`A rat and a human. Dose scaled by body surface area: ${ratDose === null ? "no dose available" : `${ratDose.toFixed(1)} mg/kg in the rat becomes ${hedDose!.toFixed(2)} mg/kg in a human`}.`} style={{ width: "100%", maxWidth: 560 }}>
      <g opacity="0.9" transform={`translate(24, ${210 - 28 * (1 - p)}) scale(${0.55 + 0})`}>
        <path d="M10 70 C 4 40, 40 20, 78 22 C 100 22, 118 28, 132 38 C 140 28, 150 26, 156 32 C 160 38, 158 44, 154 48 C 168 54, 180 62, 190 70 C 196 76, 192 82, 186 82 C 172 84, 150 84, 132 86 C 122 92, 112 96, 104 96 L 108 108 L 96 108 L 90 96 C 70 98, 48 98, 30 94 L 28 108 L 16 108 L 18 90 C 12 84, 10 78, 10 70 Z" fill="var(--ink)" opacity="0.8" />
        <path d="M10 66 C -20 66, -40 84, -52 104" stroke="var(--ink)" strokeOpacity="0.45" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
      <g style={{ transformOrigin: "300px 270px", transform: `scale(${0.35 + 0.65 * p})` }} opacity={0.35 + 0.65 * p}>
        <circle cx="300" cy="82" r="22" fill="var(--accent)" opacity="0.9" />
        <path d="M268 112 C 268 104, 332 104, 332 112 L 340 190 L 322 190 L 316 150 L 312 270 L 296 270 L 300 190 L 300 190 L 304 270 L 288 270 L 284 150 L 278 190 L 260 190 Z" fill="var(--accent)" opacity="0.75" />
      </g>
      <line x1="150" x2="250" y1="150" y2="150" stroke="var(--muted)" strokeDasharray="4 5" />
      <path d="M244 144 L 252 150 L 244 156" stroke="var(--muted)" fill="none" />
      <text x="200" y="136" textAnchor="middle" fill="var(--muted)" style={{ font: "500 11px var(--f-mono)" }}>× 6 ÷ 37</text>
      {shown !== null && <text x="24" y="40" fill="var(--ink)" style={{ font: "700 34px var(--f-display)", letterSpacing: "-0.03em" }}>{shown.toFixed(shown < 10 ? 2 : 1)}<tspan fill="var(--muted)" style={{ font: "500 13px var(--f-mono)" }}> mg/kg</tspan></text>}
      <text x="24" y="60" fill="var(--muted)" style={{ font: "500 11px var(--f-mono)" }}>{p < 0.03 ? ratLabel : p > 0.97 ? "human equivalent dose" : "scaling by body surface area"}</text>
      <text x="24" y="292" fill="var(--muted)" style={{ font: "500 10px var(--f-mono)" }}>rat</text>
      <text x="300" y="292" textAnchor="middle" fill="var(--muted)" style={{ font: "500 10px var(--f-mono)" }}>human, 60 kg</text>
    </svg>
  );
}

export { fmtInt };
