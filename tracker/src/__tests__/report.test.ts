import { describe, expect, it } from 'vitest';
import { advance, applyChange, buildReport, publishTime, reportWeekFor } from '../domain/report';
import { makeSeed } from '../domain/seed';
import { addDays, today, weekStart } from '../domain/clock';
import { reducer } from '../state/store';
import { buildSession } from '../domain/training';
import { canUse } from '../state/entitlements';

const d = makeSeed();
const lastWeek = addDays(weekStart(today()), -7);

describe('weekly report (S17.1)', () => {
  it('covers this week from Sunday 6 PM, otherwise last week', () => {
    expect(reportWeekFor(new Date(2026, 9, 18, 18, 30))).toBe('2026-10-12'); // Sun 18 Oct, 6:30 PM
    expect(reportWeekFor(new Date(2026, 9, 18, 17, 0))).toBe('2026-10-05');
    expect(reportWeekFor(new Date(2026, 9, 15, 9, 0))).toBe('2026-10-05');
    expect(publishTime('2026-10-12').getHours()).toBe(19);
  });
  it('builds causes and actionable changes from the seeded week', () => {
    const r = buildReport(d, lastWeek, { now: new Date() });
    expect(r).toMatchObject({ id: `rep-${lastWeek}`, status: 'draft' });
    expect(r.causes.length).toBeGreaterThan(0);
    expect(r.changes.length).toBeGreaterThan(0);
    expect(r.changes.length).toBeLessThanOrEqual(3);
    expect(r.changes[0]).toMatchObject({ title: '+1 set on bench press', action: { kind: 'sets', exercise: 'Bench press', delta: 1 } });
    expect(r.headline.endsWith('.')).toBe(true);
    expect(r.stats!.daysLogged).toBe(7);
  });
  it('accepting applies the change and skipping undoes it', () => {
    let s = reducer(d, { type: 'upsertReport', report: buildReport(d, lastWeek) });
    const rep = s.reports.find((r) => r.weekStart === lastWeek)!;
    s = reducer(s, { type: 'setChange', reportId: rep.id, changeId: 'c1', status: 'accepted' });
    expect(s.trainingOverrides['Bench press']).toBe(1);
    const bench = buildSession('Upper', today(), '19:00', s.workouts, 'x', s.trainingOverrides).exercises.find((e) => e.name === 'Bench press')!;
    expect(bench.target).toBe('5 × 6');
    s = reducer(s, { type: 'setChange', reportId: rep.id, changeId: 'c1', status: 'skipped' });
    expect(s.trainingOverrides['Bench press']).toBeUndefined();
  });
  it('applies calorie and reminder changes', () => {
    const a = applyChange(d, { kind: 'kcal', delta: 150 }, 1);
    expect([a.targets.kcalTraining, a.targets.kcalRest]).toEqual([2000, 1850]);
    expect(applyChange(a, { kind: 'kcal', delta: 150 }, -1).targets.kcalTraining).toBe(1850);
    expect(applyChange(d, { kind: 'windDown', time: '23:00' }, 1).reminders.windDown).toBe('23:00');
  });
  it('moves from draft to published at 7 PM once approved, or automatically when no coach is set up', () => {
    const r = buildReport(d, '2026-10-12');
    expect(advance(r, new Date(2026, 9, 18, 18, 30), false).status).toBe('draft');
    expect(advance({ ...r, status: 'approved', approvedBy: 'Coach' }, new Date(2026, 9, 18, 19, 1), false)).toMatchObject({ status: 'published', approvedBy: 'Coach' });
    expect(advance(r, new Date(2026, 9, 18, 19, 1), true)).toMatchObject({ status: 'published', approvedBy: 'PeakX checks' });
    expect(advance(r, new Date(2026, 9, 18, 19, 1), false).status).toBe('draft');
  });
  it('gives free users their first report only', () => {
    const free = { ...d, plan: 'free' as const, firstReportUsed: false };
    expect(canUse(free, 'weeklyReport')).toBe(true);
    const used = reducer(free, { type: 'useFreeReport' });
    expect(canUse(used, 'weeklyReport')).toBe(false);
  });
});
