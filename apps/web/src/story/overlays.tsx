import { tween, useReducedMotion } from "../lib/motion";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [selected,setSelected]=useState<number | null>(null);
  const counts=outcomeCounts(outcomes),order=counts.map((_,i)=>i);
  if(!sorted)order.sort((a,b)=>counts[b]!-counts[a]!);
  return <div className="cohort-telemetry"><span className="eyebrow">Virtual cohort · {mode}</span><h3>{outcomes.length.toLocaleString()} / {total.toLocaleString()} simulated</h3><p>Worst organ injury over the study. Each bar summarizes virtual animals, not biological particles.</p><div className="cohort-bars">{order.map(g=><button key={g} aria-pressed={selected===g} onClick={()=>setSelected(selected===g?null:g)}><span>{GRADE_WORD[g]}</span><i><em style={{transform:`scaleX(${counts[g]!/Math.max(1,outcomes.length)})`,background:GRADE_HEX[palette][g]}}/></i><strong>{counts[g]}</strong></button>)}</div><div role="status">{selected===null?"Select a severity band to inspect its outcomes.":`${counts[selected]} virtual rats in this band; ${outcomes.filter(o=>o.worstGrade===selected&&o.humaneDay!==null).length} reached a humane endpoint.`}</div></div>;
}

/** Rat to human scale-up. The number moves from the rat dose to the human equivalent dose as the reader scrolls. */
export function HumanScale({ progress, ratDose, hedDose, ratLabel }: { progress: number; ratDose: number | null; hedDose: number | null; ratLabel: string }) {
  const reduced=useReducedMotion();
  const [shown,setShown]=useState(hedDose);
  const previous=useRef(hedDose??0);
  useEffect(()=>{
    if(hedDose===null){setShown(null);return;}
    if(reduced){setShown(hedDose);previous.current=hedDose;return;}
    return tween(previous.current,hedDose,.65,v=>{setShown(v);previous.current=v;});
  },[hedDose,reduced]);
  return <div className="translation-telemetry"><span className="eyebrow">Allometric translation · illustrative</span><strong>{hedDose===null?'Unavailable':(shown??hedDose).toFixed(2)} <small>mg/kg HED</small></strong><div className="translation-bridges"><span>Body surface normalization <b>Km 6 / 37</b></span><span>Hepatic clearance bridge <b>Not validated</b></span><span>Organ concordance <b>No human outcome data</b></span><span>Safety divisor <b>10× assumption · not therapeutic index</b></span></div></div>;

}

export { fmtInt };
