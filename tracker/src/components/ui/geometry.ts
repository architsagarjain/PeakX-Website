/**
 * Pure maths behind the inline-SVG charts in this folder. No React, so it is unit-tested directly.
 * Every helper copes with no data: null or missing values are skipped, and an empty series draws nothing.
 */

/** Clamp a share to 0–1. Unknown or broken input is 0. */
export function share(value: number | null | undefined, target: number | null | undefined): number {
  if (value == null || !target || !isFinite(value) || !isFinite(target) || target <= 0) return 0;
  return Math.min(1, Math.max(0, value / target));
}

/** Known values only, with their positions in the original series. */
function points(values: (number | null | undefined)[]) {
  return values.flatMap((v, i) => (v == null || !isFinite(v) ? [] : [{ i, v }]));
}

/**
 * SVG path for a line through the known values, scaled into w×h with `pad` px of room for the stroke.
 * Returns '' when fewer than two values are known (one point is not a trend).
 */
export function linePath(values: (number | null | undefined)[], w: number, h: number, pad = 2): string {
  const pts = points(values);
  if (pts.length < 2) return '';
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  const span = hi - lo || 1;
  const n = Math.max(1, values.length - 1);
  const x = (i: number) => pad + (i / n) * (w - pad * 2);
  // A flat series sits in the middle rather than on the floor.
  const y = (v: number) => (hi === lo ? h / 2 : pad + (1 - (v - lo) / span) * (h - pad * 2));
  return pts.map((p, k) => `${k ? 'L' : 'M'}${round(x(p.i))} ${round(y(p.v))}`).join(' ');
}

/** The last known point of linePath, for an end dot. Null when the line is not drawn. */
export function lastPoint(values: (number | null | undefined)[], w: number, h: number, pad = 2): { x: number; y: number } | null {
  const d = linePath(values, w, h, pad);
  if (!d) return null;
  const m = /([\d.-]+) ([\d.-]+)$/.exec(d)!;
  return { x: Number(m[1]), y: Number(m[2]) };
}

/** Bar heights (px) for values against the largest one, with a small floor so logged-but-tiny days stay visible. */
export function barHeights(values: (number | null | undefined)[], h: number, floor = 3): number[] {
  const max = Math.max(0, ...values.map((v) => (v == null || !isFinite(v) ? 0 : v)));
  return values.map((v) => (v == null || !isFinite(v) || v <= 0 || max === 0 ? 0 : Math.max(floor, round((v / max) * h))));
}

/** stroke-dasharray for a ring of radius r filled to `pct` (0–1). */
export function ringDash(pct: number, r: number): string {
  const c = 2 * Math.PI * r;
  const on = round(c * Math.min(1, Math.max(0, pct)));
  return `${on} ${round(c - on)}`;
}

/** Path for the top half of a circle (a gauge) from the left end, filled to `pct` (0–1). '' when pct is 0. */
export function halfArc(pct: number, cx: number, cy: number, r: number): string {
  const p = Math.min(1, Math.max(0, pct));
  if (p === 0) return '';
  const a = Math.PI * (1 - p);
  return `M${round(cx - r)} ${round(cy)} A${r} ${r} 0 0 1 ${round(cx + r * Math.cos(a))} ${round(cy - r * Math.sin(a))}`;
}

/** Heatmap shade 0–4: 0 is nothing logged, 4 is at or above the busiest cell. */
export function heatLevel(value: number | null | undefined, max: number): 0 | 1 | 2 | 3 | 4 {
  if (value == null || !isFinite(value) || value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) as 1 | 2 | 3 | 4;
}

const round = (n: number) => Math.round(n * 10) / 10;
