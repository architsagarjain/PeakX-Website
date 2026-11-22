import type { ExerciseLog, FixPlan, ISODate, Profile, SetEntry, WorkoutSession } from './types.js';
import { addDays, parse, weekStart } from './clock.js';
import { splitFor } from './onboarding.js';
import { e1rm } from './nutrition.js';
import { isRunLabel } from './runs.js';

/**
 * Training plan (S15.1) and session logic (S11.1).
 * Split templates turn onboarding's days-per-week into named sessions; progression is double
 * progression: hit every target rep on every set and the weight goes up next time.
 */

export interface ExerciseTemplate { name: string; sets: number; reps: number; restSec: number; startKg: number; step: number }
const ex = (name: string, sets: number, reps: number, restSec: number, startKg: number, step = 2.5): ExerciseTemplate => ({ name, sets, reps, restSec, startKg, step });

export const TEMPLATES: Record<string, ExerciseTemplate[]> = {
  'Full body': [ex('Back squat', 3, 6, 180, 60), ex('Bench press', 3, 8, 150, 50), ex('Seated cable row', 3, 10, 90, 45), ex('Romanian deadlift', 3, 8, 120, 60), ex('Seated DB shoulder press', 3, 10, 90, 14, 2)],
  Upper: [ex('Bench press', 4, 6, 150, 60), ex('Lat pulldown', 3, 10, 90, 55), ex('Seated DB shoulder press', 3, 8, 90, 20, 2), ex('Seated cable row', 3, 10, 90, 50), ex('Incline DB press', 3, 10, 90, 22.5, 2.5), ex('Face pull + curl superset', 3, 12, 60, 15, 1)],
  Lower: [ex('Back squat', 4, 5, 180, 80), ex('Romanian deadlift', 3, 8, 120, 70), ex('Walking lunge', 3, 10, 90, 20, 2), ex('Leg press', 3, 10, 90, 120, 5), ex('Calf raise', 3, 12, 60, 40, 2.5)],
  Push: [ex('Bench press', 4, 6, 150, 60), ex('Seated DB shoulder press', 3, 8, 90, 20, 2), ex('Incline DB press', 3, 10, 90, 22.5, 2.5), ex('Cable triceps pushdown', 3, 12, 60, 25, 2.5), ex('Lateral raise', 3, 12, 60, 8, 1)],
  Pull: [ex('Deadlift', 3, 5, 180, 100, 5), ex('Lat pulldown', 3, 10, 90, 55), ex('Seated cable row', 3, 10, 90, 50), ex('Face pull', 3, 12, 60, 15, 1), ex('DB curl', 3, 12, 60, 10, 1)],
  Legs: [ex('Back squat', 4, 6, 180, 75), ex('Leg press', 3, 10, 90, 120, 5), ex('Romanian deadlift', 3, 8, 120, 70), ex('Leg curl', 3, 12, 60, 35, 2.5), ex('Calf raise', 3, 15, 60, 40, 2.5)],
};
export const SESSION_LABELS = Object.keys(TEMPLATES);

export interface PlanDay { date: ISODate; label: string; training: boolean; run: boolean }
type PlanProfile = Pick<Profile, 'trainingDays'> & Partial<Pick<Profile, 'trainingStyle'>>;

/** The 7 days of the week containing `date`, Monday first, from the profile's days per week and training style. */
export function planWeek(p: PlanProfile, date: ISODate): PlanDay[] {
  const start = weekStart(date);
  return splitFor(p.trainingDays, p.trainingStyle).map((label, i) => ({ date: addDays(start, i), label, training: label !== 'Rest', run: isRunLabel(label) }));
}
export function planDay(p: PlanProfile, date: ISODate): PlanDay {
  return planWeek(p, date).find((d) => d.date === date)!;
}

/** Most recent finished session before `date` that has this exercise with at least one set. */
export function lastPerformance(workouts: WorkoutSession[], name: string, before: ISODate): { date: ISODate; log: ExerciseLog } | null {
  const done = workouts.filter((w) => w.date < before && w.done).sort((a, b) => b.date.localeCompare(a.date));
  for (const w of done) {
    const log = w.exercises.find((e) => e.name === name && e.sets.length);
    if (log) return { date: w.date, log };
  }
  return null;
}

/** Weight to use next time and why (double progression). */
export function nextTarget(t: ExerciseTemplate, last: ExerciseLog | null): { kg: number; reason: string; change: number } {
  if (!last || !last.sets.length) return { kg: t.startKg, reason: 'Starting weight; adjust to leave 2 reps in reserve', change: 0 };
  const kg = Math.max(...last.sets.map((s) => s.kg));
  const top = last.sets.filter((s) => s.kg === kg);
  const hitAll = top.length >= t.sets && top.every((s) => s.reps >= t.reps);
  if (hitAll) return { kg: kg + t.step, reason: `You hit ${t.sets} × ${t.reps} at ${kg} kg last time`, change: t.step };
  const missedBadly = top.filter((s) => s.reps <= t.reps - 2).length >= 2;
  if (missedBadly) return { kg, reason: 'Missed reps last time; same weight, focus on every rep', change: 0 };
  return { kg, reason: `Same weight until you hit ${t.sets} × ${t.reps}`, change: 0 };
}

