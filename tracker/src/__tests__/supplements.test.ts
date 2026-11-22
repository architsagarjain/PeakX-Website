import { describe, expect, it } from 'vitest';
import {
  buildProtocol, buyLinks, emptyAnswers, firstInvalidSuppStep, foodRowsFor, prefillAnswers, previewOf, productsFor, protocolText,
  RESULT_STEP, RULES_VERSION, SUPP_STEPS, toggleFlag, validateSuppStep, type SuppAnswers,
} from '../domain/supplements';
import type { LabReport } from '../domain/types';
import { makeFresh, makeSeed } from '../domain/seed';
import { reducer } from '../state/store';
import { migrate } from '../state/migrate';
import { canUse } from '../state/entitlements';

const TODAY = '2026-10-31';
/** Arjun-like: vegetarian lifter, little sun, no blood work. */
const VEG_LIFTER: SuppAnswers = {
  ...emptyAnswers(), age: 26, sex: 'male', heightCm: 175, weightKg: 72, diet: 'veg',
  food: { dairy: '1_3', legumes: '4_6' }, sun: 'lt10', exercise: '5_7', exerciseType: 'strength',
  flags: ['none'], meds: false, takesSupps: false, bloodwork: 'none',
};
const lab = (date: string, markers: [string, number][]): LabReport => ({
  id: 'lab-t', date, fileName: null, source: 'manual', markers: markers.map(([id, value]) => ({ id, value, unit: '' })), coachCheck: null, sentForCheck: false, retestOn: date,
});
const ids = (a: SuppAnswers, l: LabReport | null = null) => buildProtocol(a, l, TODAY).items.map((i) => `${i.supp}:${i.priority}`);

describe('supplement questionnaire', () => {
  it('has 10 steps with unique ids, and a complete answer set passes every step', () => {
    expect(SUPP_STEPS).toHaveLength(10);
    expect(new Set(SUPP_STEPS.map((s) => s.id)).size).toBe(10);
    expect(SUPP_STEPS[SUPP_STEPS.length - 1].id).toBe('labs');
    expect(firstInvalidSuppStep(VEG_LIFTER)).toBe(RESULT_STEP);
    expect(firstInvalidSuppStep(emptyAnswers())).toBe(0);
  });

  it('blocks under-18s at the age step', () => {
    expect(validateSuppStep('age', { ...VEG_LIFTER, age: 17 })).toMatch(/18/);
    expect(validateSuppStep('age', { ...VEG_LIFTER, age: 18 })).toBe('');
  });

  it('hides animal-food rows that do not fit the diet', () => {
    expect(foodRowsFor('vegan')).toEqual(['dairy', 'legumes']);
    expect(foodRowsFor('egg')).toEqual(['dairy', 'eggs', 'legumes']);
    expect(foodRowsFor('nonveg')).toHaveLength(5);
    // A vegetarian is never asked about fish.
    expect(validateSuppStep('foods', { ...VEG_LIFTER, food: { dairy: 'daily', legumes: 'daily' } })).toBe('');
  });

  it('only asks the training type when they exercise', () => {
    expect(validateSuppStep('exercise', { ...VEG_LIFTER, exercise: '3_4', exerciseType: null })).toMatch(/kind/);
    expect(validateSuppStep('exercise', { ...VEG_LIFTER, exercise: '0', exerciseType: null })).toBe('');
  });

  it('makes "None of these" mutually exclusive and asks to name an other condition', () => {
    expect(toggleFlag(['thyroid'], 'none')).toEqual(['none']);
    expect(toggleFlag(['none'], 'thyroid')).toEqual(['thyroid']);
    expect(toggleFlag(['thyroid', 'bp'], 'thyroid')).toEqual(['bp']);
    expect(validateSuppStep('safety', { ...VEG_LIFTER, flags: ['other'], otherCondition: ' ' })).toMatch(/condition/);
  });

  it('needs the supplements picked when they say they take some, and a confirmed report when they pick one', () => {
    expect(validateSuppStep('meds', { ...VEG_LIFTER, takesSupps: true, current: [] })).toMatch(/Pick/);
    expect(validateSuppStep('labs', { ...VEG_LIFTER, bloodwork: 'report', labId: null })).toMatch(/Confirm/);
    expect(validateSuppStep('labs', { ...VEG_LIFTER, bloodwork: 'skip' })).toBe('');
  });

  it('prefills from the plan without overwriting answers', () => {
    const p = { age: 26, sex: 'male' as const, heightCm: 175, diet: 'egg' as const, trainingDays: 4 };
    expect(prefillAnswers(emptyAnswers(), p, 72.4)).toMatchObject({ age: 26, sex: 'male', heightCm: 175, weightKg: 72.4, diet: 'egg', exercise: '3_4' });
    expect(prefillAnswers({ ...emptyAnswers(), diet: 'vegan' }, p, 72).diet).toBe('vegan');
  });
});

