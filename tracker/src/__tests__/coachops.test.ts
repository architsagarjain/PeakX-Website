import { describe, expect, it } from 'vitest';
import { makeSeed, RECIPES } from '../domain/seed';
import { addDays, today } from '../domain/clock';
import { reducer } from '../state/store';
import { fixPlanFrom, reviewProblems, checklistFor, activeFixPlans, LIFTS } from '../domain/formcheck';
import { buildSession, sessionFor } from '../domain/training';
import { MARKERS, doctorNote, foodChanges, matchMarker, needsDoctor, recipesFor, statusOf, toStandard, markerDef, calendarLink } from '../domain/labs';
import { mergeResults, newQueueItem, queueStats, sortQueue, type QueueItem } from '../domain/queue';

const d = makeSeed();
const t = today();

describe('Form Check (S18.1)', () => {
  const check = d.formChecks[0];
  it('turns a review into a fix plan that runs until the re-check', () => {
    const p = fixPlanFrom(check, t)!;
    expect(p).toMatchObject({ lift: 'Back squat', loadChangeKg: -5, from: t, until: addDays(t, 13) });
    expect(activeFixPlans([p], addDays(t, 13))).toHaveLength(1);
    expect(activeFixPlans([p], addDays(t, 14))).toHaveLength(0);
  });
  it('puts drills before the lift and applies the load change', () => {
    const p = fixPlanFrom(check, t)!;
    const plain = buildSession('Lower', t, '19:00', d.workouts, 'x');
    const fixed = buildSession('Lower', t, '19:00', d.workouts, 'x', {}, [p]);
    const i = fixed.exercises.findIndex((e) => e.name === 'Back squat');
    expect(fixed.exercises.slice(i - 3, i).map((e) => e.name)).toEqual(check.review!.drills.map((x) => x.name));
    expect(fixed.exercises[i].targetKg).toBe(plain.exercises.find((e) => e.name === 'Back squat')!.targetKg! - 5);
    expect(buildSession('Lower', addDays(t, 20), '19:00', d.workouts, 'x', {}, [p]).exercises).toHaveLength(plain.exercises.length);
  });
  it('checks a coach review before it can be sent', () => {
    expect(reviewProblems({ score: 80, summary: '', findings: checklistFor('Bench press'), drills: [], cue: null })).toContain('Add a one-line summary');
    const findings = checklistFor('Deadlift').map((f, i) => ({ ...f, detail: 'ok', ok: i !== 1 }));
    expect(reviewProblems({ score: 70, summary: 'Hips rise early', findings, drills: [], cue: null })).toContain('Something needs fixing: add a cue or a drill');
    expect(reviewProblems({ score: 70, summary: 'Hips rise early', findings, drills: [], cue: { text: 'Chest up', detail: '' } })).toEqual([]);
    expect(LIFTS).toContain('Back squat');
  });
  it('a newer fix plan for the same lift replaces the old one', () => {
    const p = fixPlanFrom(check, t)!;
    let s = reducer(d, { type: 'addFixPlan', plan: p });
    s = reducer(s, { type: 'addFixPlan', plan: { ...p, id: 'fix-2' } });
    expect(s.fixPlans.map((f) => f.id)).toEqual(['fix-2']);
    expect(sessionFor(s.workouts, s.profile, t, undefined, {}, s.fixPlans)).toBeDefined();
  });
});

