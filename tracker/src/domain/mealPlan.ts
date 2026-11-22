import type { Diet, ISODate, Macros, MealPlan, MealPlanDay, MealSlot, PlannedItem, PlannedMeal, Recipe } from './types';
import { DISHES, INGREDIENTS, dishDiet, dishMacros, ingredient } from './foods';
import { add, rounded, scale, ZERO } from './nutrition';
import { addDays, parse } from './clock';

/**
 * Meal plan (S14.1, Pro). A week of meals from the recipe library and the food table, with servings
 * chosen so every day lands within ±5% of its calorie target and meets the protein target.
 * Search: for each day, try serving sizes (½ to 2) for the four meals and pick the closest feasible combo.
 */

export interface TemplateItem { kind: PlannedItem['kind']; id: string; base?: number }
export interface MealTemplate { slot: MealSlot; name: string; items: TemplateItem[] }
/** [kind, id, base servings] — e.g. ['dish', 'roti', 2] for "2 roti". */
const T = (slot: MealSlot, name: string, ...items: [PlannedItem['kind'], string, number?][]): MealTemplate => ({ slot, name, items: items.map(([kind, id, base]) => ({ kind, id, base })) });

/** Candidate meals per slot. Lunch and dinner pair a curry with a base so plates look like real meals. */
export const TEMPLATES: MealTemplate[] = [
  T('breakfast', 'Poha', ['dish', 'poha-dish']), T('breakfast', 'Upma', ['dish', 'upma']), T('breakfast', 'Idli + sambar', ['dish', 'idli'], ['dish', 'sambar']),
  T('breakfast', 'Besan chilla + hung curd', ['recipe', 'besan-chilla-curd']), T('breakfast', 'Moong dal chilla + curd', ['recipe', 'moong-chilla-curd']),
  T('breakfast', 'Oats with milk', ['dish', 'oats-porridge']), T('breakfast', 'Masala egg bhurji + 2 toast', ['recipe', 'egg-bhurji-toast']),
  T('breakfast', 'Paneer paratha + curd', ['dish', 'paneer-paratha'], ['dish', 'curd-bowl']), T('breakfast', 'Masala omelette + toast', ['dish', 'omelette'], ['ingredient', 'brown-bread']),
  T('lunch', 'Rajma brown rice bowl', ['recipe', 'rajma-rice-bowl']), T('lunch', 'Soya chunk pulao', ['recipe', 'soya-chunk-pulao']), T('lunch', 'Chicken tikka bowl', ['recipe', 'chicken-tikka-bowl']),
  T('lunch', 'Dal tadka + jeera rice + salad', ['dish', 'dal-tadka'], ['dish', 'jeera-rice'], ['ingredient', 'cucumber']), T('lunch', 'Chole + 2 roti', ['dish', 'chole'], ['dish', 'roti', 2]),
  T('lunch', 'Fish curry + rice', ['recipe', 'fish-curry-rice']), T('lunch', 'Palak paneer + 2 roti', ['dish', 'palak-paneer'], ['dish', 'roti', 2]),
  T('lunch', 'Chicken curry + rice', ['dish', 'chicken-curry'], ['dish', 'plain-rice']), T('lunch', 'Kadhi + rice', ['dish', 'kadhi'], ['dish', 'plain-rice']),
  T('dinner', 'Paneer tikka + 2 roti', ['recipe', 'paneer-tikka-roti']), T('dinner', 'Egg curry + 2 roti', ['recipe', 'egg-curry-roti']), T('dinner', 'Dal makhani + 2 roti', ['recipe', 'dal-makhani-roti']),
  T('dinner', 'Moong dal khichdi + raita', ['dish', 'khichdi'], ['dish', 'raita']), T('dinner', 'Matar paneer + 2 roti', ['dish', 'matar-paneer'], ['dish', 'roti', 2]),
  T('dinner', 'Tandoori chicken + salad + roti', ['dish', 'tandoori-chicken'], ['ingredient', 'cucumber'], ['dish', 'roti']), T('dinner', 'Rajma + rice', ['dish', 'rajma'], ['dish', 'plain-rice']),
  T('dinner', 'Mixed veg + dal + 2 roti', ['dish', 'mix-veg'], ['dish', 'moong-dal'], ['dish', 'roti', 2]),
  T('snacks', 'Chana chaat', ['dish', 'chana-chaat']), T('snacks', 'Sprouts salad', ['dish', 'sprouts']), T('snacks', 'Whey shake + banana', ['dish', 'whey-shake'], ['ingredient', 'banana']),
  T('snacks', 'Hung curd + fruit', ['ingredient', 'hung-curd'], ['ingredient', 'apple']), T('snacks', 'Boiled eggs', ['dish', 'boiled-eggs']), T('snacks', 'Masala chai + roasted peanuts', ['dish', 'chai'], ['ingredient', 'peanuts']),
  T('snacks', 'Chana chaat with paneer', ['recipe', 'chana-chaat-paneer']),
  // More non-veg and egg plates, so a non-veg week isn't mostly dal and paneer.
  T('breakfast', 'Egg bhurji + toast', ['dish', 'egg-bhurji'], ['ingredient', 'brown-bread']), T('breakfast', 'Boiled eggs + poha', ['dish', 'boiled-eggs'], ['dish', 'poha-dish']),
  T('lunch', 'Chicken biryani + raita', ['dish', 'chicken-biryani'], ['dish', 'raita']), T('lunch', 'Egg curry + rice', ['dish', 'egg-curry'], ['dish', 'plain-rice']),
  T('lunch', 'Chicken tikka + 2 roti + salad', ['dish', 'chicken-tikka'], ['dish', 'roti', 2], ['ingredient', 'cucumber']),
  T('dinner', 'Butter chicken + 2 roti', ['dish', 'butter-chicken'], ['dish', 'roti', 2]), T('dinner', 'Fish curry + 2 roti', ['dish', 'fish-curry'], ['dish', 'roti', 2]),
  T('dinner', 'Chicken curry + 2 roti', ['dish', 'chicken-curry'], ['dish', 'roti', 2]), T('dinner', 'Egg bhurji + 2 roti', ['dish', 'egg-bhurji'], ['dish', 'roti', 2]),
  T('snacks', 'Chicken tikka (3 pieces)', ['dish', 'chicken-tikka', 0.5]),
];