describe('protocol rules', () => {
  it('builds a protocol for a vegetarian lifter with little sun, without calling anything a deficiency', () => {
    const p = buildProtocol(VEG_LIFTER, null, TODAY);
    expect(p.blocked).toBeNull();
    expect(p.rulesVersion).toBe(RULES_VERSION);
    expect(ids(VEG_LIFTER)).toEqual(['vitD:conditional', 'b12:conditional', 'omega3:conditional', 'creatine:optional', 'protein:optional']);
    // No lab: nothing is Core, and nothing claims a deficiency.
    expect(p.items.some((i) => i.priority === 'core')).toBe(false);
    for (const i of p.items) expect(i.why).not.toMatch(/you are deficient|deficiency/i);
    const d = p.items.find((i) => i.supp === 'vitD')!;
    expect(d).toMatchObject({ rule: 'VD-SUN', dose: '1,000 IU (25 mcg) of D3', frequency: 'Daily' });
    expect(d.basis).toContain('No recent vitamin D test');
  });

  it('only shows vegetarian-friendly products (no gelatin softgels, no fish oil) to vegetarians', () => {
    const p = buildProtocol(VEG_LIFTER, null, TODAY);
    const d = p.items.find((i) => i.supp === 'vitD')!;
    expect(d.products.map((x) => x.brand)).toEqual(['Wellbeing Nutrition']);
    const o = p.items.find((i) => i.supp === 'omega3')!;
    expect(o.name).toMatch(/algal/);
    expect(o.products.every((x) => x.suits.includes('veg'))).toBe(true);
    expect(productsFor('fishOil', 'veg')).toEqual([]);
    expect(productsFor('fishOil', 'nonveg').length).toBeGreaterThan(0);
  });

  it('gives buying links on two stores for every product', () => {
    const [p] = productsFor('vitD2000', 'nonveg');
    const links = buyLinks(p);
    expect(links.map((l) => l.store)).toEqual(['Amazon.in', 'Tata 1mg']);
    expect(links[0].url).toBe(`https://www.amazon.in/s?k=${encodeURIComponent(`${p.brand} ${p.name}`)}`);
  });

  it('uses confirmed lab values: 24 ng/mL vitamin D is Core at 2,000 IU; 14 goes to a doctor with no dose', () => {
    const a = { ...VEG_LIFTER, bloodwork: 'report' as const, labId: 'lab-t' };
    const insuf = buildProtocol(a, lab('2026-10-01', [['vitD', 24]]), TODAY);
    expect(insuf.items[0]).toMatchObject({ supp: 'vitD', priority: 'core', rule: 'VD-LAB-INSUF', dose: '2,000 IU (50 mcg) of D3' });
    expect(insuf.biomarkers).toMatchObject({ read: 1, used: 1, historical: false });
    const low = buildProtocol(a, lab('2026-10-01', [['vitD', 14]]), TODAY).items[0];
    expect(low).toMatchObject({ rule: 'VD-LAB-LOW', needsReview: true, products: [] });
    expect(low.dose).toMatch(/doctor/);
    const ok = buildProtocol(a, lab('2026-10-01', [['vitD', 45]]), TODAY).items.find((i) => i.supp === 'vitD')!;
    expect(ok.priority).toBe('not_recommended');
  });

  it('keeps reports over 6 months old as history and does not dose from them', () => {
    const a = { ...VEG_LIFTER, bloodwork: 'report' as const, labId: 'lab-t' };
    const p = buildProtocol(a, lab('2026-01-10', [['vitD', 14]]), TODAY);
    expect(p.biomarkers).toMatchObject({ read: 1, used: 0, historical: true });
    expect(p.items.find((i) => i.supp === 'vitD')!.rule).toBe('VD-SUN');
    expect(p.alerts.some((x) => /6 months/.test(x.title))).toBe(true);
  });

  it('never doses iron without blood work, and leaves the iron dose to a doctor when ferritin is low', () => {
    const female = { ...VEG_LIFTER, sex: 'female' as const };
    const noLab = buildProtocol(female, null, TODAY).items.find((i) => i.supp === 'iron')!;
    expect(noLab).toMatchObject({ priority: 'not_recommended', dose: 'None until tested' });
    const low = buildProtocol({ ...female, bloodwork: 'report', labId: 'lab-t' }, lab('2026-10-01', [['ferritin', 12]]), TODAY).items.find((i) => i.supp === 'iron')!;
    expect(low).toMatchObject({ priority: 'core', needsReview: true, products: [] });
  });

  it('flags overlap with what they already take instead of adding a second product', () => {
    const a: SuppAnswers = { ...VEG_LIFTER, takesSupps: true, current: [{ id: 'creatine', product: 'MB creatine', dose: '5 g', freq: 'daily' }, { id: 'multi', product: '', dose: '', freq: '' }] };
    const p = buildProtocol(a, null, TODAY);
    expect(p.items.find((i) => i.supp === 'creatine')!.overlap).toMatch(/already take creatine \(MB creatine, 5 g, daily\)/);
    expect(p.items.find((i) => i.supp === 'vitD')!.safety.join(' ')).toMatch(/multivitamin/);
  });

  it('applies safety flags: kidney removes creatine and protein, blood thinners withhold omega-3, liver withholds every dose', () => {
    const kidney = buildProtocol({ ...VEG_LIFTER, flags: ['kidney'] }, null, TODAY);
    expect(kidney.items.find((i) => i.supp === 'creatine')!.priority).toBe('not_recommended');
    expect(kidney.items.find((i) => i.supp === 'protein')!.priority).toBe('not_recommended');
    expect(kidney.alerts.some((x) => x.level === 'review')).toBe(true);
    const thin = buildProtocol({ ...VEG_LIFTER, flags: ['bleeding'] }, null, TODAY).items.find((i) => i.supp === 'omega3')!;
    expect(thin).toMatchObject({ needsReview: true, dose: 'Ask your doctor first', products: [] });
    const liver = buildProtocol({ ...VEG_LIFTER, flags: ['liver'] }, null, TODAY);
    for (const i of liver.items.filter((x) => x.priority !== 'not_recommended')) expect(i).toMatchObject({ needsReview: true, dose: 'Ask your doctor for the dose' });
  });

  it('adds a pharmacist check to every item when they take regular medicines', () => {
    const p = buildProtocol({ ...VEG_LIFTER, meds: true, medNames: 'thyroxine' }, null, TODAY);
    expect(p.alerts.find((x) => /medicines/.test(x.title))!.detail).toMatch(/thyroxine/);
    for (const i of p.items) expect(i.safety.join(' ')).toMatch(/pharmacist/);
  });

  it('does not generate a protocol in pregnancy or for minors', () => {
    const preg = buildProtocol({ ...VEG_LIFTER, sex: 'female', flags: ['pregnancy'] }, null, TODAY);
    expect(preg.items).toEqual([]);
    expect(preg.blocked).toMatch(/doctor/);
    expect(buildProtocol({ ...VEG_LIFTER, age: 16 }, null, TODAY).blocked).toMatch(/18/);
  });

  it('traces every item to a rule and the answers it used', () => {
    for (const i of buildProtocol({ ...VEG_LIFTER, sex: 'female' }, null, TODAY).items) {
      expect(i.rule).toMatch(/^[A-Z0-9-]+$/);
      expect(i.basis.length).toBeGreaterThan(0);
    }
  });

  it('previews counts and categories only, keeping safety alerts visible', () => {
    const p = buildProtocol({ ...VEG_LIFTER, flags: ['surgery'] }, null, TODAY);
    const pv = previewOf(p);
    expect(pv.count).toBe(5);
    expect(pv.categories).toEqual([{ name: 'Nutrient support', count: 3 }, { name: 'Performance support', count: 2 }]);
    expect(pv.alerts.map((x) => x.title)).toContain('Surgery coming up');
    expect(JSON.stringify(pv)).not.toMatch(/IU|mcg|Wellbeing/);
  });

  it('writes a plain-text copy for the doctor', () => {
    const t = protocolText(buildProtocol(VEG_LIFTER, null, TODAY), 'Arjun', TODAY);
    expect(t).toMatch(/Supplement protocol for Arjun/);
    expect(t).toMatch(/Rule VD-SUN/);
    expect(t).toMatch(/not a diagnosis/);
  });
});

