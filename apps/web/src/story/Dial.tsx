import { useRef } from "react";
import { fmtInt } from "../design/format";

/**
 * A single large dose dial. Drag around the ring, or use the arrow keys, Page Up/Down, Home and End.
 * The value is a multiple of the compound's reference dose; the label shows mg/kg/day.
 */
export function DoseDial({ value, min, max, step, onChange, referenceDose, label }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void; referenceDose: number; label: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const START = 135, SWEEP = 270, R = 92, C = 110;
  const frac = (value - min) / (max - min);
  const ang = (deg: number) => (deg * Math.PI) / 180;
  const pt = (deg: number, r = R) => [C + r * Math.cos(ang(deg)), C + r * Math.sin(ang(deg))] as const;
  const arc = (from: number, to: number) => {
    const [x0, y0] = pt(from), [x1, y1] = pt(to);
    return `M ${x0} ${y0} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const snap = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const fromPointer = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = e.clientX - r.left - (r.width / 2), y = e.clientY - r.top - (r.height / 2);
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    if (deg < START - 360 + SWEEP / 2) deg += 360;
    if (deg < START) deg += 360;
    const f = Math.min(1, Math.max(0, (deg - START) / SWEEP));
    onChange(snap(min + f * (max - min)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const big = (max - min) / 10;
    const k: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big };
    if (e.key in k) { onChange(snap(value + k[e.key]!)); e.preventDefault(); }
    if (e.key === "Home") { onChange(min); e.preventDefault(); }
    if (e.key === "End") { onChange(max); e.preventDefault(); }
  };
  const [kx, ky] = pt(START + frac * SWEEP);
  const dose = referenceDose * value;
  return (
    <div className="dial">
      <svg ref={ref} viewBox="0 0 220 220" role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        aria-valuetext={`${fmtInt(dose)} milligrams per kilogram per day, ${value.toFixed(2)} times the reference dose`}
        onKeyDown={onKey} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); fromPointer(e); }} onPointerMove={(e) => { if (e.buttons) fromPointer(e); }}>
        <defs>
          <linearGradient id="dialg" x1="0" x2="1"><stop offset="0" stopColor="var(--g0)" /><stop offset="0.5" stopColor="var(--g2)" /><stop offset="1" stopColor="var(--g4)" /></linearGradient>
        </defs>
        <path d={arc(START, START + SWEEP)} stroke="var(--grid)" strokeWidth="14" fill="none" strokeLinecap="round" />
        {frac > 0.001 && <path d={arc(START, START + frac * SWEEP)} stroke="url(#dialg)" strokeWidth="14" fill="none" strokeLinecap="round" />}
        <circle cx={kx} cy={ky} r="13" fill="var(--surface-solid)" stroke="var(--ink)" strokeWidth="2" />
        <text x={C} y={C - 4} textAnchor="middle" fill="var(--ink)" style={{ font: "700 40px var(--f-display)", letterSpacing: "-0.03em" }}>{fmtInt(dose)}</text>
        <text x={C} y={C + 22} textAnchor="middle" fill="var(--muted)" style={{ font: "500 12px var(--f-mono)" }}>mg/kg/day</text>
        <text x={C} y={C + 44} textAnchor="middle" fill="var(--muted)" style={{ font: "500 11px var(--f-mono)" }}>{value.toFixed(2)}× reference</text>
      </svg>
    </div>
  );
}