export const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'snacks', 'dinner'];

/** Protein add-ons the planner can attach to the snack when meals alone fall short of the protein target. */
export const ADD_ONS: { name: string; item: Omit<PlannedItem, 'servings'>; servings: number[] }[] = [
  { name: 'whey shake', item: { kind: 'dish', id: 'whey-shake' }, servings: [1, 2] },
  { name: 'hung curd', item: { kind: 'ingredient', id: 'hung-curd' }, servings: [1, 2] },
  { name: 'egg whites', item: { kind: 'ingredient', id: 'egg-white' }, servings: [3, 6] },
  { name: 'roasted soya', item: { kind: 'ingredient', id: 'soya' }, servings: [1, 2] },
];
/** Serving multipliers the planner may use per slot (snacks stay small; mains can grow). */
const STEPS_BY_SLOT: Record<MealSlot, number[]> = { breakfast: [0.75, 1, 1.25, 1.5], lunch: [0.75, 1, 1.25, 1.5, 1.75, 2], dinner: [0.75, 1, 1.25, 1.5, 1.75, 2], snacks: [0.5, 0.75, 1, 1.25] };
const SERVING_SCALE: Record<PlannedItem['kind'], number> = { recipe: 1, dish: 1, ingredient: 1 }; // servings of the item's first portion

export interface Lookup { recipes: Recipe[]; recipeMacros: (r: Recipe) => Macros }

