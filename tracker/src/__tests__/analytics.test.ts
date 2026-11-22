import { describe, expect, it } from 'vitest';
import { caloriesByWeekday, findings, numbersOnlyFrom, setsPerMuscle, sleepBuckets, sleepVsLift } from '../state/analytics';
import { makeSeed } from '../domain/seed';
import { today } from '../domain/clock';

const d = makeSeed();
const t = today();

describe('detailed analytics (S16.2)', () => {
  it('averages calories by weekday; the seeded weekends run over', () => {
    const wd = caloriesByWeekday(d, t, 28);
    expect(wd.map((x) => x.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    const fri = wd[4], sat = wd[5];
    expect(fri.kcal! - fri.target).toBeGreaterThan(150);
    expect(sat.kcal! - sat.target).toBeGreaterThan(150);
  });
  it('pairs sleep with bench sessions and buckets them', () => {
    const pairs = sleepVsLift(d, 'Bench press', t, 28);
    expect(pairs.length).toBeGreaterThan(3);
    for (const p of pairs) expect(p.completion).toBeGreaterThan(80);
    const b = sleepBuckets(pairs);
    expect(b.reduce((s, x) => s + x.sessions, 0)).toBe(pairs.length);
  });
  it('counts weekly sets per muscle', () => {
    const s = setsPerMuscle(d, t, 28);
    expect(s.find((m) => m.muscle === 'Chest')!.perWeek).toBeGreaterThan(0);
    expect(s.every((m) => m.perWeek >= 0)).toBe(true);
  });
  it('writes up to three findings whose numbers all come from the data', () => {
    const f = findings(d, t, 28);
    expect(f.length).toBeGreaterThan(0);
    expect(f.length).toBeLessThanOrEqual(3);
    expect(f[0].id).toBe('weekday');
    for (const x of f) expect(numbersOnlyFrom(`${x.title} ${x.detail}`, x.numbers)).toBe(true);
  });
  it('rejects text with numbers that were not given', () => {
    expect(numbersOnlyFrom('Protein short on 9 of 28 days', [9, 28])).toBe(true);
    expect(numbersOnlyFrom('Protein short on 10 of 28 days', [9, 28])).toBe(false);
    expect(numbersOnlyFrom('About 2,380 kcal a week', [2380])).toBe(true);
  });
});
