import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { barHeights, halfArc, heatLevel, lastPoint, linePath, ringDash } from './geometry';

type Tone = 'ink' | 'lime' | 'coral' | 'band';
type Series = (number | null | undefined)[];

/**
 * Line trend, 1.5px stroke, dot on the latest value. With under two values it draws a dashed baseline.
 * `fluid` fills the container's width at a fixed height (instead of scaling up and growing tall on wide cards).
 */
export function Sparkline({ fluid, ...p }: SparkProps & { fluid?: boolean }) {
  const [ref, w] = useWidth<HTMLDivElement>(p.width ?? 240);
  return fluid ? <div className="ui-spark-wrap" ref={ref}><SparkSvg {...p} width={w} /></div> : <SparkSvg {...p} />;
}
type SparkProps = { values: Series; label: string; width?: number; height?: number; tone?: Tone; fill?: boolean };

function SparkSvg({ values, label, width = 120, height = 40, tone = 'ink', fill = false }: SparkProps) {
  const d = linePath(values, width, height, 3);
  const end = lastPoint(values, width, height, 3);
  const gid = useId();
  return (
    <svg className={`ui-spark t-${tone}`} viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={d ? label : `${label}: not enough data yet`}>
      {d ? (
        <>
          {fill ? (
            <>
              <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="ui-spark-fill-a" /><stop offset="1" className="ui-spark-fill-b" /></linearGradient></defs>
              <path d={`${d} L${end!.x} ${height} L${d.match(/^M([\d.-]+)/)![1]} ${height} Z`} fill={`url(#${gid})`} stroke="none" />
            </>
          ) : null}
          <path d={d} className="ui-spark-line" />
          {end ? <circle cx={end.x} cy={end.y} r="3" className="ui-spark-dot" /> : null}
        </>
      ) : <path d={`M3 ${height / 2} H${width - 3}`} className="ui-spark-empty" />}
    </svg>
  );
}

/** Small bar row (a week of volume, say). `highlight` marks one bar (today) in ink; the rest are quiet. */
export function BarSpark({ values, labels, highlight, label, height = 64 }: {
  values: Series; labels?: string[]; highlight?: number; label: string; height?: number;
}) {
  const hs = barHeights(values, height);
  return (
    <div className="ui-bars" role="img" aria-label={label}>
      <div className="ui-bars-row" style={{ height: `${height}px` }}>
        {hs.map((h, i) => (
          <span key={i} className={`ui-bar${i === highlight ? ' on' : ''}${h === 0 ? ' none' : ''}`} style={{ height: `${h || 4}px` }} />
        ))}
      </div>
      {labels ? <div className="ui-bars-labels" aria-hidden="true">{labels.map((l, i) => <span key={i} className={i === highlight ? 'on' : undefined}>{l}</span>)}</div> : null}
    </div>
  );
}

