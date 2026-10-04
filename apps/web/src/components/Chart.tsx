import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { area as d3area, line as d3line } from "d3-shape";
import { fmtSmart } from "../design/format";

export interface Series {
  name: string;
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  color: string;
  dash?: string;
  width?: number;
  band?: { lo: ArrayLike<number>; hi: ArrayLike<number> };
  /** draw as steps (survival curves) */
  step?: boolean;
}

export interface LineChartProps {
  series: Series[];
  /** axis titles are required and must include units */
  xLabel: string;
  yLabel: string;
  height?: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  logY?: boolean;
  /** shaded x ranges, such as the dark phase */
  shade?: Array<[number, number]>;
  /** vertical marker, for example the viewed day */
  marker?: number;
  fmtX?: (v: number) => string;
  fmtY?: (v: number) => string;
  label: string;
}

function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(240, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const M = { l: 52, r: 12, t: 10, b: 34 };

export function LineChart(p: LineChartProps) {
  const [ref, width] = useWidth();
  const height = p.height ?? 240;
  const [hover, setHover] = useState<number | null>(null);
  const iw = width - M.l - M.r, ih = height - M.t - M.b;

  const dom = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of p.series) {
      for (let i = 0; i < s.x.length; i++) {
        const x = s.x[i]!, y = s.y[i]!;
        if (Number.isFinite(x)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
        if (Number.isFinite(y) && (!p.logY || y > 0)) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (s.band) {
          const lo = s.band.lo[i]!, hi = s.band.hi[i]!;
          if (Number.isFinite(lo) && (!p.logY || lo > 0)) y0 = Math.min(y0, lo);
          if (Number.isFinite(hi)) y1 = Math.max(y1, hi);
        }
      }
    }
    if (!Number.isFinite(x0)) { x0 = 0; x1 = 1; }
    if (!Number.isFinite(y0)) { y0 = 0; y1 = 1; }
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    return { x0: p.xMin ?? x0, x1: p.xMax ?? x1, y0: p.yMin ?? (p.logY ? y0 : Math.min(0, y0)), y1: p.yMax ?? y1 * (p.logY ? 1.5 : 1.05) };
  }, [p.series, p.xMin, p.xMax, p.yMin, p.yMax, p.logY]);

  const sx = scaleLinear().domain([dom.x0, dom.x1]).range([0, iw]);
  const sy = p.logY ? scaleLog().domain([Math.max(dom.y0, 1e-6), dom.y1]).range([ih, 0]).clamp(true) : scaleLinear().domain([dom.y0, dom.y1]).range([ih, 0]).nice(5);
  const xt = sx.ticks(Math.max(3, Math.floor(iw / 80)));
  const yt = sy.ticks(5);
  const fx = p.fmtX ?? ((v: number) => fmtSmart(v, 2));
  const fy = p.fmtY ?? ((v: number) => fmtSmart(v, 2));

  const first = p.series[0];
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!first || first.x.length === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const xv = sx.invert(e.clientX - r.left - M.l);
    let best = 0, bd = Infinity;
    for (let i = 0; i < first.x.length; i++) { const d = Math.abs(first.x[i]! - xv); if (d < bd) { bd = d; best = i; } }
    setHover(best);
  };

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={p.label} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <g transform={`translate(${M.l},${M.t})`}>
          {(p.shade ?? []).map(([a, b], i) => <rect key={i} x={sx(Math.max(a, dom.x0))} width={Math.max(0, sx(Math.min(b, dom.x1)) - sx(Math.max(a, dom.x0)))} y={0} height={ih} fill="var(--accent-soft)" />)}
          {yt.map((t) => <g key={t}><line x1={0} x2={iw} y1={sy(t)} y2={sy(t)} stroke="var(--grid)" /><text x={-8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="var(--f-mono)">{fy(t)}</text></g>)}
          {xt.map((t) => <text key={t} x={sx(t)} y={ih + 16} textAnchor="middle" fontSize={11} fill="var(--muted)" fontFamily="var(--f-mono)">{fx(t)}</text>)}
          <line x1={0} x2={0} y1={0} y2={ih} stroke="var(--muted)" />
          <line x1={0} x2={iw} y1={ih} y2={ih} stroke="var(--muted)" />
          {p.xLabel && <text x={iw} y={ih + 30} textAnchor="end" fontSize={11} fill="var(--muted)">{p.xLabel}</text>}
          {p.yLabel && <text transform={`translate(-40,0) rotate(-90)`} textAnchor="end" fontSize={11} fill="var(--muted)">{p.yLabel}</text>}
          <clipPath id={`clip-${p.label.replace(/\W/g, "")}`}><rect x={0} y={-4} width={iw} height={ih + 8} /></clipPath>
          <g clipPath={`url(#clip-${p.label.replace(/\W/g, "")})`}>
            {p.series.map((s, k) => {
              const pts = Array.from({ length: s.x.length }, (_, i) => i).filter((i) => Number.isFinite(s.y[i]!) && (!p.logY || s.y[i]! > 0));
              const gen = d3line<number>().x((i) => sx(s.x[i]!)).y((i) => sy(s.y[i]!));
              if (s.step) gen.curve(stepAfter);
              const band = s.band ? d3area<number>().x((i) => sx(s.x[i]!)).y0((i) => sy(s.band!.lo[i]!)).y1((i) => sy(s.band!.hi[i]!))(pts) : null;
              return (
                <g key={k}>
                  {band && <path d={band} fill={s.color} opacity={0.18} />}
                  <path d={gen(pts) ?? ""} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} />
                </g>
              );
            })}
          </g>
          {p.marker !== undefined && p.marker >= dom.x0 && p.marker <= dom.x1 && <line x1={sx(p.marker)} x2={sx(p.marker)} y1={0} y2={ih} stroke="var(--ink)" strokeDasharray="3 4" />}
          {hover !== null && first && <line x1={sx(first.x[hover]!)} x2={sx(first.x[hover]!)} y1={0} y2={ih} stroke="var(--muted)" />}
        </g>
      </svg>
      {hover !== null && first && (
        <div className="tip" style={{ left: Math.min(width - 160, M.l + sx(first.x[hover]!) + 10), top: M.t + 4 }}>
          <div>{p.xLabel ? `${p.xLabel} ` : ""}{fx(first.x[hover]!)}</div>
          {p.series.map((s) => <div key={s.name}><span style={{ color: s.color }}>■</span> {s.name}: {fy(s.y[Math.min(hover, s.y.length - 1)]!)}</div>)}
        </div>
      )}
    </div>
  );
}

