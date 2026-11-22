import { beforeEach, describe, expect, it } from 'vitest';
import { firstUpload, looksLikeDemo, makeFresh, makeSeed, SCHEMA_VERSION } from '../domain/seed';
import { firstInvalidStep } from '../domain/onboarding';
import { canUse } from '../state/entitlements';
import { LocalRepository } from '../state/repository';
import { reducer } from '../state/store';
import { headline } from '../domain/plateau';
import { today } from '../domain/clock';

/** Minimal localStorage for the repository tests. */
class Mem { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } clear() { this.m.clear(); } }

describe('fresh accounts and the demo (submission fixes)', () => {
  beforeEach(() => { (globalThis as { localStorage?: unknown }).localStorage = new Mem(); });

  it('a new browser starts as an empty free account, not the demo', () => {
    const d = new LocalRepository().load();
    expect(d.demo).toBe(false);
    expect(d.plan).toBe('free');
    expect(d.profile.name).toBe('');
    expect(d.meals).toHaveLength(0);
    expect(d.devices).toEqual({ google: false, strava: false });
    expect(d.onboarding.done).toBe(false);
    expect(d.version).toBe(SCHEMA_VERSION);
    expect(canUse(d, 'analytics')).toBe(false);
    expect(canUse(d, 'weeklyReport')).toBe(true); // first report is free
  });

  it('onboarding makes a fresh user enter their own name and body stats', () => {
    expect(firstInvalidStep(makeFresh().onboarding.draft)).toBeTruthy();
  });

  it('the demo is opt-in and flagged', () => {
    const repo = new LocalRepository();
    repo.load();
    const demo = repo.loadDemo();
    expect(demo.demo).toBe(true);
    expect(demo.profile.name).toBe('Arjun');
    expect(repo.load().demo).toBe(true);
    expect(repo.reset().demo).toBe(false);
  });

  it('flags demo data saved before the flag existed', () => {
    const legacy = makeSeed();
    delete legacy.demo;
    localStorage.setItem('peakx.data.v1', JSON.stringify(legacy));
    expect(new LocalRepository().load().demo).toBe(true);
    expect(looksLikeDemo(makeFresh())).toBe(false);
  });

  it('a new cloud account never starts from the demo', () => {
    const up = firstUpload(makeSeed());
    expect(up.demo).toBe(false);
    expect(up.plan).toBe('free');
    expect(up.meals).toHaveLength(0);
    const mine = reducer(makeFresh(), { type: 'logWeight', date: today(), kg: 70 });
    expect(firstUpload(mine)).toBe(mine);
  });

  it('a fresh user can finish onboarding into their own plan', () => {
    let d = makeFresh();
    d = reducer(d, { type: 'onboardingSet', patch: { name: 'Priya', age: 24, sex: 'female', heightCm: 162, weightKg: 58, goal: 'lose', diet: 'veg' } });
    d = reducer(d, { type: 'onboardingFinish', date: today() });
    expect(d.onboarding.done).toBe(true);
    expect(d.profile.name).toBe('Priya');
    expect(d.weights).toEqual([{ date: today(), kg: 58 }]);
    expect(d.targets.protein).toBeGreaterThan(0);
  });

  it('result headline treats "too early to call" as a caveat', () => {
    expect(headline({ goal: 'strength', stuck: 'lift', weeks: '2', days: '4', sleep: 'under6', food: 'same', protein: 'yes', training: 'progress' } as never)).not.toMatch(/, then too early/);
  });
});
