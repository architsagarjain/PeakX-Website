import { useEffect, useState } from 'react';
import { callAi, AiError } from './ai';
import { idToken, loadWearableDocs, watchDevices } from './cloud';
import { ALL_READ, combine, type DevicesStatus, type Provider } from '../domain/wearables';
import type { DeviceRead, WearableDay } from '../domain/types';
import { addDays, today } from '../domain/clock';

/** Wearables in the app (S21.1): availability, live status, connect, sync, toggles, disconnect. */

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const t = await idToken();
  if (!t) throw new AiError(401, 'Sign in first, so your devices stay connected on every device.');
  return callAi<T>('devices', body, 60000, t);
}

let avail: Promise<{ google: boolean; strava: boolean }> | null = null;
export function deviceAvailability() {
  avail ??= fetch('/api/devices', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : { google: false, strava: false }))
    .catch(() => ({ google: false, strava: false }));
  return avail;
}
export function useDeviceAvailability() {
  const [a, setA] = useState<{ google: boolean; strava: boolean } | null>(null);
  useEffect(() => { let live = true; deviceAvailability().then((x) => live && setA(x)); return () => { live = false; }; }, []);
  return a;
}

export function useDevicesStatus(uid: string | null | undefined): DevicesStatus | null {
  const [s, setS] = useState<DevicesStatus | null>(null);
  useEffect(() => {
    if (!uid) { setS(null); return; }
    let stop: (() => void) | undefined;
    watchDevices(uid, (x) => setS(x ? { google: x.google ?? null, strava: x.strava ?? null, read: { ...ALL_READ, ...(x.read ?? {}) } } : { google: null, strava: null, read: ALL_READ })).then((f) => { stop = f; }).catch(() => undefined);
    return () => stop?.();
  }, [uid]);
  return s;
}

/** Send the browser to Google or Strava to connect. */
export async function connectDevice(provider: Provider, read?: Partial<DeviceRead>): Promise<void> {
  const r = await api<{ url: string }>({ action: 'start', provider, read });
  window.location.href = r.url;
}
export const syncDevices = (days = 3) => api<{ days: WearableDay[] }>({ action: 'sync', days }).then((r) => r.days);
export const saveDeviceRead = (read: DeviceRead) => api<{ read: DeviceRead }>({ action: 'settings', read });
export const disconnectDevice = (provider: Provider) => api<{ ok: true }>({ action: 'disconnect', provider });
export const calendarFeedUrl = () => api<{ url: string }>({ action: 'calendar' }).then((r) => r.url);

/** The stored synced days for the last 60 days, combined with the read toggles. */
export async function loadSyncedDays(uid: string, read: DeviceRead): Promise<WearableDay[]> {
  const docs = await loadWearableDocs(uid, addDays(today(), -60));
  return docs.map((d) => combine(d, read)).filter((w): w is WearableDay => !!w);
}

/** "Add to Google Calendar" link for a feed URL. */
export const googleCalendarLink = (feed: string) => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feed.replace(/^https:/, 'webcal:'))}`;
