import type { Diet, Macros, MealItem, Recipe } from './types';
import { DISHES, INGREDIENTS, dishDiet, dishMacros, type Portion } from './foods';
import { rounded, scale } from './nutrition';

/** One thing a user can log: an ingredient, a dish from the food table, or a library recipe. */
export type FoodKind = 'ingredient' | 'dish' | 'recipe';
export interface FoodRef { kind: FoodKind; id: string; portion: string; qty: number }

export interface Loggable {
  kind: FoodKind;
  id: string;
  name: string;
  hint: string;           // shown under the name in results, e.g. "Dish · 1 katori · 150 g"
  portions: Portion[];
  defaultPortion: number;
  estimated: boolean;
  diet?: Diet;
  /** Macros for `qty` × portion. */
  macros(portion: Portion, qty: number): Macros;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9½ ]+/g, ' ').replace(/\s+/g, ' ').trim();

function fromRecipe(r: Recipe, recipeMacros: (r: Recipe) => Macros): Loggable {
  const per = recipeMacros(r);
  return {
    kind: 'recipe', id: r.id, name: r.name, hint: `Recipe · ${r.minutes} min`, estimated: true, diet: r.diet,
    portions: [{ label: '1 serving', grams: 100 }, { label: '½ serving', grams: 50 }, { label: '2 servings', grams: 200 }], defaultPortion: 0,
    macros: (p, q) => scale(per, (p.grams / 100) * q),
  };
}

export function catalogue(recipes: Recipe[], recipeMacros: (r: Recipe) => Macros): (Loggable & { keys: string[] })[] {
  const dishes = DISHES.map((d) => {
    const per = dishMacros(d);
    const def = Math.max(0, d.portions.findIndex((p) => p.grams === 100));
    return {
      kind: 'dish' as const, id: d.id, name: d.name, hint: `Dish · ${d.serving}`, estimated: true, diet: dishDiet(d),
      portions: d.portions, defaultPortion: def,
      macros: (p: Portion, q: number) => scale(per, (p.grams / 100) * q),
      keys: [d.name, ...d.aliases].map(norm),
    };
  });
  const ingredients = INGREDIENTS.map((i) => ({
    kind: 'ingredient' as const, id: i.id, name: i.name, hint: `${i.brand ? `Packaged · ${i.brand}` : 'Ingredient'} · per ${i.portions[0].label}`, estimated: !i.reviewed,
    portions: i.portions.some((p) => p.grams === 100) ? i.portions : [...i.portions, { label: '100 g', grams: 100 }], defaultPortion: 0,
    macros: (p: Portion, q: number) => scale(i.per100g, (p.grams / 100) * q),
    keys: [i.name, ...i.aliases].map(norm),
  }));
  const recs = recipes.map((r) => ({ ...fromRecipe(r, recipeMacros), keys: [norm(r.name)] }));
  return [...dishes, ...recs, ...ingredients];
}

const KIND_BOOST: Record<FoodKind, number> = { dish: 6, recipe: 4, ingredient: 0 };

/**
 * Ranked search over dishes, recipes and ingredients. Matches English names and Hindi/Hinglish aliases.
 * `strict` (for menus and speech) matches whole words only, so "kheer" doesn't become "kheera" (cucumber);
 * a menu line like "boondi raita" still finds "raita" through its last word.
 */
export function searchFoods(query: string, items: (Loggable & { keys: string[] })[], limit = 8, strict = false): Loggable[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(' ');
  const sing = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
  const scored: { item: Loggable; score: number }[] = [];
  for (const it of items) {
    let best = 0;
    it.keys.forEach((k, idx) => {
      const name = idx === 0;
      let s = 0;
      if (strict) {
        const words = new Set(k.split(' ').map(sing));
        const hits = tokens.filter((t) => words.has(sing(t))).length;
        if (k === q) s = name ? 100 : 92;
        else if (hits === tokens.length) s = (name ? 70 : 64) - Math.max(0, words.size - tokens.length) * 3;
        else if (words.has(sing(tokens[tokens.length - 1]))) s = 30 + hits * 4 - words.size;
      } else if (k === q) s = name ? 100 : 92;
      else if (k.startsWith(q)) s = name ? 80 : 72;
      else if (k.split(' ').some((w) => w.startsWith(q))) s = name ? 64 : 58;
      else if (k.includes(q)) s = name ? 50 : 42;
      else if (tokens.length > 1 && tokens.every((t) => k.includes(t))) s = 36;
      best = Math.max(best, s);
    });
    if (best > 0) scored.push({ item: it, score: best + KIND_BOOST[it.kind] });
  }
  return scored.sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length).slice(0, limit).map((x) => x.item);
}

const FRAC: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
/** 1.5 → "1½", 0.75 → "¾", 2 → "2", 1.3 → "1.3". */
export function qtyText(q: number): string {
  const whole = Math.floor(q), part = Math.round((q - whole) * 100) / 100;
  if (part === 0) return String(whole);
  if (FRAC[part]) return `${whole || ''}${FRAC[part]}`;
  return q.toFixed(1).replace(/\.0$/, '');
}
/** "1 katori" × 1.5 → "1½ katori"; "2 roti" × 2 → "2 × 2 roti"; "1 serving" × 0.75 → "¾ serving". */
export function amountLabel(portion: Portion, qty: number): string {
  if (qty === 1) return portion.label;
  const m = portion.label.match(/^1 (.+)$/);
  if (m) return `${qtyText(qty)} ${m[1]}${qty > 1 && /^(serving|scoop|slice|egg|cup|glass|plate|bowl|chilla|dosa|idli|samosa|sandwich|piece|egg white)$/.test(m[1]) ? 's' : ''}`;
  return `${qtyText(qty)} × ${portion.label}`;
}

/** A meal item for `qty` × portion of a loggable, rounded to whole numbers. */
export function itemFrom(l: Loggable, portionIndex: number, qty: number, id: string, source: MealItem['source'] = 'typed'): MealItem {
  const p = l.portions[portionIndex] ?? l.portions[0];
  return {
    id, name: l.name, amount: amountLabel(p, qty), macros: rounded(l.macros(p, qty)), source,
    recipeId: l.kind === 'recipe' ? l.id : undefined,
    estimated: l.estimated || undefined,
    ref: { kind: l.kind, id: l.id, portion: p.label, qty },
  };
}

/** A typed item the table doesn't know yet. */
export function customItem(name: string, kcal: number, protein: number, id: string): MealItem {
  return { id, name: name.trim(), amount: 'Custom', macros: { kcal: Math.round(kcal), protein: Math.round(protein), carbs: 0, fat: 0 }, source: 'typed' };
}

/** Coach-matched names (S20.1 unmatched foods): { "poha with peanuts": "dish:poha" } become extra search keys. */
export function withAliases<T extends Loggable & { keys: string[] }>(cat: T[], map: Record<string, string>): T[] {
  const entries = Object.entries(map);
  if (!entries.length) return cat;
  return cat.map((l) => {
    const extra = entries.filter(([, to]) => to === `${l.kind}:${l.id}`).map(([name]) => norm(name));
    return extra.length ? { ...l, keys: [...l.keys, ...extra] } : l;
  });
}
