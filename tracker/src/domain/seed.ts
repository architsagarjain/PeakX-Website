import type { AppData, PlateauState, Profile, Ingredient, Macros, Meal, MealItem, Recipe, WearableDay, WeightEntry, WorkoutSession, FormCheck, LabReport, ISODate } from './types';
import { emptySupplements } from './supplements';
import { addDays, parse, today, weekStart } from './clock';
import type { SportState } from './sport';
import { add, ZERO } from './nutrition';
import { draftFromProfile } from './onboarding';
import { TEMPLATES, planDay } from './training';

/** Arjun plays club badminton: week 3 of 8, matches next Sunday and in weeks 6 and 8. */
export function seedSport(t: string): SportState {
  const mon = weekStart(t);
  return { sport: 'badminton', start: addDays(mon, -14), matches: [
    { id: 'm1', date: addDays(mon, 13), time: '10:00', label: 'Club league' },
    { id: 'm2', date: addDays(mon, 26), time: '10:00', label: 'Club league' },
    { id: 'm3', date: addDays(mon, 39), time: '09:00', label: 'Club finals' },
  ] };
}

export function emptyPlateau(): PlateauState { return { answers: {}, step: 0 }; }

/** Demo account for Arjun, 26, Gurugram. All dates are relative to the real today, so the app always looks current. */

/** v2 plateau + onboarding; v3 sport program; v4 meal plan, coach, unmatched foods, overrides, reminders (see state/migrate.ts). */
export const SCHEMA_VERSION = 7;

/** v7: runs (S11.3). */
export const R7_DEFAULTS = (): Pick<AppData, 'runs'> => ({ runs: [] });

export const R6_DEFAULTS = (): Pick<AppData, 'supplements'> => ({ supplements: emptySupplements() });

export const R5_DEFAULTS = (): Pick<AppData, 'billing' | 'formChecks' | 'fixPlans' | 'labs' | 'coachRequest'> => ({
  billing: null, formChecks: [], fixPlans: [], labs: [], coachRequest: null,
});

export const R3_DEFAULTS = (): Pick<AppData, 'mealPlan' | 'coach' | 'unmatchedFoods' | 'trainingOverrides' | 'reminders'> => ({
  mealPlan: null, coach: { messages: [], usage: { date: '', count: 0 } }, unmatchedFoods: [], trainingOverrides: {}, reminders: { windDown: null },
});

const m = (kcal: number, protein: number, carbs: number, fat: number): Macros => ({ kcal, protein, carbs, fat });
const ing = (name: string, grams: number, kcal: number, p: number, c: number, f: number): Ingredient => ({ name, grams, macros: m(kcal, p, c, f) });