/** Macros for one serving: recipe = 1 serving, dish = 1 standard serving, ingredient = its first portion. */
export function itemMacros(it: Pick<PlannedItem, 'kind' | 'id'>, lk: Lookup): Macros {
  if (it.kind === 'recipe') { const r = lk.recipes.find((x) => x.id === it.id); return r ? lk.recipeMacros(r) : ZERO; }
  if (it.kind === 'dish') { const d = DISHES.find((x) => x.id === it.id); return d ? dishMacros(d) : ZERO; }
  const i = INGREDIENTS.find((x) => x.id === it.id);
  return i ? scale(i.per100g, i.portions[0].grams / 100) : ZERO;
}
export function itemDiet(it: Pick<PlannedItem, 'kind' | 'id'>, lk: Lookup): Diet {
  if (it.kind === 'recipe') return lk.recipes.find((x) => x.id === it.id)?.diet ?? 'veg';
  if (it.kind === 'dish') return dishDiet(DISHES.find((x) => x.id === it.id)!);
  const g = ingredient(it.id).group;
  return g === 'meat' ? 'nonveg' : g === 'egg' ? 'egg' : g === 'dairy' ? 'veg' : 'vegan';
}
const fits = (user: Diet, item: Diet) => user === 'nonveg' || (user === 'egg' ? item !== 'nonveg' : user === 'veg' ? item === 'veg' || item === 'vegan' : item === 'vegan');

export function templatesFor(diet: Diet, slot: MealSlot, lk: Lookup): MealTemplate[] {
  return TEMPLATES.filter((t) => t.slot === slot && t.items.every((i) => fits(diet, itemDiet(i, lk))));
}
/** True when any item in the meal is meat or fish (or egg, for `egg`). */
export function mealHas(t: Pick<MealTemplate, 'items'>, kind: 'nonveg' | 'egg', lk: Lookup): boolean {
  return t.items.some((i) => itemDiet(i, lk) === kind);
}

/** Monday = 0 … Sunday = 6. */
export const weekdayIndex = (date: ISODate) => (parse(date).getDay() + 6) % 7;
/** The diet to plan a date with: a non-veg or egg eater's veg days plan as vegetarian. */
export function dayDiet(diet: Diet, vegDays: number[] | undefined, date: ISODate): Diet {
  return (diet === 'nonveg' || diet === 'egg') && vegDays?.includes(weekdayIndex(date)) ? 'veg' : diet;
}
/** Identifies what a plan was built for; when the profile no longer matches, the plan is rebuilt. */
export function planKey(diet: Diet, vegDays: number[] | undefined): string {
  return `${diet}|${(diet === 'nonveg' || diet === 'egg') && vegDays?.length ? [...vegDays].sort((a, b) => a - b).join(',') : ''}`;
}

/**
 * On non-veg days one of lunch or dinner (alternating) is always a meat or fish plate; on egg days one of
 * breakfast or dinner has eggs. The other meals stay open, so a non-veg week mixes veg and non-veg food.
 */
function featured(diet: Diet, seed: number): { slot: number; kind: 'nonveg' | 'egg' } | null {
  if (diet === 'nonveg') return { slot: seed % 2 ? 1 : 3, kind: 'nonveg' };
  if (diet === 'egg') return { slot: seed % 2 ? 0 : 3, kind: 'egg' };
  return null;
}

export function mealMacros(m: Pick<PlannedMeal, 'items'>, lk: Lookup): Macros {
  return rounded(m.items.reduce((s, i) => add(s, scale(itemMacros(i, lk), i.servings * SERVING_SCALE[i.kind])), ZERO));
}
export function dayMacros(d: MealPlanDay, lk: Lookup): Macros {
  return rounded(d.meals.reduce((s, m) => add(s, mealMacros(m, lk)), ZERO));
}

export interface DayTarget { kcal: number; protein: number }
const within = (kcal: number, t: number) => Math.abs(kcal - t) <= t * 0.05;

/** Best serving multipliers for a set of meals (some can be fixed). Returns multipliers and whether the day is feasible. */
function bestServings(per: Macros[], t: DayTarget, fixed: (number | null)[], extra: Macros = ZERO, slots: MealSlot[] = SLOT_ORDER): { mult: number[]; ok: boolean; score: number } {
  let best: { mult: number[]; score: number; ok: boolean } | null = null;
  const rec = (i: number, acc: number[], kcal: number, protein: number) => {
    if (i === per.length) {
      const ok = within(kcal, t.kcal) && protein >= t.protein;
      const score = Math.abs(kcal - t.kcal) / t.kcal + Math.max(0, t.protein - protein) / t.protein * 3 - (ok ? 10 : 0);
      if (!best || score < best.score) best = { mult: [...acc], score, ok };
      return;
    }
    for (const s of fixed[i] !== null ? [fixed[i] as number] : STEPS_BY_SLOT[slots[i]]) rec(i + 1, [...acc, s], kcal + per[i].kcal * s, protein + per[i].protein * s);
  };
  rec(0, [], extra.kcal, extra.protein);
  return best!;
}

