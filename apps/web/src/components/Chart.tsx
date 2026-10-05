import { useEffect, useId, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { area as d3area, line as d3line } from "d3-shape";
import { fmtSmart } from "../design/format";
import { axisWidth, nearestIndex, runs, sampleIndices, spreadLabels, valueAt } from "./chartMath";

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

const NARROW = 460;
const LABEL_GAP = 14;

/**
 * Line chart with: units on both axes, direct end-of-line labels on wide screens (a legend row on narrow ones),
 * lines that break at missing values, one readout that reads every series at the same x, a keyboard crosshair
 * (arrow keys, Home, End, Escape), a collapsible data table, and a draw-in that respects reduced motion.
 */
export function LineChart(p: LineChartProps) {
  const [ref, width] = useWidth();
  const uid = useId().replace(/:/g, "");
  const height = p.height ?? 240;
  const narrow = width < NARROW;
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

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

  const fx = p.fmtX ?? ((v: number) => fmtSmart(v, 2));
  const fy = p.fmtY ?? ((v: number) => fmtSmart(v, 2));
  // direct labels only when every line reaches the right edge; otherwise a legend row is clearer
  const reachesEnd = p.series.every((s) => { let last = -Infinity; for (let i = 0; i < s.x.length; i++) if (Number.isFinite(s.y[i]!) && s.x[i]! > last) last = s.x[i]!; return last >= dom.x0 + 0.85 * (dom.x1 - dom.x0); });
  const direct = !narrow && p.series.length >= 2 && p.series.every((s) => s.name) && reachesEnd;
  const t = p.yLabel ? 24 : 10, b = 36;
  const ih = height - t - b;
  const sy = p.logY ? scaleLog().domain([Math.max(dom.y0, 1e-6), dom.y1]).range([ih, 0]).clamp(true) : scaleLinear().domain([dom.y0, dom.y1]).range([ih, 0]).nice(5);
  const yt = sy.ticks(5);
  const l = axisWidth(yt.map(fy));
  const longestName = p.series.reduce((m, s) => Math.max(m, s.name.length), 0);
  const r = direct ? Math.min(150, Math.round(longestName * 6.4 + 18)) : 14;
  const iw = Math.max(60, width - l - r);
  const sx = scaleLinear().domain([dom.x0, dom.x1]).range([0, iw]);
  const xt = sx.ticks(Math.max(3, Math.floor(iw / 80)));

  // the x positions the crosshair can sit on: those of the series with the most points
  const grid = useMemo(() => {
    let best: ArrayLike<number> = [];
    for (const s of p.series) if (s.x.length > best.length) best = s.x;
    return Array.from(best).filter(Number.isFinite).sort((a, c) => a - c);
  }, [p.series]);

  const readings = hoverX === null ? [] : p.series.map((s) => ({ s, v: valueAt(s, hoverX) }));
  const readoutText = hoverX === null ? "" : `${p.xLabel ? `${p.xLabel} ` : ""}${fx(hoverX)}. ${readings.map(({ s, v }) => `${s.name}: ${v ? fy(v.y) : "no value"}`).join(". ")}`;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!grid.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xv = sx.invert(e.clientX - rect.left - l);
    setHoverX(grid[nearestIndex(grid, xv)]!);
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!grid.length) return;
    const at = hoverX === null ? -1 : nearestIndex(grid, hoverX);
    let next = at;
    if (e.key === "ArrowRight") next = Math.min(grid.length - 1, at + 1);
    else if (e.key === "ArrowLeft") next = at < 0 ? grid.length - 1 : Math.max(0, at - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = grid.length - 1;
    else if (e.key === "Escape") { setHoverX(null); return; }
    else return;
    e.preventDefault();
    setHoverX(grid[next]!);
  };

  // end-of-line labels, pushed apart so they never overlap
  const ends = direct ? p.series.map((s) => {
    const rs = runs(s.y, s.x, !!p.logY);
    const lastRun = rs[rs.length - 1];
    const last = lastRun ? lastRun[lastRun.length - 1]! : -1;
    return last >= 0 ? sy(s.y[last]!) : ih / 2;
  }) : [];
  const labelY = direct ? spreadLabels(ends, LABEL_GAP, 6, ih - 2) : [];

  const tableIdx = showTable ? sampleIndices(grid.length, 40) : [];
  const clip = `clip-${uid}`;
  const tipLeft = hoverX === null ? 0 : l + sx(hoverX);
  const flip = tipLeft > width * 0.6;

  return (
    <div className="chart" ref={ref}>
      <div className="chart-focus" tabIndex={0} role="group" aria-label={`${p.label}. Use the left and right arrow keys to read values.`} onKeyDown={onKey} onBlur={() => setHoverX(null)}>
        <svg width={width} height={height} role="img" aria-label={p.label} onMouseMove={onMove} onMouseLeave={() => setHoverX(null)}>
          {p.yLabel && <text x={2} y={12} fontSize={11} fill="var(--muted)">{p.yLabel}</text>}
          <g transform={`translate(${l},${t})`}>
            {(p.shade ?? []).map(([a, c], i) => <rect key={i} x={sx(Math.max(a, dom.x0))} width={Math.max(0, sx(Math.min(c, dom.x1)) - sx(Math.max(a, dom.x0)))} y={0} height={ih} fill="var(--accent-soft)" />)}
            {yt.map((v) => <g key={v}><line x1={0} x2={iw} y1={sy(v)} y2={sy(v)} stroke="var(--grid)" /><text x={-8} y={sy(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" fontFamily="var(--f-mono)">{fy(v)}</text></g>)}
            {xt.map((v) => <text key={v} x={sx(v)} y={ih + 16} textAnchor="middle" fontSize={11} fill="var(--muted)" fontFamily="var(--f-mono)">{fx(v)}</text>)}
            <line x1={0} x2={iw} y1={ih} y2={ih} stroke="var(--muted)" />
            {p.xLabel && <text x={iw} y={ih + 31} textAnchor="end" fontSize={11} fill="var(--muted)">{p.xLabel}</text>}
            <clipPath id={clip}><rect x={0} y={-4} width={iw} height={ih + 8} /></clipPath>
            <g clipPath={`url(#${clip})`}>
              {p.series.map((s, k) => {
                const gen = d3line<number>().x((i) => sx(s.x[i]!)).y((i) => sy(s.y[i]!));
                if (s.step) gen.curve(stepAfter);
                const band = s.band ? d3area<number>().x((i) => sx(s.x[i]!)).y0((i) => sy(s.band!.lo[i]!)).y1((i) => sy(s.band!.hi[i]!)) : null;
                const rs = runs(s.y, s.x, !!p.logY);
                return (
                  <g key={k}>
                    {band && rs.map((run, j) => <path key={`b${j}`} d={band(run) ?? ""} fill={s.color} opacity={0.18} />)}
                    {rs.map((run, j) => <path key={j} className={s.dash ? undefined : "chart-line"} pathLength={1} d={gen(run) ?? ""} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />)}
                  </g>
                );
              })}
            </g>
            {p.marker !== undefined && p.marker >= dom.x0 && p.marker <= dom.x1 && <line x1={sx(p.marker)} x2={sx(p.marker)} y1={0} y2={ih} stroke="var(--ink)" strokeDasharray="3 4" />}
            {hoverX !== null && <line x1={sx(hoverX)} x2={sx(hoverX)} y1={0} y2={ih} stroke="var(--muted)" />}
            {hoverX !== null && readings.map(({ s, v }, k) => (v ? <circle key={k} cx={sx(v.x)} cy={sy(v.y)} r={4} fill={s.color} stroke="var(--surface-solid)" strokeWidth={1.5} /> : null))}
            {direct && p.series.map((s, k) => <text key={k} x={iw + 8} y={labelY[k]} dy="0.32em" fontSize={11.5} fontWeight={600} fill={s.color}>{s.name}</text>)}
          </g>
        </svg>
        {hoverX !== null && (
          <div className="tip" style={{ left: flip ? undefined : tipLeft + 12, right: flip ? width - tipLeft + 12 : undefined, top: t + 4 }} aria-hidden="true">
            <div>{p.xLabel ? `${p.xLabel} ` : ""}{fx(hoverX)}</div>
            {readings.map(({ s, v }) => <div key={s.name}><span style={{ color: s.color }}>■</span> {s.name ? `${s.name}: ` : ""}{v ? fy(v.y) : "n/a"}</div>)}
          </div>
        )}
      </div>
      <span className="sr-only" role="status" aria-live="polite">{readoutText}</span>
      {!direct && p.series.length >= 2 && p.series.every((s) => s.name) && <Legend items={p.series.map((s) => ({ name: s.name, color: s.color, dash: !!s.dash }))} />}
      <details className="chart-data" onToggle={(e) => setShowTable((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>Data table</summary>
        {showTable && (
          <div className="chart-table" tabIndex={0} role="region" aria-label={`${p.label}, data table`}>
            <table>
              <caption className="sr-only">{p.label}. {tableIdx.length < grid.length ? `Showing ${tableIdx.length} of ${grid.length} points.` : ""}</caption>
              <thead><tr><th scope="col">{p.xLabel || "x"}</th>{p.series.map((s) => <th scope="col" key={s.name}>{s.name || p.yLabel}</th>)}</tr></thead>
              <tbody>
                {tableIdx.map((gi) => {
                  const x = grid[gi]!;
                  return <tr key={gi}><th scope="row">{fx(x)}</th>{p.series.map((s) => { const v = valueAt(s, x); return <td key={s.name}>{v ? fy(v.y) : "n/a"}</td>; })}</tr>;
                })}
              </tbody>
            </table>
            {tableIdx.length < grid.length && <p className="small muted">Showing {tableIdx.length} of {grid.length} points, evenly spaced.</p>}
          </div>
        )}
      </details>
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
