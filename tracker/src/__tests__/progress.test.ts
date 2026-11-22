import { describe, expect, it } from 'vitest';
import { makeSeed } from '../domain/seed';
import { weightAvg7, weightSeries, weightTrend } from '../state/selectors';
import { TEMPLATES, buildSession, isPR, lastPerformance, nextTarget, planWeek, sessionFor, sessionVolume } from '../domain/training';
import { reducer } from '../state/store';
import { dailySeries, liftSeries, liftSummary, mean, pctChange, periodSummary } from '../state/insights';
import { SPORTS, matchDayMeals, matchDayTargets, nextMatch, phaseFor, programWeek, programWeekNo } from '../domain/sport';
import { today, addDays, weekStart } from '../domain/clock';

const W = (pairs: [string, number][]) => ({ weights: pairs.map(([date, kg]) => ({ date, kg })), profile: { ...makeSeed().profile, goal: 'lose' as const } });

describe('weight trend (S12.1)', () => {
  it('averages the entries in the 7 days ending on a date', () => {
    const d = W([['2026-10-01', 74], ['2026-10-05', 73], ['2026-10-07', 72], ['2026-10-08', 71]]);
    expect(weightAvg7(d, '2026-10-07')).toBe(73);       // 1st, 5th, 7th
    expect(weightAvg7(d, '2026-10-08')).toBe(72);       // 5th, 7th, 8th (1st falls out)
    expect(weightAvg7(d, '2026-09-20')).toBeNull();
  });
  it('reports the change in the average since the 1st and judges it against the goal', () => {
    const d = W([['2026-09-28', 75], ['2026-10-01', 74.6], ['2026-10-10', 73.4], ['2026-10-12', 73.2]]);
    const t = weightTrend(d, '2026-10-12');
    expect(t.latest?.kg).toBe(73.2);
    expect(t.avg).toBe(73.3);
    expect(t.change).toBe(-1.5);                         // 74.8 on the 1st → 73.3
    expect(t.status).toBe('good');
    expect(weightTrend({ ...d, profile: { ...d.profile, goal: 'gain' } }, '2026-10-12').status).toBe('off');
  });
  it('calls small moves steady and copes with no data', () => {
    expect(weightTrend(W([['2026-10-01', 70], ['2026-10-09', 70.2]]), '2026-10-09').status).toBe('steady');
    const none = weightTrend(W([]), '2026-10-09');
    expect(none).toMatchObject({ latest: null, avg: null, change: 0 });
  });
  it('builds one point per day for the chart', () => {
    const s = weightSeries(W([['2026-10-09', 70]]), '2026-10-10', 7);
    expect(s).toHaveLength(7);
    expect(s[5]).toMatchObject({ date: '2026-10-09', kg: 70, avg: 70 });
    expect(s[6]).toMatchObject({ date: '2026-10-10', kg: null, avg: 70 });
  });
});


describe('training plan (S15.1)', () => {
  it('builds the week from days per week, Monday first, always with a rest day', () => {
    const w = planWeek({ trainingDays: 4 }, '2026-10-15');
    expect(w.map((d) => d.label)).toEqual(['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest']);
    expect(w[0].date).toBe('2026-10-12');
    expect(planWeek({ trainingDays: 6 }, '2026-10-15').filter((d) => d.training)).toHaveLength(6);
  });
  it('has a template for every session label the split can produce', () => {
    for (const n of [2, 3, 4, 5, 6]) for (const d of planWeek({ trainingDays: n }, '2026-10-15')) if (d.training) expect(TEMPLATES[d.label]).toBeDefined();
  });
  it('progresses weight only after every target rep is hit (double progression)', () => {
    const t = TEMPLATES.Upper[0]; // bench 4 × 6, +2.5
    const log = (reps: number[]) => ({ name: t.name, target: '4 × 6', restSec: 150, sets: reps.map((r) => ({ reps: r, kg: 60 })) });
    expect(nextTarget(t, log([6, 6, 6, 6]))).toMatchObject({ kg: 62.5, change: 2.5 });
    expect(nextTarget(t, log([6, 6, 6, 5]))).toMatchObject({ kg: 60, change: 0 });
    expect(nextTarget(t, log([6, 4, 4, 3])).reason).toMatch(/Missed reps/);
    expect(nextTarget(t, null)).toMatchObject({ kg: t.startKg });
  });
});

