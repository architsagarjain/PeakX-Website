import type { Macros } from './types';
import { add, rounded, scale, ZERO } from './nutrition';
import { DISHES, dishMacros, ingredient } from './foods';

/**
 * Eating out (S14.3, Pro): what to order by type of place, with kcal and protein per order.
 * Orders built from food-table dishes use those numbers; restaurant-only items (momos, pizza…)
 * carry PeakX estimates for a typical Indian portion and are marked estimated.
 * DRAFT content for the nutrition team to review.
 */

type Part = { dish: string; servings: number } | { ingredient: string; servings: number } | { estimate: Macros };
export interface Order { name: string; parts: Part[]; tip?: string }
export interface Place { id: string; name: string; hint: string; orders: Order[]; avoid?: string }

const d = (dish: string, servings = 1): Part => ({ dish, servings });
const g = (ingredientId: string, servings = 1): Part => ({ ingredient: ingredientId, servings });
const e = (kcal: number, protein: number, carbs: number, fat: number): Part => ({ estimate: { kcal, protein, carbs, fat } });

export const PLACES: Place[] = [
  { id: 'dhaba', name: 'North Indian / dhaba', hint: 'Tandoor, dal, roti', avoid: 'Butter chicken with two butter naan is close to 1,000 kcal.', orders: [
    { name: 'Tandoori chicken (2 pieces) + 1 roti + salad', parts: [d('tandoori-chicken'), d('roti'), g('cucumber')], tip: 'Ask for roti without butter.' },
    { name: 'Chicken tikka (6 pieces) + salad', parts: [d('chicken-tikka'), g('cucumber')] },
    { name: 'Paneer tikka (half) + 2 roti', parts: [e(300, 18, 8, 22), d('roti', 2)], tip: 'Half plate is about 6 pieces.' },
    { name: 'Dal tadka + 2 roti + raita', parts: [d('dal-tadka'), d('roti', 2), d('raita')] },
    { name: 'Chana masala + 2 roti', parts: [d('chole'), d('roti', 2)] },
    { name: 'Butter chicken + 2 butter naan', parts: [d('butter-chicken', 1.5), d('naan', 2)] },
  ] },
  { id: 'south', name: 'South Indian / udupi', hint: 'Idli, dosa, meals', avoid: 'Ghee roast dosa adds about 150 kcal over plain.', orders: [
    { name: '3 idli + sambar', parts: [d('idli', 1.5), d('sambar')] },
    { name: 'Plain dosa + sambar', parts: [d('dosa'), d('sambar')] },
    { name: 'Masala dosa + sambar', parts: [d('masala-dosa'), d('sambar')] },
    { name: 'Egg dosa', parts: [d('dosa'), g('egg', 2)], tip: 'Where it’s on the menu: two eggs on a plain dosa.' },
  ] },
  { id: 'biryani', name: 'Biryani place', hint: 'Biryani, kebabs', avoid: 'A full plate with extra salan is close to 1,200 kcal.', orders: [
    { name: 'Chicken biryani (half) + raita', parts: [d('chicken-biryani', 0.6), d('raita')], tip: 'Ask for leg piece and less rice.' },
    { name: 'Chicken biryani (full)', parts: [d('chicken-biryani', 1.2)] },
    { name: 'Veg biryani (half) + raita', parts: [d('veg-biryani', 0.6), d('raita')] },
    { name: 'Chicken seekh kebab (4) + salad', parts: [e(330, 30, 6, 20), g('cucumber')] },
  ] },
  { id: 'chinese', name: 'Indo-Chinese and momos', hint: 'Momos, noodles, fried rice', avoid: 'Fried momos and Manchurian gravy are the heaviest picks.', orders: [
    { name: 'Steamed chicken momos (8)', parts: [e(360, 22, 44, 9)] },
    { name: 'Steamed veg momos (8)', parts: [e(320, 9, 52, 7)] },
    { name: 'Chilli chicken, dry (half)', parts: [e(380, 28, 16, 22)] },
    { name: 'Chicken fried rice (half)', parts: [e(450, 18, 62, 14)] },
  ] },
  { id: 'pizza', name: 'Pizza', hint: 'Slices, sides', avoid: 'Cheese burst and garlic bread add 300+ kcal.', orders: [
    { name: '2 slices thin-crust chicken tikka (medium)', parts: [e(420, 22, 44, 16)] },
    { name: '2 slices veg, regular crust (medium)', parts: [e(460, 16, 60, 16)] },
  ] },
  { id: 'burger', name: 'Burger, sandwich and wrap', hint: 'Quick-service chains', avoid: 'Fries and a cola add about 550 kcal.', orders: [
    { name: 'Grilled chicken sandwich (6-inch, multigrain)', parts: [e(360, 26, 44, 8)], tip: 'Skip mayo; add extra veggies.' },
    { name: 'Paneer tikka wrap', parts: [e(470, 19, 50, 21)] },
    { name: 'Veg burger', parts: [e(410, 11, 52, 17)] },
  ] },
  { id: 'cafe', name: 'Café', hint: 'Coffee, eggs, sandwiches', orders: [
    { name: 'Masala omelette + 2 toast', parts: [d('omelette'), g('brown-bread', 2)] },
    { name: 'Paneer sandwich', parts: [d('paneer-sandwich')] },
    { name: 'Cold coffee, no syrup', parts: [e(180, 8, 22, 6)] },
  ] },
  { id: 'chaat', name: 'Street food and chaat', hint: 'Chaat, pav bhaji, samosa', avoid: 'Pav bhaji with butter pav is about 650 kcal and little protein.', orders: [
    { name: 'Chana chaat', parts: [d('chana-chaat')] },
    { name: 'Sprouts chaat', parts: [d('sprouts')] },
    { name: 'Samosa (1) + chai', parts: [d('samosa'), d('chai')] },
    { name: 'Pav bhaji (1 plate)', parts: [e(640, 14, 82, 28)] },
  ] },
  { id: 'canteen', name: 'Office canteen thali', hint: 'Dal, sabzi, roti, rice', orders: [
    { name: 'Thali: dal, sabzi, 2 roti, ½ rice, curd', parts: [d('dal-tadka'), d('mix-veg'), d('roti', 2), d('plain-rice', 0.5), d('curd-bowl', 0.5)], tip: 'Skip the papad and sweet to save about 250 kcal.' },
    { name: 'Rajma chawal + salad', parts: [d('rajma'), d('plain-rice'), g('cucumber')] },
    { name: 'Egg curry + 2 roti', parts: [d('egg-curry'), d('roti', 2)] },
  ] },
];

export function orderMacros(o: Order): Macros {
  return rounded(o.parts.reduce((s, p) => {
    if ('estimate' in p) return add(s, p.estimate);
    if ('dish' in p) { const dd = DISHES.find((x) => x.id === p.dish); return dd ? add(s, scale(dishMacros(dd), p.servings)) : s; }
    const i = ingredient(p.ingredient); return add(s, scale(i.per100g, (i.portions[0].grams / 100) * p.servings));
  }, ZERO));
}
export const isEstimated = (o: Order) => o.parts.some((p) => 'estimate' in p);

/** Tag for scanning: high protein (≥ 7 g per 100 kcal), heavy (over 700 kcal), or none. */
export function orderTag(m: Macros): 'High protein' | 'Heavy' | null {
  if (m.kcal > 700) return 'Heavy';
  if (m.protein / Math.max(1, m.kcal) >= 0.07) return 'High protein';
  return null;
}
