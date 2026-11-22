import type { Loggable } from './foodSearch';
import { searchFoods } from './foodSearch';
import { rounded } from './nutrition';

/**
 * Mess mode (S14.2, Pro). Read a mess or canteen menu (text, or names from a photo), match dishes to
 * the food table, then choose how much of each fits what's left today, favouring protein.
 */

export interface MenuLine { text: string; match: Loggable | null }
export interface Pick { item: Loggable; portionIndex: number; amount: number }

const SKIP = /^(menu|dinner|lunch|breakfast|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|special)\b/i;

/** "1. Dal makhani\n2. Aloo gobhi · Kheer" → one line per dish, matched to the table. */
export function menuFromText(text: string, cat: (Loggable & { keys: string[] })[]): MenuLine[] {
  const parts = text.split(/\n|,|·|\||;|\/|\band\b|&/i)
    .map((s) => s.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').replace(/[—–-]\s*(veg|non-veg|jain)\s*$/i, '').trim())
    .filter((s) => s.length > 1 && !SKIP.test(s));
  const seen = new Set<string>();
  return parts.filter((p) => !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase())).slice(0, 12)
    .map((p) => ({ text: p, match: searchFoods(p, cat, 1, true)[0] ?? null }));
}

const DESSERT = /kheer|halwa|gulab|jalebi|ladoo|laddu|rasgulla|sweet|ice cream|payasam/i;
const RICE = (l: Loggable) => /rice|biryani|pulao|khichdi/i.test(l.name);
const BREAD = (l: Loggable) => /roti|paratha|naan|chapati|bread/i.test(l.name);

/** Amount options per item: none, half, one, one and a half, two portions (breads by count). */
function options(l: Loggable): { portionIndex: number; amount: number }[] {
  const def = l.defaultPortion;
  if (BREAD(l)) { const one = l.portions.findIndex((p) => /^1 /.test(p.label)); const pi = one >= 0 ? one : def; return [0, 1, 2, 3].map((a) => ({ portionIndex: pi, amount: a })); }
  const one = l.portions.findIndex((p) => p.grams === 100 && l.kind === 'dish');
  const pi = one >= 0 ? one : def;
  return [0, 0.5, 1, 1.5, 2].map((a) => ({ portionIndex: pi, amount: a }));
}

/**
 * Pick amounts that fit `kcalLeft` (up to 3% over) with the most protein, using at most one rice dish
 * and no more than a half portion of dessert. Ties go to the plate closest to the calories left.
 */
export function fitMenu(menu: Loggable[], kcalLeft: number, proteinLeft: number): { picks: Pick[]; kcal: number; protein: number } {
  const items = menu.slice(0, 7);
  const opts = items.map(options);
  const per = items.map((l, i) => opts[i].map((o) => rounded(l.macros(l.portions[o.portionIndex], o.amount || 0))));
  let best: { choice: number[]; score: number; kcal: number; protein: number } | null = null;
  const limit = Math.max(150, kcalLeft) * 1.03;
  const rec = (i: number, choice: number[], kcal: number, protein: number, rice: number) => {
    if (kcal > limit) return;
    if (i === items.length) {
      if (!choice.some((c, k) => opts[k][c].amount > 0)) return;
      const score = Math.min(protein, Math.max(proteinLeft, 1)) * 10 + protein - Math.abs(kcalLeft - kcal) * 0.05;
      if (!best || score > best.score) best = { choice: [...choice], score, kcal, protein };
      return;
    }
    opts[i].forEach((o, c) => {
      if (DESSERT.test(items[i].name) && o.amount > 0.5) return;
      const isRice = RICE(items[i]) && o.amount > 0 ? 1 : 0;
      if (rice + isRice > 1) return;
      rec(i + 1, [...choice, c], kcal + per[i][c].kcal, protein + per[i][c].protein, rice + isRice);
    });
  };
  rec(0, [], 0, 0, 0);
  if (!best) return { picks: [], kcal: 0, protein: 0 };
  const b = best as { choice: number[]; kcal: number; protein: number };
  return {
    picks: items.map((item, i) => ({ item, ...opts[i][b.choice[i]] })).filter((p) => p.amount > 0),
    kcal: b.kcal, protein: b.protein,
  };
}