const templateMacros = (lk: Lookup) => (t: MealTemplate) => t.items.reduce((s, i) => add(s, scale(itemMacros(i, lk), i.base ?? 1)), ZERO);
const density = (lk: Lookup) => (t: MealTemplate) => { const m = templateMacros(lk)(t); return m.protein / Math.max(1, m.kcal); };

function build(tpls: MealTemplate[], mult: number[], addOns: PlannedItem[]): PlannedMeal[] {
  return tpls.map((t, k) => {
    const items: PlannedItem[] = t.items.map((i) => ({ kind: i.kind, id: i.id, servings: Math.round(mult[k] * (i.base ?? 1) * 100) / 100 }));
    if (t.slot !== 'snacks' || !addOns.length) return { slot: t.slot, name: t.name, items };
    const labels = addOns.map((a) => ADD_ONS.find((x) => x.item.id === a.id)?.name ?? a.id);
    return { slot: t.slot, name: [t.name, ...labels].join(' + '), items: [...items, ...addOns.map((a) => ({ ...a, addOn: true }))] };
  });
}
const baseName = (m: PlannedMeal) => m.name.split(' + ').filter((part) => !ADD_ONS.some((a) => a.name === part)).join(' + ');
const addOnsFor = (diet: Diet, lk: Lookup) => ADD_ONS.filter((a) => fits(diet, itemDiet(a.item, lk)));

/** Plan one day: rotate through templates by `seed`, try protein add-ons when needed, keep the closest feasible day. */
export function planDay(date: ISODate, t: DayTarget, diet: Diet, seed: number, lk: Lookup, avoid: Set<string> = new Set()): MealPlanDay {
  const feat = featured(diet, seed);
  const pools = SLOT_ORDER.map((s, k) => {
    const pool = templatesFor(diet, s, lk);
    if (!feat || feat.slot !== k) return pool;
    const only = pool.filter((p) => mealHas(p, feat.kind, lk));
    return only.length ? only : pool;
  });
  const adds = addOnsFor(diet, lk);
  let best: { meals: PlannedMeal[]; ok: boolean; score: number } | null = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    // First 8 attempts rotate for variety; later ones lean on the most protein-dense options.
    const pick = pools.map((pool, k) => {
      if (attempt >= 8) { const dense = [...pool].sort((a, b) => density(lk)(b) - density(lk)(a)); return dense[((attempt - 8) >> k) & 1 ? Math.min(1, dense.length - 1) : 0]; }
      const ordered = pool.filter((p) => !avoid.has(p.name)).concat(pool.filter((p) => avoid.has(p.name)));
      return ordered[(seed * (k + 3) + attempt * (k + 1)) % ordered.length];
    });
    const per = pick.map(templateMacros(lk));
    const snackIds = new Set(pick[2].items.map((i) => i.id));
    const usable = adds.filter((a) => !snackIds.has(a.item.id));
    const singles = usable.flatMap((a) => a.servings.map((n) => [{ ...a.item, servings: n }]));
    const pairs = usable.flatMap((a, i) => usable.slice(i + 1).map((b) => [{ ...a.item, servings: a.servings[0] }, { ...b.item, servings: b.servings[0] }]));
    let found = false;
    for (const group of [[[]] as PlannedItem[][], singles, pairs]) {
      for (const addOns of group) {
        const extra = addOns.reduce((s, x) => add(s, scale(itemMacros(x, lk), x.servings)), ZERO);
        const r = bestServings(per, t, [null, null, null, null], extra);
        const score = r.score + addOns.reduce((s, x) => s + 0.004 * x.servings, 0); // prefer real food over add-ons
        if (!best || score < best.score) best = { meals: build(pick, r.mult, addOns), ok: r.ok, score };
        if (r.ok) found = true;
      }
      if (found) break;
    }
    if (best?.ok && attempt >= 2) break;
  }
  return { date, meals: best!.meals };
}