describe('workout logging (S11.1)', () => {
  const seed = makeSeed();
  it('seed history keeps the bench stall: next bench stays at 60 kg, other lifts go up', () => {
    const s = buildSession('Upper', addDays(weekStart(today()), 14), '19:00', seed.workouts, 'x');
    expect(s.exercises.find((e) => e.name === 'Bench press')?.targetKg).toBe(60);
    expect(s.exercises.find((e) => e.name === 'Lat pulldown')?.targetKg).toBe(57.5);
  });
  it('finds last time and flags a PR only when the estimated 1RM beats history', () => {
    const d = today();
    const last = lastPerformance(seed.workouts, 'Bench press', d);
    expect(last?.log.sets[0]).toEqual({ kg: 60, reps: 6 });
    expect(isPR(seed.workouts, 'Bench press', { kg: 62.5, reps: 6 }, d)).toBe(true);
    expect(isPR(seed.workouts, 'Bench press', { kg: 60, reps: 6 }, d)).toBe(false);
    expect(isPR(seed.workouts, 'Never done', { kg: 100, reps: 1 }, d)).toBe(false);
  });
  it('starts a planned session on the first set, logs, removes and finishes', () => {
    const plan = { trainingDays: 6, gymTime: '19:00' };
    const date = weekStart(today()); // Monday is always a training day
    let s = { ...makeSeed(), profile: { ...seed.profile, ...plan }, workouts: seed.workouts.filter((w) => w.date !== date) };
    const p = sessionFor(s.workouts, s.profile, date, 'wo-x')!;
    expect(p.saved).toBe(false);
    s = reducer(s, { type: 'startSession', session: p.session });
    s = reducer(s, { type: 'startSession', session: p.session }); // no duplicate
    expect(s.workouts.filter((w) => w.date === date)).toHaveLength(1);
    s = reducer(s, { type: 'logSet', sessionId: 'wo-x', exercise: 0, set: { reps: 6, kg: 60 } });
    s = reducer(s, { type: 'logSet', sessionId: 'wo-x', exercise: 0, set: { reps: 5, kg: 60 } });
    s = reducer(s, { type: 'removeSet', sessionId: 'wo-x', exercise: 0, index: 1 });
    s = reducer(s, { type: 'finishSession', sessionId: 'wo-x' });
    const w = sessionFor(s.workouts, s.profile, date)!;
    expect(w.saved).toBe(true);
    expect(w.session.done).toBe(true);
    expect(sessionVolume(w.session)).toBe(360);
  });
});


