import { describe, expect, it } from 'vitest';
import { TEMPLATES, dayStatus, groceryList, groceryText, itemDiet, planWeek, swapMeal, templatesFor } from '../domain/mealPlan';
import { RECIPES, recipeMacros } from '../domain/seed';
import { DISHES, INGREDIENTS } from '../domain/foods';
import type { Diet } from '../domain/types';

const LK = { recipes: RECIPES, recipeMacros };
const target = (d: string) => ({ kcal: new Date(d).getDay() % 2 ? 1850 : 1700, protein: 140 });

describe('meal plan (S14.1)', () => {
  it('every template points at real recipes, dishes and ingredients', () => {
    for (const t of TEMPLATES) for (const i of t.items) {
      const ok = i.kind === 'recipe' ? RECIPES.some((r) => r.id === i.id) : i.kind === 'dish' ? DISHES.some((d) => d.id === i.id) : INGREDIENTS.some((g) => g.id === i.id);
      expect(ok, `${t.name}: ${i.kind} ${i.id}`).toBe(true);
    }
  });
  it.each(['nonveg', 'veg', 'egg'] as Diet[])('keeps every day within ±5%% of target with protein met (%s)', (diet) => {
    const plan = planWeek('2026-10-12', target, diet, LK);
    expect(plan.days).toHaveLength(7);
    for (const d of plan.days) {
      const s = dayStatus(d, target(d.date), LK);
      expect(s.kcalOk, `${diet} ${d.date} kcal ${s.kcal} vs ${target(d.date).kcal}`).toBe(true);
      expect(s.proteinOk, `${diet} ${d.date} protein ${s.protein}`).toBe(true);
      expect(d.meals.map((m) => m.slot)).toEqual(['breakfast', 'lunch', 'snacks', 'dinner']);
      for (const m of d.meals) for (const i of m.items) expect(diet === 'veg' ? ['veg', 'vegan'] : diet === 'egg' ? ['veg', 'vegan', 'egg'] : ['veg', 'vegan', 'egg', 'nonveg']).toContain(itemDiet(i, LK));
    }
  });
  it('varies meals across the week', () => {
    const plan = planWeek('2026-10-12', target, 'nonveg', LK);
    expect(new Set(plan.days.map((d) => d.meals[1].name)).size).toBeGreaterThanOrEqual(4);
  });
  it('swap changes the meal and keeps the day on target', () => {
    const plan = planWeek('2026-10-12', target, 'veg', LK);
    const before = plan.days[2].meals[3].name;
    const after = swapMeal(plan, plan.days[2].date, 'dinner', target(plan.days[2].date), 'veg', LK);
    expect(after.days[2].meals[3].name).not.toBe(before);
    const s = dayStatus(after.days[2], target(plan.days[2].date), LK);
    expect(s.kcalOk && s.proteinOk).toBe(true);
    expect(after.days[0]).toBe(plan.days[0]);
  });
  it('builds a grocery list that sums the week', () => {
    const plan = planWeek('2026-10-12', target, 'nonveg', LK);
    const list = groceryList(plan, LK);
    expect(list.length).toBeGreaterThan(3);
    const all = list.flatMap((g) => g.items);
    expect(all.every((i) => i.grams > 0 && i.grams % 10 === 0)).toBe(true);
    expect(new Set(all.map((i) => i.name)).size).toBe(all.length);
    expect(groceryText(list, '12–18 Oct')).toMatch(/^PeakX grocery list · 12–18 Oct/);
  });
  it('has options for every slot for each diet', () => {
    for (const diet of ['nonveg', 'veg', 'egg', 'vegan'] as Diet[]) for (const slot of ['breakfast', 'lunch', 'snacks', 'dinner'] as const) expect(templatesFor(diet, slot, LK).length, `${diet} ${slot}`).toBeGreaterThan(0);
  });
});
