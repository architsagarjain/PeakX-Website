import { admin, loadUserData } from './_lib/admin.js';
import { feedOk } from './_lib/feed.js';
import { calendarEvents, toICS } from '../src/domain/reminders.js';

/**
 * GET /api/calendar.ics?u=…&k=…  → the member's private training calendar (Google Calendar subscribes)
 * GET /api/feed?type=unsub&u=…&k=… → turns off all PeakX emails for that member
 */
const page = (title: string, body: string, status = 200) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="margin:0;background:#ECECE9;font-family:Georgia,serif;color:#1A1A1A"><div style="max-width:480px;margin:12vh auto;padding:0 20px"><h1 style="font-weight:400">${title}</h1><p style="font:15px/1.5 Arial,sans-serif;color:#4A4A4A">${body}</p><a href="${(process.env.APP_URL ?? process.env.SITE_URL ?? 'https://peakx.live').replace(/\/$/, '')}/#/app/account" style="font:15px Arial,sans-serif;color:#1A1A1A">Open PeakX</a></div></body>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function GET(req: Request) {
  const u = new URL(req.url);
  const type = u.searchParams.get('type') === 'unsub' ? 'unsub' : 'ics';
  const uid = u.searchParams.get('u') ?? '', k = u.searchParams.get('k') ?? '';
  if (!feedOk(uid, type, k)) return type === 'ics' ? new Response('Not found', { status: 404 }) : page('Link not valid', 'This unsubscribe link has expired or was changed. You can turn emails off in Account › Reminders.', 404);
  try {
    if (type === 'unsub') {
      await admin().db.doc(`users/${uid}/private/email`).set({ logNudge: false, reportEmail: false, retest: false, unsubscribedAt: new Date().toISOString() }, { merge: true });
      return page('You’re unsubscribed', 'PeakX won’t email you any more. You can turn reminders back on in Account › Reminders.');
    }
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const data = await loadUserData(uid, today);
    if (!data) return new Response('Not found', { status: 404 });
    return new Response(toICS(calendarEvents(data, today, 4), 'PeakX training'), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=1800' } });
  } catch (e) {
    console.error(e);
    return new Response('Unavailable', { status: 503 });
  }
}

/** One-click unsubscribe from mail apps (RFC 8058: POST to the List-Unsubscribe URL). */
export async function POST(req: Request) {
  const u = new URL(req.url);
  const uid = u.searchParams.get('u') ?? '', k = u.searchParams.get('k') ?? '';
  if (u.searchParams.get('type') !== 'unsub' || !feedOk(uid, 'unsub', k)) return new Response('Not found', { status: 404 });
  await admin().db.doc(`users/${uid}/private/email`).set({ logNudge: false, reportEmail: false, retest: false, unsubscribedAt: new Date().toISOString() }, { merge: true });
  return new Response('Unsubscribed', { status: 200 });
}
