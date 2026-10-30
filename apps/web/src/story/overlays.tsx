import type { BridgeOrgan } from "./StoryDetails";
import { tween, useReducedMotion } from "../lib/motion";
import { useEffect, useId, useRef, useState } from "react";
import type { RatOutcome } from "@eliminate/sim-core";
import { GRADE_WORD } from "../design/damage";
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
      <span className="split-label" style={{ left: 14 }}>Untreated</span>
      <span className="split-label" style={{ right: 14 }}>Dosed · cutaway</span>
      <div className="split-line" style={{ left: `${split * 100}%` }}>
        <div className="split-handle" role="slider" tabIndex={0} aria-label="Compare treated and untreated" aria-orientation="horizontal"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split * 100)} aria-valuetext={`${Math.round(split * 100)} percent untreated`}
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
export function ForecastField({ outcomes, total, mode, palette, sorted, strain, onStrain }: { strain?:string;onStrain?:(strain:"SD"|"WI")=>void; outcomes: RatOutcome[]; total: number; mode: "treated" | "untreated"; palette: "standard" | "cb"; sorted: boolean }) {
  const [sex,setSex]=useState<"all"|"M"|"F">("all"),[grade,setGrade]=useState<number|null>(null),[selected,setSelected]=useState<number|null>(null);
  const filtered=outcomes.filter(o=>(sex==="all"||o.sex===sex)&&(grade===null||(o.humaneDay!==null||o.worstGrade>=3?2:o.worstGrade===0?0:1)===grade));
  if(sorted)filtered.sort((a,b)=>a.worstGrade-b.worstGrade);
  const chosen=outcomes.find(o=>o.index===selected),colors=palette==="cb"?["#8fc1e3","#f5c26b","#d55e00"]:["#78c679","#e8a855","#e05a47"];
  return <div className="population-matrix"><span className="eyebrow">{mode} · {outcomes.length} / {total} virtual animals</span><div className="matrix-filters" role="group" aria-label="Re-simulate population strain">{(["SD","WI"] as const).map(s=><button key={s} aria-pressed={strain===s} onClick={()=>onStrain?.(s)}>{s==="SD"?"Sprague-Dawley":"Wistar"}</button>)}</div><div className="matrix-filters" role="group" aria-label="Population sex filter">{(["all","M","F"] as const).map(s=><button key={s} aria-pressed={sex===s} onClick={()=>setSex(s)}>{s==="all"?"All":s} {s==="all"?outcomes.length:outcomes.filter(o=>o.sex===s).length}</button>)}</div><svg viewBox="0 0 560 350" role="img" aria-label={`${filtered.length} virtual rats match the current filters. Colors show modelled injury categories.`}><defs><symbol id="cohort-rat" viewBox="0 0 14 12"><path d="M3 7Q0 6 0 10M3 7C2 2 10 1 11 5L14 7L10 9H4Z" fill="currentColor" stroke="currentColor" strokeWidth=".7"/><circle cx="10" cy="4" r="1.2" fill="currentColor"/></symbol></defs>{Array.from({length:total},(_,i)=>{const o=filtered[i],g=o?(o.humaneDay!==null||o.worstGrade>=3?2:o.worstGrade===0?0:1):0;return <use key={i} href="#cohort-rat" x={(i%40)*14} y={Math.floor(i/40)*14} width="12" height="11" style={{color:o?colors[g]:"#544c3e",opacity:o?1:.18,cursor:o?"pointer":"default"}} onClick={()=>o&&setSelected(o.index)}/>;})}</svg><div className="matrix-filters" role="group" aria-label="Cohort outcome filter">{["No injury","Subclinical / mild","Severe / endpoint"].map((label,g)=><button key={g} aria-pressed={grade===g} onClick={()=>setGrade(grade===g?null:g)} style={{color:colors[g]}}>{label}</button>)}</div><p role="status">{chosen?`Rat ${chosen.index+1} · ${chosen.sex} · ${GRADE_WORD[chosen.worstGrade]} · endpoint ${chosen.humaneDay??"not reached"}`:`${filtered.length} animals match. Select a silhouette to inspect.`}</p><small>Strain: {strain??"configured cohort"}. Metabolic phenotypes and multi-dose ED50/TD50 distributions are not recorded in these results.</small></div>;

}

