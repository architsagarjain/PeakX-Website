import { describe, expect, it } from 'vitest';
import { PLATEAU_QUESTIONS, rankCauses, isComplete, answeredCount, levelFor, headline } from '../domain/plateau';
import { applyPlateau, draftFromProfile, firstInvalidStep, recipesForDiet, splitFor, validateStep, clock12 } from '../domain/onboarding';
import { makeSeed, RECIPES } from '../domain/seed';
import { targetsExplain, targetsFor } from '../domain/nutrition';
import { reducer } from '../state/store';
import { migrate } from '../state/migrate';

const ARJUN = { goal: 'strength', stuck: 'lift', weeks: '6', days: '5', sleep: 'u6', food: 'one', protein: 'all', program: 'cut' };

describe('plateau check', () => {
  it('has 8 questions, each with 4 options and unique ids', () => {
    expect(PLATEAU_QUESTIONS).toHaveLength(8);
    for (const q of PLATEAU_QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(4);
    }
    expect(new Set(PLATEAU_QUESTIONS.map((q) => q.id)).size).toBe(8);
  });

  it('ranks volume then sleep for a short-sleeping lifter who cuts sets (matches his weekly report)', () => {
    const top = rankCauses(ARJUN).slice(0, 3);
    expect(top.map((c) => c.id)).toEqual(['volume', 'sleep', 'recovery']);
    expect(top[0]).toMatchObject({ score: 4.5, level: 'High', evidence: 'Sets cut on busy days' });
    expect(top[1]).toMatchObject({ score: 3.5, level: 'High', evidence: 'Under 6 h before training' });
    expect(top[2]).toMatchObject({ level: 'Medium' });
    expect(headline(ARJUN)).toBe('Training volume dropped, then not enough sleep');
  });

  it('updates live: one answer is enough to show a cause', () => {
    expect(rankCauses({})).toEqual([]);
    const r = rankCauses({ protein: 'rare' });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'protein', level: 'High' });
  });

  it('ignores unknown answers and counts progress', () => {
    expect(rankCauses({ sleep: 'nonsense' })).toEqual([]);
    expect(answeredCount({ sleep: 'u6', food: 'nope' })).toBe(1);
    expect(isComplete(ARJUN)).toBe(true);
    expect(isComplete({ ...ARJUN, program: undefined as unknown as string })).toBe(false);
  });

  it('maps scores to levels', () => {
    expect([levelFor(3), levelFor(1.5), levelFor(0.5)]).toEqual(['High', 'Medium', 'Low']);
  });
});

describe('onboarding', () => {
  const seed = makeSeed();
  const draft = draftFromProfile(seed.profile, 72.4);

  it('accepts the seeded profile on every step', () => {
    expect(firstInvalidStep(draft)).toBeNull();
  });

  it('flags out-of-range and missing answers per step', () => {
    expect(validateStep('about', { ...draft, age: 12, name: ' ' })).toEqual({ age: 'Age between 16 and 80', name: 'Add your first name' });
    expect(validateStep('routine', { ...draft, trainingDays: 7, gymTime: '25:00' })).toHaveProperty('gymTime');
    expect(validateStep('diet', { ...draft, mealSources: [] })).toEqual({ mealSources: 'Pick at least one' });
    expect(firstInvalidStep({ ...draft, heightCm: 300 })).toBe('about');
  });

  it('carries plateau answers into the draft', () => {
    const d = applyPlateau({ ...draft, goal: 'lose', trainingDays: 3 }, ARJUN);
    expect(d).toMatchObject({ goal: 'plateau', stuckWeeks: 6, trainingDays: 5, stuckLift: 'Bench press' });
  });

  it('builds a weekly split with at least one rest day', () => {
    for (let n = 1; n <= 8; n++) {
      const s = splitFor(n);
      expect(s).toHaveLength(7);
      expect(s).toContain('Rest');
    }
    expect(splitFor(5).filter((x) => x !== 'Rest')).toHaveLength(5);
    expect(splitFor(4)).toEqual(['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest']);
  });

  it('picks starter recipes by diet', () => {
    expect(recipesForDiet('nonveg', RECIPES)).toHaveLength(RECIPES.length);
    expect(recipesForDiet('veg', RECIPES).every((r) => r.diet === 'veg')).toBe(true);
    expect(recipesForDiet('egg', RECIPES).some((r) => r.diet === 'egg')).toBe(true);
    const vegan = recipesForDiet('vegan', RECIPES);
    expect(vegan.length).toBeGreaterThan(0);
    expect(vegan.flatMap((r) => r.ingredients).some((i) => /paneer|curd/i.test(i.name))).toBe(false);
  });

  it('explains targets with the same numbers it produces', () => {
    const x = targetsExplain(seed.profile, 72.4);
    expect(x.bmr).toBe(1699);
    expect(x.tdee).toBe(Math.round(1699 * 1.55));
    expect(x.targets).toEqual(targetsFor(seed.profile, 72.4));
  });

  it('formats 24-hour times for people', () => {
    expect([clock12('19:00'), clock12('07:30'), clock12('00:05'), clock12('12:00')]).toEqual(['7:00 PM', '7:30 AM', '12:05 AM', '12:00 PM']);
  });
});

