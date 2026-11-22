import type { AppData, ChangeAction, ISODate, PlanChange, WeeklyReport } from './types.js';
import { addDays, parse, weekStart as mondayOf } from './clock.js';
import { findings } from '../state/analytics.js';
import { liftSummary, MAIN_LIFTS, periodSummary } from '../state/insights.js';
import { weightAvg7 } from '../state/selectors.js';
import { MUSCLE } from '../state/analytics.js';

/**
 * Weekly report (S17.1). Built from the week's logs: a headline, up to three causes, and up to three
 * changes the user can accept in one click. Accepting applies the change (applyChange); skipping an
 * accepted change undoes it. The same builder runs in the app and in the Sunday server job.
 */

export const DRAFT_HOUR = 18;   // Sunday 6 PM: draft built
export const PUBLISH_HOUR = 19; // Sunday 7 PM: published (after coach approval)

/** The Monday of the week a report covers at `now`: this week from Sunday 6 PM, otherwise last week. */
export function reportWeekFor(now: Date): ISODate | null {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = iso(now);
  const isSunday = now.getDay() === 0;
  if (isSunday && now.getHours() >= DRAFT_HOUR) return mondayOf(today);
  return addDays(mondayOf(today), -7);
}
export function publishTime(weekStart: ISODate): Date { const d = parse(addDays(weekStart, 6)); d.setHours(PUBLISH_HOUR, 0, 0, 0); return d; }

const TAG: Record<string, string> = { weekday: 'Food', protein: 'Protein', sleep: 'Sleep', volume: 'Volume' };

export function buildReport(d: AppData, weekStart: ISODate, opts: { now?: Date; free?: boolean } = {}): WeeklyReport {
  const end = addDays(weekStart, 6);
  const f = findings(d, end, 14);
  const sum = periodSummary(d, end, 7);
  const changes: PlanChange[] = [];
  const add = (title: string, detail: string, action?: ChangeAction) => { if (changes.length < 3) changes.push({ id: `c${changes.length + 1}`, title, detail, status: 'pending', action }); };

  const stalled = MAIN_LIFTS.map((n) => liftSummary(d.workouts, n, end, 28)).find((l) => l?.stalled);
  if (stalled) add(`+1 set on ${stalled.name.toLowerCase()}`, `${stalled.flatWeeks} weeks at ${stalled.top.kg} kg; one more working set from next session`, { kind: 'sets', exercise: stalled.name, delta: 1 });
  const lowVol = f.find((x) => x.id === 'volume');
  if (!stalled && lowVol) {
    const muscle = lowVol.title.split(' ')[0];
    const ex = Object.entries(MUSCLE).find(([, m]) => m === muscle)?.[0];
    if (ex) add(`+1 set on ${ex.toLowerCase()}`, `${muscle} is below 10 hard sets a week`, { kind: 'sets', exercise: ex, delta: 1 });
  }
  if (f.some((x) => x.id === 'sleep')) add('Wind-down reminder at 11 PM', 'On the night before training days, so you get 7 hours', { kind: 'windDown', time: '23:00' });

  const wNow = weightAvg7(d, end), wThen = weightAvg7(d, addDays(end, -14));
  const goal = d.profile.goal;
  if (wNow !== null && wThen !== null) {
    const change = Math.round((wNow - wThen) * 10) / 10;
    if ((goal === 'lose' || goal === 'recomp') && change > -0.2) add('−150 kcal on rest days and training days', `Weight moved ${change >= 0 ? '+' : ''}${change} kg in 2 weeks; a small cut restarts the trend`, { kind: 'kcal', delta: -150 });
    if (goal === 'gain' && change < 0.1) add('+150 kcal on training days', `Weight moved ${change} kg in 2 weeks; you need a little more to grow`, { kind: 'kcal', delta: 150 });
    if (goal === 'plateau' && stalled && sum.kcalIn.now !== null && sum.kcalIn.now < d.targets.kcalTraining - 100) add('+150 kcal on training days', 'Training-day calories ran under target while the lift stalled', { kind: 'kcal', delta: 150 });
  }
  if (f.some((x) => x.id === 'protein')) add('Protein at breakfast', 'Add eggs, paneer, curd or whey to breakfast; it fixes most short days');
  if (f.some((x) => x.id === 'weekday')) add('One meal out at the weekend', 'Log it before you order; pick from Eating out for the best options');

  const headline = f.length
    ? f.slice(0, 2).map((x, i) => (i === 0 ? x.title : x.title.charAt(0).toLowerCase() + x.title.slice(1))).join(', and ') + '.'
    : 'A steady week: nothing stood out. Keep logging and the next report gets sharper.';

  return {
    id: `rep-${weekStart}`, weekStart, headline,
    causes: f.map((x) => ({ title: x.title, detail: x.detail, tag: TAG[x.id] ?? 'Trend' })),
    changes, free: !!opts.free, status: 'draft', builtAt: (opts.now ?? new Date()).toISOString(),
    stats: {
      kcal: Math.round(sum.kcalIn.now ?? 0), protein: Math.round(sum.protein.now ?? 0), daysLogged: sum.daysLogged,
      sessions: d.workouts.filter((w) => w.date >= weekStart && w.date <= end && w.done).length,
      sleep: Math.round((sum.sleep.now ?? 0) * 10) / 10, weightChange: wNow !== null && wThen !== null ? Math.round((wNow - wThen) * 10) / 10 : 0,
    },
  };
}

/** Apply (sign = 1) or undo (sign = −1) a change's effect on the plan. */
export function applyChange(d: AppData, a: ChangeAction | undefined, sign: 1 | -1): AppData {
  if (!a) return d;
  switch (a.kind) {
    case 'kcal': return { ...d, targets: { ...d.targets, kcalTraining: d.targets.kcalTraining + sign * a.delta, kcalRest: d.targets.kcalRest + sign * a.delta } };
    case 'protein': return { ...d, targets: { ...d.targets, protein: d.targets.protein + sign * a.delta } };
    case 'steps': return sign > 0 ? { ...d, targets: { ...d.targets, steps: a.target } } : d;
    case 'windDown': return { ...d, reminders: { ...d.reminders, windDown: sign > 0 ? a.time : null } };
    case 'sets': {
      const cur = d.trainingOverrides[a.exercise] ?? 0;
      const next = Math.max(0, cur + sign * a.delta);
      const o = { ...d.trainingOverrides, [a.exercise]: next };
      if (!next) delete o[a.exercise];
      return { ...d, trainingOverrides: o };
    }
  }
}

/** Advance a local report through its day: draft from 6 PM, published from 7 PM once approved (or auto when no coach is configured). */
export function advance(r: WeeklyReport, now: Date, autoApprove: boolean): WeeklyReport {
  if (r.status === 'published') return r;
  const due = now >= publishTime(r.weekStart);
  const approved = r.status === 'approved' || (autoApprove && due);
  if (approved && due) { const pt = publishTime(r.weekStart); return { ...r, status: 'published', approvedBy: r.approvedBy ?? 'PeakX checks', publishedAt: (now > pt ? pt : now).toISOString() }; }
  return approved && r.status !== 'approved' ? { ...r, status: 'approved', approvedBy: r.approvedBy ?? 'PeakX checks' } : r;
}