export const RECIPES: Recipe[] = [
  { id: 'chicken-tikka-bowl', name: 'Chicken tikka bowl', diet: 'nonveg', minutes: 30, servings: 1, tags: ['high-protein'],
    ingredients: [ing('Chicken breast', 180, 297, 41, 0, 7), ing('Basmati rice, raw', 50, 175, 4, 39, 0), ing('Hung curd', 60, 48, 5, 3, 2), ing('Onion, capsicum', 100, 35, 1, 7, 0), ing('Oil', 5, 45, 0, 0, 5)],
    steps: ['Marinate chicken in hung curd and tikka spices for 20 minutes.', 'Grill or pan-roast until charred.', 'Serve over rice with onion and capsicum.'] },
  { id: 'soya-chunk-pulao', name: 'Soya chunk pulao', diet: 'veg', minutes: 25, servings: 1, tags: ['high-protein', 'mess-friendly'],
    ingredients: [ing('Soya chunks', 50, 172, 26, 16, 0), ing('Basmati rice, raw', 55, 193, 4, 43, 0), ing('Curd', 100, 60, 3, 4, 4), ing('Onion, peas, tomato', 110, 40, 1, 8, 0), ing('Oil', 5, 45, 0, 0, 5)],
    steps: ['Soak soya chunks in hot water for 10 minutes and squeeze dry.', 'Sauté onion, peas and tomato; add soya and rice.', 'Cook covered with 1.5 cups water; serve with curd.'] },
  { id: 'paneer-bhurji-wrap', name: 'Paneer bhurji wrap', diet: 'veg', minutes: 15, servings: 1, tags: ['high-protein', 'under-500', 'under-20-min'],
    ingredients: [ing('Paneer', 80, 212, 15, 3, 16), ing('Whole-wheat roti', 60, 180, 7, 30, 1), ing('Onion, tomato', 80, 30, 1, 6, 0), ing('Hung curd', 20, 16, 2, 1, 1)],
    steps: ['Crumble paneer and cook with onion, tomato and spices.', 'Fill the roti and roll.'] },
  { id: 'egg-bhurji-toast', name: 'Masala egg bhurji + 2 toast', diet: 'egg', minutes: 10, servings: 1, tags: ['under-500', 'under-20-min'],
    ingredients: [ing('Eggs', 150, 215, 19, 1, 15), ing('Brown bread', 50, 125, 5, 23, 1), ing('Onion, tomato', 80, 30, 1, 6, 0)],
    steps: ['Scramble eggs with onion, tomato, chilli.', 'Serve with toasted bread.'] },
  { id: 'moong-chilla-curd', name: 'Moong dal chilla + curd', diet: 'veg', minutes: 20, servings: 1, tags: ['under-500', 'under-20-min'],
    ingredients: [ing('Moong dal, raw', 60, 210, 15, 35, 1), ing('Curd', 150, 90, 5, 6, 6), ing('Oil', 5, 45, 0, 0, 5)],
    steps: ['Soak and grind moong dal into a batter.', 'Cook thin chillas on a hot tawa.', 'Serve with curd.'] },
  { id: 'rajma-rice-bowl', name: 'Rajma brown rice bowl', diet: 'veg', minutes: 40, servings: 1, tags: ['under-500'],
    ingredients: [ing('Rajma, cooked', 180, 230, 15, 40, 1), ing('Brown rice, raw', 50, 180, 4, 38, 2), ing('Onion, tomato gravy', 100, 50, 1, 8, 2), ing('Oil', 3, 27, 0, 0, 3)],
    steps: ['Pressure-cook soaked rajma.', 'Simmer in onion-tomato gravy.', 'Serve over brown rice.'] },
  { id: 'fish-curry-rice', name: 'Fish curry + rice', diet: 'nonveg', minutes: 35, servings: 1, tags: ['high-protein'],
    ingredients: [ing('Rohu fish', 150, 145, 25, 0, 4), ing('Rice, raw', 60, 210, 4, 47, 0), ing('Curry base', 100, 120, 2, 8, 9)],
    steps: ['Fry the curry base; add fish pieces.', 'Simmer 10 minutes; serve with rice.'] },
  { id: 'egg-curry-roti', name: 'Egg curry + 2 roti', diet: 'egg', minutes: 25, servings: 1, tags: ['under-500'],
    ingredients: [ing('Eggs', 100, 143, 13, 1, 10), ing('Whole-wheat roti', 70, 210, 8, 36, 2), ing('Curry base', 90, 107, 1, 7, 8)],
    steps: ['Boil eggs; add to the curry base.', 'Serve with roti.'] },
  { id: 'chana-chaat-paneer', name: 'Chana chaat with paneer', diet: 'veg', minutes: 10, servings: 1, tags: ['under-500', 'under-20-min', 'mess-friendly'],
    ingredients: [ing('Kala chana, boiled', 150, 200, 11, 30, 3), ing('Paneer', 40, 106, 8, 2, 8), ing('Onion, tomato, lemon', 80, 34, 2, 4, 0)],
    steps: ['Toss chana, cubed paneer, onion and tomato with chaat masala and lemon.'] },
  { id: 'besan-chilla-curd', name: 'Besan chilla + hung curd', diet: 'veg', minutes: 15, servings: 1, tags: ['under-500', 'under-20-min'],
    ingredients: [ing('Besan', 60, 230, 13, 30, 4), ing('Hung curd', 150, 120, 12, 6, 5), ing('Oil', 7, 70, 0, 0, 7)],
    steps: ['Make a thin besan batter with onion and coriander.', 'Cook chillas; serve with hung curd.'] },
  { id: 'paneer-tikka-roti', name: 'Paneer tikka + 2 roti', diet: 'veg', minutes: 30, servings: 1, tags: ['high-protein'],
    ingredients: [ing('Paneer', 120, 318, 22, 4, 24), ing('Whole-wheat roti', 70, 210, 8, 36, 2), ing('Salad', 100, 32, 2, 6, 0)],
    steps: ['Marinate paneer in hung curd and spices.', 'Grill until charred; serve with roti and salad.'] },
  { id: 'dal-makhani-roti', name: 'Dal makhani + 2 roti', diet: 'veg', minutes: 45, servings: 1, tags: [],
    ingredients: [ing('Dal makhani', 150, 230, 9, 22, 12), ing('Whole-wheat roti', 70, 210, 8, 36, 2)],
    steps: ['Slow-cook black urad and rajma with tomato and butter.', 'Serve with roti.'] },
];