describe('blood work (S18.2)', () => {
  it('matches printed names and converts units', () => {
    expect(matchMarker('25-OH Vitamin D (Total)')?.id).toBe('vitD');
    expect(matchMarker('HDL Cholesterol, Direct')?.id).toBe('hdl');
    expect(matchMarker('Cholesterol - Total')?.id).toBe('chol');
    expect(matchMarker('Glycosylated Haemoglobin (HbA1c)')?.id).toBe('hba1c');
    expect(matchMarker('Platelet count')).toBeNull();
    expect(toStandard(markerDef('vitD')!, 50, 'nmol/L')).toBeCloseTo(20.03, 1);
    expect(toStandard(markerDef('glucose')!, 5.5, 'mmol/L')).toBe(99);
    expect(toStandard(markerDef('hba1c')!, 48, 'mmol/mol')).toBeCloseTo(6.54, 1);
    expect(toStandard(markerDef('b12')!, 190, 'pg/mL')).toBe(190);
  });
  it('rates values by sex and flags doctor-level results', () => {
    expect(statusOf(markerDef('hb')!, 12.5, 'male')).toBe('low');
    expect(statusOf(markerDef('hb')!, 12.5, 'female')).toBe('normal');
    expect(statusOf(markerDef('hba1c')!, 5.4, 'male')).toBe('normal');
    expect(needsDoctor(markerDef('vitD')!, 10)).toBe(true);
    expect(needsDoctor(markerDef('vitD')!, 18)).toBe(false);
    expect(MARKERS.length).toBeGreaterThanOrEqual(10);
  });
  it('gives diet-aware food changes and the recipes that help', () => {
    const lab = d.labs[0];
    const veg = foodChanges(lab.markers, 'male', 'veg');
    expect(veg.map((c) => c.marker)).toEqual(['vitD', 'b12']);
    expect(veg.some((c) => /egg|chicken|fish/i.test(c.detail))).toBe(false);
    expect(foodChanges(lab.markers, 'male', 'nonveg').find((c) => c.marker === 'b12')!.detail).toMatch(/chicken or fish/);
    const recs = recipesFor(veg, RECIPES, 'veg');
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.recipe.diet === 'veg' || r.recipe.diet === 'vegan')).toBe(true);
    expect(foodChanges([{ id: 'ferritin', value: 45, unit: 'ng/mL' }], 'male', 'veg')).toEqual([]);
  });
  it('writes a doctor note and a calendar link; saving sets the re-test reminder', () => {
    const lab = d.labs[0];
    expect(doctorNote(lab, 'male', 'Arjun')).toMatch(/Vitamin D: 18 ng\/mL \(low/);
    expect(calendarLink('2026-12-12')).toContain('dates=20261212/20261213');
    const s = reducer(d, { type: 'saveLab', lab: { ...lab, id: 'lab-2', date: t, retestOn: addDays(t, 90) } });
    expect(s.labs[0].id).toBe('lab-2');
    expect(s.reminders.retest).toBe(addDays(t, 90));
  });
});

describe('coach queue (S20.1, S20.2)', () => {
  const now = Date.now();
  const mk = (id: string, kind: QueueItem['kind'], hoursAgo: number, payload: unknown): QueueItem => ({ ...newQueueItem(kind, { id, uid: 'u', member: { name: 'A', plan: 'pro' }, title: id, detail: '', payload: payload as never, nowMs: now - hoursAgo * 3_600_000 }) });
  it('sorts overdue work first and counts it', () => {
    const items = [mk('food', 'food', 1, { name: 'x', count: 2 }), mk('late', 'form', 30, {}), mk('new', 'form', 1, {})];
    expect(sortQueue(items).map((i) => i.id)).toEqual(['late', 'new', 'food']);
    const st = queueStats([...items, { ...mk('d', 'form', 20, {}), status: 'done', doneAt: new Date(now - 3_600_000).toISOString(), timeSec: 600 }], now);
    expect(st).toMatchObject({ open: 3, overdue: 1, doneToday: 1, minutesToday: 10, formTurnaroundHours: 19 });
  });
  it('merges a coach review into the member’s Form Check', () => {
    const fc = { ...d.formChecks[0], id: 'fc-new', status: 'queued' as const, review: null };
    const s0 = { ...d, formChecks: [fc] };
    const claimed = mergeResults(s0, [{ ...mk('fc-new', 'form', 2, { formId: 'fc-new' }), status: 'claimed' }]);
    expect(claimed.formChecks[0].status).toBe('in_review');
    const done = mergeResults(s0, [{ ...mk('fc-new', 'form', 2, { formId: 'fc-new' }), status: 'done', result: d.formChecks[0].review!, doneAt: new Date().toISOString() }]);
    expect(done.formChecks[0]).toMatchObject({ status: 'reviewed', review: { score: 78 } });
  });
  it('merges lab checks and coach assignment', () => {
    const lab = { ...d.labs[0], id: 'lab-x', coachCheck: null };
    const s0 = { ...d, labs: [lab], coachRequest: { at: '', status: 'requested' as const } };
    const out = mergeResults(s0, [
      { ...mk('lab-x', 'labs', 5, { labId: 'lab-x' }), status: 'done', result: { markers: [{ id: 'vitD', value: 19, unit: 'ng/mL' }], note: 'Typo fixed', by: 'Coach Riya' }, doneAt: new Date().toISOString() },
      { ...mk('lead', 'lead', 5, { message: '' }), status: 'done', result: { coachUid: 'c', coachName: 'Riya' } },
    ]);
    expect(out.labs[0]).toMatchObject({ markers: [{ id: 'vitD', value: 19 }], coachCheck: { by: 'Coach Riya', note: 'Typo fixed' } });
    expect(out.coachRequest?.status).toBe('assigned');
  });
});

describe('coach-matched food aliases', () => {
  it('makes a matched name findable', async () => {
    const { catalogue, searchFoods, withAliases } = await import('../domain/foodSearch');
    const { recipeMacros } = await import('../domain/seed');
    const cat = catalogue(RECIPES, recipeMacros);
    const poha = searchFoods('poha', cat, 3)[0];
    const withA = withAliases(cat, { 'kanda batata poha': `${poha.kind}:${poha.id}` });
    expect(searchFoods('kanda batata poha', withA, 3)[0].id).toBe(poha.id);
  });
});
