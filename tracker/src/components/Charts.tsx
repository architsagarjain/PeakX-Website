import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Small SVG chart kit in the PeakX palette: ink for the current series, light grey for history,
 * --chart-over for over-target bars. One y-axis per chart, hover tooltip, a table view, and an
 * empty state when there's nothing to draw.
 */

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Label every `step`th tick plus the last, dropping one that would crowd the last label. */
const showTick = (i: number, n: number, step: number) => i === n - 1 || (i % step === 0 && n - 1 - i >= Math.ceil(step * 0.7));

const fmtN = (n: number, dp = 0) => n.toLocaleString('en-IN', { maximumFractionDigits: dp, minimumFractionDigits: 0 });

function niceRange(min: number, max: number, zero: boolean, minStep = 0): [number, number, number[]] {
  if (zero) min = Math.min(0, min);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / 3)));
  const s = Math.max(minStep, [1, 2, 2.5, 5, 10].map((k) => k * step).find((k) => span / k <= 4) ?? step * 10);
  const lo = Math.floor(min / s) * s, hi = Math.ceil(max / s) * s;
  const ticks: number[] = []; for (let v = lo; v <= hi + s / 2; v += s) ticks.push(Math.round(v * 100) / 100);
  return [lo, hi, ticks];
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return <div className="px-chart-empty">{children}</div>;
}

function TableToggle({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="px-chart-table">
      <summary>Show as table</summary>
      <table><thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>)}</tr>)}</tbody></table>
    </details>
  );
}

export interface LinePoint { label: string; value: number | null; trend?: number | null }

/**
 * Line chart. `value` points draw as small grey dots (raw entries); `trend` draws as the ink line.
 * Without any `trend`, the values themselves form the ink line.
 */
export function LineChart({ points, unit, height = 160, dp = 1, zero = false, label, valueName = 'Value', trendName = '7-day average', empty }: {
  points: LinePoint[]; unit: string; height?: number; dp?: number; zero?: boolean; label: string; valueName?: string; trendName?: string; empty: ReactNode;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const vals = points.flatMap((p) => [p.value, p.trend ?? null]).filter((v): v is number => v !== null);
  if (vals.length === 0) return <ChartEmpty>{empty}</ChartEmpty>;
  const hasTrend = points.some((p) => p.trend != null);
  const L = 36, R = 8, T = 10, B = 22, H = height;
  const [lo, hi, ticks] = niceRange(Math.min(...vals), Math.max(...vals), zero, Math.pow(10, -dp));
  const x = (i: number) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const lineOf = (key: 'value' | 'trend') => {
    let d = ''; let pen = false;
    points.forEach((p, i) => { const v = p[key]; if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    return d;
  };
  const step = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((W - L) / 64))));
  const hp = hover !== null ? points[hover] : null;
  return (
    <div className="px-chart-wrap" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label} onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const i = Math.round(((e.clientX - r.left - L) / (W - L - R)) * (points.length - 1)); setHover(Math.max(0, Math.min(points.length - 1, i))); }}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 6} y={y(t) + 3} className="tick" textAnchor="end">{fmtN(t, dp)}</text></g>)}
        {points.map((p, i) => showTick(i, points.length, step) ? <text key={i} x={x(i)} y={H - 6} className="tick" textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}>{p.label}</text> : null)}
        {hasTrend ? points.map((p, i) => p.value != null ? <circle key={i} cx={x(i)} cy={y(p.value)} r={3} className="dot" /> : null) : null}
        <path d={lineOf(hasTrend ? 'trend' : 'value')} className="line" />
        {!hasTrend && points.filter((p) => p.value != null).length < 12 ? points.map((p, i) => p.value != null ? <circle key={i} cx={x(i)} cy={y(p.value)} r={3.5} className="dot ink" /> : null) : null}
        {hover !== null && hp ? <g>
          <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="cross" />
          {hp.trend != null ? <circle cx={x(hover)} cy={y(hp.trend)} r={4.5} className="dot ink ring" /> : null}
          {hp.value != null && !hasTrend ? <circle cx={x(hover)} cy={y(hp.value)} r={4.5} className="dot ink ring" /> : null}
        </g> : null}
      </svg>
      {hover !== null && hp ? (
        <div className="px-tip" style={{ left: Math.min(W - 150, Math.max(0, x(hover) - 70)) }}>
          <b>{hp.label}</b>
          {hp.value != null ? <span>{valueName}: {fmtN(hp.value, dp)} {unit}</span> : <span>{valueName}: no entry</span>}
          {hasTrend && hp.trend != null ? <span>{trendName}: {fmtN(hp.trend, dp)} {unit}</span> : null}
        </div>
      ) : null}
      {hasTrend ? <div className="px-legend"><span><i className="sw dot" />{valueName}</span><span><i className="sw line" />{trendName}</span></div> : null}
      <TableToggle head={['Day', `${valueName} (${unit})`, ...(hasTrend ? [`${trendName} (${unit})`] : [])]}
        rows={points.filter((p) => p.value != null || p.trend != null).map((p) => [p.label, p.value != null ? fmtN(p.value, dp) : '–', ...(hasTrend ? [p.trend != null ? fmtN(p.trend, dp) : '–'] : [])])} />
    </div>
  );
}