export function recipeMacros(r: Recipe): Macros { return r.ingredients.reduce((s, i) => add(s, i.macros), ZERO); }

/** Small deterministic pseudo-random so the demo looks the same on every load. */
function rnd(i: number, s = 1) { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); }
let uid = 0;
const id = (p: string) => `${p}-${++uid}`;
const item = (name: string, amount: string, mac: Macros, source: MealItem['source'] = 'voice', recipeId?: string): MealItem => ({ id: id('it'), name, amount, macros: mac, source, recipeId });

function historyDay(date: string, i: number): Meal[] {
  const dow = parse(date).getDay(); // 0 Sun … 6 Sat
  const out = dow === 5 || dow === 6 ? 340 : Math.round((rnd(i, 3) - 0.5) * 120);
  const protein = dow === 3 ? 118 : dow === 5 ? 96 : 140 + Math.round((rnd(i, 4) - 0.3) * 8);
  const total = 1850 + out;
  const split = [0.22, 0.34, 0.1, 0.34];
  const slots: Meal['slot'][] = ['breakfast', 'lunch', 'snacks', 'dinner'];
  const names = [['Besan chilla + curd', 'Poha + eggs', 'Oats + whey'], ['Rajma chawal', 'Chicken curry + 2 roti', 'Dal, rice, sabzi'], ['Chai + chana', 'Whey + banana', 'Fruit + curd'], ['Paneer bhurji + 2 roti', 'Egg curry + roti', dow === 5 || dow === 6 ? 'Biryani, eaten out' : 'Dal, roti, sabzi']];
  return slots.map((slot, k) => ({
    id: id('meal'), date, slot, time: ['08:30', '13:30', '16:30', '20:30'][k],
    items: [item(names[k][Math.floor(rnd(i, k) * 3)], '1 serving', { kcal: Math.round(total * split[k]), protein: Math.round(protein * split[k]), carbs: Math.round(220 * split[k]), fat: Math.round(60 * split[k]) }, rnd(i, k + 9) > 0.3 ? 'voice' : 'typed')],
  }));
}

function todayMeals(d: string): Meal[] {
  return [
    { id: id('meal'), date: d, slot: 'breakfast', time: '08:30', items: [
      item('Besan chilla × 2', 'Recipe', m(300, 18, 34, 10), 'voice', 'besan-chilla-curd'),
      item('Hung curd', '1 katori · 150 g', m(120, 12, 6, 5), 'voice')] },
    { id: id('meal'), date: d, slot: 'lunch', time: '13:30', items: [
      item('Chicken curry', '1 katori', m(240, 26, 6, 12), 'voice'),
      item('Roti × 2, jeera rice ½ cup, salad', '1 plate', m(400, 12, 90, 8), 'voice')] },
    { id: id('meal'), date: d, slot: 'snacks', time: '16:30', items: [
      item('Masala chai, whey 1 scoop', 'Typed', m(180, 24, 14, 3), 'typed')] },
  ];
}

/** History follows the same plan the app shows (domain/training.ts), so "last time" numbers line up. */
function workoutsFor(dates: string[], t: string, trainingDays: number): WorkoutSession[] {
  const out: WorkoutSession[] = [];
  dates.filter((d) => d < t).forEach((d) => {
    const day = planDay({ trainingDays }, d);
    if (!day.training) return;
    const tpl = TEMPLATES[day.label];
    out.push({
      id: id('wo'), date: d, name: day.label === 'Full body' ? 'Full body' : ['Upper', 'Lower'].includes(day.label) ? `${day.label} body` : day.label, time: '19:00', done: true,
      exercises: tpl.map((e) => ({
        name: e.name, target: `${e.sets} × ${e.reps}`, restSec: e.restSec,
        // The bench stall: last set one rep short every time, so the plan keeps 60 kg.
        // Other lifts went up one step a week, so their history shows progress.
        sets: Array.from({ length: e.sets }, (_, k) => ({
          kg: e.name === 'Bench press' ? e.startKg : Math.max(e.step, e.startKg - e.step * Math.floor((parse(t).getTime() - parse(d).getTime()) / (7 * 864e5))),
          reps: e.name === 'Bench press' && k === e.sets - 1 ? e.reps - 1 : e.reps,
        })),
      })),
    });
  });
  return out;
}

