import type { AppData, ISODate } from '../domain/types.js';
import { addDays, parse, today } from '../domain/clock.js';
import { dailySeries, mean } from './insights.js';
import { targetReps, targetSets } from '../domain/training.js';

/**
 * Detailed analytics (S16.2, Pro). Pure calculations over the user's logs, plus three findings
 * written from the numbers. An AI step may reword findings but never adds numbers (see api/_lib/ai/findings.ts).
 */

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const wdIndex = (d: ISODate) => (parse(d).getDay() + 6) % 7;

/** Today is still being logged, so averages and counts use finished days only. */
const finished = <T extends { date: ISODate }>(xs: T[], now: ISODate) => xs.filter((x) => x.date < now);

export function caloriesByWeekday(d: AppData, end: ISODate, days: number, now: ISODate = today()) {
  const s = finished(dailySeries(d, end, days), now);
  return WD.map((label, i) => {
    const xs = s.filter((x) => wdIndex(x.date) === i);
    const kcal = mean(xs.map((x) => x.kcalIn));
    const target = mean(xs.map((x) => x.target));
    return { label, kcal: kcal === null ? null : Math.round(kcal), target: target === null ? 0 : Math.round(target) };
  });
}

export function proteinByDay(d: AppData, end: ISODate, days: number) {
  return dailySeries(d, end, days).map((x) => ({ date: x.date, protein: x.protein }));
}

/** Sleep the night before each session with this lift, against how much of the target work was done. */
export function sleepVsLift(d: AppData, lift: string, end: ISODate, days: number) {
  const from = addDays(end, -days + 1);
  return d.workouts.filter((w) => w.date >= from && w.date <= end && w.done).flatMap((w) => {
    const e = w.exercises.find((x) => x.name === lift);
    const sleep = d.wearable.find((x) => x.date === w.date)?.sleepHours;
    if (!e || !e.sets.length || sleep === undefined) return [];
    const done = e.sets.reduce((s, x) => s + x.reps, 0);
    const planned = targetSets(e) * targetReps(e);
    return [{ date: w.date, sleep, completion: Math.round((done / planned) * 100), kg: Math.max(...e.sets.map((x) => x.kg)) }];
  });
}
export function sleepBuckets(pairs: ReturnType<typeof sleepVsLift>) {
  const b = [
    { label: 'Under 6 h', test: (h: number) => h < 6 },
    { label: '6 to 7 h', test: (h: number) => h >= 6 && h < 7 },
    { label: '7 h or more', test: (h: number) => h >= 7 },
  ];
  return b.map(({ label, test }) => {
    const xs = pairs.filter((p) => test(p.sleep));
    return { label, sessions: xs.length, completion: xs.length ? Math.round(xs.reduce((s, p) => s + p.completion, 0) / xs.length) : null };
  });
}

export const MUSCLE: Record<string, string> = {
  'Bench press': 'Chest', 'Incline DB press': 'Chest', 'Lat pulldown': 'Back', 'Seated cable row': 'Back', 'Deadlift': 'Back',
  'Back squat': 'Quads', 'Leg press': 'Quads', 'Walking lunge': 'Quads', 'Romanian deadlift': 'Hamstrings', 'Leg curl': 'Hamstrings',
  'Calf raise': 'Calves', 'Seated DB shoulder press': 'Shoulders', 'Lateral raise': 'Shoulders', 'Face pull': 'Shoulders',
  'Face pull + curl superset': 'Arms', 'Cable triceps pushdown': 'Arms', 'DB curl': 'Arms',
};
export const SETS_RANGE: [number, number] = [10, 20];

/** Hard sets per muscle per week, averaged over the window. */
export function setsPerMuscle(d: AppData, end: ISODate, days: number) {
  const from = addDays(end, -days + 1);
  const weeks = days / 7;
  const totals = new Map<string, number>();
  for (const w of d.workouts) if (w.date >= from && w.date <= end) for (const e of w.exercises) {
    const m = MUSCLE[e.name] ?? 'Other';
    totals.set(m, (totals.get(m) ?? 0) + e.sets.length);
  }
  const order = ['Chest', 'Back', 'Shoulders', 'Arms', 'Quads', 'Hamstrings', 'Calves'];
  return order.map((m) => ({ muscle: m, perWeek: Math.round(((totals.get(m) ?? 0) / weeks) * 10) / 10 }));
}