describe('supplement state', () => {
  it('new and demo accounts start with an empty assessment, and v5 data migrates', () => {
    expect(makeFresh().supplements).toEqual({ answers: emptyAnswers(), step: 0 });
    expect(makeSeed().supplements.step).toBe(0);
    const { supplements: _s, ...v5 } = makeSeed();
    expect(migrate({ ...v5, version: 5 })).toMatchObject({ version: 7, runs: [], supplements: { step: 0 } });
  });

  it('saves answers, refuses to complete an incomplete assessment, and records consent and versions', () => {
    let s = makeFresh();
    s = reducer(s, { type: 'suppComplete', date: TODAY, consentAt: `${TODAY}T10:00:00Z` });
    expect(s.supplements.completedOn).toBeUndefined();
    s = reducer(s, { type: 'suppSet', patch: VEG_LIFTER });
    s = reducer(s, { type: 'suppGo', step: 99 });
    expect(s.supplements.step).toBe(RESULT_STEP - 1);
    s = reducer(s, { type: 'suppComplete', date: TODAY, consentAt: `${TODAY}T10:00:00Z` });
    expect(s.supplements).toMatchObject({ step: RESULT_STEP, completedOn: TODAY, consentAt: `${TODAY}T10:00:00Z`, rulesVersion: RULES_VERSION, questionnaireVersion: 'q1.0' });
    s = reducer(s, { type: 'suppReset' });
    expect(s.supplements.step).toBe(0);
    expect(s.supplements.answers.diet).toBe('veg');
  });

  it('the full protocol is a Pro feature', () => {
    expect(canUse({ plan: 'free', firstReportUsed: false }, 'supplements')).toBe(false);
    expect(canUse({ plan: 'pro', firstReportUsed: true }, 'supplements')).toBe(true);
  });
});
