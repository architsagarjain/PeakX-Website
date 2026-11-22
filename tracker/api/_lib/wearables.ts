import { admin } from './admin.js';
import { HttpError } from './http.js';
import { ALL_READ, combine, googleScopes, parseGoogle, parseStrava, syncRange, type DevicesStatus, type FitbitPart, type GoogleRaw, type Provider, type StravaActivity, type StravaPart, type WearableDoc } from '../../src/domain/wearables.js';
import type { DeviceRead, WearableDay } from '../../src/domain/types.js';

/**
 * Wearable sync on the server (S21.1). Tokens live in deviceTokens/{uid} (no client access); status and
 * read toggles in users/{uid}/private/devices; data in users/{uid}/wearable/{date}.
 * Env: GOOGLE_HEALTH_CLIENT_ID / _SECRET (Google Cloud OAuth client with the Google Health API enabled),
 *      STRAVA_CLIENT_ID / _SECRET, SITE_URL (the redirect URI is SITE_URL/api/devices).
 */

export const redirectUri = () => `${(process.env.SITE_URL ?? 'https://peakx.live').replace(/\/$/, '')}/api/devices`;
export const providerConfigured = (p: Provider) => (p === 'google' ? !!(process.env.GOOGLE_HEALTH_CLIENT_ID && process.env.GOOGLE_HEALTH_CLIENT_SECRET) : !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET));

interface Token { access: string; refresh: string; expiresAt: number; scope?: string }
type Tokens = Partial<Record<Provider, Token>>;
const tokensRef = (uid: string) => admin().db.doc(`deviceTokens/${uid}`);
export const statusRef = (uid: string) => admin().db.doc(`users/${uid}/private/devices`);
export async function getStatus(uid: string): Promise<DevicesStatus> {
  const s = (await statusRef(uid).get()).data() as DevicesStatus | undefined;
  return { google: s?.google ?? null, strava: s?.strava ?? null, read: { ...ALL_READ, ...(s?.read ?? {}) } };
}

export function authorizeUrl(p: Provider, state: string, read: DeviceRead): string {
  if (p === 'google') {
    const q = new URLSearchParams({ client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!, redirect_uri: redirectUri(), response_type: 'code', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: googleScopes(read).join(' '), state });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  const q = new URLSearchParams({ client_id: process.env.STRAVA_CLIENT_ID!, redirect_uri: redirectUri(), response_type: 'code', approval_prompt: 'auto', scope: 'read,activity:read_all', state });
  return `https://www.strava.com/oauth/authorize?${q}`;
}

async function form<T>(url: string, body: Record<string, string>): Promise<T> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const data = await r.json().catch(() => ({})) as T & { error?: unknown };
  if (!r.ok) { console.error('token', url, r.status, JSON.stringify(data).slice(0, 300)); throw new HttpError(502, 'The device service refused the sign-in'); }
  return data;
}

/** Exchange the OAuth code and keep the tokens. Returns a display name for the account if known. */
export async function exchange(uid: string, p: Provider, code: string): Promise<string | null> {
  if (p === 'google') {
    const t = await form<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }>('https://oauth2.googleapis.com/token', { code, client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!, client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET!, redirect_uri: redirectUri(), grant_type: 'authorization_code' });
    if (!t.refresh_token) throw new HttpError(400, 'Google didn’t grant offline access. Try connecting again.');
    await tokensRef(uid).set({ google: { access: t.access_token, refresh: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000, scope: t.scope ?? '' } }, { merge: true });
    return null;
  }
  const t = await form<{ access_token: string; refresh_token: string; expires_at: number; athlete?: { firstname?: string; lastname?: string } }>('https://www.strava.com/oauth/token', { code, client_id: process.env.STRAVA_CLIENT_ID!, client_secret: process.env.STRAVA_CLIENT_SECRET!, grant_type: 'authorization_code' });
  await tokensRef(uid).set({ strava: { access: t.access_token, refresh: t.refresh_token, expiresAt: t.expires_at * 1000 } }, { merge: true });
  return t.athlete ? `${t.athlete.firstname ?? ''} ${t.athlete.lastname ?? ''}`.trim() || null : null;
}

