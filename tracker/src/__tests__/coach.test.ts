import { describe, expect, it } from 'vitest';
import { coachContext, DAILY_LIMIT, optionsFromAi, ruleReply, suggestOptions, usageLeft } from '../domain/coach';
import { makeSeed } from '../domain/seed';
import { catalogue } from '../domain/foodSearch';
import { RECIPES, recipeMacros } from '../domain/seed';
import { addDays, today } from '../domain/clock';
import { reducer } from '../state/store';
import { remaining } from '../state/selectors';
import { canUse } from '../state/entitlements';
import type { CoachMessage } from '../domain/types';

const d = makeSeed();
const date = today();
const cat = catalogue(RECIPES, recipeMacros);
const msg = (id: string): CoachMessage => ({ id, role: 'user', text: 'hi', at: new Date().toISOString() });

describe('AI Coach (S19.1)', () => {
  it('builds context from targets, today’s log, plan, wearable and trends', () => {
    const c = coachContext(d, date);
    expect(c.targets.kcalToday).toBe(remaining(d, date).target.total);
    expect(c.today.kcalLeft).toBe(remaining(d, date).left);
    expect(c.training).toHaveProperty('session');
    expect(c.last7Days.avgKcal).toBeGreaterThan(0);
    expect(Array.isArray(c.findings)).toBe(true);
    expect(JSON.stringify(c).length).toBeLessThan(12000);
  });

  it('counts 40 messages a day and resets the next day', () => {
    let s = d;
    for (let i = 0; i < DAILY_LIMIT; i++) s = reducer(s, { type: 'coachSend', message: msg(`m${i}`), date });
    expect(usageLeft(s, date)).toBe(0);
    expect(usageLeft(s, addDays(date, 1))).toBe(DAILY_LIMIT);
    s = reducer(s, { type: 'coachSend', message: msg('next'), date: addDays(date, 1) });
    expect(s.coach.usage).toEqual({ date: addDays(date, 1), count: 1 });
    s = reducer(s, { type: 'coachReply', message: { ...msg('r'), role: 'coach' } });
    expect(s.coach.usage.count).toBe(1); // replies don't count
    expect(reducer(s, { type: 'coachClear' }).coach.messages).toEqual([]);
  });

  it('suggests food-table dinners under a cap that respect diet', () => {
    const opts = suggestOptions(cat, { maxKcal: 500, word: 'paneer', diet: 'veg' }, 3);
    expect(opts.length).toBeGreaterThan(0);
    opts.forEach((o) => { expect(o.macros.kcal).toBeLessThanOrEqual(500); expect(o.name.toLowerCase()).toContain('paneer'); expect(o.ref).toBeTruthy(); });
    const veg = suggestOptions(cat, { maxKcal: 600, diet: 'veg' }, 10);
    expect(veg.some((o) => /chicken|fish|mutton|egg/i.test(o.name))).toBe(false);
  });

  it('answers the common questions from the user’s numbers', () => {
    const dinner = ruleReply('What can I eat for dinner under 500 kcal?', d, date, cat);
    expect(dinner.text).toContain('under 500 kcal');
    expect(dinner.options.length).toBeGreaterThan(0);
    expect(ruleReply('Pre-workout snack', d, date, cat).options.every((o) => o.macros.kcal <= 320)).toBe(true);
    expect(ruleReply('Why did my bench stall?', d, date, cat).text).toMatch(/Bench press|stalled/);
    expect(ruleReply('Something from outside', d, date, cat).text).toContain('kcal left');
    expect(ruleReply('hello', d, date, cat).text).toContain('I can help');
  });

  it('turns AI names and amounts into food-table numbers', () => {
    const opts = optionsFromAi([{ name: 'paneer bhurji', quantity: 1, unit: 'katori' }, { name: 'roti', quantity: 2, unit: 'piece' }, { name: 'unicorn steak', quantity: 1, unit: null }], cat);
    expect(opts.length).toBe(2);
    expect(opts[1].amount).toMatch(/^2/);
    expect(opts[1].macros.kcal).toBeGreaterThan(100);
  });

  it('is a Pro feature', () => {
    expect(canUse({ plan: 'free', firstReportUsed: false }, 'aiCoach')).toBe(false);
    expect(canUse({ plan: 'pro', firstReportUsed: true }, 'aiCoach')).toBe(true);
  });
});

describe('Coach option quality', () => {
  it('dinner options are real meals near the cap, pre-workout options have carbs', () => {
    const dinner = ruleReply('dinner under 500', d, date, cat).options;
    dinner.forEach((o) => { expect(o.macros.kcal).toBeGreaterThanOrEqual(225); expect(o.name).not.toMatch(/shake/i); });
    ruleReply('pre-workout snack', d, date, cat).options.forEach((o) => expect(o.macros.carbs).toBeGreaterThanOrEqual(15));
  });
});