export interface Bar { label: string; value: number | null; tone?: 'current' | 'past' | 'over' }

/** Bar chart from zero, optional dashed target line. Missing values show as a stub with "no data". */
export function BarChart({ bars, unit, target, targetLabel = 'Target', height = 160, label, empty, dp = 0 }: {
  bars: Bar[]; unit: string; target?: number; targetLabel?: string; height?: number; label: string; empty: ReactNode; dp?: number;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const vals = bars.map((b) => b.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return <ChartEmpty>{empty}</ChartEmpty>;
  const L = 40, R = 8, T = 10, B = 22, H = height;
  const [lo, hi, ticks] = niceRange(0, Math.max(...vals, target ?? 0), true, Math.pow(10, -dp));
  const slot = (W - L - R) / bars.length;
  const bw = Math.max(4, Math.min(28, slot - 4));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const step = Math.max(1, Math.ceil(bars.length / Math.max(2, Math.floor((W - L) / 44))));
  const hb = hover !== null ? bars[hover] : null;
  return (
    <div className="px-chart-wrap" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 6} y={y(t) + 3} className="tick" textAnchor="end">{fmtN(t, dp)}</text></g>)}
        {bars.map((b, i) => {
          const cx = L + slot * i + slot / 2;
          const v = b.value;
          const top = v != null ? y(v) : y(0) - 2;
          const h = Math.max(2, y(0) - top);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill="transparent" />
              <path d={`M${cx - bw / 2},${y(0)}V${top + Math.min(4, h)}a4,4 0 0 1 4,-4h${bw - 8}a4,4 0 0 1 4,4V${y(0)}Z`} className={`bar ${v == null ? 'none' : b.tone ?? 'current'}${hover === i ? ' on' : ''}`} />
              {showTick(i, bars.length, step) ? <text x={cx} y={H - 6} className="tick" textAnchor="middle">{b.label}</text> : null}
            </g>
          );
        })}
        {target ? <g><line x1={L} x2={W - R} y1={y(target)} y2={y(target)} className="target" /><text x={W - R} y={y(target) - 4} className="tick" textAnchor="end">{targetLabel} {fmtN(target, dp)}</text></g> : null}
      </svg>
      {hover !== null && hb ? (
        <div className="px-tip" style={{ left: Math.min(W - 150, Math.max(0, L + slot * hover + slot / 2 - 70)) }}>
          <b>{hb.label}</b><span>{hb.value != null ? `${fmtN(hb.value, dp)} ${unit}` : 'No data'}</span>
          {target && hb.value != null ? <span>{hb.value > target ? `${fmtN(hb.value - target, dp)} over` : `${fmtN(target - hb.value, dp)} under`} {targetLabel.toLowerCase()}</span> : null}
        </div>
      ) : null}
      <TableToggle head={['Day', `${unit}`]} rows={bars.map((b) => [b.label, b.value != null ? fmtN(b.value, dp) : '–'])} />
    </div>
  );
}