async function accessToken(uid: string, p: Provider): Promise<string | null> {
  const all = (await tokensRef(uid).get()).data() as Tokens | undefined;
  const t = all?.[p];
  if (!t) return null;
  if (t.expiresAt > Date.now() + 60_000) return t.access;
  if (p === 'google') {
    const r = await form<{ access_token: string; expires_in: number }>('https://oauth2.googleapis.com/token', { client_id: process.env.GOOGLE_HEALTH_CLIENT_ID!, client_secret: process.env.GOOGLE_HEALTH_CLIENT_SECRET!, refresh_token: t.refresh, grant_type: 'refresh_token' });
    await tokensRef(uid).set({ google: { ...t, access: r.access_token, expiresAt: Date.now() + r.expires_in * 1000 } }, { merge: true });
    return r.access_token;
  }
  const r = await form<{ access_token: string; refresh_token: string; expires_at: number }>('https://www.strava.com/oauth/token', { client_id: process.env.STRAVA_CLIENT_ID!, client_secret: process.env.STRAVA_CLIENT_SECRET!, refresh_token: t.refresh, grant_type: 'refresh_token' });
  await tokensRef(uid).set({ strava: { access: r.access_token, refresh: r.refresh_token, expiresAt: r.expires_at * 1000 } }, { merge: true });
  return r.access_token;
}

const G = 'https://health.googleapis.com/v4/users/me/dataTypes';
const gdate = (iso: string) => { const [year, month, day] = iso.split('-').map(Number); return { year, month, day }; };
async function gget<T>(token: string, path: string, filter?: string): Promise<T | undefined> {
  const go = (f?: string) => fetch(`${G}/${path}?pageSize=200${f ? `&filter=${encodeURIComponent(f)}` : ''}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  let r = await go(filter);
  if (r.status === 400 && filter) r = await go();   // filter syntax not accepted for this type: fetch the page and filter here
  if (!r.ok) { console.error('google health', path, r.status, (await r.text()).slice(0, 200)); return undefined; }
  return r.json() as Promise<T>;
}

async function fetchGoogle(token: string, read: DeviceRead, from: string, to: string): Promise<Record<string, FitbitPart>> {
  const raw: GoogleRaw = {};
  const end = new Date(`${to}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
  const jobs: Promise<void>[] = [];
  if (read.steps) jobs.push(fetch(`${G}/steps/dataPoints:dailyRollUp`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ range: { start: { date: gdate(from) }, end: { date: gdate(end.toISOString().slice(0, 10)) } }, windowSizeDays: 1 }) })
    .then(async (r) => { if (r.ok) raw.steps = await r.json(); else console.error('steps', r.status, (await r.text()).slice(0, 200)); }).catch(() => undefined));
  if (read.sleep) jobs.push(gget<GoogleRaw['sleep']>(token, 'sleep/dataPoints', `sleep.interval.civil_start_time >= "${from}T00:00:00"`).then((x) => { raw.sleep = x; }).catch(() => undefined));
  if (read.heartRate) jobs.push(gget<GoogleRaw['restingHr']>(token, 'daily-resting-heart-rate/dataPoints', `daily_resting_heart_rate.date >= "${from}"`).then((x) => { raw.restingHr = x; }).catch(() => undefined));
  if (read.workouts) jobs.push(gget<GoogleRaw['exercise']>(token, 'exercise/dataPoints', `exercise.interval.civil_start_time >= "${from}T00:00:00"`).then((x) => { raw.exercise = x; }).catch(() => undefined));
  await Promise.all(jobs);
  const parts = parseGoogle(raw);
  return Object.fromEntries(Object.entries(parts).filter(([d]) => d >= from && d <= to));
}

async function fetchStrava(token: string, from: string): Promise<Record<string, StravaPart>> {
  const after = Math.floor(new Date(`${from}T00:00:00+05:30`).getTime() / 1000);
  const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { console.error('strava', r.status, (await r.text()).slice(0, 200)); throw new HttpError(502, 'Strava didn’t answer'); }
  return parseStrava(await r.json() as StravaActivity[]);
}

