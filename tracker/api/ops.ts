import { handle, json, rateLimit, readJson, HttpError } from './_lib/http.js';
import { admin, bucket, coachFrom, userFrom, type CoachDoc } from './_lib/admin.js';
import type { AssignedCoach, Billing, PlanChange, WeeklyReport } from '../src/domain/types.js';
import type { QueueItem, QueueResults } from '../src/domain/queue.js';
import { reviewProblems } from '../src/domain/formcheck.js';
import { DAY } from '../src/domain/billing.js';

/**
 * Coach desk (S20.1, S20.2). Coaches are accounts with a coaches/{uid} document.
 *   GET  /api/ops?view=me      → { coach | null }               (any signed-in user)
 *   GET  /api/ops?view=queue   → { items, members, coach }      (coaches)
 *   GET  /api/ops?view=usage   → daily event counts and recent errors (coaches)
 *   POST /api/ops { action: 'join', code, name, whatsapp, bookingUrl }  code = COACH_TOKEN
 *   POST /api/ops { action: 'claim' | 'release' | 'time' | 'reviewForm' | 'checkLabs' | 'approveReport'
 *                    | 'resolveFood' | 'assign' | 'activateCoached' | 'profile', … }
 */

const clean = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
const phone = (v: unknown) => { const d = String(v ?? '').replace(/[^\d]/g, ''); return d.length >= 10 ? (d.length === 10 ? `91${d}` : d) : null; };
const url = (v: unknown) => { const s = str(v, 300); return /^https:\/\/\S+$/.test(s) ? s : null; };
const assigned = (c: CoachDoc): AssignedCoach => ({ uid: c.uid, name: c.name, whatsapp: c.whatsapp, bookingUrl: c.bookingUrl, since: new Date().toISOString() });

export const GET = handle(async (req) => {
  const view = new URL(req.url).searchParams.get('view');
  const { db, auth } = admin();
  if (view === 'me') {
    const u = await userFrom(req);
    const s = await db.doc(`coaches/${u.uid}`).get();
    return json({ coach: s.exists ? { ...(s.data() as CoachDoc), uid: u.uid } : null });
  }
  if (view === 'usage') {
    await coachFrom(req);
    const [days, errors] = await Promise.all([
      db.collection('metrics').orderBy((await import('firebase-admin/firestore')).FieldPath.documentId(), 'desc').limit(14).get(),
      db.collection('errors').orderBy('at', 'desc').limit(20).get(),
    ]);
    return json({ days: days.docs.map((d) => ({ date: d.id, ...d.data() })), errors: errors.docs.map((d) => d.data()) });
  }
  if (view !== 'queue') throw new HttpError(400, 'Unknown view');
  const coach = await coachFrom(req);
  const since = new Date(Date.now() - 14 * DAY).toISOString();
  const [open, recent, members] = await Promise.all([
    db.collection('queue').where('status', 'in', ['open', 'claimed']).limit(300).get(),
    db.collection('queue').where('doneAt', '>=', since).limit(200).get(),
    db.collection('members').limit(300).get(),
  ]);
  const items = [...open.docs, ...recent.docs].map((d) => d.data() as QueueItem).filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i);
  const b = items.some((i) => i.kind === 'form' && i.status !== 'done') ? await bucket().catch(() => null) : null;
  const emails = new Map<string, string | null>();
  for (const uid of new Set(items.filter((i) => i.kind === 'lead' && i.status !== 'done').map((i) => i.uid).concat(members.docs.map((m) => m.id)))) {
    emails.set(uid, (await auth.getUser(uid).catch(() => null))?.email ?? null);
  }
  const withMedia = await Promise.all(items.map(async (i) => {
    if (i.kind === 'report' && i.status !== 'done') {
      const r = (await db.doc(`users/${i.uid}/reports/${(i.payload as { week: string }).week}`).get()).data() as WeeklyReport | undefined;
      return { ...i, report: r ? { headline: r.headline, causes: r.causes, changes: r.changes, stats: r.stats ?? null, status: r.status } : null };
    }
    if (i.kind !== 'form' || i.status === 'done' || !b) return { ...i, email: emails.get(i.uid) ?? undefined };
    const p = (i.payload as { videoPath: string }).videoPath;
    const [videoUrl] = await b.file(p).getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60_000 }).catch(() => [null]);
    return { ...i, videoUrl };
  }));
  return json({ coach, items: withMedia, members: members.docs.map((m) => ({ uid: m.id, ...m.data(), email: emails.get(m.id) ?? null })) });
});

type Post = { action: string; id?: string; timeSec?: number; [k: string]: unknown };

