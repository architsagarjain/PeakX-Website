import { handle, json, rateLimit, readJson, HttpError } from './_lib/http.js';
import { admin } from './_lib/admin.js';

/**
 * POST /api/events: the app's own usage and error collector (S24.2 analytics). Point VITE_TELEMETRY_URL
 * at /api/events. Events are counted per day (metrics/{date}); errors keep their message, screen and
 * last action (errors/{id}). Nothing here includes health values, food names or emails.
 */
interface Entry { kind: 'event' | 'error'; name: string; props?: Record<string, unknown>; screen?: string; at?: string; session?: string; release?: string }
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[^\w ./:#()'"-]/g, ' ').slice(0, n);

export const POST = handle(async (req) => {
  rateLimit(req, 'events', 600, 60 * 60_000);
  const e = await readJson<Entry>(req, 8_000);
  if (e.kind !== 'event' && e.kind !== 'error') throw new HttpError(400, 'Bad event');
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return json({ ok: false }, 202);
  const { db } = admin();
  const { FieldValue } = await import('firebase-admin/firestore');
  const day = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const name = clean(e.name, 60).replace(/[ ./#]/g, '_') || 'unknown';
  await db.doc(`metrics/${day}`).set({ [`${e.kind}s`]: { [name]: FieldValue.increment(1) } }, { merge: true });
  if (e.kind === 'error') await db.collection('errors').add({ at: new Date().toISOString(), message: clean(e.name, 300), screen: clean(e.screen, 80), action: clean((e.props as { lastAction?: string })?.lastAction, 80), release: clean(e.release, 40) });
  return json({ ok: true });
});