/** Sync the last `days` days for every connected source. Returns the combined days for the app. */
export async function syncUser(uid: string, today: string, days: number): Promise<WearableDay[]> {
  const { db } = admin();
  const status = await getStatus(uid);
  const { from, to } = syncRange(today, days);
  const docs = new Map<string, WearableDoc>();
  const put = (d: string, patch: Partial<WearableDoc>) => docs.set(d, { ...(docs.get(d) ?? { date: d }), ...patch });
  const now = new Date().toISOString();
  for (const p of ['google', 'strava'] as Provider[]) {
    if (!status[p]?.connected || !providerConfigured(p)) continue;
    try {
      const token = await accessToken(uid, p);
      if (!token) continue;
      if (p === 'google') Object.entries(await fetchGoogle(token, status.read, from, to)).forEach(([d, f]) => put(d, { fitbit: f }));
      else if (status.read.workouts) Object.entries(await fetchStrava(token, from)).forEach(([d, s]) => put(d, { strava: s }));
      await statusRef(uid).set({ [p]: { ...status[p], lastSync: now, error: null } }, { merge: true });
    } catch (e) {
      await statusRef(uid).set({ [p]: { ...status[p], error: (e as Error).message.slice(0, 120) } }, { merge: true });
    }
  }
  const batch = db.batch();
  docs.forEach((doc, d) => batch.set(db.doc(`users/${uid}/wearable/${d}`), JSON.parse(JSON.stringify({ ...doc, updatedAt: now })), { merge: true }));
  await batch.commit();
  const stored = await db.collection(`users/${uid}/wearable`).where('date', '>=', from).get();
  return stored.docs.map((s) => combine(s.data() as WearableDoc, status.read)).filter((w): w is WearableDay => !!w);
}

/** Revoke, forget tokens and delete that source's data. */
export async function disconnect(uid: string, p: Provider): Promise<void> {
  const { db } = admin();
  const all = (await tokensRef(uid).get()).data() as Tokens | undefined;
  const t = all?.[p];
  if (t) {
    if (p === 'google') await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t.refresh)}`, { method: 'POST' }).catch(() => undefined);
    else await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { Authorization: `Bearer ${t.access}` } }).catch(() => undefined);
  }
  const { FieldValue } = await import('firebase-admin/firestore');
  await tokensRef(uid).set({ [p]: FieldValue.delete() }, { merge: true });
  await statusRef(uid).set({ [p]: null }, { merge: true });
  const key = p === 'google' ? 'fitbit' : 'strava';
  const docs = await db.collection(`users/${uid}/wearable`).get();
  for (let i = 0; i < docs.size; i += 400) {
    const batch = db.batch();
    docs.docs.slice(i, i + 400).forEach((d) => {
      const doc = d.data() as WearableDoc;
      const other = key === 'fitbit' ? doc.strava : doc.fitbit;
      if (other) batch.update(d.ref, { [key]: FieldValue.delete() }); else batch.delete(d.ref);
    });
    await batch.commit();
  }
}

/** Remove fields for toggles turned off (data already stored). */
export async function applyReadToStored(uid: string, read: DeviceRead): Promise<void> {
  const { db } = admin();
  const { FieldValue } = await import('firebase-admin/firestore');
  const off: string[] = [];
  if (!read.steps) off.push('fitbit.steps');
  if (!read.sleep) off.push('fitbit.sleepHours');
  if (!read.heartRate) off.push('fitbit.restingHr');
  if (!read.workouts) off.push('fitbit.activities', 'fitbit.activeMinutes', 'fitbit.kcalBurned', 'strava');
  if (!off.length) return;
  const docs = await db.collection(`users/${uid}/wearable`).get();
  for (let i = 0; i < docs.size; i += 400) {
    const batch = db.batch();
    docs.docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, Object.fromEntries(off.map((f) => [f, FieldValue.delete()]))));
    await batch.commit();
  }
}
