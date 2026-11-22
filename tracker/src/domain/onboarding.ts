import type { Diet, Goal, Profile, Recipe, Sex, TrainingStyle } from './types.js';
import type { PlateauAnswers } from './plateau.js';

/** Onboarding: 6 steps that turn a new user's answers into a profile, targets, starter recipes and a weekly split. */

export const ONBOARDING_STEPS = [
  { id: 'goal', label: 'Goal' },
  { id: 'about', label: 'About you' },
  { id: 'routine', label: 'Routine' },
  { id: 'diet', label: 'Diet' },
  { id: 'devices', label: 'Devices' },
  { id: 'plan', label: 'Plan ready' },
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]['id'];

export function stepIndex(s: string): number { return ONBOARDING_STEPS.findIndex((x) => x.id === s); }
export function isStep(s: string | undefined): s is OnboardingStep { return !!s && stepIndex(s) >= 0; }

export interface OnboardingDraft {
  goal: Goal;
  stuckLift: string;
  stuckWeeks: number;
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  trainingDays: number;
  gymTime: string;
  activity: Profile['activity'];
  /** Missing on drafts saved before running was added: treat as 'gym'. */
  trainingStyle?: TrainingStyle;
  diet: Diet;
  /** Weekdays (0 = Monday) to keep vegetarian; only used for non-veg and egg eaters. */
  vegDays?: number[];
  mealSources: string[];
  voiceLanguages: string[];
}

export const LIMITS = { age: [16, 80], heightCm: [130, 220], weightKg: [35, 200], trainingDays: [2, 6] } as const;

type Errors = Partial<Record<keyof OnboardingDraft, string>>;

/** Field errors for one step; an empty object means the step can be left. */
export function validateStep(step: OnboardingStep, d: OnboardingDraft): Errors {
  const e: Errors = {};
  const range = (k: 'age' | 'heightCm' | 'weightKg' | 'trainingDays', label: string, unit = '') => {
    const [lo, hi] = LIMITS[k]; const v = d[k];
    if (!Number.isFinite(v) || v < lo || v > hi) e[k] = `${label} between ${lo} and ${hi}${unit}`;
  };
  if (step === 'goal' && d.goal === 'plateau') {
    if (!d.stuckLift.trim()) e.stuckLift = 'Tell us what is stuck';
    if (!(d.stuckWeeks >= 1 && d.stuckWeeks <= 104)) e.stuckWeeks = 'Weeks between 1 and 104';
  }
  if (step === 'about') {
    if (!d.name.trim()) e.name = 'Add your first name';
    range('age', 'Age'); range('heightCm', 'Height', ' cm'); range('weightKg', 'Weight', ' kg');
  }
  if (step === 'routine') {
    range('trainingDays', 'Training days');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.gymTime)) e.gymTime = 'Pick a time';
  }
  if (step === 'diet') {
    if (d.mealSources.length === 0) e.mealSources = 'Pick at least one';
    if (d.voiceLanguages.length === 0) e.voiceLanguages = 'Pick at least one';
  }
  return e;
}

/** First step that still has errors, or null when every step before Plan ready is valid. */
export function firstInvalidStep(d: OnboardingDraft): OnboardingStep | null {
  for (const s of ONBOARDING_STEPS) {
    if (s.id === 'plan') break;
    if (Object.keys(validateStep(s.id, d)).length) return s.id;
  }
  return null;
}

export function draftFromProfile(p: Profile, weightKg: number): OnboardingDraft {
  return {
    goal: p.goal, stuckLift: p.stuckLift ?? '', stuckWeeks: p.stuckWeeks ?? 3,
    name: p.name, age: p.age, sex: p.sex, heightCm: p.heightCm, weightKg,
    trainingDays: p.trainingDays, gymTime: p.gymTime, activity: p.activity, trainingStyle: p.trainingStyle ?? 'gym',
    diet: p.diet, vegDays: [...(p.vegDays ?? [])], mealSources: [...p.mealSources], voiceLanguages: [...p.voiceLanguages],
  };
}