export function makeSeed(): AppData {
  uid = 0;
  const t = today();
  const days = Array.from({ length: 28 }, (_, i) => addDays(t, i - 27));
  const meals: Meal[] = days.slice(0, -1).flatMap((d, i) => historyDay(d, i)).concat(todayMeals(t));
  const weights: WeightEntry[] = days.filter((_, i) => i % 2 === 1 || i === 27).map((d, k, arr) => ({ date: d, kg: Math.round((74.2 - (1.8 * k) / (arr.length - 1) + (rnd(k, 8) - 0.5) * 0.3) * 10) / 10 }));
  weights[weights.length - 1].kg = 72.4;
  const wearable: WearableDay[] = days.map((d, i) => i === 27
    ? { date: d, steps: 6420, sleepHours: 6.2, restingHr: 62, activeMinutes: 38, kcalBurned: 1900, source: 'fitbit' }
    : { date: d, steps: Math.round(6000 + rnd(i, 5) * 3500), sleepHours: Math.round((5.5 + rnd(i, 6) * 2.3) * 10) / 10, restingHr: Math.round(60 + rnd(i, 7) * 4), activeMinutes: Math.round(25 + rnd(i, 2) * 40), kcalBurned: Math.round(2200 + rnd(i, 1) * 300), source: 'fitbit' });
  const profile: Profile = { name: 'Arjun', city: 'Gurugram', age: 26, sex: 'male', heightCm: 176, goal: 'plateau', stuckLift: 'Bench press', stuckWeeks: 3, diet: 'nonveg', mealSources: ['Home', 'PG mess'], voiceLanguages: ['English', 'Hindi'], trainingDays: 5, gymTime: '19:00', activity: 'moderate' };
  return {
    version: SCHEMA_VERSION,
    demo: true,
    plateau: emptyPlateau(),
    onboarding: { step: 'plan', done: true, draft: draftFromProfile(profile, weights[weights.length - 1].kg) },
    plan: 'pro',
    foundingMember: true,
    firstReportUsed: true,
    profile,
    targets: { kcalTraining: 1850, kcalRest: 1700, protein: 140, carbs: 220, fat: 60, steps: 8000, sleepHours: 7 },
    meals,
    workouts: workoutsFor(days, t, profile.trainingDays),
    weights,
    wearable,
    reports: [{
      id: 'rep-last', weekStart: addDays(weekStart(t), -14), free: false, status: 'published', approvedBy: 'PeakX coach',
      headline: 'Bench stalled for 3 weeks: volume dropped and you slept under 6 h before 2 of 3 sessions.',
      causes: [
        { title: 'Bench cut from 4 sets to 3 on busy days', detail: 'Biggest cause', tag: 'Volume' },
        { title: 'Slept under 6 h before 2 of 3 bench days', detail: 'From your Fitbit · 5.6 h average on those nights', tag: 'Sleep' },
        { title: 'Training-day calories ran under target', detail: 'About 150 kcal short', tag: 'Fuel' },
      ],
      changes: [
        { id: 'c1', title: '+1 set on bench', detail: 'Back to 4 × 6 from Monday', status: 'accepted' },
        { id: 'c2', title: '+150 kcal on training days', detail: 'Paneer tikka bowl added on Thu and Sat', status: 'accepted' },
        { id: 'c3', title: 'Wind-down reminder at 11 PM', detail: 'On the night before bench days', status: 'pending' },
      ],
    }],
    savedRecipes: ['soya-chunk-pulao', 'paneer-tikka-roti'],
    devices: { google: true, strava: true },
    sport: seedSport(t),
    ...R3_DEFAULTS(),
    ...R5_DEFAULTS(),
    ...R6_DEFAULTS(),
    ...R7_DEFAULTS(),
    formChecks: seedFormChecks(t),
    labs: seedLabs(t),
    reminders: { windDown: null, retest: seedLabs(t)[0].retestOn },
  };
}

