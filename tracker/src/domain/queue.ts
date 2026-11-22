import type { AppData, FormReview, LabMarker, Plan, PlanChange } from './types.js';

/**
 * The coach queue (S20.1): Form Checks, lab checks, weekly report drafts, unmatched foods and
 * requests for a coach, in one list. Members create items; coaches work them from the coach desk
 * (api/ops), which writes `result`. The app merges results back into the member's data.
 */

export type QueueKind = 'form' | 'labs' | 'report' | 'food' | 'lead';
export const KIND_TITLE: Record<QueueKind, string> = { form: 'Form Check', labs: 'Lab check', report: 'Report draft', food: 'Unmatched food', lead: 'Coach request' };
export const DUE_HOURS: Record<QueueKind, number> = { form: 24, labs: 48, report: 1, food: 168, lead: 24 };

export interface QueuePayloads {
  form: { formId: string; exercise: string; kg: number; reps: number; note: string; videoPath: string; fileName: string; durationSec: number | null };
  labs: { labId: string; date: string; markers: LabMarker[] };
  report: { week: string };
  food: { name: string; count: number };
  lead: { message: string };
}
export interface QueueResults {
  form: FormReview;
  labs: { markers: LabMarker[]; note: string; by: string };
  report: { approvedBy: string; changes?: PlanChange[] };
  food: { mapTo: string | null; note: string };
  lead: { coachUid: string; coachName: string };
}

export interface QueueItem<K extends QueueKind = QueueKind> {
  id: string; uid: string; kind: K; status: 'open' | 'claimed' | 'done';
  createdAt: string; dueAt: string; title: string; detail: string;
  member: { name: string; plan: Plan };
  payload: QueuePayloads[K];
  timeSec: number;
  claimedBy?: { uid: string; name: string } | null;
  doneAt?: string; doneBy?: string;
  result?: QueueResults[K];
}
export type NewQueueItem = Omit<QueueItem, 'claimedBy' | 'doneAt' | 'doneBy' | 'result'>;

export function newQueueItem<K extends QueueKind>(kind: K, o: { id: string; uid: string; member: QueueItem['member']; title: string; detail: string; payload: QueuePayloads[K]; nowMs: number; dueAt?: string }): NewQueueItem {
  return { id: o.id, uid: o.uid, kind, status: 'open', createdAt: new Date(o.nowMs).toISOString(), dueAt: o.dueAt ?? new Date(o.nowMs + DUE_HOURS[kind] * 3_600_000).toISOString(), title: o.title, detail: o.detail, member: o.member, payload: o.payload, timeSec: 0 };
}

/** Open work first: overdue, then soonest due; done items last, newest first. */
export function sortQueue(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || (a.status === 'done' ? (b.doneAt ?? '').localeCompare(a.doneAt ?? '') : a.dueAt.localeCompare(b.dueAt)));
}

export function isOverdue(i: QueueItem, nowMs: number): boolean { return i.status !== 'done' && new Date(i.dueAt).getTime() < nowMs; }

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Counts and time for the coach desk header. */
export function queueStats(items: QueueItem[], nowMs: number, coachUid?: string) {
  const open = items.filter((i) => i.status !== 'done');
  const dayAgo = nowMs - 86_400_000;
  const done = items.filter((i) => i.status === 'done' && (!coachUid || i.claimedBy?.uid === coachUid || !i.claimedBy));
  const doneToday = done.filter((i) => i.doneAt && new Date(i.doneAt).getTime() >= dayAgo);
  const turnaround = done.filter((i) => i.kind === 'form' && i.doneAt).map((i) => (new Date(i.doneAt!).getTime() - new Date(i.createdAt).getTime()) / 3_600_000);
  return {
    open: open.length,
    overdue: open.filter((i) => isOverdue(i, nowMs)).length,
    byKind: Object.fromEntries((Object.keys(KIND_TITLE) as QueueKind[]).map((k) => [k, open.filter((i) => i.kind === k).length])) as Record<QueueKind, number>,
    doneToday: doneToday.length,
    minutesToday: Math.round(doneToday.reduce((s, i) => s + i.timeSec, 0) / 60),
    medianMinutes: Math.round(median(done.map((i) => i.timeSec / 60)) * 10) / 10,
    formTurnaroundHours: Math.round(median(turnaround) * 10) / 10,
  };
}

/** Bring coach results into the member's data: reviews into Form Checks, checks into lab reports, an assigned coach into the request. */
export function mergeResults(d: AppData, items: QueueItem[]): AppData {
  let out = d;
  for (const i of items) {
    if (i.kind === 'form') {
      const p = i.payload as QueuePayloads['form'];
      const fc = out.formChecks.find((f) => f.id === p.formId);
      if (!fc) continue;
      const status = i.status === 'done' && i.result ? 'reviewed' : i.status === 'claimed' ? 'in_review' : fc.status === 'uploading' || fc.status === 'failed' ? fc.status : 'queued';
      const review = i.status === 'done' ? ((i.result as FormReview) ?? null) : fc.review;
      if (status !== fc.status || review !== fc.review) out = { ...out, formChecks: out.formChecks.map((f) => (f.id === fc.id ? { ...f, status, review } : f)) };
    } else if (i.kind === 'labs' && i.status === 'done' && i.result) {
      const r = i.result as QueueResults['labs'];
      const p = i.payload as QueuePayloads['labs'];
      const lab = out.labs.find((l) => l.id === p.labId);
      if (lab && !lab.coachCheck) out = { ...out, labs: out.labs.map((l) => (l.id === lab.id ? { ...l, markers: r.markers.length ? r.markers : l.markers, coachCheck: { by: r.by, at: i.doneAt ?? new Date().toISOString(), note: r.note } } : l)) };
    } else if (i.kind === 'lead' && i.status === 'done' && out.coachRequest && out.coachRequest.status !== 'assigned') {
      out = { ...out, coachRequest: { ...out.coachRequest, status: 'assigned' } };
    }
  }
  return out;
}
