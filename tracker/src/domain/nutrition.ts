import type { Goal, Macros, MealItem, Profile, Targets } from './types.js';

const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 } as const;

/** Resting energy (Mifflin-St Jeor), kcal/day. */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm'>, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(p.sex === 'male' ? base + 5 : base - 161);
}

/** Total daily energy, kcal/day. */
export function tdee(p: Profile, weightKg: number): number {
  return Math.round(bmr(p, weightKg) * ACTIVITY[p.activity]);
}

const GOAL_DELTA: Record<Goal, number> = { lose: -500, recomp: -300, plateau: -250, gain: 250 };

/** Targets from profile and current weight: protein 2 g/kg, fat 25% of kcal, carbs fill the rest; rest days 150 kcal lower. */
export function targetsFor(p: Profile, weightKg: number): Targets {
  const kcalTraining = roundTo(tdee(p, weightKg) + GOAL_DELTA[p.goal], 50);
  const protein = Math.round(weightKg * 2 / 5) * 5;
  const fat = Math.round((kcalTraining * 0.25) / 9 / 5) * 5;
  const carbs = Math.max(0, Math.round((kcalTraining - protein * 4 - fat * 9) / 4 / 10) * 10);
  return { kcalTraining, kcalRest: kcalTraining - 150, protein, carbs, fat, steps: 8000, sleepHours: 7 };
}

/** The working behind targetsFor, for the "Why these numbers" panel. */
export function targetsExplain(p: Profile, weightKg: number) {
  return {
    bmr: bmr(p, weightKg),
    activityFactor: ACTIVITY[p.activity],
    tdee: tdee(p, weightKg),
    goalDelta: GOAL_DELTA[p.goal],
    targets: targetsFor(p, weightKg),
  };
}

export function roundTo(n: number, step: number) { return Math.round(n / step) * step; }

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function add(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat };
}
export function scale(m: Macros, f: number): Macros {
  return { kcal: m.kcal * f, protein: m.protein * f, carbs: m.carbs * f, fat: m.fat * f };
}
export function sumItems(items: MealItem[]): Macros { return items.reduce((s, i) => add(s, i.macros), ZERO); }
export function rounded(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), protein: Math.round(m.protein), carbs: Math.round(m.carbs), fat: Math.round(m.fat) };
}

/** Estimated one-rep max (Epley). */
export function e1rm(kg: number, reps: number): number { return reps <= 1 ? kg : Math.round(kg * (1 + reps / 30)); }

/** Format with Indian/English thousands separator: 1850 → "1,850". */
export function fmt(n: number): string { return Math.round(n).toLocaleString('en-IN'); }