/** Carry plateau-check answers into the draft so the user isn't asked twice. */
export function applyPlateau(d: OnboardingDraft, a: PlateauAnswers): OnboardingDraft {
  const out = { ...d };
  if (a.stuck) {
    out.goal = 'plateau';
    out.stuckLift = { scale: 'Scale weight', lift: d.stuckLift || 'Bench press', size: 'Muscle size', all: 'Weight and lifts' }[a.stuck] ?? d.stuckLift;
  } else if (a.goal) {
    out.goal = ({ lose: 'lose', muscle: 'gain', recomp: 'recomp', strength: 'plateau' } as Record<string, Goal>)[a.goal] ?? d.goal;
  }
  if (a.weeks) out.stuckWeeks = Number(a.weeks);
  if (a.days) out.trainingDays = Number(a.days);
  return out;
}

export function profileFromDraft(d: OnboardingDraft, prev: Profile): Profile {
  return {
    ...prev,
    name: d.name.trim(), age: d.age, sex: d.sex, heightCm: d.heightCm,
    goal: d.goal, stuckLift: d.goal === 'plateau' ? d.stuckLift.trim() : undefined, stuckWeeks: d.goal === 'plateau' ? d.stuckWeeks : undefined,
    diet: d.diet, vegDays: d.diet === 'nonveg' || d.diet === 'egg' ? [...(d.vegDays ?? [])].sort((a, b) => a - b) : [],
    mealSources: d.mealSources, voiceLanguages: d.voiceLanguages,
    trainingDays: d.trainingDays, gymTime: d.gymTime, activity: d.activity, trainingStyle: d.trainingStyle ?? 'gym',
  };
}

/** Weekly split, Monday first. Always keeps at least one rest day. Runners get easy, tempo, interval and long runs. */
export function splitFor(days: number, style: TrainingStyle = 'gym'): string[] {
  const n = Math.min(6, Math.max(2, Math.round(days)));
  const R = 'Rest';
  if (style === 'run') {
    const E = 'Easy run', T = 'Tempo run', L = 'Long run', I = 'Intervals';
    const runs: Record<number, string[]> = {
      2: [R, E, R, R, R, L, R],
      3: [E, R, T, R, R, L, R],
      4: [E, R, T, E, R, L, R],
      5: [E, I, E, R, T, L, R],
      6: [E, I, E, T, E, L, R],
    };
    return runs[n];
  }
  const map: Record<number, string[]> = {
    2: ['Full body', R, R, 'Full body', R, R, R],
    3: ['Full body', R, 'Full body', R, 'Full body', R, R],
    4: ['Upper', 'Lower', R, 'Upper', 'Lower', R, R],
    5: ['Upper', 'Lower', R, 'Push', 'Pull', 'Legs', R],
    6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', R],
  };
  return map[n];
}

export const STYLE_LABEL: Record<TrainingStyle, string> = { gym: 'Gym', run: 'Running', both: 'Gym and running' };
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAIRY = /paneer|curd|milk|ghee|butter|whey|cheese|makhani/i;

/** Library recipes that fit a diet. Vegan = vegetarian recipes with no dairy. */
export function recipesForDiet(diet: Diet, all: Recipe[]): Recipe[] {
  return all.filter((r) => {
    if (diet === 'nonveg') return true;
    if (diet === 'egg') return r.diet === 'veg' || r.diet === 'egg';
    if (diet === 'veg') return r.diet === 'veg';
    return r.diet === 'veg' && !r.ingredients.some((i) => DAIRY.test(i.name));
  });
}

export const GOAL_LABEL: Record<Goal, string> = { lose: 'Lose fat', gain: 'Build muscle', recomp: 'Lose fat, keep muscle', plateau: 'Break a plateau' };
export const DIET_LABEL: Record<Diet, string> = { veg: 'Vegetarian', egg: 'Eggetarian', nonveg: 'Non-vegetarian', vegan: 'Vegan' };
export const ACTIVITY_LABEL: Record<Profile['activity'], string> = { sedentary: 'Desk job, few steps', light: 'Desk job, walk daily', moderate: 'On my feet some of the day', active: 'Physical job or very active' };

/** "19:00" → "7:00 PM" */
export function clock12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h)) return t;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function isEmail(s: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()); }
