import { describe, expect, it } from 'vitest';
import { DISHES, INGREDIENTS, dishDiet, dishMacros, ingredient } from '../domain/foods';
import { amountLabel, catalogue, customItem, itemFrom, searchFoods } from '../domain/foodSearch';
import { RECIPES, makeSeed, recipeMacros } from '../domain/seed';
import { reducer } from '../state/store';
import { filterRecipes, matchesDiet } from '../domain/recipes';
import { dayTotals, recentItems, slotFor } from '../state/selectors';

const CAT = catalogue(RECIPES, recipeMacros);
const find = (q: string) => searchFoods(q, CAT).map((x) => x.id);

describe('food table (S10.1)', () => {
  it('has at least 60 dishes and every dish uses known ingredients', () => {
    expect(DISHES.length).toBeGreaterThanOrEqual(60);
    for (const d of DISHES) for (const [id, g] of d.parts) { expect(() => ingredient(id)).not.toThrow(); expect(g).toBeGreaterThan(0); }
  });
  it('keeps ids unique', () => {
    expect(new Set(DISHES.map((d) => d.id)).size).toBe(DISHES.length);
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
  });
  it('per-100 g values are physically possible (energy ≈ 4P + 4C + 9F)', () => {
    for (const i of INGREDIENTS) {
      const { kcal, protein, carbs, fat } = i.per100g;
      expect(protein + carbs + fat).toBeLessThanOrEqual(101);
      expect(Math.abs(kcal - (4 * protein + 4 * carbs + 9 * fat))).toBeLessThan(kcal * 0.15 + 12);
    }
  });
  it('builds familiar numbers: a roti is about 100 kcal, dal tadka about 175', () => {
    const roti = dishMacros(DISHES.find((d) => d.id === 'roti')!);
    expect(Math.round(roti.kcal)).toBe(99);
    const dal = dishMacros(DISHES.find((d) => d.id === 'dal-tadka')!);
    expect(Math.round(dal.kcal)).toBeGreaterThan(160);
    expect(Math.round(dal.kcal)).toBeLessThan(190);
  });
  it('works out diet from ingredients', () => {
    const by = (id: string) => dishDiet(DISHES.find((d) => d.id === id)!);
    expect([by('chicken-curry'), by('egg-bhurji'), by('palak-paneer'), by('chole')]).toEqual(['nonveg', 'egg', 'veg', 'vegan']);
  });
});

describe('food search (S9.1)', () => {
  it('finds dishes by English and Hindi names, dishes before raw ingredients', () => {
    expect(find('dal')[0]).toBe('dal-tadka');
    expect(find('anda')).toContain('egg-curry');
    expect(find('dahi')[0]).toBe('curd-bowl');
    expect(find('aloo')).toEqual(expect.arrayContaining(['aloo-gobi', 'aloo-paratha']));
    expect(find('chapati')[0]).toBe('roti');
    expect(find('soya')).toContain('soya-chunk-pulao');
  });
  it('returns nothing for empty or unknown queries', () => {
    expect(find('')).toEqual([]);
    expect(find('zzzz')).toEqual([]);
  });
  it('scales by portion and quantity and remembers where the item came from', () => {
    const roti = CAT.find((x) => x.id === 'roti')!;
    const two = itemFrom(roti, 1, 1, 'x');
    expect(two).toMatchObject({ name: 'Roti', amount: '2 roti', estimated: true, ref: { kind: 'dish', id: 'roti', portion: '2 roti', qty: 1 } });
    expect(two.macros.kcal).toBe(198);
    expect(itemFrom(roti, 0, 3, 'y').amount).toBe('3 roti');
    expect(amountLabel({ label: '1 katori', grams: 100 }, 0.5)).toBe('½ katori');
    expect(amountLabel({ label: '1 serving', grams: 100 }, 1.5)).toBe('1½ servings');
    expect(amountLabel({ label: '2 eggs', grams: 100 }, 2)).toBe('2 × 2 eggs');
  });
  it('makes custom items', () => {
    expect(customItem(' Momos ', 300.4, 9.6, 'c')).toMatchObject({ name: 'Momos', macros: { kcal: 300, protein: 10 } });
  });
});

describe('food log in the store', () => {
  it('edits an item in place, and moving it to another meal keeps day totals right', () => {
    let s = makeSeed();
    const meal = s.meals.find((m) => m.slot === 'breakfast' && m.items.length > 1)!;
    const item = meal.items[0];
    const before = dayTotals(s, meal.date).kcal;
    s = reducer(s, { type: 'editItem', mealId: meal.id, itemId: item.id, item: { ...item, macros: { ...item.macros, kcal: item.macros.kcal + 100 } }, slot: 'breakfast' });
    expect(dayTotals(s, meal.date).kcal).toBe(before + 100);
    s = reducer(s, { type: 'editItem', mealId: meal.id, itemId: item.id, item: { ...item }, slot: 'dinner' });
    const dinner = s.meals.find((m) => m.date === meal.date && m.slot === 'dinner')!;
    expect(dinner.items.some((i) => i.id === item.id)).toBe(true);
    expect(s.meals.find((m) => m.id === meal.id)!.items.some((i) => i.id === item.id)).toBe(false);
    expect(dayTotals(s, meal.date).kcal).toBe(before);
  });
  it('lists recent distinct items newest first', () => {
    const r = recentItems(makeSeed(), 5);
    expect(r).toHaveLength(5);
    expect(new Set(r.map((i) => `${i.name}|${i.amount}`)).size).toBe(5);
  });
  it('picks the meal from the hour', () => {
    expect([slotFor(8), slotFor(13), slotFor(17), slotFor(21)]).toEqual(['breakfast', 'lunch', 'snacks', 'dinner']);
  });
});


