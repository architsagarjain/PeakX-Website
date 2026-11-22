import type { ISODate, RunKind, RunLog } from './types.js';
import { addDays, weekStart } from './clock.js';

/**
 * Running (S11.3). For people who run instead of (or as well as) lifting: log a run by distance and time,
 * see pace and a calorie estimate, and get a plain target for the planned run of the day.
 * Calories use the usual running estimate of about 1 kcal per kg of body weight per km, so they are marked estimated.
 */

export const RUN_KINDS: { id: RunKind; label: string; plan: string }[] = [
  { id: 'easy', label: 'Easy', plan: 'Easy run' },
  { id: 'tempo', label: 'Tempo', plan: 'Tempo run' },
  { id: 'long', label: 'Long', plan: 'Long run' },
  { id: 'intervals', label: 'Intervals', plan: 'Intervals' },
  { id: 'race', label: 'Race', plan: 'Race' },
];
export const RUN_LABEL: Record<RunKind, string> = Object.fromEntries(RUN_KINDS.map((k) => [k.id, k.label])) as Record<RunKind, string>;

/** True for plan labels that are runs rather than gym sessions. */
export function isRunLabel(label: string): boolean { return RUN_KINDS.some((k) => k.plan === label); }
export function kindForLabel(label: string): RunKind { return RUN_KINDS.find((k) => k.plan === label)?.id ?? 'easy'; }

/** "32" (minutes), "32:15" (min:sec) or "1:05:20" (h:min:sec) → seconds. Null when it can't be read. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) { const m = Number(t); return m > 0 ? Math.round(m * 60) : null; }
  const parts = t.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const n = parts.map(Number);
  if (n.slice(1).some((x) => x >= 60)) return null;
  const sec = n.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n[0] * 60 + n[1];
  return sec > 0 ? sec : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** 1935 → "32:15"; 3920 → "1:05:20". */
export function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** Seconds per km. */
export function paceSec(km: number, seconds: number): number { return km > 0 ? seconds / km : 0; }
/** 342 → "5:42 /km". */
export function fmtPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${pad(s % 60)} /km`;
}

/** Estimated calories for a run: about 1 kcal per kg per km. */
export function runKcal(weightKg: number, km: number): number {
  return Math.round(Math.max(0, weightKg) * Math.max(0, km));
}

/** Field errors for a run; an empty object means it can be saved. */
export function validateRun(km: number, seconds: number | null): { km?: string; time?: string } {
  const e: { km?: string; time?: string } = {};
  if (!Number.isFinite(km) || km < 0.2 || km > 100) e.km = 'Distance between 0.2 and 100 km';
  if (seconds === null) e.time = 'Time as minutes or mm:ss';
  else if (!e.km) {
    const p = paceSec(km, seconds);
    if (p < 150 || p > 15 * 60) e.time = 'That works out faster than 2:30 or slower than 15:00 per km';
  }
  return e;
}

export function runsOn(runs: RunLog[], date: ISODate): RunLog[] { return runs.filter((r) => r.date === date); }

/** Runs in the Monday–Sunday week containing `date`, with total km and time. */
export function weekRuns(runs: RunLog[], date: ISODate) {
  const start = weekStart(date), end = addDays(start, 6);
  const list = runs.filter((r) => r.date >= start && r.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const km = Math.round(list.reduce((s, r) => s + r.km, 0) * 10) / 10;
  const seconds = list.reduce((s, r) => s + r.seconds, 0);
  return { list, km, seconds, count: list.length };
}

/** Longest run in the 14 days before `date`. */
export function longestRecent(runs: RunLog[], date: ISODate): number {
  const from = addDays(date, -14);
  return runs.filter((r) => r.date < date && r.date >= from).reduce((m, r) => Math.max(m, r.km), 0);
}

/** Fastest pace on a run of at least `minKm`, before `date`. 0 when there is none. */
export function bestPace(runs: RunLog[], minKm: number, before: ISODate): number {
  const p = runs.filter((r) => r.date < before && r.km >= minKm).map((r) => paceSec(r.km, r.seconds));
  return p.length ? Math.min(...p) : 0;
}

/** What to do on a planned run, with a suggested distance from recent runs. */
export function runGuide(kind: RunKind, runs: RunLog[], date: ISODate): { title: string; detail: string; km: number } {
  const half = (x: number) => Math.round(x * 2) / 2;
  const recentEasy = runs.filter((r) => r.date < date && r.kind === 'easy').slice(-4);
  const easyKm = recentEasy.length ? half(recentEasy.reduce((s, r) => s + r.km, 0) / recentEasy.length) : 4;
  switch (kind) {
    case 'long': {
      const longest = longestRecent(runs, date);
      const km = longest ? Math.min(half(longest * 1.1), longest + 2) : Math.max(6, easyKm + 2);
      return { title: 'Long run', detail: 'Slow enough to talk the whole way. Add no more than about 10% on your longest run of the last two weeks.', km };
    }
    case 'tempo': return { title: 'Tempo run', detail: '10 minutes easy, then 15–20 minutes comfortably hard (short sentences only), then 10 minutes easy.', km: Math.max(4, easyKm + 1) };
    case 'intervals': return { title: 'Intervals', detail: '10 minutes easy, then 6 × 400 m fast with a 90-second jog between, then 10 minutes easy.', km: Math.max(4, easyKm) };
    case 'race': return { title: 'Race', detail: 'Start a little slower than goal pace for the first km; eat carbs 2–3 hours before.', km: 5 };
    default: return { title: 'Easy run', detail: 'Conversational pace, 25–40 minutes. Most of your running should feel like this.', km: easyKm };
  }
}