export const POST = handle(async (req) => {
  rateLimit(req, 'ops', 600, 60 * 60_000);
  const body = await readJson<Post>(req, 200_000);
  const { db } = admin();

  if (body.action === 'join') {
    const u = await userFrom(req);
    if (!process.env.COACH_TOKEN || body.code !== process.env.COACH_TOKEN) throw new HttpError(403, 'That setup code isn’t right');
    const name = str(body.name, 60);
    if (!name) throw new HttpError(400, 'Add your name as members will see it');
    const doc: Omit<CoachDoc, 'uid'> = { name, email: u.email, whatsapp: phone(body.whatsapp), bookingUrl: url(body.bookingUrl), addedAt: new Date().toISOString() };
    await db.doc(`coaches/${u.uid}`).set(doc);
    return json({ coach: { ...doc, uid: u.uid } });
  }

  const coach = await coachFrom(req);

  if (body.action === 'profile') {
    const patch = { name: str(body.name, 60) || coach.name, whatsapp: phone(body.whatsapp), bookingUrl: url(body.bookingUrl) };
    await db.doc(`coaches/${coach.uid}`).set(patch, { merge: true });
    const mine = await db.collection('members').where('coachUid', '==', coach.uid).get();
    await Promise.all(mine.docs.map((m) => db.doc(`users/${m.id}/private/billing`).set({ coach: { ...assigned({ ...coach, ...patch }), since: (m.data().since as string) ?? new Date().toISOString() } }, { merge: true })));
    return json({ coach: { ...coach, ...patch } });
  }

  if (body.action === 'activateCoached') {
    const uid = str(body.uid, 128), months = Math.max(1, Math.min(12, Number(body.months) || 1));
    if (!uid) throw new HttpError(400, 'Which member?');
    const ref = db.doc(`users/${uid}/private/billing`);
    const cur = (await ref.get()).data() as Billing | undefined;
    const now = Date.now();
    const end = Math.max(now, cur?.paidThroughMs ?? 0) + months * 30 * DAY;
    const next: Billing = { plan: 'coached', kind: 'coached', status: 'active', subscriptionId: cur?.subscriptionId ?? null, startedAt: cur?.startedAt ?? new Date(now).toISOString(), accessFrom: cur?.accessFrom ?? new Date(now).toISOString(), paidThrough: new Date(end).toISOString(), paidThroughMs: end, renewsAt: null, payments: cur?.payments ?? [], refund: cur?.refund ?? null, coach: assigned(coach), manual: true };
    await ref.set(clean(next));
    await db.doc(`members/${uid}`).set({ coachUid: coach.uid, coachName: coach.name, since: new Date(now).toISOString(), until: next.paidThrough, name: str(body.name, 60) || null }, { merge: true });
    return json({ ok: true, billing: next });
  }

  // Everything else works on one queue item.
  const id = str(body.id, 120);
  if (!id) throw new HttpError(400, 'Which item?');
  const ref = db.doc(`queue/${id}`);
  const item = (await ref.get()).data() as QueueItem | undefined;
  if (!item) throw new HttpError(404, 'That item is gone');
  const time = Math.max(0, Math.min(4 * 3600, Number(body.timeSec) || 0));
  const finish = async (result: unknown, extra: Record<string, unknown> = {}) => {
    if (item.status === 'done') throw new HttpError(409, 'Already done');
    await ref.update(clean({ status: 'done', result, doneAt: new Date().toISOString(), doneBy: coach.name, claimedBy: item.claimedBy ?? { uid: coach.uid, name: coach.name }, timeSec: item.timeSec + time, ...extra }));
    return json({ ok: true });
  };

  switch (body.action) {
    case 'claim':
      if (item.claimedBy && item.claimedBy.uid !== coach.uid && item.status === 'claimed') throw new HttpError(409, `${item.claimedBy.name} is on it`);
      await ref.update({ status: 'claimed', claimedBy: { uid: coach.uid, name: coach.name } });
      return json({ ok: true });
    case 'release':
      await ref.update({ status: 'open', claimedBy: null, timeSec: item.timeSec + time });
      return json({ ok: true });
    case 'time':
      await ref.update({ timeSec: item.timeSec + time });
      return json({ ok: true });
    case 'reviewForm': {
      if (item.kind !== 'form') throw new HttpError(400, 'Not a Form Check');
      const r = body.review as QueueResults['form'];
      const problems = reviewProblems(r ?? {});
      if (problems.length) throw new HttpError(400, problems[0]);
      return finish({ ...r, coach: coach.name, at: new Date().toISOString() });
    }
    case 'checkLabs': {
      if (item.kind !== 'labs') throw new HttpError(400, 'Not a lab check');
      const markers = Array.isArray(body.markers) ? (body.markers as { id: string; value: number; unit: string }[]).filter((m) => m && typeof m.value === 'number').slice(0, 30) : [];
      return finish({ markers, note: str(body.note, 500), by: coach.name });
    }
    case 'approveReport': {
      if (item.kind !== 'report') throw new HttpError(400, 'Not a report');
      const week = (item.payload as { week: string }).week;
      const rep = db.doc(`users/${item.uid}/reports/${week}`);
      const r = (await rep.get()).data() as WeeklyReport | undefined;
      if (!r) throw new HttpError(404, 'The report is gone');
      if (r.status === 'published') return finish({ approvedBy: r.approvedBy ?? coach.name });
      const changes = Array.isArray(body.changes) ? (body.changes as PlanChange[]).slice(0, 3) : undefined;
      await rep.update(clean({ status: 'approved', approvedBy: coach.name, ...(changes ? { changes } : {}) }));
      return finish({ approvedBy: coach.name, ...(changes ? { changes } : {}) });
    }
    case 'resolveFood': {
      if (item.kind !== 'food') throw new HttpError(400, 'Not a food');
      const mapTo = str(body.mapTo, 80) || null;
      if (mapTo) await db.doc('config/aliases').set({ map: { [(item.payload as { name: string }).name.toLowerCase().trim()]: mapTo } }, { merge: true });
      return finish({ mapTo, note: str(body.note, 300) });
    }
    case 'assign': {
      if (item.kind !== 'lead') throw new HttpError(400, 'Not a coach request');
      const bref = db.doc(`users/${item.uid}/private/billing`);
      const b = (await bref.get()).data() as Billing | undefined;
      if (b) await bref.set({ coach: assigned(coach) }, { merge: true });
      await db.doc(`members/${item.uid}`).set({ coachUid: coach.uid, coachName: coach.name, since: new Date().toISOString(), name: item.member.name, paying: !!b && b.plan === 'coached' }, { merge: true });
      return finish({ coachUid: coach.uid, coachName: coach.name });
    }
    default:
      throw new HttpError(400, 'Unknown action');
  }
});
