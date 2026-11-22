import type { AppData, ISODate, Macros, Meal, MealSlot, PlannedMeal, WeeklyReport, WeightEntry } from '../domain/types.js';
import { rounded, sumItems, ZERO, add } from '../domain/nutrition.js';
import { addDays, parse, today, weekStart } from '../domain/clock.js';
import { planDay, sessionFor, lastPerformance, targetSets, targetReps } from '../domain/training.js';
import { headline as plateauHeadline, isComplete, rankCauses } from '../domain/plateau.js';

export const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snacks', 'dinner'];
export const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snacks: 'Snacks', dinner: 'Dinner' };

export function mealsOn(d: AppData, date: ISODate): Meal[] {
  return d.meals.filter((m) => m.date === date).sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
}
export function mealTotal(m: Meal): Macros { return rounded(sumItems(m.items)); }
export function dayTotals(d: AppData, date: ISODate): Macros {
  return rounded(mealsOn(d, date).reduce((s, m) => add(s, sumItems(m.items)), ZERO));
}
/** Training day = a session was logged that day, or the plan has one (unlogged days in the past count as rest). */
export function isTrainingDay(d: AppData, date: ISODate): boolean {
  if (d.workouts.some((w) => w.date === date) || (d.runs ?? []).some((r) => r.date === date)) return true;
  return date >= today() && planDay(d.profile, date).training;
}

/** Calorie target for a date: training or rest target, plus up to 200 kcal from steps above goal. */
export function kcalTarget(d: AppData, date: ISODate): { base: number; stepBonus: number; total: number } {
  const base = isTrainingDay(d, date) ? d.targets.kcalTraining : d.targets.kcalRest;
  const w = d.wearable.find((x) => x.date === date);
  const stepBonus = d.devices.google && w ? Math.min(200, Math.max(0, Math.round((w.steps - 5000) * 0.04 / 10) * 10)) : 0;
  return { base, stepBonus, total: base + stepBonus };
}
export function remaining(d: AppData, date: ISODate) {
  const t = kcalTarget(d, date); const eaten = dayTotals(d, date);
  return { target: t, eaten, left: t.total - eaten.kcal };
}

/** Most recent weigh-in, or undefined for a new account. */
export function latestWeight(d: AppData): WeightEntry | undefined { return d.weights[d.weights.length - 1]; }
export function weightChangeSince(d: AppData, date: ISODate): number {
  const last = latestWeight(d);
  if (!last) return 0;
  const before = [...d.weights].filter((w) => w.date <= date).pop() ?? d.weights[0];
  return Math.round((last.kg - before.kg) * 10) / 10;
}
export function wearableOn(d: AppData, date: ISODate) { return d.wearable.find((w) => w.date === date); }
export function sessionOn(d: AppData, date: ISODate) { return d.workouts.find((w) => w.date === date); }

/** Training volume (kg × reps) per day for the week containing date. */
export function weekVolume(d: AppData, date: ISODate): { date: ISODate; kg: number }[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i);
    const kg = d.workouts.filter((w) => w.date === day).flatMap((w) => w.exercises.flatMap((e) => e.sets)).reduce((s, x) => s + x.kg * x.reps, 0);
    return { date: day, kg };
  });
}
export function weekday(date: ISODate) { return parse(date).getDay(); }

