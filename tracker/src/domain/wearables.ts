import type { DeviceRead, ISODate, WearableActivity, WearableDay } from './types.js';

/**
 * Wearables (S21.1): Fitbit and Google-linked devices through the Google Health API, and Strava.
 * The server keeps the tokens and writes one document per day (users/{uid}/wearable/{date}) with each
 * source's numbers kept apart, so disconnecting a source can delete exactly its data. The app combines
 * them into a WearableDay, honouring the "what PeakX reads" toggles.
 */

export const ALL_READ: DeviceRead = { steps: true, sleep: true, heartRate: true, workouts: true };
export type Provider = 'google' | 'strava';
export const PROVIDER_LABEL: Record<Provider, string> = { google: 'Fitbit · via Google', strava: 'Strava' };

export interface FitbitPart { steps?: number; sleepHours?: number; restingHr?: number; activeMinutes?: number; kcalBurned?: number; activities?: WearableActivity[] }
export interface StravaPart { activities: WearableActivity[] }
export interface WearableDoc { date: ISODate; fitbit?: FitbitPart; strava?: StravaPart; updatedAt?: string }

export interface DeviceState { connected: boolean; connectedAt: string; lastSync: string | null; account: string | null; error: string | null }
/** users/{uid}/private/devices, written by the server, read live by the app. */
export interface DevicesStatus { google: DeviceState | null; strava: DeviceState | null; read: DeviceRead }

const H = 'https://www.googleapis.com/auth/googlehealth';
/** Google Health API scopes for the toggles that are on (read-only). */
export function googleScopes(read: DeviceRead): string[] {
  const s = new Set<string>();
  if (read.steps || read.workouts) s.add(`${H}.activity_and_fitness.readonly`);
  if (read.sleep) s.add(`${H}.sleep.readonly`);
  if (read.heartRate) s.add(`${H}.health_metrics_and_measurements.readonly`);
  if (!s.size) s.add(`${H}.activity_and_fitness.readonly`);
  return [...s];
}

// ---------- parsing (pure, so it can be tested without the network) ----------

type GDate = { year: number; month: number; day: number };
const isoOf = (d?: GDate | null) => (d?.year ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : null);
/** "19800s" → seconds. */
export const durSec = (s?: string | null) => (s ? Number(String(s).replace(/s$/, '')) || 0 : 0);
/** The local calendar date of a UTC timestamp with a "19800s"-style offset. */
export function localDate(utc?: string | null, offset?: string | null): ISODate | null {
  if (!utc) return null;
  const t = new Date(utc).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + durSec(offset ?? '19800s') * 1000).toISOString().slice(0, 10);
}

export interface GoogleRaw {
  steps?: { rollupDataPoints?: { civilStartTime?: { date?: GDate }; steps?: { countSum?: string } }[] };
  sleep?: { dataPoints?: { sleep?: { interval?: { endTime?: string; endUtcOffset?: string; civilEndTime?: { date?: GDate } }; summary?: { minutesAsleep?: string | number } } }[] };
  restingHr?: { dataPoints?: { dailyRestingHeartRate?: { date?: GDate; beatsPerMinute?: string | number } }[] };
  exercise?: { dataPoints?: { name?: string; exercise?: { interval?: { startTime?: string; startUtcOffset?: string }; exerciseType?: string; displayName?: string; activeDuration?: string; metricsSummary?: { caloriesKcal?: number; distanceMillimiters?: number | string; averageHeartRateBeatsPerMinute?: number | string; activeZoneMinutes?: number | string } } }[] };
}

const pretty = (t?: string) => (t ? t.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'Workout');