/**
 * A brand-new account: free plan, no history, onboarding not started. Age, height and weight start at 0
 * so onboarding asks for them instead of accepting a made-up default.
 */
export function makeFresh(): AppData {
  const profile: Profile = { name: '', city: '', age: 0, sex: 'male', heightCm: 0, goal: 'plateau', stuckLift: '', stuckWeeks: 3, diet: 'veg', mealSources: ['Home'], voiceLanguages: ['English'], trainingDays: 4, gymTime: '19:00', activity: 'moderate' };
  return {
    version: SCHEMA_VERSION,
    demo: false,
    plateau: emptyPlateau(),
    onboarding: { step: 'goal', done: false, draft: draftFromProfile(profile, 0) },
    plan: 'free',
    foundingMember: false,
    firstReportUsed: false,
    profile,
    targets: { kcalTraining: 2200, kcalRest: 2000, protein: 120, carbs: 250, fat: 65, steps: 8000, sleepHours: 7 },
    meals: [],
    workouts: [],
    weights: [],
    wearable: [],
    reports: [],
    savedRecipes: [],
    devices: { google: false, strava: false },
    sport: null,
    ...R3_DEFAULTS(),
    ...R5_DEFAULTS(),
    ...R6_DEFAULTS(),
    ...R7_DEFAULTS(),
  };
}

/** What a brand-new cloud account starts from: this device's own data, or a fresh account if it holds the demo. */
export function firstUpload(local: AppData): AppData {
  return local.demo ? makeFresh() : local;
}

/** Recognises demo data saved before the `demo` flag existed (it carries the seeded report and checks). */
export function looksLikeDemo(d: Pick<AppData, 'reports' | 'formChecks' | 'labs'>): boolean {
  return d.reports?.some((r) => r.id === 'rep-last') || d.formChecks?.some((f) => f.id === 'fc-demo-squat') || d.labs?.some((l) => l.id === 'lab-demo') || false;
}

/** Demo history: one reviewed squat check (as on the W18 design). */
function seedFormChecks(t: ISODate): FormCheck[] {
  const at = `${addDays(t, -21)}T18:40:00.000Z`;
  return [{
    id: 'fc-demo-squat', exercise: 'Back squat', kg: 80, reps: 5, note: 'Set 3 of 4', submittedAt: at, fileName: 'squat-set3.mp4', sizeMB: 38, durationSec: 24, status: 'reviewed',
    review: {
      coach: 'Coach Riya', at: `${addDays(t, -20)}T13:00:00.000Z`, score: 78, summary: 'Depth and bar path are good. The left knee drifts in on the last two reps.',
      findings: [
        { title: 'Depth', detail: 'Hip at or below knee on all 5 reps', value: '94°', ok: true },
        { title: 'Knee tracking', detail: 'Left knee drifts in on reps 4–5', value: 'Slight cave', ok: false },
        { title: 'Tempo', detail: '2 s down · 1 s pause · 2 s up', value: '2-1-2', ok: true },
        { title: 'Bar path', detail: 'Stays over mid-foot', value: '±3 cm', ok: true },
      ],
      cue: { text: 'Spread the floor.', detail: 'Push your knees out over your little toes as you stand up, most on the last two reps.' },
      drills: [
        { name: 'Banded bodyweight squat', sets: 2, reps: '10', note: 'Warm-up · mini band above knees' },
        { name: 'Paused goblet squat', sets: 2, reps: '8', note: 'Warm-up · 3 s pause · 20 kg' },
        { name: 'Knee-to-wall ankle stretch', sets: 2, reps: '45 s', note: 'Mobility · each side' },
      ],
      loadChangeKg: -5, recheckWeeks: 2,
    },
  }];
}

/** Demo history: a lab report checked by a coach. */
function seedLabs(t: ISODate): LabReport[] {
  const date = addDays(t, -33);
  return [{
    id: 'lab-demo', date, fileName: 'report.pdf', source: 'manual', sentForCheck: true,
    markers: [{ id: 'vitD', value: 18, unit: 'ng/mL' }, { id: 'b12', value: 190, unit: 'pg/mL' }, { id: 'ferritin', value: 45, unit: 'ng/mL' }, { id: 'hba1c', value: 5.4, unit: '%' }],
    coachCheck: { by: 'Coach Riya', at: `${addDays(date, 1)}T10:00:00.000Z`, note: 'Values match the PDF.' },
    retestOn: addDays(date, 90),
  }];
}
