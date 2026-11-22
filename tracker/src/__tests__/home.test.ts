import { describe, expect, it } from 'vitest';
import { makeFresh, makeSeed } from '../domain/seed';
import { today, addDays, weekStart } from '../domain/clock';
import { latestFormReview, loggedDays, nextPlannedMeal, plateauSummary, weekVolumeSummary } from '../state/selectors';
import { PLATEAU_QUESTIONS } from '../domain/plateau';
import type { AppData } from '../domain/types';

const t = today();

describe('Home selectors (redesign step 4)', () => {
  it('reports no volume and nothing to compare for a new account', () => {
    const v = weekVolumeSummary(makeFresh(), t);
    expect(v.total).toBe(0);
    expect(v.change).toBeNull();
    expect(v.days).toHaveLength(7);
  });
  it('compares this week’s volume with the same days last week', () => {
    const d = makeSeed();
    const v = weekVolumeSummary(d, t);
    expect(v.total).toBe(v.days.reduce((s, x) => s + x.kg, 0));
    if (v.last > 0) expect(v.change).toBe(Math.round(((v.total - v.last) / v.last) * 100));
  });
  it('marks logged days only inside the week', () => {
    const d = { ...makeFresh(), weights: [{ date: weekStart(t), kg: 70 }, { date: addDays(weekStart(t), -1), kg: 71 }] } as AppData;
    const s = loggedDays(d, t);
    expect(s.has(weekStart(t))).toBe(true);
    expect(s.has(addDays(weekStart(t), -1))).toBe(false);
    expect(loggedDays(makeFresh(), t).size).toBe(0);
  });
  it('has no plateau result until the check is complete', () => {
    expect(plateauSummary(makeFresh())).toMatchObject({ done: false, top: null, headline: null });
    const answers = Object.fromEntries(PLATEAU_QUESTIONS.map((q) => [q.id, q.options[0].id]));
    const s = plateauSummary({ plateau: { answers, step: 8, completedOn: t } });
    expect(s.done).toBe(true);
    expect(s.headline).toBeTruthy();
  });
  it('finds the latest reviewed form check, or none', () => {
    expect(latestFormReview(makeFresh())).toBeNull();
    expect(latestFormReview(makeSeed())?.exercise).toBe('Back squat');
  });
  it('returns the next unlogged planned meal, or null without a plan', () => {
    expect(nextPlannedMeal(makeFresh(), t, 12)).toBeNull();
    const d = makeSeed();
    const day = { date: t, meals: [
      { slot: 'lunch' as const, name: 'Rajma chawal', items: [], logged: false },
      { slot: 'dinner' as const, name: 'Paneer bhurji', items: [] },
    ] };
    const withPlan = { ...d, meals: d.meals.filter((m) => m.date !== t), mealPlan: { weekStart: weekStart(t), days: [day], createdAt: t } } as AppData;
    expect(nextPlannedMeal(withPlan, t, 20)?.name).toBe('Paneer bhurji');
    expect(nextPlannedMeal(withPlan, t, 12)?.name).toBe('Rajma chawal');
    expect(nextPlannedMeal({ ...withPlan, mealPlan: { ...withPlan.mealPlan!, days: [{ ...day, meals: day.meals.map((m) => ({ ...m, logged: true })) }] } }, t, 12)).toBeNull();
  });
});

describe('wearable series', () => {
  it('lines up synced days and leaves gaps as null', async () => {
    const { wearableSeries } = await import('../state/selectors');
    const day = (date: string, steps: number) => ({ date, steps, sleepHours: 7, restingHr: 60, activeMinutes: 30, kcalBurned: 0, source: 'demo' as const });
    expect(wearableSeries({ wearable: [day(addDays(t, -2), 5000), day(t, 8000)] }, t, 'steps', 3)).toEqual([5000, null, 8000]);
    expect(wearableSeries({ wearable: [] }, t, 'steps', 2)).toEqual([null, null]);
  });
});

describe('after this meal (redesign step 5)', () => {
  it('adds the pending meal to the day and picks a tip', async () => {
    const { afterMeal, remaining } = await import('../state/selectors');
    const d = makeFresh();
    const base = remaining(d, t);
    const a = afterMeal(d, t, { kcal: 600, protein: 24 });
    expect(a.left).toBe(base.left - 600);
    expect(a.protein).toBe(24);
    expect(a.gap).toBe(d.targets.protein - 24);
    expect(a.tip).toMatch(/protein to go/);
    expect(afterMeal(d, t, { kcal: base.left + 100, protein: 0 }).tip).toMatch(/100 kcal over/);
    expect(afterMeal(d, t, { kcal: 100, protein: d.targets.protein }).tip).toMatch(/Protein is done/);
    expect(afterMeal(d, t).left).toBe(base.left);
  });
});

describe('plan selectors (redesign step 6)', () => {
  it('lays out seven days with targets and statuses', async () => {
    const { weekPlanDays } = await import('../state/selectors');
    const days = weekPlanDays(makeFresh(), t);
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe(weekStart(t));
    expect(days.find((x) => x.date === t)?.status).toBe('today');
    expect(days.filter((x) => x.date < t).every((x) => x.status === 'missed')).toBe(true);
    expect(days.every((x) => x.target > 0)).toBe(true);
  });
  it('compares each exercise with its last session', async () => {
    const { workoutDetail } = await import('../state/selectors');
    const d = makeSeed();
    const day = Array.from({ length: 7 }, (_, i) => addDays(t, i)).find((x) => workoutDetail(d, x));
    const w = workoutDetail(d, day!)!;
    expect(w.exercises.length).toBeGreaterThan(0);
    const withLast = w.exercises.find((e) => e.last);
    if (withLast) expect(withLast.change).toBe(Math.round(((withLast.targetKg ?? 0) - withLast.last!.kg) * 10) / 10);
  });
  it('says nothing about recovery without a sync', async () => {
    const { recoveryNote } = await import('../state/selectors');
    const d = makeFresh();
    expect(recoveryNote(d, t)).toBeNull();
    const day = { date: t, steps: 0, sleepHours: d.targets.sleepHours - 2, restingHr: 60, activeMinutes: 0, kcalBurned: 0, source: 'demo' as const };
    expect(recoveryNote({ ...d, wearable: [day] }, t)).toMatch(/Short night/);
    expect(recoveryNote({ ...d, wearable: [{ ...day, sleepHours: d.targets.sleepHours }] }, t)).toMatch(/Well rested/);
  });
});

describe('report figures', () => {
  it('shows nothing logged as null, not zero', async () => {
    const { reportFigures } = await import('../state/selectors');
    const empty = reportFigures({ stats: { kcal: 0, protein: 0, daysLogged: 0, sessions: 0, sleep: 0, weightChange: 0 } });
    expect(empty.logged).toBe(false);
    expect(empty.figures.every((f) => f.value === null)).toBe(true);
    const some = reportFigures({ stats: { kcal: 1900, protein: 120, daysLogged: 3, sessions: 1, sleep: 0, weightChange: -0.4 } });
    expect(some.logged).toBe(true);
    expect(some.figures.find((f) => f.key === 'kcal')?.value).toBe(1900);
    expect(some.figures.find((f) => f.key === 'sessions')?.unit).toBe('session');
    expect(some.figures.find((f) => f.key === 'sleep')?.value).toBeNull();
    expect(reportFigures({}).logged).toBe(false);
  });
});