/** Most recent distinct items the user logged (newest first), for one-tap re-logging. */
export function recentItems(d: AppData, limit = 8) {
  const seen = new Set<string>();
  const out: import('../domain/types.js').MealItem[] = [];
  const meals = [...d.meals].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  for (const m of meals) for (const it of m.items) {
    const key = `${it.name}|${it.amount}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(it);
    if (out.length >= limit) return out;
  }
  return out;
}

/** Which meal a new entry belongs to, from the hour (today) — other days default to lunch. */
export function slotFor(hour: number): MealSlot {
  return hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 19 ? 'snacks' : 'dinner';
}

/** 7-day average weight ending on `date`: mean of entries in [date−6, date]; null when there are none. */
export function weightAvg7(d: Pick<AppData, 'weights'>, date: ISODate): number | null {
  const from = addDays(date, -6);
  const xs = d.weights.filter((w) => w.date >= from && w.date <= date).map((w) => w.kg);
  return xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null;
}

/**
 * Weight trend for the card on This week: latest entry, 7-day average, and the change in the
 * 7-day average since the 1st of the month (falls back to the first entry this month).
 */
export function weightTrend(d: Pick<AppData, 'weights' | 'profile'>, date: ISODate) {
  const latest = [...d.weights].filter((w) => w.date <= date).pop() ?? null;
  const avg = weightAvg7(d, date);
  const first = date.slice(0, 8) + '01';
  const startAvg = weightAvg7(d, first) ?? d.weights.find((w) => w.date >= first && w.date <= date)?.kg ?? null;
  const change = avg !== null && startAvg !== null ? Math.round((avg - startAvg) * 10) / 10 : 0;
  const wantDown = d.profile.goal !== 'gain';
  const status: 'good' | 'steady' | 'off' = Math.abs(change) < 0.3 ? 'steady' : (change < 0) === wantDown ? 'good' : 'off';
  return { latest, avg, change, status, since: first };
}

/** Daily points for a weight chart: the entry (if any) and the 7-day average, for `days` days ending on `date`. */
export function weightSeries(d: Pick<AppData, 'weights'>, date: ISODate, days = 28) {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(date, i - days + 1);
    return { date: day, kg: d.weights.find((w) => w.date === day)?.kg ?? null, avg: weightAvg7(d, day) };
  });
}

/** Training volume this week so far against the same days last week (Home's volume card). `change` is null with nothing to compare. */
export function weekVolumeSummary(d: AppData, date: ISODate) {
  const days = weekVolume(d, date);
  const total = days.reduce((x, v) => x + v.kg, 0);
  const soFar = days.filter((v) => v.date <= date).length;
  const last = weekVolume(d, addDays(date, -7)).slice(0, soFar).reduce((x, v) => x + v.kg, 0);
  return { days, total, last, change: last > 0 ? Math.round(((total - last) / last) * 100) : null };
}

/** Days in the week containing `date` with a meal, workout or weigh-in logged (WeekStrip dots). */
export function loggedDays(d: AppData, date: ISODate): Set<ISODate> {
  const start = weekStart(date), end = addDays(start, 6);
  const inWeek = (x: ISODate) => x >= start && x <= end;
  return new Set([...d.meals.map((m) => m.date), ...d.workouts.map((w) => w.date), ...d.weights.map((w) => w.date)].filter(inWeek));
}

/** Plateau check result for Home: the top cause and its level, or not taken yet. */
export function plateauSummary(d: Pick<AppData, 'plateau'>) {
  const done = !!d.plateau.completedOn && isComplete(d.plateau.answers);
  const top = done ? rankCauses(d.plateau.answers)[0] ?? null : null;
  return { done, completedOn: d.plateau.completedOn ?? null, top, headline: done ? plateauHeadline(d.plateau.answers) : null };
}

/** Most recent Form Check a coach has reviewed, or null. */
export function latestFormReview(d: Pick<AppData, 'formChecks'>) {
  return [...d.formChecks].filter((c) => c.status === 'reviewed' && c.review).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0] ?? null;
}

/**
 * The next meal on today's meal plan that isn't logged yet, from the current meal slot on.
 * Null without a plan for the day or when every remaining meal is logged. `macrosOf` comes from the
 * caller (mealMacros with the recipe library) so this file stays free of the recipe data the server doesn't load.
 */
export function nextPlannedMeal(d: AppData, date: ISODate, hour: number, macrosOf: (m: PlannedMeal) => Macros = () => ZERO) {
  const day = d.mealPlan?.days.find((x) => x.date === date);
  if (!day) return null;
  const eaten = new Set(mealsOn(d, date).map((m) => m.slot));
  const from = date === today() ? SLOTS.indexOf(slotFor(hour)) : 0;
  const meal = SLOTS.slice(from).map((s) => day.meals.find((m) => m.slot === s)).find((m) => m && !m.logged && !eaten.has(m.slot));
  return meal ? { ...meal, macros: rounded(macrosOf(meal)) } : null;
}

/** One wearable field for the `days` days ending on `date`; null where nothing synced. */
export function wearableSeries(d: Pick<AppData, 'wearable'>, date: ISODate, field: 'steps' | 'sleepHours' | 'restingHr' | 'activeMinutes', days = 7): (number | null)[] {
  return Array.from({ length: days }, (_, i) => d.wearable.find((w) => w.date === addDays(date, i - days + 1))?.[field] ?? null);
}

/**
 * Where the day stands once a pending meal (not yet logged) is added: calories left, protein against the
 * target, and one plain tip for the rest of the day. With nothing pending it is the day as logged.
 */
export function afterMeal(d: AppData, date: ISODate, pending: { kcal: number; protein: number } = { kcal: 0, protein: 0 }) {
  const r = remaining(d, date);
  const left = r.left - pending.kcal;
  const protein = Math.round(r.eaten.protein + pending.protein);
  const proteinTarget = d.targets.protein;
  const gap = Math.max(0, proteinTarget - protein);
  const tip = left < 0
    ? `That puts you ${Math.round(-left)} kcal over. A 30-minute walk tonight and a lighter breakfast tomorrow even it out.`
    : gap >= 25 && left >= 250
      ? `Still ${gap} g of protein to go. 150 g of paneer or a katori of curd with roasted chana covers most of it.`
      : gap >= 10
        ? `A glass of milk or a katori of curd later closes the last ${gap} g of protein.`
        : gap === 0
          ? 'Protein is done for today. If you’re hungry later, keep it light: fruit or a cup of milk.'
          : 'You’re on track. Keep the rest of the day light.';
  return { target: r.target.total, left, protein, proteinTarget, gap, tip };
}

/**
 * The seven days of the week containing `date` for the Plan strip: session name (or rest), calorie target,
 * calories eaten and a status. Past days count as done when anything was logged.
 */
export function weekPlanDays(d: AppData, date: ISODate) {
  const t = today();
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart(date), i);
    const s = sessionFor(d.workouts, d.profile, day, undefined, d.trainingOverrides, d.fixPlans);
    const p = planDay(d.profile, day);
    const ran = (d.runs ?? []).filter((r) => r.date === day);
    const target = kcalTarget(d, day).total;
    const eaten = dayTotals(d, day).kcal;
    const logged = eaten > 0 || d.workouts.some((w) => w.date === day && w.done) || ran.length > 0;
    const status: 'done' | 'missed' | 'today' | 'planned' = day === t ? 'today' : day > t ? 'planned' : logged ? 'done' : 'missed';
    const label = s ? s.session.name : p.run ? p.label : ran.length ? 'Run' : 'Rest day';
    return { date: day, label, training: !!s || p.run || ran.length > 0, run: !s && (p.run || ran.length > 0), target, eaten, status };
  });
}

/** A day's workout with each exercise's target next to the best set from the last time it was done. Null on rest days. */
export function workoutDetail(d: AppData, date: ISODate) {
  const s = sessionFor(d.workouts, d.profile, date, undefined, d.trainingOverrides, d.fixPlans);
  if (!s) return null;
  const exercises = s.session.exercises.map((e) => {
    const last = lastPerformance(d.workouts, e.name, date);
    const top = last ? [...last.log.sets].sort((a, b) => b.kg - a.kg || b.reps - a.reps)[0] : null;
    return {
      ...e, sets: e.sets, plannedSets: targetSets(e), reps: targetReps(e),
      last: top && last ? { date: last.date, kg: top.kg, reps: top.reps } : null,
      change: top && e.targetKg != null ? Math.round((e.targetKg - top.kg) * 10) / 10 : null,
    };
  });
  return { ...s, exercises };
}

/** One line on recovery from last night's sleep against the target; null with nothing synced. */
export function recoveryNote(d: Pick<AppData, 'wearable' | 'targets'>, date: ISODate): string | null {
  const w = d.wearable.find((x) => x.date === date);
  if (!w) return null;
  if (w.sleepHours < d.targets.sleepHours - 1) return 'Short night. Keep today’s weights where they are and skip any extra sets.';
  if (w.sleepHours < d.targets.sleepHours) return 'A little under your sleep target. Warm up well and see how the first set feels.';
  return 'Well rested. If the warm-up feels good, go for today’s target on the main lift.';
}

/**
 * A weekly report's numbers for display. Anything not logged is null (shown as a short empty line, never 0),
 * and `logged` says whether the week has any data at all.
 */
export function reportFigures(r: Pick<WeeklyReport, 'stats'>) {
  const s = r.stats ?? {};
  const days = s.daysLogged ?? 0;
  const figures = [
    { key: 'kcal', label: 'Calories a day', value: days ? s.kcal ?? null : null, unit: 'kcal', dp: 0, empty: 'No meals logged' },
    { key: 'protein', label: 'Protein a day', value: days ? s.protein ?? null : null, unit: 'g', dp: 0, empty: 'No meals logged' },
    { key: 'sessions', label: 'Workouts', value: s.sessions ? s.sessions : null, unit: s.sessions === 1 ? 'session' : 'sessions', dp: 0, empty: 'None logged' },
    { key: 'sleep', label: 'Sleep a night', value: s.sleep ? s.sleep : null, unit: 'h', dp: 1, empty: 'No watch data' },
    { key: 'weight', label: 'Weight, 2 weeks', value: s.weightChange ? s.weightChange : null, unit: 'kg', dp: 1, empty: 'No change yet' },
  ];
  return { figures, days, logged: figures.some((f) => f.value !== null) };
}