export function planWeek(weekStart: ISODate, targetFor: (d: ISODate) => DayTarget, diet: Diet, lk: Lookup, vegDays: number[] = []): MealPlan {
  const days: MealPlanDay[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const day = planDay(date, targetFor(date), dayDiet(diet, vegDays, date), i + 1, lk, used);
    day.meals.forEach((m) => used.add(baseName(m)));
    if (used.size > 18) used.clear();
    days.push(day);
  }
  return { weekStart, days, createdAt: new Date().toISOString(), dietKey: planKey(diet, vegDays) };
}

/** Re-plan one day (after it becomes, or stops being, a veg day), keeping the rest of the week as it is. */
export function replanDay(plan: MealPlan, date: ISODate, t: DayTarget, diet: Diet, lk: Lookup, vegDays: number[]): MealPlan {
  const i = plan.days.findIndex((d) => d.date === date);
  if (i < 0) return { ...plan, dietKey: planKey(diet, vegDays) };
  const avoid = new Set(plan.days.filter((d) => d.date !== date).flatMap((d) => d.meals.map(baseName)));
  const day = planDay(date, t, dayDiet(diet, vegDays, date), i + 1, lk, avoid);
  return { ...plan, days: plan.days.map((d) => (d.date === date ? day : d)), dietKey: planKey(diet, vegDays) };
}

/** Swap one meal for the next option in its slot, then re-fit servings with the other meals fixed (all meals if needed). */
export function swapMeal(plan: MealPlan, date: ISODate, slot: MealSlot, t: DayTarget, diet: Diet, lk: Lookup): MealPlan {
  const day = plan.days.find((d) => d.date === date);
  if (!day) return plan;
  const idx = day.meals.findIndex((m) => m.slot === slot);
  if (idx < 0) return plan;
  const pool = templatesFor(diet, slot, lk);
  const usedThisWeek = new Set(plan.days.flatMap((d) => d.meals.filter((m) => m.slot === slot).map(baseName)));
  const cur = pool.findIndex((p) => p.name === baseName(day.meals[idx]));
  const order = [...pool.slice(cur + 1), ...pool.slice(0, cur + 1)];
  const next = order.find((p) => !usedThisWeek.has(p.name)) ?? order[0];
  const addOns = day.meals.flatMap((m) => m.items).filter((i) => i.addOn);
  const tplOf = (m: PlannedMeal): MealTemplate => TEMPLATES.find((x) => x.slot === m.slot && x.name === baseName(m)) ?? { slot: m.slot, name: baseName(m), items: m.items.filter((i) => !i.addOn).map(({ kind, id }) => ({ kind, id })) };
  const multOf = (m: PlannedMeal) => { const t = tplOf(m); const first = m.items.find((i) => !i.addOn); return first ? first.servings / (t.items[0]?.base ?? 1) : 1; };
  const tpls: MealTemplate[] = day.meals.map((m, k) => (k === idx ? next : tplOf(m)));
  const per = tpls.map(templateMacros(lk));
  const extra = addOns.reduce((acc, x) => add(acc, scale(itemMacros(x, lk), x.servings)), ZERO);
  let r = bestServings(per, t, day.meals.map((m, k) => (k === idx ? null : multOf(m))), extra);
  let chosen: PlannedItem[] = addOns.map((x) => ({ ...x, addOn: undefined }));
  if (!r.ok) r = bestServings(per, t, [null, null, null, null], extra);
  if (!r.ok) {
    const adds = addOnsFor(diet, lk);
    const groups = [...adds.flatMap((a) => a.servings.map((n) => [{ ...a.item, servings: n }])), ...adds.flatMap((a, i) => adds.slice(i + 1).map((b) => [{ ...a.item, servings: a.servings[0] }, { ...b.item, servings: b.servings[0] }]))];
    for (const g of groups) {
      const rr = bestServings(per, t, [null, null, null, null], g.reduce((acc, x) => add(acc, scale(itemMacros(x, lk), x.servings)), ZERO));
      if (rr.ok) { r = rr; chosen = g; break; }
    }
  }
  const meals = build(tpls, r.mult, chosen);
  return { ...plan, days: plan.days.map((d) => (d.date === date ? { ...d, meals } : d)) };
}