describe('sport programs (S15.2)', () => {
  const mon = '2026-10-12';
  const base = { sport: 'badminton' as const, start: '2026-09-28', matches: [] };
  it('has 8 weeks of phases for each sport', () => {
    for (const s of Object.values(SPORTS)) {
      const weeks = s.phases.flatMap((p) => Array.from({ length: p.weeks[1] - p.weeks[0] + 1 }, (_, i) => p.weeks[0] + i));
      expect(weeks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      for (const p of s.phases) expect(p.template).toHaveLength(7);
    }
  });
  it('counts program weeks from the start week', () => {
    expect(programWeekNo('2026-09-28', '2026-10-15')).toBe(3);
    expect(phaseFor('badminton', 3).name).toBe('Base + footwork');
    expect(phaseFor('badminton', 12).name).toBe('Peak, then taper');
  });
  it('without matches, the week is the phase template', () => {
    expect(programWeek(base, '2026-10-15').map((d) => d.label)).toEqual(['Lower', 'Court', 'Rest', 'Upper', 'Footwork', 'Court', 'Rest']);
  });
  it('a match day moves the plan: light day before, recovery after, heavy session moved earlier', () => {
    // Friday match: Thursday Upper → Activation, Saturday Court → Recovery.
    const fri = programWeek({ ...base, matches: [{ id: 'm', date: '2026-10-16', time: '10:00', label: 'League' }] }, mon);
    expect(fri.map((d) => d.label)).toEqual(['Lower', 'Court', 'Rest', 'Activation', 'Match', 'Recovery', 'Rest']);
    expect(fri[4]).toMatchObject({ kind: 'match', note: 'League · 10:00' });
    const run = programWeek({ sport: 'running', start: '2026-10-12', matches: [{ id: 'r', date: '2026-10-18', time: '06:00', label: '10K' }] }, mon);
    // Sunday race: Saturday Upper → Activation; Sunday Long run is displaced and moves to the Thursday rest day.
    expect(run.map((d) => d.label)).toEqual(['Easy run', 'Lower', 'Easy run', 'Long run', 'Tempo', 'Activation', 'Race']);
    expect(run[3].note).toBe('Moved here for the match');
  });
  it('picks the next match and builds match-day meals with real numbers', () => {
    const s = { ...base, matches: [{ id: 'a', date: '2026-10-10', time: '10:00', label: 'Old' }, { id: 'b', date: '2026-10-20', time: '10:00', label: 'Next' }] };
    expect(nextMatch(s, '2026-10-15')?.label).toBe('Next');
    const meals = matchDayMeals('veg', '10:00');
    expect(meals.map((m) => [m.tag, m.time])).toEqual([['Pre', '07:00'], ['Top-up', '09:30'], ['During', '10:00'], ['Post', '12:00']]);
    expect(meals[0].macros.kcal).toBeGreaterThan(350);
    expect(meals[3].name).toMatch(/Paneer/);
    expect(matchDayMeals('nonveg', '18:30')[3].name).toMatch(/Chicken/);
    expect(matchDayTargets(makeSeed().targets)).toMatchObject({ kcalTraining: 1850 + 320, carbs: 300, protein: 140 });
  });
  it('store: add, replace on the same date, remove', () => {
    let s = makeSeed();
    s = reducer(s, { type: 'addMatch', match: { id: 'x', date: '2030-01-05', time: '10:00', label: 'A' } });
    s = reducer(s, { type: 'addMatch', match: { id: 'y', date: '2030-01-05', time: '11:00', label: 'B' } });
    expect(s.sport!.matches.filter((m) => m.date === '2030-01-05').map((m) => m.label)).toEqual(['B']);
    s = reducer(s, { type: 'removeMatch', id: 'y' });
    expect(s.sport!.matches.some((m) => m.date === '2030-01-05')).toBe(false);
    s = reducer(s, { type: 'setSport', sport: 'running', start: mon });
    expect(s.sport).toMatchObject({ sport: 'running', start: mon });
  });
});

describe('insights aggregations (S16.1)', () => {
  const seed = makeSeed();
  it('builds one point per day; days with no meals are empty, not zero', () => {
    const s = dailySeries(seed, today(), 28);
    expect(s).toHaveLength(28);
    expect(s.every((x) => x.kcalIn !== null)).toBe(true);
    const none = dailySeries({ ...seed, meals: [] }, today(), 7);
    expect(none.every((x) => x.kcalIn === null && x.protein === null)).toBe(true);
  });
  it('hides wearable numbers when no device is connected', () => {
    const s = dailySeries({ ...seed, devices: { google: false, strava: false } }, today(), 7);
    expect(s.every((x) => x.steps === null && x.sleep === null && x.kcalOut === null)).toBe(true);
  });
  it('averages and compares with the previous period', () => {
    const p = periodSummary(seed, today(), 7);
    expect(p.daysLogged).toBe(7);
    expect(p.steps.now).toBeGreaterThan(5000);
    expect(p.balance).not.toBeNull();
    expect(mean([1, null, 3])).toBe(2);
    expect(pctChange(100, 109)).toBe(9);
    expect(pctChange(null, 5)).toBeNull();
  });
  it('flags the seeded bench as stalled and other lifts as moving or steady', () => {
    const bench = liftSummary(seed.workouts, 'Bench press', today(), 28)!;
    expect(bench).toMatchObject({ stalled: true, best: 72, top: { kg: 60, reps: 6 } });
    expect(bench.flatWeeks).toBeGreaterThanOrEqual(3);
    expect(liftSummary(seed.workouts, 'Not a lift', today(), 28)).toBeNull();
    expect(liftSeries(seed.workouts, 'Bench press', today(), 28).every((p, i, a) => i === 0 || a[i - 1].date <= p.date)).toBe(true);
  });
});
