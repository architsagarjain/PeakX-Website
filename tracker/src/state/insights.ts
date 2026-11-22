import type { AppData, ISODate, WorkoutSession } from '../domain/types.js';
import { addDays, parse, weekStart } from '../domain/clock.js';
import { e1rm } from '../domain/nutrition.js';
import { planDay } from '../domain/training.js';
import { dayTotals, kcalTarget } from './selectors.js';

/** Aggregations for Insights (S16.1). Every number on the screen comes from here. */

export interface DayPoint {
  date: ISODate;
  kcalIn: number | null;     // null = nothing logged that day
  protein: number | null;
  target: number;            // that day's calorie target
  kcalOut: number | null;    // wearable calories burned
  steps: number | null;
  sleep: number | null;
}

export function dailySeries(d: AppData, end: ISODate, days: number): DayPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(end, i - days + 1);
    const logged = d.meals.some((m) => m.date === date && m.items.length);
    const t = dayTotals(d, date);
    const w = d.devices.google || d.devices.strava ? d.wearable.find((x) => x.date === date) : undefined;
    return {
      date, kcalIn: logged ? t.kcal : null, protein: logged ? t.protein : null, target: kcalTarget(d, date).total,
      kcalOut: w ? w.kcalBurned : null, steps: w ? w.steps : null, sleep: w ? w.sleepHours : null,
    };
  });
}

export function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}
/** % change from a to b, rounded; null when either side is missing. */
export function pctChange(a: number | null, b: number | null): number | null {
  return a && b !== null ? Math.round(((b - a) / a) * 100) : null;
}

/** Averages for the period and the period before it, for "+9% vs last 28 days". */
export function periodSummary(d: AppData, end: ISODate, days: number) {
  const now = dailySeries(d, end, days);
  const before = dailySeries(d, addDays(end, -days), days);
  const pick = (xs: DayPoint[], k: keyof DayPoint) => mean(xs.map((x) => x[k] as number | null));
  const keys = ['kcalIn', 'protein', 'kcalOut', 'steps', 'sleep'] as const;
  const out = {} as Record<(typeof keys)[number], { now: number | null; before: number | null; change: number | null }>;
  for (const k of keys) { const a = pick(before, k), b = pick(now, k); out[k] = { now: b, before: a, change: pctChange(a, b) }; }
  const restingHr = mean(d.wearable.filter((w) => w.date > addDays(end, -days) && w.date <= end).map((w) => w.restingHr));
  const balance = mean(now.map((x) => (x.kcalIn !== null && x.kcalOut !== null ? x.kcalIn - x.kcalOut : null)));
  const daysLogged = now.filter((x) => x.kcalIn !== null).length;
  return { ...out, restingHr, balance, daysLogged, days };
}

export const MAIN_LIFTS = ['Bench press', 'Back squat', 'Deadlift', 'Romanian deadlift'];