/** Progress ring. `pct` null shows an empty track. Put the number in `children`. */
export function Ring({ pct, size = 96, stroke = 8, tone = 'lime', label, children }: {
  pct: number | null; size?: number; stroke?: number; tone?: Tone; label: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  return (
    <div className="ui-ring" style={{ width: `${size}px`, height: `${size}px` }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ui-ring-track" strokeWidth={stroke} />
        {pct ? <circle cx={size / 2} cy={size / 2} r={r} className={`ui-ring-fill t-${tone}`} strokeWidth={stroke} strokeDasharray={ringDash(pct, r)} transform={`rotate(-90 ${size / 2} ${size / 2})`} /> : null}
      </svg>
      {children ? <div className="ui-ring-in">{children}</div> : null}
    </div>
  );
}

/** Half-circle gauge, for a 0–1 score such as plateau risk. `pct` null shows the track only. */
export function HalfGauge({ pct, width = 160, stroke = 10, tone = 'coral', label, children }: {
  pct: number | null; width?: number; stroke?: number; tone?: Tone; label: string; children?: ReactNode;
}) {
  const r = (width - stroke) / 2;
  const h = r + stroke / 2;
  const fill = halfArc(pct ?? 0, width / 2, h, r);
  return (
    <div className="ui-gauge" style={{ width: `${width}px` }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${width} ${h + 1}`} width={width} height={h + 1} aria-hidden="true">
        <path d={halfArc(1, width / 2, h, r)} className="ui-ring-track" strokeWidth={stroke} />
        {fill ? <path d={fill} className={`ui-ring-fill t-${tone}`} strokeWidth={stroke} /> : null}
      </svg>
      {children ? <div className="ui-gauge-in">{children}</div> : null}
    </div>
  );
}

/** Grid of shaded cells (weeks × days of training). Null or 0 is an empty cell. Columns come from a CSS variable, not an inline grid template, so the phone layout's grid reset leaves it alone. */
export function Heatmap({ rows, rowLabels, colLabels, label }: {
  rows: Series[]; rowLabels?: string[]; colLabels?: string[]; label: string;
}) {
  const max = Math.max(0, ...rows.flat().map((v) => (v == null || !isFinite(v) ? 0 : v)));
  const cols = Math.max(0, ...rows.map((r) => r.length));
  return (
    <div className={`ui-heat${rowLabels ? ' labelled' : ''}`} role="img" aria-label={label} style={{ '--cols': cols } as CSSProperties}>
      {colLabels ? <>{rowLabels ? <span /> : null}{colLabels.map((c, i) => <span key={i} className="ui-heat-col" aria-hidden="true">{c}</span>)}</> : null}
      {rows.map((r, ri) => (
        <div key={ri} className="ui-heat-row" style={{ display: 'contents' }}>
          {rowLabels ? <span className="ui-heat-label" aria-hidden="true">{rowLabels[ri]}</span> : null}
          {Array.from({ length: cols }, (_, ci) => <span key={ci} className={`ui-heat-cell l${heatLevel(r[ci], max)}`} />)}
        </div>
      ))}
    </div>
  );
}


function useWidth<T extends HTMLElement>(fallback = 560): [React.RefObject<T>, number] {
  // Measures the element’s content width; 80px minimum so a chart never collapses to nothing.
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(80, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * Bars (e.g. weekly calories) with a line on its own scale (e.g. weight) over the same buckets.
 * `highlight` bars are lime; nulls leave a gap. Labels sit under the bars.
 */
export function ComboChart({ bars, line, labels, highlight = [], label, height = 220, lineUnit = '' }: {
  bars: Series; line: Series; labels: string[]; highlight?: number[]; label: string; height?: number; lineUnit?: string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const n = Math.max(bars.length, line.length, 1);
  const pad = 10;
  const slot = (w - pad * 2) / n;
  const bw = Math.min(40, slot * 0.55);
  const hs = barHeights(bars, height - 24, 4);
  const pts = line.map((v, i) => (v == null ? null : { i, v }));
  const known = pts.filter((p): p is { i: number; v: number } => !!p);
  const lo = known.length ? Math.min(...known.map((p) => p.v)) : 0, hi = known.length ? Math.max(...known.map((p) => p.v)) : 1;
  const span = hi - lo || 1;
  const x = (i: number) => pad + slot * i + slot / 2;
  const y = (v: number) => 12 + (1 - (v - lo) / span) * (height * 0.55);
  const d = known.length > 1 ? known.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ') : '';
  return (
    <div className="ui-combo" ref={ref} role="img" aria-label={label}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={pad} x2={w - pad} y1={height * f} y2={height * f} className="ui-combo-grid" />)}
        {hs.map((h, i) => <rect key={i} x={x(i) - bw / 2} y={height - h} width={bw} height={h || 0} rx={6} className={`ui-combo-bar${highlight.includes(i) ? ' on' : ''}`} />)}
        {d ? <path d={d} className="ui-combo-line" /> : null}
        {known.map((p, k) => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={k === known.length - 1 ? 5 : 4} className={`ui-combo-dot${k === known.length - 1 ? ' last' : ''}`}><title>{`${p.v}${lineUnit}`}</title></circle>)}
      </svg>
      <div className="ui-combo-labels" aria-hidden="true" style={{ padding: `0 ${pad}px` }}>{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
    </div>
  );
}