export function dayStatus(d: MealPlanDay, t: DayTarget, lk: Lookup) {
  const m = dayMacros(d, lk);
  return { ...m, kcalOk: within(m.kcal, t.kcal), proteinOk: m.protein >= t.protein, diffPct: Math.round(((m.kcal - t.kcal) / t.kcal) * 100) };
}

/** Map a recipe's ingredient name ("Eggs", "Curd", "Oil") to the food table, so the list doesn't repeat items. Cooked or boiled weights stay separate. */
function canonical(name: string) {
  const n = name.toLowerCase().trim();
  if (/cooked|boiled|,.*,/.test(n)) return null;
  const head = n.split(/[,(]/)[0].trim();
  return INGREDIENTS.find((i) => i.name.toLowerCase() === n)
    ?? INGREDIENTS.find((i) => i.aliases.includes(head) && (n.includes('raw') || !/,/.test(n) || head === n))
    ?? INGREDIENTS.find((i) => i.name.toLowerCase().split(/[,(]/)[0].trim() === head)
    ?? null;
}

/** Grocery list: every ingredient across the week, summed in grams, grouped by aisle. */
export function groceryList(plan: MealPlan, lk: Lookup): { group: string; items: { name: string; grams: number }[] }[] {
  const totals = new Map<string, { grams: number; group: string }>();
  const addG = (raw: string, grams: number, group: string) => {
    const canon = canonical(raw);
    const name = canon?.name ?? raw;
    const cur = totals.get(name);
    totals.set(name, { grams: (cur?.grams ?? 0) + grams, group: cur?.group ?? canon?.group ?? group });
  };
  const groupOf = (name: string) => {
    const hit = INGREDIENTS.find((i) => i.name.toLowerCase() === name.toLowerCase() || name.toLowerCase().startsWith(i.name.split(' (')[0].split(',')[0].toLowerCase()));
    return hit?.group ?? (/chicken|fish|rohu|mutton|egg/i.test(name) ? 'meat' : /paneer|curd|milk|whey/i.test(name) ? 'dairy' : /rice|roti|bread|flour|oats|poha|besan/i.test(name) ? 'cereal' : /dal|rajma|chana|soya|moong/i.test(name) ? 'pulse' : /oil|ghee|butter/i.test(name) ? 'fat' : 'veg');
  };
  for (const d of plan.days) for (const m of d.meals) for (const it of m.items) {
    if (it.kind === 'recipe') lk.recipes.find((r) => r.id === it.id)?.ingredients.forEach((g) => addG(g.name, g.grams * it.servings, groupOf(g.name)));
    else if (it.kind === 'dish') DISHES.find((x) => x.id === it.id)?.parts.forEach(([id, g]) => { const ing = ingredient(id); addG(ing.name, g * it.servings, ing.group); });
    else { const ing = ingredient(it.id); addG(ing.name, ing.portions[0].grams * it.servings, ing.group); }
  }
  const AISLE: Record<string, string> = { veg: 'Vegetables', fruit: 'Fruit', dairy: 'Dairy', meat: 'Meat, fish and eggs', egg: 'Meat, fish and eggs', cereal: 'Grains and breads', pulse: 'Dals and pulses', fat: 'Oils and ghee', nut: 'Nuts', sugar: 'Other', other: 'Other' };
  const groups = new Map<string, { name: string; grams: number }[]>();
  for (const [name, v] of totals) {
    const g = AISLE[v.group] ?? 'Other';
    groups.set(g, [...(groups.get(g) ?? []), { name, grams: Math.ceil(v.grams / 10) * 10 }]);
  }
  const order = ['Vegetables', 'Fruit', 'Dairy', 'Meat, fish and eggs', 'Dals and pulses', 'Grains and breads', 'Oils and ghee', 'Nuts', 'Other'];
  return order.filter((g) => groups.has(g)).map((g) => ({ group: g, items: groups.get(g)!.sort((a, b) => b.grams - a.grams) }));
}

export function groceryText(list: ReturnType<typeof groceryList>, weekLabel: string): string {
  const fmtG = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(g % 1000 ? 1 : 0)} kg` : `${g} g`);
  return [`PeakX grocery list · ${weekLabel}`, '', ...list.flatMap((g) => [g.group, ...g.items.map((i) => `- ${i.name}: ${fmtG(i.grams)}`), ''])].join('\n');
}