export interface Finding { id: string; title: string; detail: string; score: number; numbers: number[] }

/** Up to three findings, most important first. Every number in them comes from the calculations above. */
export function findings(d: AppData, end: ISODate, days: number, lift = 'Bench press', now: ISODate = today()): Finding[] {
  const out: Finding[] = [];
  const wd = caloriesByWeekday(d, end, days, now).filter((x) => x.kcal !== null);
  const over = wd.filter((x) => x.kcal! - x.target > 150);
  if (over.length) {
    const avgOver = Math.round(over.reduce((s, x) => s + (x.kcal! - x.target), 0) / over.length);
    const weekly = over.reduce((s, x) => s + (x.kcal! - x.target), 0);
    out.push({ id: 'weekday', title: `${over.map((x) => x.label).join(' and ')} run ${avgOver} kcal over target`, detail: `That adds about ${weekly} kcal a week, enough to cancel most of a weekday deficit.`, score: weekly / 100, numbers: [avgOver, weekly] });
  }
  const p = finished(proteinByDay(d, end, days), now).filter((x) => x.protein !== null);
  const under = p.filter((x) => x.protein! < d.targets.protein * 0.9);
  if (under.length >= 3) {
    const low = Math.round(mean(under.map((x) => x.protein))!);
    out.push({ id: 'protein', title: `Protein fell short on ${under.length} of ${p.length} days`, detail: `On those days you averaged ${low} g against a ${d.targets.protein} g target.`, score: (under.length / Math.max(1, p.length)) * 12, numbers: [under.length, p.length, low, d.targets.protein] });
  }
  const buckets = sleepBuckets(sleepVsLift(d, lift, end, days));
  const shortB = buckets[0], longB = buckets[2];
  const pairs = sleepVsLift(d, lift, end, days);
  const shortNights = pairs.filter((x) => x.sleep < 6).length;
  if (shortNights >= 2) {
    const diff = shortB.completion !== null && longB.completion !== null ? longB.completion - shortB.completion : null;
    out.push({ id: 'sleep', title: `You slept under 6 h before ${shortNights} of ${pairs.length} ${lift.toLowerCase()} sessions`, detail: diff !== null && diff > 0 ? `You finished ${shortB.completion}% of planned reps after short nights and ${longB.completion}% after 7 h or more.` : 'Sleep under 6 h slows recovery between hard sessions, even when the reps look the same.', score: (shortNights / Math.max(1, pairs.length)) * 10 + (diff ?? 0) / 5, numbers: [shortNights, pairs.length, 6, 7, ...(diff !== null && diff > 0 ? [shortB.completion!, longB.completion!] : [])] });
  }
  const low = setsPerMuscle(d, end, days).filter((m) => m.perWeek > 0 && m.perWeek < SETS_RANGE[0]);
  if (low.length) {
    const worst = low.sort((a, b) => a.perWeek - b.perWeek)[0];
    out.push({ id: 'volume', title: `${worst.muscle} ${/s$/.test(worst.muscle) ? "get" : "gets"} ${worst.perWeek} hard sets a week`, detail: `Most people grow with ${SETS_RANGE[0]}–${SETS_RANGE[1]} sets a muscle a week.`, score: (SETS_RANGE[0] - worst.perWeek) / 2, numbers: [worst.perWeek, SETS_RANGE[0], SETS_RANGE[1]] });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}

/** True when every number in `text` appears in `allowed` (used to vet AI rewording). */
export function numbersOnlyFrom(text: string, allowed: number[]): boolean {
  const ok = new Set(allowed.flatMap((n) => [String(n), n.toLocaleString('en-IN'), String(Math.round(n))]));
  return (text.match(/\d[\d,]*(\.\d+)?/g) ?? []).every((m) => ok.has(m) || ok.has(m.replace(/,/g, '')));
}