/** Google Health API responses → per-day Fitbit parts. */
export function parseGoogle(raw: GoogleRaw): Record<ISODate, FitbitPart> {
  const out: Record<ISODate, FitbitPart> = {};
  const day = (d: ISODate) => (out[d] ??= {});
  raw.steps?.rollupDataPoints?.forEach((p) => { const d = isoOf(p.civilStartTime?.date); if (d && p.steps?.countSum !== undefined) day(d).steps = Number(p.steps.countSum) || 0; });
  raw.sleep?.dataPoints?.forEach((p) => {
    const s = p.sleep; if (!s?.summary?.minutesAsleep) return;
    const d = isoOf(s.interval?.civilEndTime?.date) ?? localDate(s.interval?.endTime, s.interval?.endUtcOffset);
    if (d) day(d).sleepHours = Math.round(((day(d).sleepHours ?? 0) + Number(s.summary.minutesAsleep) / 60) * 10) / 10;
  });
  raw.restingHr?.dataPoints?.forEach((p) => { const r = p.dailyRestingHeartRate; const d = isoOf(r?.date); if (d && r?.beatsPerMinute) day(d).restingHr = Math.round(Number(r.beatsPerMinute)); });
  raw.exercise?.dataPoints?.forEach((p, i) => {
    const e = p.exercise; if (!e) return;
    const d = localDate(e.interval?.startTime, e.interval?.startUtcOffset); if (!d) return;
    const mins = Math.round(durSec(e.activeDuration) / 60);
    const ms = e.metricsSummary ?? {};
    const a: WearableActivity = { id: p.name ?? `g-${d}-${i}`, name: e.displayName || pretty(e.exerciseType), type: pretty(e.exerciseType), minutes: mins, km: ms.distanceMillimiters ? Math.round(Number(ms.distanceMillimiters) / 10_000) / 100 : null, avgHr: ms.averageHeartRateBeatsPerMinute ? Math.round(Number(ms.averageHeartRateBeatsPerMinute)) : null, kcal: ms.caloriesKcal ? Math.round(ms.caloriesKcal) : null, source: 'fitbit' };
    const f = day(d);
    f.activities = [...(f.activities ?? []), a];
    f.activeMinutes = (f.activeMinutes ?? 0) + mins;
    f.kcalBurned = (f.kcalBurned ?? 0) + (a.kcal ?? 0);
  });
  return out;
}

export interface StravaActivity { id: number; name: string; sport_type?: string; type?: string; start_date_local: string; moving_time: number; distance?: number; average_heartrate?: number; kilojoules?: number; calories?: number }
/** Strava activities → per-day parts. */
export function parseStrava(list: StravaActivity[]): Record<ISODate, StravaPart> {
  const out: Record<ISODate, StravaPart> = {};
  for (const a of list) {
    const d = a.start_date_local?.slice(0, 10); if (!d) continue;
    const kcal = a.calories ?? (a.kilojoules ? Math.round(a.kilojoules * 0.239 / 0.24) : null);
    (out[d] ??= { activities: [] }).activities.push({ id: `strava-${a.id}`, name: a.name, type: pretty((a.sport_type ?? a.type ?? '').replace(/([a-z])([A-Z])/g, '$1_$2')), minutes: Math.round(a.moving_time / 60), km: a.distance ? Math.round(a.distance / 10) / 100 : null, avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null, kcal: kcal ? Math.round(kcal) : null, source: 'strava' });
  }
  return out;
}

/** One day's sources → the app's WearableDay, with off toggles left out. Null when nothing is left. */
export function combine(doc: WearableDoc, read: DeviceRead): WearableDay | null {
  const f = doc.fitbit ?? {}, s = doc.strava;
  const acts = [...(read.workouts ? f.activities ?? [] : []), ...(read.workouts ? s?.activities ?? [] : [])];
  // A Strava activity also recorded by the watch would count twice: drop Strava ones overlapping in type and length.
  const unique = acts.filter((a, i) => a.source === 'fitbit' || !acts.some((b, j) => j !== i && b.source === 'fitbit' && b.type === a.type && Math.abs(b.minutes - a.minutes) <= 5));
  const has = (read.steps && f.steps !== undefined) || (read.sleep && f.sleepHours !== undefined) || (read.heartRate && f.restingHr !== undefined) || unique.length;
  if (!has) return null;
  const stravaMins = unique.filter((a) => a.source === 'strava').reduce((x, a) => x + a.minutes, 0);
  const stravaKcal = unique.filter((a) => a.source === 'strava').reduce((x, a) => x + (a.kcal ?? 0), 0);
  return {
    date: doc.date,
    steps: read.steps ? f.steps ?? 0 : 0,
    sleepHours: read.sleep ? f.sleepHours ?? 0 : 0,
    restingHr: read.heartRate ? f.restingHr ?? 0 : 0,
    activeMinutes: (read.workouts ? f.activeMinutes ?? 0 : 0) + stravaMins,
    kcalBurned: (read.workouts ? f.kcalBurned ?? 0 : 0) + stravaKcal,
    source: doc.fitbit ? 'fitbit' : 'strava',
    activities: unique.length ? unique : undefined,
  };
}

/** Merge synced days into the app's list (synced days replace demo or older copies of the same date). */
export function mergeWearable(current: WearableDay[], synced: WearableDay[], removedDates: ISODate[] = []): WearableDay[] {
  const by = new Map(current.filter((w) => w.source !== 'demo' && !removedDates.includes(w.date)).map((w) => [w.date, w]));
  synced.forEach((w) => by.set(w.date, w));
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Days to fetch on a sync: the last `n` days including today. */
export function syncRange(today: ISODate, n: number): { from: ISODate; to: ISODate } {
  const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - (n - 1));
  return { from: d.toISOString().slice(0, 10), to: today };
}