/** Best estimated 1RM per session for one lift, oldest first, within the window. */
export function liftSeries(workouts: WorkoutSession[], name: string, end: ISODate, days: number) {
  const from = addDays(end, -days + 1);
  return workouts
    .filter((w) => w.date >= from && w.date <= end)
    .map((w) => {
      const sets = w.exercises.find((e) => e.name === name)?.sets ?? [];
      if (!sets.length) return null;
      const top = sets.reduce((b, s) => (e1rm(s.kg, s.reps) > e1rm(b.kg, b.reps) ? s : b));
      return { date: w.date, e1rm: e1rm(top.kg, top.reps), top };
    })
    .filter((x): x is { date: ISODate; e1rm: number; top: { kg: number; reps: number } } => x !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Change over the window and how long the best has been flat (stalled = 3+ weeks with no new best). */
export function liftSummary(workouts: WorkoutSession[], name: string, end: ISODate, days: number) {
  const s = liftSeries(workouts, name, end, days);
  if (!s.length) return null;
  const first = s[0].e1rm, best = Math.max(...s.map((x) => x.e1rm));
  const bestAt = s.find((x) => x.e1rm === best)!;
  const firstBest = s.find((x) => x.e1rm >= best)!;
  const flatDays = Math.round((parse(end).getTime() - parse(firstBest.date).getTime()) / 864e5);
  const last = s[s.length - 1];
  return {
    name, sessions: s.length, best, first, top: last.top, bestDate: bestAt.date,
    changePct: first ? Math.round(((best - first) / first) * 100) : 0,
    flatWeeks: Math.floor(flatDays / 7),
    stalled: s.length >= 3 && best <= first,
  };
}

/**
 * Week-by-week averages for the last `weeks` weeks ending with the week of `end` (oldest first):
 * calories eaten (logged days only), 7-day weight average at the week's end, and training volume.
 */
export function weeklyBuckets(d: AppData, end: ISODate, weeks: number) {
  const last = weekStart(end);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(last, (i - weeks + 1) * 7);
    const stop = addDays(start, 6) > end ? end : addDays(start, 6);
    const days = Array.from({ length: 7 }, (_, k) => addDays(start, k)).filter((x) => x <= end);
    const kcal = mean(days.map((x) => (d.meals.some((m) => m.date === x && m.items.length) ? dayTotals(d, x).kcal : null)));
    const ws = d.weights.filter((w) => w.date >= addDays(stop, -6) && w.date <= stop).map((w) => w.kg);
    const volume = d.workouts.filter((w) => w.date >= start && w.date <= stop).flatMap((w) => w.exercises.flatMap((e) => e.sets)).reduce((s, x) => s + x.kg * x.reps, 0);
    return { start, kcal: kcal === null ? null : Math.round(kcal), weight: ws.length ? Math.round((ws.reduce((s, x) => s + x, 0) / ws.length) * 10) / 10 : null, volume };
  });
}

/** Training days for the heatmap: rows Monday–Sunday, columns the last `weeks` weeks (oldest first); value is the day's volume, or 1 for a finished session with no sets. */
export function trainingHeatmap(workouts: WorkoutSession[], end: ISODate, weeks: number) {
  const last = weekStart(end);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(last, (i - weeks + 1) * 7));
  const vol = (date: ISODate) => {
    const ws = workouts.filter((w) => w.date === date && (w.done || w.exercises.some((e) => e.sets.length)));
    if (!ws.length) return date > end ? null : 0;
    return Math.max(1, ws.flatMap((w) => w.exercises.flatMap((e) => e.sets)).reduce((s, x) => s + x.kg * x.reps, 0));
  };
  const rows = Array.from({ length: 7 }, (_, day) => starts.map((s) => vol(addDays(s, day))));
  const sessions = rows.flat().filter((v) => (v ?? 0) > 0).length;
  return { rows, starts, sessions };
}

/** Wearable sync state for the connected-apps card. */
export function syncStatus(d: Pick<AppData, 'devices' | 'wearable'>) {
  const latest = [...d.wearable].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  return { connected: d.devices.google, lastSync: latest?.date ?? null, latest };
}

/** The last 7 days for the Coach panel: workouts done against planned, calorie and protein adherence, sleep and steps. */
export function lastWeekSummary(d: AppData, end: ISODate) {
  const days = dailySeries(d, end, 7);
  const dates = days.map((x) => x.date);
  const done = d.workouts.filter((w) => dates.includes(w.date) && w.done);
  const planned = dates.filter((x) => planDay(d.profile, x).training || d.workouts.some((w) => w.date === x)).length;
  const logged = days.filter((x) => x.kcalIn !== null);
  const kcal = mean(logged.map((x) => x.kcalIn));
  const target = mean(logged.map((x) => x.target));
  return {
    workouts: { done: done.length, planned, names: [...new Set(done.map((w) => w.name))] },
    kcal: kcal === null ? null : Math.round(kcal), kcalTarget: target === null ? null : Math.round(target),
    adherence: kcal !== null && target ? Math.round((1 - Math.abs(kcal - target) / target) * 100) : null,
    proteinDays: logged.filter((x) => (x.protein ?? 0) >= d.targets.protein * 0.9).length, loggedDays: logged.length,
    protein: mean(logged.map((x) => x.protein)),
    sleep: mean(days.map((x) => x.sleep)), steps: mean(days.map((x) => x.steps)),
  };
}
