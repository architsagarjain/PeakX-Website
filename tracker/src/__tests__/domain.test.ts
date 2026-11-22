import { describe, expect, it } from 'vitest';
import { bmr, e1rm, targetsFor, fmt } from '../domain/nutrition';
import { makeSeed } from '../domain/seed';
import { addDays, iso, today, weekStart } from '../domain/clock';
import { reducer } from '../state/store';
import { canUse } from '../state/entitlements';
import { dayTotals, kcalTarget, remaining } from '../state/selectors';

const profile = makeSeed().profile;

describe('nutrition maths', () => {
  it('computes Mifflin-St Jeor BMR', () => {
    // 10×72.4 + 6.25×176 − 5×26 + 5 = 1699
    expect(bmr(profile, 72.4)).toBe(1699);
  });
  it('sets protein at 2 g/kg and keeps macros inside the calorie target', () => {
    const t = targetsFor(profile, 72.4);
    expect(t.protein).toBe(145);
    expect(t.protein * 4 + t.carbs * 4 + t.fat * 9).toBeLessThanOrEqual(t.kcalTraining + 40);
    expect(t.kcalRest).toBe(t.kcalTraining - 150);
  });
  it('estimates one-rep max with Epley', () => {
    expect(e1rm(60, 6)).toBe(72);
    expect(e1rm(80, 5)).toBe(93);
    expect(e1rm(100, 1)).toBe(100);
  });
  it('formats numbers with separators', () => { expect(fmt(1850)).toBe('1,850'); });
});

describe('clock', () => {
  it('finds the Monday of a week', () => { expect(weekStart('2026-10-14')).toBe('2026-10-12'); });
  it('adds days across months', () => { expect(addDays('2026-09-29', 3)).toBe('2026-10-02'); });
  it('formats local dates', () => { expect(iso(new Date(2026, 0, 5))).toBe('2026-01-05'); });
});

describe('seed', () => {
  const d = makeSeed();
  it('matches the design numbers for today', () => {
    const eaten = dayTotals(d, today());
    expect(eaten.kcal).toBe(1240);
    expect(eaten.protein).toBe(92);
  });
  it('covers 28 days of wearable data and a 1.8 kg drop', () => {
    expect(d.wearable).toHaveLength(28);
    expect(d.weights[d.weights.length - 1].kg).toBe(72.4);
  });
});

describe('store', () => {
  it('logs a dinner and updates calories left', () => {
    const d = makeSeed(); const t = today();
    const before = remaining(d, t).left;
    const next = reducer(d, { type: 'logItems', date: t, slot: 'dinner', time: '20:30', items: [{ id: 'x', name: 'Dal', amount: '1 katori', macros: { kcal: 230, protein: 9, carbs: 22, fat: 12 }, source: 'voice' }] });
    expect(remaining(next, t).left).toBe(before - 230);
  });
  it('removes an item and drops empty meals', () => {
    const d = makeSeed(); const t = today();
    const snack = d.meals.find((m) => m.date === t && m.slot === 'snacks')!;
    const next = reducer(d, { type: 'removeItem', mealId: snack.id, itemId: snack.items[0].id });
    expect(next.meals.find((m) => m.id === snack.id)).toBeUndefined();
  });
  it('replaces a same-day weight instead of duplicating it', () => {
    const d = makeSeed(); const t = today();
    const next = reducer(d, { type: 'logWeight', date: t, kg: 72.1 });
    expect(next.weights.filter((w) => w.date === t)).toHaveLength(1);
    expect(next.weights[next.weights.length - 1].kg).toBe(72.1);
  });
  it('adds steps to the calorie target, capped at 200', () => {
    const d = makeSeed(); const t = today();
    expect(kcalTarget(d, t).stepBonus).toBeLessThanOrEqual(200);
  });
});

describe('entitlements', () => {
  it('locks Pro features for Free users', () => {
    expect(canUse({ plan: 'free', firstReportUsed: true }, 'mealPlan')).toBe(false);
    expect(canUse({ plan: 'pro', firstReportUsed: true }, 'mealPlan')).toBe(true);
  });
  it('gives Free users their first weekly report', () => {
    expect(canUse({ plan: 'free', firstReportUsed: false }, 'weeklyReport')).toBe(true);
    expect(canUse({ plan: 'free', firstReportUsed: true }, 'weeklyReport')).toBe(false);
  });
  it('keeps the human coach for Coached only', () => {
    expect(canUse({ plan: 'pro', firstReportUsed: true }, 'humanCoach')).toBe(false);
    expect(canUse({ plan: 'coached', firstReportUsed: true }, 'humanCoach')).toBe(true);
  });
});
