import { describe, expect, it } from 'vitest';
import { dayDiet, itemDiet, mealHas, planKey, planWeek, replanDay, weekdayIndex } from '../domain/mealPlan';
import { RECIPES, recipeMacros, makeFresh } from '../domain/seed';
import { reducer } from '../state/store';
import { addDays } from '../domain/clock';

const LK = { recipes: RECIPES, recipeMacros };
const target = () => ({ kcal: 2200, protein: 140 });
const WS = '2026-11-09'; // a Monday

describe('non-veg meal plans mix veg and non-veg', () => {
  it('puts a meat or fish meal on every non-veg day, alongside veg meals', () => {
    for (const kcal of [1800, 2200, 2600]) {
      const plan = planWeek(WS, () => ({ kcal, protein: 140 }), 'nonveg', LK);
      for (const d of plan.days) expect(d.meals.some((m) => mealHas(m, 'nonveg', LK)), `${d.date} @ ${kcal}`).toBe(true);
      const all = plan.days.flatMap((d) => d.meals);
      expect(all.filter((m) => !mealHas(m, 'nonveg', LK)).length).toBeGreaterThan(all.length / 3);
    }
  });
  it('gives egg eaters an egg meal every day and never meat', () => {
    const plan = planWeek(WS, target, 'egg', LK);
    for (const d of plan.days) {
      expect(d.meals.some((m) => mealHas(m, 'egg', LK))).toBe(true);
      expect(d.meals.some((m) => mealHas(m, 'nonveg', LK))).toBe(false);
    }
  });
});

describe('veg days', () => {
  it('maps dates to weekdays and veg days to a vegetarian diet', () => {
    expect(weekdayIndex(WS)).toBe(0);
    expect(weekdayIndex(addDays(WS, 6))).toBe(6);
    expect(dayDiet('nonveg', [1], addDays(WS, 1))).toBe('veg');
    expect(dayDiet('nonveg', [1], addDays(WS, 2))).toBe('nonveg');
    expect(dayDiet('veg', [1], addDays(WS, 1))).toBe('veg');
    expect(planKey('veg', [1, 2])).toBe(planKey('veg', []));
    expect(planKey('nonveg', [3, 1])).toBe('nonveg|1,3');
  });
  it('keeps veg days fully vegetarian and the others non-veg', () => {
    const plan = planWeek(WS, target, 'nonveg', LK, [1, 3]);
    expect(plan.dietKey).toBe('nonveg|1,3');
    plan.days.forEach((d, i) => {
      const meat = d.meals.some((m) => m.items.some((it) => ['nonveg', 'egg'].includes(itemDiet(it, LK))));
      if (i === 1 || i === 3) expect(meat, d.date).toBe(false);
      else expect(d.meals.some((m) => mealHas(m, 'nonveg', LK)), d.date).toBe(true);
    });
  });
  it('re-plans only the toggled day', () => {
    const plan = planWeek(WS, target, 'nonveg', LK);
    const wed = addDays(WS, 2);
    const next = replanDay(plan, wed, target(), 'nonveg', LK, [2]);
    expect(next.dietKey).toBe('nonveg|2');
    expect(next.days.find((d) => d.date === wed)!.meals.some((m) => mealHas(m, 'nonveg', LK))).toBe(false);
    next.days.filter((d) => d.date !== wed).forEach((d, i) => expect(d).toEqual(plan.days.filter((x) => x.date !== wed)[i]));
  });
  it('saves veg days on the profile and the onboarding draft', () => {
    let s = makeFresh();
    s = { ...s, profile: { ...s.profile, diet: 'nonveg' } };
    s = reducer(s, { type: 'setVegDays', days: [3, 1, 1, 9] });
    expect(s.profile.vegDays).toEqual([1, 3]);
    expect(s.onboarding.draft.vegDays).toEqual([1, 3]);
  });
});
