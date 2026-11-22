import type { AppData, ISODate, Meal, WearableDay, WorkoutSession } from './types.js';

/**
 * Firestore data layout, shared by the app (state/cloud.ts) and the server jobs (api/):
 *   users/{uid}             everything except per-day logs
 *   users/{uid}/days/{date} that day's meals, workouts, weight and wearable data
 */


export interface DayDoc { meals: Meal[]; workouts: WorkoutSession[]; weight: number | null; wearable: WearableDay | null }
/** Billing is server-owned (users/{uid}/private/billing), so it never goes in the root doc. */
export type RootDoc = Omit<AppData, 'meals' | 'workouts' | 'weights' | 'wearable' | 'billing'>;

/** Plain JSON (drops undefined, which Firestore rejects). */
const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function splitData(d: AppData): { root: RootDoc; days: Record<ISODate, DayDoc> } {
  const { meals, workouts, weights, wearable, billing: _billing, ...root } = d;
  const days: Record<ISODate, DayDoc> = {};
  const day = (date: ISODate) => (days[date] ??= { meals: [], workouts: [], weight: null, wearable: null });
  meals.forEach((m) => day(m.date).meals.push(m));
  workouts.forEach((w) => day(w.date).workouts.push(w));
  weights.forEach((w) => { day(w.date).weight = w.kg; });
  wearable.forEach((w) => { day(w.date).wearable = w; });
  return { root: plain(root), days: plain(days) };
}

export function joinData(root: RootDoc, days: Record<ISODate, DayDoc>): AppData {
  const dates = Object.keys(days).sort();
  return {
    ...root,
    billing: null,
    meals: dates.flatMap((d) => days[d].meals ?? []),
    workouts: dates.flatMap((d) => days[d].workouts ?? []),
    weights: dates.filter((d) => days[d].weight != null).map((d) => ({ date: d, kg: days[d].weight as number })),
    wearable: dates.map((d) => days[d].wearable).filter((w): w is WearableDay => !!w),
  };
}

/** What changed since the last save: day docs to write, day docs to delete, and whether the root changed. */
export function diffForSave(next: { root: RootDoc; days: Record<ISODate, DayDoc> }, last: Snapshot | null) {
  const rootJson = JSON.stringify(next.root);
  const dayJson = Object.fromEntries(Object.entries(next.days).map(([k, v]) => [k, JSON.stringify(v)]));
  const write = Object.keys(dayJson).filter((k) => last?.days[k] !== dayJson[k]);
  const remove = last ? Object.keys(last.days).filter((k) => !(k in dayJson)) : [];
  return { rootChanged: last?.root !== rootJson, write, remove, snapshot: { root: rootJson, days: dayJson } as Snapshot };
}
export interface Snapshot { root: string; days: Record<string, string> }

