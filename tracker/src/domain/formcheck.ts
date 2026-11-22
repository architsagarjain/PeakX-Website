import type { Drill, FixPlan, FormCheck, FormFinding, FormReview, ISODate } from './types.js';
import { addDays } from './clock.js';
import { TEMPLATES } from './training.js';

/**
 * Form Check (S18.1). Members send one working set on video; a coach reviews it within 24 hours with
 * what's good, what to fix, one cue and drills. Accepting the fix plan adds the drills to every session
 * with that lift (and any load change) until the re-check date. Drill and checklist content is a draft
 * for coach review.
 */

export const MAX_MB = 150;
export const MAX_SECONDS = 90;
export const REVIEW_HOURS = 24;

/** Lifts members can send: every lift in the training templates. */
export const LIFTS = [...new Set(Object.values(TEMPLATES).flat().map((t) => t.name))].sort();

const CHECKS: Record<string, string[]> = {
  'Back squat': ['Depth', 'Knee tracking', 'Tempo', 'Bar path'],
  'Bench press': ['Bar path', 'Elbow angle', 'Leg drive', 'Touch point'],
  Deadlift: ['Back position', 'Hip hinge', 'Bar path', 'Lockout'],
  'Romanian deadlift': ['Back position', 'Hip hinge', 'Range of motion', 'Bar path'],
};
/** The checklist a coach fills for a lift. */
export function checklistFor(lift: string): FormFinding[] {
  return (CHECKS[lift] ?? ['Setup', 'Range of motion', 'Tempo', 'Control']).map((title) => ({ title, detail: '', value: '', ok: true }));
}

/** Drill library by fault, for the coach's quick picks. */
export const DRILLS: Record<string, Drill[]> = {
  'Knee cave': [{ name: 'Banded bodyweight squat', sets: 2, reps: '10', note: 'Warm-up · mini band above knees' }, { name: 'Paused goblet squat', sets: 2, reps: '8', note: 'Warm-up · 3 s pause' }],
  'Ankle mobility': [{ name: 'Knee-to-wall ankle stretch', sets: 2, reps: '45 s', note: 'Mobility · each side' }],
  'Rounded back': [{ name: 'Bird dog', sets: 2, reps: '8', note: 'Warm-up · each side, slow' }, { name: 'Romanian deadlift with dowel', sets: 2, reps: '10', note: 'Warm-up · dowel touching head, back and hips' }],
  'Bar path': [{ name: 'Tempo reps at 60%', sets: 2, reps: '5', note: 'Warm-up · 3 s down, film one set' }],
  'Elbow flare': [{ name: 'Paused bench at 60%', sets: 2, reps: '5', note: 'Warm-up · 1 s pause on chest, elbows 45°' }, { name: 'Band pull-apart', sets: 2, reps: '15', note: 'Warm-up' }],
  'Weak lockout': [{ name: 'Glute bridge', sets: 2, reps: '12', note: 'Warm-up · 2 s squeeze at top' }],
  'Depth': [{ name: 'Box squat to parallel', sets: 2, reps: '6', note: 'Warm-up · light, sit and stand' }],
};

/** A review is complete enough to send. */
export function reviewProblems(r: Partial<FormReview>): string[] {
  const out: string[] = [];
  if (!r.summary?.trim()) out.push('Add a one-line summary');
  if (!r.findings?.length || r.findings.some((f) => !f.detail.trim())) out.push('Fill in every checklist line');
  if (r.findings?.some((f) => !f.ok) && !r.drills?.length && !r.cue) out.push('Something needs fixing: add a cue or a drill');
  if (typeof r.score !== 'number' || r.score < 0 || r.score > 100) out.push('Score must be 0–100');
  return out;
}

export const fixCount = (r: FormReview) => r.findings.filter((f) => !f.ok).length;

/** The fix plan a member adds to training from a reviewed check, starting `from` (usually tomorrow). */
export function fixPlanFrom(check: FormCheck, from: ISODate): FixPlan | null {
  const r = check.review;
  if (!r || (!r.drills.length && !r.loadChangeKg)) return null;
  return { id: `fix-${check.id}`, lift: check.exercise, drills: r.drills, loadChangeKg: r.loadChangeKg, from, until: addDays(from, Math.max(1, r.recheckWeeks) * 7 - 1), source: check.id };
}

export const activeFixPlans = (plans: FixPlan[], date: ISODate) => plans.filter((p) => p.from <= date && date <= p.until);

/** Whether a new check on this lift is due (the re-check date of an active plan has come). */
export function recheckDue(plans: FixPlan[], date: ISODate): FixPlan | null {
  return plans.find((p) => date >= p.until) ?? null;
}

/** Read a video file's duration in the browser (null if it can't). */
export function videoDuration(file: File): Promise<number | null> {
  return new Promise((res) => {
    try {
      const v = document.createElement('video');
      v.preload = 'metadata';
      const url = URL.createObjectURL(file);
      v.onloadedmetadata = () => { URL.revokeObjectURL(url); res(Number.isFinite(v.duration) ? Math.round(v.duration) : null); };
      v.onerror = () => { URL.revokeObjectURL(url); res(null); };
      v.src = url;
    } catch { res(null); }
  });
}
