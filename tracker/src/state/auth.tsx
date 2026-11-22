import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from './store';
import { useToast } from '../components/Toast';
import { track } from './telemetry';
import {
  cloudConfigured, googleEnabled, deleteCloudAccount, loadCloud, loadCloudReports, saveCloud, saveCloudReportChanges, signInWithGoogle, signInWithPassword, signUpWithPassword, signOutCloud,
  watchUser, watchBilling, loadMyQueue, addQueueItem, loadAliases, type CloudUser, type Snapshot,
} from './cloud';
import { planFrom } from '../domain/billing';
import { newQueueItem } from '../domain/queue';
import { setFoodAliases } from './aliases';
import { loadSyncedDays, syncDevices } from './devices';
import { watchDevices } from './cloud';
import { ALL_READ } from '../domain/wearables';
import { firstUpload } from '../domain/seed';

export type SyncState = 'off' | 'loading' | 'syncing' | 'saved' | 'offline' | 'error';

type Auth = {
  configured: boolean;
  ready: boolean;
  user: CloudUser | null;
  sync: SyncState;
  /** Google sign-in is offered only once it's switched on in Supabase. */
  googleOn: boolean;
  google: () => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<'deleted' | 'reauth'>;
  /** Push accept/skip answers for a server-built report. */
  syncReport: (r: import('../domain/types').WeeklyReport) => void;
  /** Reload coach results now (after sending something to the queue). */
  refreshQueue: () => void;
};
const Ctx = createContext<Auth | null>(null);

const message = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? '';
  const raw = (e as { message?: string })?.message ?? '';
  if (code === 'network') return 'No connection. Try again when you’re online.';
  if (code === 'wrong-password') return 'That email and password don’t match. Check them, or create an account.';
  if (code === 'email-taken' || code === 'signup-failed') return raw || 'Couldn’t create the account. Try again.';
  if (code === 'google-off') return 'Google sign-in isn’t switched on yet. Use email and password.';
  if (code === 'not-configured') return 'Accounts aren’t switched on for this site yet. Your data is saved in this browser.';
  if (/rate limit|too many/i.test(raw)) return 'Too many attempts. Wait a minute and try again.';
  // Keep the reason visible so a failed sign-in can be diagnosed from a screenshot.
  return `Sign-in didn’t work${raw ? ` (${raw.slice(0, 80)})` : ''}. Please try again.`;
};