describe('recipe library filters (S13.1)', () => {
  it('filters by diet tab', () => {
    expect(filterRecipes(RECIPES, { diet: 'veg' }).every((r) => r.diet === 'veg')).toBe(true);
    expect(filterRecipes(RECIPES, { diet: 'egg' }).some((r) => r.diet === 'egg')).toBe(true);
    expect(filterRecipes(RECIPES, { diet: 'egg' }).some((r) => r.diet === 'nonveg')).toBe(false);
    expect(filterRecipes(RECIPES, { diet: 'nonveg' }).every((r) => r.diet === 'nonveg')).toBe(true);
    expect(matchesDiet(RECIPES[0], 'all')).toBe(true);
  });
  it('combines protein, calorie, time and mess filters, highest protein first', () => {
    const out = filterRecipes(RECIPES, { diet: 'all', highProtein: true });
    expect(out.length).toBeGreaterThan(0);
    for (const r of out) expect(recipeMacros(r).protein).toBeGreaterThanOrEqual(25);
    const p = out.map((r) => recipeMacros(r).protein);
    expect([...p].sort((a, b) => b - a)).toEqual(p);
    for (const r of filterRecipes(RECIPES, { diet: 'all', under500: true, under20: true })) {
      expect(recipeMacros(r).kcal).toBeLessThan(500);
      expect(r.minutes).toBeLessThanOrEqual(20);
    }
    expect(filterRecipes(RECIPES, { diet: 'all', mess: true }).map((r) => r.id)).toEqual(expect.arrayContaining(['soya-chunk-pulao', 'chana-chaat-paneer']));
  });
  it('searches names and ingredients, and limits to saved', () => {
    expect(filterRecipes(RECIPES, { diet: 'all', q: 'paneer' }).length).toBeGreaterThanOrEqual(3);
    expect(filterRecipes(RECIPES, { diet: 'all', saved: ['rajma-rice-bowl'] }).map((r) => r.id)).toEqual(['rajma-rice-bowl']);
  });
});

describe('wider Indian coverage and packaged brands (Nov 2026)', () => {
  it('has well over 200 dishes, each one serving in a believable range', () => {
    expect(DISHES.length).toBeGreaterThanOrEqual(200);
    for (const d of DISHES) {
      const k = dishMacros(d).kcal;
      expect(k, d.id).toBeGreaterThan(40);
      expect(k, d.id).toBeLessThan(1300);
    }
  });
  it('finds common curries, street food and sweets by everyday names', () => {
    expect(find('rogan josh')[0]).toBe('rogan-josh');
    expect(find('kadai paneer')[0]).toBe('kadai-paneer');
    expect(find('golgappa')[0]).toBe('pani-puri');
    expect(find('chicken tikka masala')[0]).toBe('chicken-tikka-masala');
    expect(find('keema')).toContain('mutton-keema');
    expect(find('chole bhature')[0]).toBe('chole-bhature');
    expect(find('gulab jamun')[0]).toBe('gulab-jamun');
    expect(find('buttermilk')[0]).toBe('chaas');
  });
  it('lists packaged products with their brand and a pack-sized portion', () => {
    const branded = INGREDIENTS.filter((i) => i.brand);
    expect(branded.length).toBeGreaterThanOrEqual(40);
    for (const b of branded) { expect(b.name.length).toBeGreaterThan(2); expect(b.portions[0].grams).toBeGreaterThan(0); }
    expect(find('quaker')[0]).toBe('quaker-oats');
    expect(find('maggi')[0]).toBe('maggi-masala');
    expect(find('oats')).toEqual(expect.arrayContaining(['oats', 'quaker-oats', 'saffola-oats']));
    const maggi = CAT.find((x) => x.id === 'maggi-masala')!;
    expect(maggi.hint).toBe('Packaged · Maggi · per 1 pack · 70 g');
    expect(itemFrom(maggi, 0, 1, 'm').macros.kcal).toBe(308);
  });
  it('keeps generic foods ahead of brands for plain words', () => {
    expect(find('paneer')[0]).not.toBe('amul-paneer');
    expect(find('milk')[0]).toBe('milk');
  });
  it('works out diet for the new dishes', () => {
    const by = (id: string) => dishDiet(DISHES.find((d) => d.id === id)!);
    expect([by('rogan-josh'), by('egg-biryani'), by('kadai-paneer'), by('masoor-dal'), by('prawn-masala')]).toEqual(['nonveg', 'egg', 'veg', 'vegan', 'nonveg']);
  });
});