/** A fresh session for a plan label, with suggested weights from history. */
export function buildSession(label: string, date: ISODate, time: string, workouts: WorkoutSession[], id: string, overrides: Record<string, number> = {}, fixes: FixPlan[] = []): WorkoutSession {
  const tpl = TEMPLATES[label] ?? TEMPLATES['Full body'];
  const active = fixes.filter((f) => f.from <= date && date <= f.until);
  const session: WorkoutSession = {
    id, date, time, name: label === 'Full body' ? 'Full body' : `${label} body`.replace('Push body', 'Push').replace('Pull body', 'Pull').replace('Legs body', 'Legs'),
    done: false,
    exercises: tpl.map((t) => {
      const last = lastPerformance(workouts, t.name, date)?.log ?? null;
      const next = nextTarget(t, last);
      const extra = overrides[t.name] ?? 0;
      return { name: t.name, target: `${t.sets + extra} × ${t.reps}`, restSec: t.restSec, sets: [], targetKg: next.kg, note: extra ? `${next.reason} · +${extra} set from your weekly report` : next.reason };
    }),
  };
  return withFixes(session, active);
}

/** Form Check fix plans (S18.1): drills before the lift, and the coach's load change on the lift itself. */
export function withFixes(s: WorkoutSession, fixes: FixPlan[]): WorkoutSession {
  if (!fixes.length) return s;
  const exercises: ExerciseLog[] = [];
  for (const e of s.exercises) {
    const f = fixes.find((x) => x.lift === e.name);
    if (f) {
      f.drills.forEach((d) => exercises.push({ name: d.name, target: `${d.sets} × ${d.reps}`, restSec: 60, sets: [], note: `${d.note} · Form Check fix plan until ${f.until.slice(8)}/${f.until.slice(5, 7)}` }));
      exercises.push(f.loadChangeKg && e.targetKg !== undefined ? { ...e, targetKg: Math.max(0, e.targetKg + f.loadChangeKg), note: `${f.loadChangeKg > 0 ? '+' : '−'}${Math.abs(f.loadChangeKg)} kg from your Form Check; clean reps first` } : e);
    } else exercises.push(e);
  }
  return { ...s, exercises };
}

/** The gym session for a date: the logged one if it exists, otherwise a planned (unsaved) one, or null on rest and run days. */
export function sessionFor(workouts: WorkoutSession[], p: Pick<Profile, 'trainingDays' | 'gymTime'> & Partial<Pick<Profile, 'trainingStyle'>>, date: ISODate, id = `plan-${date}`, overrides: Record<string, number> = {}, fixes: FixPlan[] = []): { session: WorkoutSession; saved: boolean } | null {
  const saved = workouts.find((w) => w.date === date);
  if (saved) return { session: saved, saved: true };
  const day = planDay(p, date);
  return day.training && !day.run ? { session: buildSession(day.label, date, p.gymTime, workouts, id, overrides, fixes), saved: false } : null;
}

export function targetSets(e: ExerciseLog): number { return Number(e.target.split('×')[0]) || 3; }
export function targetReps(e: ExerciseLog): number { return Number(e.target.split('×')[1]) || 8; }

/** Best estimated 1-rep max for an exercise across finished sessions before `date`. */
export function bestE1rm(workouts: WorkoutSession[], name: string, before: ISODate): number {
  let best = 0;
  for (const w of workouts) if (w.date < before) for (const e of w.exercises) if (e.name === name) for (const s of e.sets) best = Math.max(best, e1rm(s.kg, s.reps));
  return best;
}
/** A set is a PR when its estimated 1RM beats everything before this session (and there was history). */
export function isPR(workouts: WorkoutSession[], name: string, set: SetEntry, date: ISODate): boolean {
  const best = bestE1rm(workouts, name, date);
  return best > 0 && e1rm(set.kg, set.reps) > best;
}

export function sessionVolume(w: WorkoutSession): number {
  return w.exercises.reduce((s, e) => s + e.sets.reduce((t, x) => t + x.kg * x.reps, 0), 0);
}

/** Rough duration: sets × (40 s work + rest). */
export function estimatedMinutes(w: WorkoutSession): number {
  return Math.round(w.exercises.reduce((s, e) => s + targetSets(e) * (40 + e.restSec), 0) / 60);
}

export function weekdayShort(date: ISODate): string { return parse(date).toLocaleDateString('en-GB', { weekday: 'short' }); }