/** Rat to human scale-up. The number moves from the rat dose to the human equivalent dose as the reader scrolls. */
export function HumanScale({ ratDose, hedDose,selected,onSelect,inputDose,clearance }: { selected?:BridgeOrgan;onSelect?:(o:BridgeOrgan)=>void;inputDose?:number;clearance?:number;ratDose: number | null; hedDose: number | null }) {
  const effectiveHed=inputDose===undefined?hedDose:inputDose*6/37;
  const reduced=useReducedMotion();
  const [shown,setShown]=useState(effectiveHed);
  const previous=useRef(effectiveHed??0);
  useEffect(()=>{
    if(effectiveHed===null){setShown(null);return;}
    if(reduced){setShown(effectiveHed);previous.current=effectiveHed;return;}
    return tween(previous.current,effectiveHed,.65,v=>{setShown(v);previous.current=v;});
  },[effectiveHed,reduced]);
  const [tab,setTab]=useState(0);
  const id=useId();
  const tabs=["HED","Homology","Clearance","Safety"];
  const tabKeys=(event:React.KeyboardEvent<HTMLButtonElement>,index:number)=>{
    const next=event.key==="ArrowRight"?(index+1)%4:event.key==="ArrowLeft"?(index+3)%4:event.key==="Home"?0:event.key==="End"?3:null;
    if(next===null)return;event.preventDefault();setTab(next);document.getElementById(`${id}-tab-${next}`)?.focus();
  };
  return <aside className="translation-telemetry" aria-label="Allometric translation metrics">
    <div className="dock-heading"><span className="eyebrow">10 / Across species</span><span className="dock-status">Illustrative model</span></div>
    <div className="translation-tabs" role="tablist" aria-label="Translation metrics">
      {tabs.map((label,index)=><button key={label} id={`${id}-tab-${index}`} role="tab" aria-selected={tab===index} aria-controls={`${id}-panel`} tabIndex={tab===index?0:-1} onKeyDown={event=>tabKeys(event,index)} onClick={()=>setTab(index)}>{label}</button>)}
    </div>
    <div className="translation-panel" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
      {tab===0&&<><span className="eyebrow">Human equivalent dose</span><strong>{effectiveHed===null?'—':(shown??effectiveHed).toFixed(2)} <small>mg/kg</small></strong><p>Selected dose × <b>6 / 37</b><br/>Body surface area normalization</p><div className="dock-row"><span>Selected rat dose</span><b>{inputDose?.toFixed(2)} mg/kg</b></div><div className="dock-row"><span>NOAEL-based HED</span><b>{hedDose===null?'No NOAEL found':hedDose.toFixed(2)+' mg/kg'}</b></div></>}
      {tab===1&&<><span className="eyebrow">Receptor ortholog homology</span><h3>Sequence evidence needed.</h3><p>This fictional compound has no identified binding target or matched rat–human sequence pair. Anatomy alone cannot establish sequence identity or binding affinity.</p><span className="dock-status">No percentage inferred</span></>}
      {tab===2&&<><span className="eyebrow">Clearance · arithmetic extrapolation</span><strong>{clearance===undefined?'—':(clearance*Math.pow(.3/60,.25)).toFixed(2)} <small>mL/min/kg</small></strong><p>Assumed 0.75 allometric exponent<br/>300 g rat → 60 kg adult</p><div className="dock-row"><span>Rat intrinsic clearance input</span><b>{clearance?.toFixed(2)} mL/min/kg</b></div><small>A model parameter scaled by body mass. This is not a measured human clearance or a full human PBPK prediction.</small></>}
      {tab===3&&<><span className="eyebrow">Safety margin · model limits</span><h3>A dose calculation, not a clinical window.</h3><div className="dock-row"><span>Rat NOAEL</span><b>{ratDose===null?'No non-adverse dose found':ratDose.toFixed(2)+' mg/kg/day'}</b></div><div className="dock-row"><span>HED ÷ 10 × 60 kg</span><b>{hedDose===null?'—':(hedDose/10*60).toFixed(2)+' mg'}</b></div><p>Illustrative starting-dose arithmetic. A therapeutic index and confidence interval require measured efficacy and toxicity data.</p></>}
    </div>
    <div className="dock-bridge"><span className="eyebrow">Explore the anatomical bridge</span><div className="organ-bridge-controls" role="group" aria-label="Organ translation bridge">{(["heart","liver","brain","kidney","lungs"] as BridgeOrgan[]).map(o=><button key={o} aria-pressed={selected===o} onClick={()=>onSelect?.(o)}>{o==='kidney'?'Kidneys':o[0]!.toUpperCase()+o.slice(1)}</button>)}</div><p role="status">{selected==='kidney'?'Kidneys':selected} linked in both models.</p></div>
    <small className="dock-footnote">Fictional compound · educational calculations. No human outcomes have been validated. Never use this to select a real dose.</small>
  </aside>;

}

export { fmtInt };
