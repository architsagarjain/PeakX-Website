import { randomBytes } from 'node:crypto';
import { handle, json, rateLimit, readJson, HttpError } from './_lib/http.js';
import { admin, userFrom } from './_lib/admin.js';
import { applyReadToStored, authorizeUrl, disconnect, exchange, getStatus, providerConfigured, statusRef, syncUser } from './_lib/wearables.js';
import { feedUrl } from './_lib/feed.js';
import { ALL_READ, type Provider } from '../src/domain/wearables.js';
import type { DeviceRead } from '../src/domain/types.js';

/**
 * Wearables and calendar (S21.1, S22.1).
 *   GET  /api/devices                       → { google, strava } configured flags (no auth)
 *   GET  /api/devices?code=…&state=…        → OAuth redirect back from Google or Strava
 *   POST /api/devices { action: 'start', provider, read? } → { url } to send the browser to
 *   POST /api/devices { action: 'sync', days? }            → { days } synced and combined
 *   POST /api/devices { action: 'settings', read }         → saves what PeakX reads
 *   POST /api/devices { action: 'disconnect', provider }   → revokes and deletes that source's data
 *   POST /api/devices { action: 'calendar' }               → { url } private calendar feed for Google Calendar
 */

const site = () => (process.env.SITE_URL ?? 'https://peakx.live').replace(/\/$/, '');
const app = () => (process.env.APP_URL ?? site()).replace(/\/$/, '');
const back = (q: string) => new Response(null, { status: 302, headers: { Location: `${app()}/#/app/devices?${q}` } });
const todayIst = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const isProvider = (p: unknown): p is Provider => p === 'google' || p === 'strava';

export const GET = handle(async (req) => {
  const u = new URL(req.url);
  const code = u.searchParams.get('code'), state = u.searchParams.get('state'), err = u.searchParams.get('error');
  if (!state) return json({ google: providerConfigured('google'), strava: providerConfigured('strava') });
  const { db } = admin();
  const ref = db.doc(`oauthStates/${state.replace(/[^a-f0-9]/g, '').slice(0, 64)}`);
  const s = (await ref.get()).data() as { uid: string; provider: Provider; read: DeviceRead; exp: number } | undefined;
  await ref.delete().catch(() => undefined);
  if (!s || s.exp < Date.now()) return back('device_error=expired');
  if (err || !code) return back(`device_error=${err === 'access_denied' ? 'denied' : 'failed'}&provider=${s.provider}`);
  try {
    const account = await exchange(s.uid, s.provider, code);
    const now = new Date().toISOString();
    await statusRef(s.uid).set({ [s.provider]: { connected: true, connectedAt: now, lastSync: null, account, error: null }, read: s.read }, { merge: true });
    await syncUser(s.uid, todayIst(), 30).catch(() => undefined);
    return back(`connected=${s.provider}`);
  } catch { return back(`device_error=failed&provider=${s.provider}`); }
});

export const POST = handle(async (req) => {
  rateLimit(req, 'devices', 120, 60 * 60_000);
  const body = await readJson<{ action: string; provider?: unknown; read?: Partial<DeviceRead>; days?: number }>(req, 10_000);
  const user = await userFrom(req);
  const { db } = admin();
  switch (body.action) {
    case 'start': {
      if (!isProvider(body.provider)) throw new HttpError(400, 'Which device?');
      if (!providerConfigured(body.provider)) throw new HttpError(503, `${body.provider === 'google' ? 'Fitbit' : 'Strava'} sync isn’t switched on yet`);
      const read = { ...ALL_READ, ...(await getStatus(user.uid)).read, ...(body.read ?? {}) };
      const state = randomBytes(24).toString('hex');
      await db.doc(`oauthStates/${state}`).set({ uid: user.uid, provider: body.provider, read, exp: Date.now() + 10 * 60_000 });
      return json({ url: authorizeUrl(body.provider, state, read) });
    }
    case 'sync':
      return json({ days: await syncUser(user.uid, todayIst(), Math.max(1, Math.min(60, Number(body.days) || 3))) });
    case 'settings': {
      const read = { ...(await getStatus(user.uid)).read, ...(body.read ?? {}) };
      await statusRef(user.uid).set({ read }, { merge: true });
      await applyReadToStored(user.uid, read);
      return json({ read });
    }
    case 'disconnect':
      if (!isProvider(body.provider)) throw new HttpError(400, 'Which device?');
      await disconnect(user.uid, body.provider);
      return json({ ok: true });
    case 'calendar':
      return json({ url: feedUrl(user.uid, 'ics') });
    default:
      throw new HttpError(400, 'Unknown action');
  }
});
