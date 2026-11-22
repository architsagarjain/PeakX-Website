import { describe, expect, it } from 'vitest';
import { fitMenu, menuFromText } from '../domain/mess';
import { PLACES, isEstimated, orderMacros, orderTag } from '../domain/eatingOut';
import { DISHES, INGREDIENTS } from '../domain/foods';
import { catalogue } from '../domain/foodSearch';
import { RECIPES, recipeMacros } from '../domain/seed';

const CAT = catalogue(RECIPES, recipeMacros);
const MENU = 'Dinner — Saturday\n1. Dal makhani\n2. Aloo gobhi\n3. Jeera rice\n4. Roti\n5. Boondi raita · Kheer';

describe('mess mode (S14.2)', () => {
  it('reads a menu into dishes and skips headings and repeats', () => {
    const m = menuFromText(MENU + '\nRoti', CAT);
    expect(m.map((x) => x.text)).toEqual(['Dal makhani', 'Aloo gobhi', 'Jeera rice', 'Roti', 'Boondi raita', 'Kheer']);
    expect(m.map((x) => x.match?.id)).toEqual(['dal-makhani', 'aloo-gobi', 'jeera-rice', 'roti', 'raita', 'kheer']);
  });
  it('fits portions to what is left, protein first, one rice dish at most', () => {
    const menu = menuFromText(MENU, CAT).filter((x) => x.match).map((x) => x.match!);
    const f = fitMenu(menu, 610, 40);
    expect(f.kcal).toBeLessThanOrEqual(610 * 1.03);
    expect(f.kcal).toBeGreaterThan(450);
    expect(f.picks.filter((p) => /rice/i.test(p.item.name)).length).toBeLessThanOrEqual(1);
    expect(f.picks.find((p) => p.item.id === 'dal-makhani')).toBeDefined();
  });
  it('returns a small plate when little is left, and nothing for an empty menu', () => {
    const menu = menuFromText('Dal tadka, Roti', CAT).map((x) => x.match!);
    expect(fitMenu(menu, 200, 20).kcal).toBeLessThanOrEqual(206);
    expect(fitMenu([], 500, 20)).toEqual({ picks: [], kcal: 0, protein: 0 });
  });
});

describe('eating-out guide (S14.3)', () => {
  it('every order uses known dishes and ingredients and has sane numbers', () => {
    for (const p of PLACES) for (const o of p.orders) {
      for (const part of o.parts) {
        if ('dish' in part) expect(DISHES.some((d) => d.id === part.dish), part.dish).toBe(true);
        if ('ingredient' in part) expect(INGREDIENTS.some((i) => i.id === part.ingredient), part.ingredient).toBe(true);
      }
      const m = orderMacros(o);
      expect(m.kcal, o.name).toBeGreaterThan(100);
      expect(m.kcal, o.name).toBeLessThan(1500);
    }
  });
  it('tags orders and marks estimates', () => {
    const dhaba = PLACES.find((p) => p.id === 'dhaba')!;
    expect(orderTag(orderMacros(dhaba.orders[0]))).toBe('High protein');
    expect(orderTag(orderMacros(dhaba.orders[5]))).toBe('Heavy');
    expect(isEstimated(PLACES.find((p) => p.id === 'chinese')!.orders[0])).toBe(true);
    expect(isEstimated(dhaba.orders[0])).toBe(false);
  });
});