function stepAfter(context: { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void }) {
  let x = NaN, y = NaN, first = true;
  return {
    areaStart() {}, areaEnd() {}, lineStart() { first = true; }, lineEnd() {},
    point(px: number, py: number) {
      if (first) { context.moveTo(px, py); first = false; } else { context.lineTo(px, y); context.lineTo(px, py); }
      x = px; y = py; void x;
    },
  };
}

export function Legend({ items }: { items: Array<{ name: string; color: string; dash?: boolean }> }) {
  return <div className="legend">{items.map((i) => <span key={i.name}><i style={{ background: i.dash ? "transparent" : i.color, borderTop: i.dash ? `2px dashed ${i.color}` : undefined, height: i.dash ? 0 : 3 }} />{i.name}</span>)}</div>;
}

export interface BarItem { label: string; value: number; low?: number; high?: number; note?: string; color?: string }
export function BarList({ items, max = 1, fmt = (v: number) => `${(v * 100).toFixed(0)}%` }: { items: BarItem[]; max?: number; fmt?: (v: number) => string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((i) => (
        <div className="barrow" key={i.label} title={i.note}>
          <span>{i.label}</span>
          <div className="bar" role="img" aria-label={`${i.label} ${fmt(i.value)}`}>
            <i style={{ width: `${Math.min(100, (i.value / max) * 100)}%`, background: i.color }} />
            {i.low !== undefined && <u style={{ left: `${Math.min(100, (i.low / max) * 100)}%` }} />}
            {i.high !== undefined && <u style={{ left: `${Math.min(100, (i.high / max) * 100)}%` }} />}
          </div>
          <span className="mono" style={{ textAlign: "right" }}>{fmt(i.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Rows of signs against days; filled cells mean the sign was observed. */
export function HeatGrid({ rows, days, onDay }: { rows: Array<{ label: string; on: number[] }>; days: number; onDay?: (d: number) => void }) {
  return (
    <div className="heat" style={{ gridTemplateColumns: `140px repeat(${days + 1}, minmax(4px, 1fr))` }} role="img" aria-label="Clinical signs observed by day">
      {rows.map((r) => (
        <div key={r.label} style={{ display: "contents" }}>
          <div className="lab">{r.label}</div>
          {Array.from({ length: days + 1 }, (_, d) => <div key={d} className={`cell ${r.on[d] ? "on" : ""}`} title={`${r.label}, day ${d}`} onClick={() => onDay?.(d)} />)}
        </div>
      ))}
    </div>
  );
}