describe('store: plateau and onboarding', () => {
  it('saves answers, refuses to complete early, then completes and fills the onboarding draft', () => {
    let s = makeSeed();
    s = reducer(s, { type: 'plateauAnswer', question: 'sleep', option: 'u6' });
    expect(s.plateau.answers.sleep).toBe('u6');
    expect(reducer(s, { type: 'plateauComplete', date: '2026-10-14' })).toBe(s);
    for (const [q, o] of Object.entries(ARJUN)) s = reducer(s, { type: 'plateauAnswer', question: q, option: o });
    s = reducer(s, { type: 'plateauComplete', date: '2026-10-14' });
    expect(s.plateau).toMatchObject({ step: 8, completedOn: '2026-10-14' });
    expect(s.onboarding.draft.stuckWeeks).toBe(6);
  });

  it('keeps the email when the check is retaken', () => {
    let s = reducer(makeSeed(), { type: 'plateauEmail', email: ' Arjun@Example.com ' });
    s = reducer(s, { type: 'plateauAnswer', question: 'sleep', option: 'u6' });
    s = reducer(s, { type: 'plateauReset' });
    expect(s.plateau).toEqual({ answers: {}, step: 0, email: 'arjun@example.com' });
  });

  it('finishing onboarding writes profile, targets and today’s weight', () => {
    let s = makeSeed();
    s = reducer(s, { type: 'onboardingSet', patch: { name: 'Priya', sex: 'female', age: 29, heightCm: 162, weightKg: 61, goal: 'lose', diet: 'veg', trainingDays: 4 } });
    s = reducer(s, { type: 'onboardingFinish', date: '2026-10-14' });
    expect(s.profile).toMatchObject({ name: 'Priya', diet: 'veg', trainingDays: 4, stuckLift: undefined });
    expect(s.targets.kcalTraining).toBe(targetsFor(s.profile, 61).kcalTraining);
    expect(s.weights.find((w) => w.date === '2026-10-14')?.kg).toBe(61);
    expect(s.onboarding.done).toBe(true);
  });

  it('does not finish with invalid answers', () => {
    const s = reducer(makeSeed(), { type: 'onboardingSet', patch: { age: 5 } });
    expect(reducer(s, { type: 'onboardingFinish', date: '2026-10-14' })).toBe(s);
  });
});

describe('migration', () => {
  it('upgrades v1 data and keeps the logs', () => {
    const seed = makeSeed();
    const { plateau: _p, onboarding: _o, sport: _s, mealPlan: _m, coach: _c, unmatchedFoods: _u, trainingOverrides: _t, reminders: _r, ...rest } = seed;
    const v1 = { ...rest, version: 1 };
    const out = migrate(JSON.parse(JSON.stringify(v1)))!;
    expect(out.version).toBe(7);
    expect(out.sport).toBeNull();
    expect(out.meals).toHaveLength(seed.meals.length);
    expect(out.plateau).toEqual({ answers: {}, step: 0 });
    expect(out.onboarding.draft.name).toBe('Arjun');
  });
  it('upgrades v2 data by adding an empty sport program', () => {
    const { sport: _s, mealPlan: _m, coach: _c, unmatchedFoods: _u, trainingOverrides: _t, reminders: _r, ...v2 } = { ...makeSeed(), version: 2 };
    expect(migrate(JSON.parse(JSON.stringify(v2)))).toMatchObject({ version: 7, runs: [], sport: null, billing: null, formChecks: [], plateau: { step: 0 }, mealPlan: null, trainingOverrides: {}, coach: { messages: [] } });
  });
  it('rejects unknown data', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ version: 99 })).toBeNull();
  });
});
