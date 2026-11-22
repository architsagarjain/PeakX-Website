import { describe, expect, it } from 'vitest';
import { makeFresh, makeSeed } from '../domain/seed';
import { addDays, today, weekStart } from '../domain/clock';
import { syncStatus, trainingHeatmap, weeklyBuckets } from '../state/insights';
import type { AppData } from '../domain/types';

const t = today();

describe('Insights aggregations (redesign step 7)', () => {
  it('buckets weeks oldest first and leaves empty weeks as null', () => {
    const b = weeklyBuckets(makeFresh(), t, 8);
    expect(b).toHaveLength(8);
    expect(b[7].start).toBe(weekStart(t));
    expect(b[0].start).toBe(addDays(weekStart(t), -49));
    expect(b.every((x) => x.kcal === null && x.weight === null && x.volume === 0)).toBe(true);
  });
  it('averages weight in the last 7 days of each week', () => {
    const ws = weekStart(t);
    const d = { ...makeFresh(), weights: [{ date: ws, kg: 70 }, { date: addDays(ws, -1), kg: 72 }] } as AppData;
    const b = weeklyBuckets(d, t, 2);
    expect(b[0].weight).toBe(72);
    expect(b[1].weight).toBe(71); // this week's last 7 days hold both weigh-ins
  });
  it('maps training to a weekday × week grid', () => {
    const h = trainingHeatmap([], t, 12);
    expect(h.rows).toHaveLength(7);
    expect(h.rows[0]).toHaveLength(12);
    expect(h.sessions).toBe(0);
    const seed = makeSeed();
    const s = trainingHeatmap(seed.workouts, t, 12);
    expect(s.sessions).toBe(new Set(seed.workouts.filter((w) => w.date <= t && w.date >= addDays(weekStart(t), -77) && (w.done || w.exercises.some((e) => e.sets.length))).map((w) => w.date)).size);
  });
  it('reports sync state', () => {
    expect(syncStatus(makeFresh())).toMatchObject({ connected: false, lastSync: null });
    expect(syncStatus(makeSeed()).lastSync).toBeTruthy();
  });
});

describe('last week summary (redesign step 8)', () => {
  it('is empty for a new account and counts for the demo', async () => {
    const { lastWeekSummary } = await import('../state/insights');
    const f = lastWeekSummary(makeFresh(), t);
    expect(f).toMatchObject({ kcal: null, adherence: null, loggedDays: 0, proteinDays: 0, sleep: null, steps: null });
    expect(f.workouts.done).toBe(0);
    const s = lastWeekSummary(makeSeed(), t);
    expect(s.loggedDays).toBeGreaterThan(0);
    expect(s.adherence).toBeLessThanOrEqual(100);
    expect(s.workouts.done).toBeLessThanOrEqual(s.workouts.planned);
  });
});
