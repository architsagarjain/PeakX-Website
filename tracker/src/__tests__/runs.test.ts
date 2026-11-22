import { describe, expect, it } from 'vitest';
import { bestPace, fmtDuration, fmtPace, isRunLabel, longestRecent, paceSec, parseDuration, runGuide, runKcal, validateRun, weekRuns } from '../domain/runs';
import { splitFor } from '../domain/onboarding';
import { planWeek, sessionFor } from '../domain/training';
import { reducer } from '../state/store';
import { makeFresh } from '../domain/seed';
import { isTrainingDay, weekPlanDays } from '../state/selectors';
import { today } from '../domain/clock';
import type { RunLog } from '../domain/types';

const run = (date: string, km: number, seconds: number, kind: RunLog['kind'] = 'easy'): RunLog => ({ id: `r-${date}-${km}`, date, km, seconds, kind });

describe('runs (S11.3)', () => {
  it('reads durations as minutes, mm:ss or h:mm:ss', () => {
    expect(parseDuration('32')).toBe(1920);
    expect(parseDuration('32:15')).toBe(1935);
    expect(parseDuration('1:05:20')).toBe(3920);
    expect(parseDuration('5:75')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(fmtDuration(1935)).toBe('32:15');
    expect(fmtDuration(3920)).toBe('1:05:20');
  });
  it('works out pace and an estimated calorie burn', () => {
    expect(paceSec(5, 1710)).toBe(342);
    expect(fmtPace(342)).toBe('5:42 /km');
    expect(runKcal(70, 5)).toBe(350);
  });
  it('rejects impossible runs', () => {
    expect(validateRun(5, 1800)).toEqual({});
    expect(validateRun(0, 1800).km).toBeTruthy();
    expect(validateRun(5, null).time).toBeTruthy();
    expect(validateRun(10, 600).time).toBeTruthy(); // 1:00 /km
  });
  it('sums the week and finds the longest recent run and best pace', () => {
    const runs = [run('2026-11-09', 5, 1800), run('2026-11-11', 8, 3000, 'long'), run('2026-11-02', 4, 1300)];
    expect(weekRuns(runs, '2026-11-12')).toMatchObject({ km: 13, count: 2 });
    expect(longestRecent(runs, '2026-11-14')).toBe(8);
    expect(bestPace(runs, 4, '2026-11-14')).toBe(325);
  });
  it('suggests a long run no more than about 10% over the recent longest', () => {
    const runs = [run('2026-11-08', 10, 3600, 'long')];
    expect(runGuide('long', runs, '2026-11-15').km).toBe(11);
    expect(runGuide('easy', [], '2026-11-15').km).toBe(4);
  });
});

describe('runner plans', () => {
  it('gives runners run days, never gym sessions', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const s = splitFor(n, 'run');
      expect(s.filter((x) => x !== 'Rest')).toHaveLength(n);
      expect(s.filter((x) => x !== 'Rest').every(isRunLabel)).toBe(true);
    }
    expect(splitFor(4)).toEqual(['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest']);
    const p = { trainingDays: 3, trainingStyle: 'run' as const, gymTime: '06:30' };
    const days = planWeek(p, '2026-11-11');
    expect(days.filter((d) => d.run)).toHaveLength(3);
    for (const d of days) expect(sessionFor([], p, d.date)).toBeNull();
  });
  it('logs and removes runs, and a run makes the day a training day', () => {
    let s = makeFresh();
    const t = today();
    s = { ...s, profile: { ...s.profile, trainingStyle: 'run', trainingDays: 3 } };
    s = reducer(s, { type: 'logRun', run: run(t, 5, 1800) });
    expect(s.runs).toHaveLength(1);
    expect(isTrainingDay(s, t)).toBe(true);
    const week = weekPlanDays(s, t);
    expect(week.find((d) => d.date === t)).toMatchObject({ training: true, run: true });
    s = reducer(s, { type: 'removeRun', id: s.runs[0].id });
    expect(s.runs).toHaveLength(0);
  });
});
