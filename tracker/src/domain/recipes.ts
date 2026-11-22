import type { Diet, Recipe } from './types';
import { recipeMacros } from './seed';

/** Recipe library filters (S13.1). Thresholds are per serving. */
export interface RecipeFilter {
  diet: 'all' | Diet;
  highProtein?: boolean;   // ≥ 25 g protein
  under500?: boolean;      // < 500 kcal
  under20?: boolean;       // ≤ 20 minutes
  mess?: boolean;          // works with a mess or canteen kitchen
  saved?: string[];        // only these ids when set
  q?: string;
}
export const HIGH_PROTEIN_G = 25;

/** Diet tabs: Veg = vegetarian only; Eggetarian = veg + egg; Non-veg = recipes with meat or fish. */
export function matchesDiet(r: Recipe, diet: RecipeFilter['diet']): boolean {
  if (diet === 'all') return true;
  if (diet === 'egg') return r.diet === 'veg' || r.diet === 'egg';
  if (diet === 'vegan') return r.diet === 'vegan';
  return r.diet === diet;
}

export function filterRecipes(all: Recipe[], f: RecipeFilter): Recipe[] {
  const q = f.q?.trim().toLowerCase();
  return all.filter((r) => {
    const m = recipeMacros(r);
    if (!matchesDiet(r, f.diet)) return false;
    if (f.highProtein && m.protein < HIGH_PROTEIN_G) return false;
    if (f.under500 && m.kcal >= 500) return false;
    if (f.under20 && r.minutes > 20) return false;
    if (f.mess && !r.tags.includes('mess-friendly')) return false;
    if (f.saved && !f.saved.includes(r.id)) return false;
    if (q && !(r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.name.toLowerCase().includes(q)))) return false;
    return true;
  }).sort((a, b) => recipeMacros(b).protein - recipeMacros(a).protein);
}

/** Protein share Pro would scale one meal to: about 30% of the day's target. */
export function scaledProtein(dayProtein: number): number { return Math.round(dayProtein * 0.3); }