/**
 * Accounts and cloud sync (S8.1). Local-first: the store always saves to this browser; when signed in,
 * changes are also written to Supabase (debounced). First sign-in on an empty account uploads what's on
 * this device; signing in where the account already has data loads that data.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, dispatch, reset } = useStore();
  const toast = useToast();
  const configured = cloudConfigured();
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [sync, setSync] = useState<SyncState>('off');
  const snap = useRef<Snapshot | null>(null);
  const loadedFor = useRef<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Watch the signed-in user.
  useEffect(() => {
    if (!configured) return;
    let stop: (() => void) | undefined;
    watchUser((u) => { setUser(u); setReady(true); if (!u) { setSync('off'); snap.current = null; loadedFor.current = null; } })
      .then((s) => { stop = s; })
      .catch(() => { setReady(true); setSync('error'); });
    return () => stop?.();
  }, [configured]);

  // On sign-in: upload this device's data to a new account, or load the account's data.
  useEffect(() => {
    if (!user || loadedFor.current === user.uid) return;
    loadedFor.current = user.uid;
    setSync('loading');
    (async () => {
      try {
        const cloud = await loadCloud(user.uid);
        if (cloud) {
          snap.current = cloud.snapshot;
          dispatch({ type: 'replace', data: cloud.data });
          toast('Loaded your saved data', 'good');
        } else {
          // A new account starts from this device's own data, never from the demo.
          const start = firstUpload(dataRef.current);
          if (start !== dataRef.current) dispatch({ type: 'replace', data: start });
          snap.current = await saveCloud(user.uid, start, null);
          toast(start.onboarding.done ? 'Your progress is now saved to your account' : 'Account created. Let’s set up your plan.', 'good');
        }
        setSync('saved');
        // Reports built by the Sunday server job win over local drafts for the same week.
        loadCloudReports(user.uid).then((rs) => rs.forEach((report) => dispatch({ type: 'upsertReport', report }))).catch(() => undefined);
      } catch (e) {
        setSync(navigator.onLine ? 'error' : 'offline');
        loadedFor.current = null;
        const code = (e as { code?: string })?.code ?? '';
        if (navigator.onLine) toast(`Signed in, but your data couldn’t sync${code ? ` (${code})` : ''}. It’s still saved on this device.`);
      }
    })();
  }, [user, dispatch, toast]);

  // Save changes while signed in (debounced 1.2 s).
  useEffect(() => {
    if (!user || loadedFor.current !== user.uid || sync === 'loading') return;
    const t = setTimeout(async () => {
      try {
        setSync('syncing');
        snap.current = await saveCloud(user.uid, data, snap.current);
        setSync('saved');
      } catch { setSync(navigator.onLine ? 'error' : 'offline'); }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, user]);

  // Retry when the connection comes back.
  useEffect(() => {
    const on = () => { if (user && (sync === 'offline' || sync === 'error')) { loadedFor.current = loadedFor.current ?? null; setSync('syncing'); saveCloud(user.uid, dataRef.current, snap.current).then((s) => { snap.current = s; setSync('saved'); }).catch(() => setSync('error')); } };
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [user, sync]);

  const google = useCallback(async () => {
    try { await signInWithGoogle(); track('sign_in', { method: 'google' }); } catch (e) { toast(message(e)); throw e; }
  }, [toast]);
  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    try { await signUpWithPassword(email.trim(), password, name?.trim()); track('sign_up', { method: 'password' }); toast('Account created. You’re signed in.', 'good'); } catch (e) { toast(message(e)); throw e; }
  }, [toast]);
  const signIn = useCallback(async (email: string, password: string) => {
    try { await signInWithPassword(email.trim(), password); track('sign_in', { method: 'password' }); toast('Signed in', 'good'); } catch (e) { toast(message(e)); throw e; }
  }, [toast]);
  const signOut = useCallback(async () => {
    await signOutCloud();
    reset();
    toast('Signed out. Data on this device was cleared; it’s safe in your account.');
  }, [reset, toast]);
  const deleteAccount = useCallback(async (): Promise<'deleted' | 'reauth'> => {
    if (user) {
      try { await deleteCloudAccount(user.uid); }
      catch (e) { throw e; }
    }
    reset();
    track('account_deleted');
    return 'deleted';
  }, [user, reset]);

  // Billing (R4): the server's record decides the plan. Live, so webhook updates show up without a reload.
  useEffect(() => {
    if (!user) return;
    let stop: (() => void) | undefined;
    watchBilling(user.uid, (billing) => dispatch({ type: 'setBilling', billing, nowMs: Date.now() })).then((s) => { stop = s; }).catch(() => undefined);
    return () => stop?.();
  }, [user, dispatch]);
  // A paid period can end while the app is open.
  useEffect(() => {
    const check = () => { const d = dataRef.current; if (d.billing) { const p = planFrom(d.billing, Date.now()); if (p !== d.plan) dispatch({ type: 'setPlan', plan: p }); } };
    check();
    const t = setInterval(check, 60 * 60_000);
    return () => clearInterval(t);
  }, [dispatch, data.billing]);

  // Wearables (R6): keep the app's copy in step with what the server synced; sync if it's been 3 hours.
  useEffect(() => {
    if (!user) return;
    let stop: (() => void) | undefined;
    let lastKey = '';
    watchDevices(user.uid, async (st) => {
      const devices = { google: !!st?.google?.connected, strava: !!st?.strava?.connected };
      const read = { ...ALL_READ, ...(st?.read ?? {}) };
      const key = JSON.stringify([devices, read, st?.google?.lastSync, st?.strava?.lastSync]);
      if (key === lastKey) return;
      lastKey = key;
      if (!devices.google && !devices.strava) { if (dataRef.current.devices.google || dataRef.current.devices.strava) dispatch({ type: 'setWearable', days: [], devices }); return; }
      const days = await loadSyncedDays(user.uid, read).catch(() => null);
      if (days) dispatch({ type: 'setWearable', days, devices });
      const last = Math.max(...[st?.google?.lastSync, st?.strava?.lastSync].map((x) => (x ? new Date(x).getTime() : 0)));
      if (Date.now() - last > 3 * 3_600_000) syncDevices(3).catch(() => undefined);   // the status update re-runs this
    }).then((f) => { stop = f; }).catch(() => undefined);
    return () => stop?.();
  }, [user, dispatch]);

  // Coach queue (R5): bring in Form Check reviews, lab checks and coach assignments.
  const refreshQueue = useCallback(() => {
    if (!user) return;
    loadMyQueue(user.uid).then((items) => dispatch({ type: 'mergeQueue', items })).catch(() => undefined);
  }, [user, dispatch]);
  useEffect(() => {
    if (!user) return;
    loadAliases().then(setFoodAliases).catch(() => undefined);
    refreshQueue();
    const on = () => { if (document.visibilityState === 'visible') refreshQueue(); };
    document.addEventListener('visibilitychange', on);
    const t = setInterval(on, 5 * 60_000);
    return () => { document.removeEventListener('visibilitychange', on); clearInterval(t); };
  }, [user, refreshQueue]);

  // Foods logged twice that the food table doesn't know go to the coach queue once.
  useEffect(() => {
    if (!user) return;
    const key = 'peakx.sentFoods';
    let sent: string[] = [];
    try { sent = JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { /* storage blocked */ }
    const fresh = data.unmatchedFoods.filter((f) => f.count >= 2 && !sent.includes(f.name)).slice(0, 5);
    if (!fresh.length) return;
    fresh.forEach((f) => {
      const slug = f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      addQueueItem(newQueueItem('food', { id: `food-${user.uid.slice(0, 8)}-${slug}`, uid: user.uid, member: { name: data.profile.name, plan: data.plan }, title: f.name, detail: `Logged ${f.count} times, not in the food table`, payload: { name: f.name, count: f.count }, nowMs: Date.now() })).catch(() => undefined);
    });
    try { localStorage.setItem(key, JSON.stringify([...sent, ...fresh.map((f) => f.name)].slice(-200))); } catch { /* ignore */ }
  }, [user, data.unmatchedFoods, data.profile.name, data.plan]);

  const syncReport = useCallback((r: import('../domain/types').WeeklyReport) => { if (user) saveCloudReportChanges(user.uid, r).catch(() => undefined); }, [user]);

  return <Ctx.Provider value={{ configured, ready, user, sync, googleOn: googleEnabled(), google, signUp, signIn, signOut, deleteAccount, syncReport, refreshQueue }}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAuth must be used inside <AuthProvider>');
  return a;
}

export const SYNC_LABEL: Record<SyncState, string> = {
  off: 'Saved on this device', loading: 'Loading your account…', syncing: 'Saving…', saved: 'Saved to your account', offline: 'Offline · will save when back online', error: 'Couldn’t save · will retry',
};
