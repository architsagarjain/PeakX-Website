import type { AppData } from '../domain/types';
import { migrate } from './migrate';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Cloud layer: Supabase Auth + Postgres, loaded on demand so the app stays small and fully usable
 * without it. Configure with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the project's publishable
 * key; access is controlled by row-level security, not by hiding it).
 *
 * Tables (supabase project "peakx", every table has RLS so members reach only their own rows):
 *   user_data(user_id, data jsonb)   the whole app state for one member
 *   queue_items(id, user_id, item)   Form Check, lab report, unmatched food and coach requests
 *   email_prefs(user_id, prefs)      email reminder settings
 * Storage bucket form-videos/{user_id}/…  Form Check uploads, private.
 * Sign-up runs through the `signup` edge function, which creates a confirmed email + password account.
 */

const env = import.meta.env as Record<string, string | undefined>;
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

export function cloudConfigured(): boolean { return !!(URL_ && KEY); }
/** Google sign-in needs the Google provider switched on in Supabase; until then the button stays hidden. */
export function googleEnabled(): boolean { return cloudConfigured() && env.VITE_SUPABASE_GOOGLE === 'true'; }

export interface CloudUser { uid: string; email: string | null; name: string | null; provider: 'google' | 'email' | 'other' }

// Kept for tests and older callers: the day-split helpers still describe the data shape.
export { splitData, joinData, diffForSave, type DayDoc, type RootDoc } from '../domain/cloudData';
/** What was last saved, to skip writes that change nothing. */
export type Snapshot = string;

let client: Promise<SupabaseClient> | null = null;
function sb(): Promise<SupabaseClient> {
  if (!cloudConfigured()) return Promise.reject(Object.assign(new Error('Accounts are not configured'), { code: 'not-configured' }));
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL_!, KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'peakx.auth' },
  }));
  return client;
}

const toUser = (u: User): CloudUser => ({
  uid: u.id,
  email: u.email ?? null,
  name: (u.user_metadata?.name as string | undefined) ?? (u.user_metadata?.full_name as string | undefined) ?? null,
  provider: u.app_metadata?.provider === 'google' ? 'google' : u.app_metadata?.provider === 'email' ? 'email' : 'other',
});

/** Errors carry a short `code` the UI turns into words. */
const fail = (code: string, message: string) => Object.assign(new Error(message), { code });

export async function watchUser(cb: (u: CloudUser | null) => void): Promise<() => void> {
  const s = await sb();
  const { data } = await s.auth.getSession();
  cb(data.session?.user ? toUser(data.session.user) : null);
  const { data: sub } = s.auth.onAuthStateChange((_event, session) => cb(session?.user ? toUser(session.user) : null));
  return () => sub.subscription.unsubscribe();
}

export async function signInWithGoogle(): Promise<void> {
  const s = await sb();
  const { error } = await s.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${window.location.pathname}` } });
  if (error) throw fail('google-off', error.message);
}

/** Create an account (confirmed straight away by the signup function), then sign in with it. */
export async function signUpWithPassword(email: string, password: string, name?: string): Promise<void> {
  const res = await fetch(`${URL_}/functions/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY!, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ email, password, name }),
  }).catch(() => { throw fail('network', 'No connection'); });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw fail(res.status === 409 ? 'email-taken' : 'signup-failed', body.error ?? 'Couldn’t create the account');
  await signInWithPassword(email, password);
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const s = await sb();
  const { error } = await s.auth.signInWithPassword({ email, password });
  if (error) throw fail(/invalid/i.test(error.message) ? 'wrong-password' : /network|fetch/i.test(error.message) ? 'network' : 'signin-failed', error.message);
}

export async function signOutCloud(): Promise<void> {
  const s = await sb();
  await s.auth.signOut();
}

/** Billing is written by the server only, so it never travels in the member's own copy. */
const storable = (d: AppData) => { const { billing: _b, ...rest } = d; return rest; };

export async function loadCloud(uid: string): Promise<{ data: AppData; snapshot: Snapshot } | null> {
  const s = await sb();
  const { data, error } = await s.from('user_data').select('data').eq('user_id', uid).maybeSingle();
  if (error) throw fail(error.code ?? 'load-failed', error.message);
  if (!data) return null;
  const app = { ...(migrate(data.data) ?? (data.data as AppData)), billing: null };
  return { data: app, snapshot: JSON.stringify(storable(app)) };
}

/** Saves the member's data when it changed since `last`. Returns the new snapshot. */
export async function saveCloud(uid: string, data: AppData, last: Snapshot | null): Promise<Snapshot> {
  const body = storable(data);
  const snap = JSON.stringify(body);
  if (snap === last) return snap;
  const s = await sb();
  const { error } = await s.from('user_data').upsert({ user_id: uid, data: body });
  if (error) throw fail(error.code ?? 'save-failed', error.message);
  return snap;
}

/** Deletes the member's account and all their rows (cascade). */
export async function deleteCloudAccount(_uid: string): Promise<void> {
  const s = await sb();
  const { error } = await s.rpc('delete_my_account');
  if (error) throw fail(error.code ?? 'delete-failed', error.message);
  await s.auth.signOut().catch(() => undefined);
}

// ---------- weekly reports: built in the app; server-built reports arrive when the Sunday job runs on Supabase ----------
export async function loadCloudReports(_uid: string): Promise<import('../domain/types').WeeklyReport[]> { return []; }
export async function saveCloudReportChanges(_uid: string, _r: import('../domain/types').WeeklyReport): Promise<void> { /* answers live in user_data */ }

// ---------- sign-in token, billing, coach queue, uploads ----------

/** Access token for calls to /api that need to know who you are. */
export async function idToken(): Promise<string | null> {
  if (!cloudConfigured()) return null;
  const s = await sb();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Your plan as the payment server recorded it (table `billing`, read-only for members). Updates live
 * when a payment, renewal or refund lands, and re-reads when the tab regains focus.
 */
export async function watchBilling(uid: string, cb: (b: import('../domain/types').Billing | null) => void): Promise<() => void> {
  type B = import('../domain/types').Billing;
  const s = await sb();
  const read = async () => {
    const { data, error } = await s.from('billing').select('data').eq('user_id', uid).maybeSingle();
    if (!error) cb((data?.data as B | undefined) ?? null);
  };
  await read().catch(() => undefined);
  const ch = s.channel(`billing:${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'billing', filter: `user_id=eq.${uid}` }, (p) => cb(((p.new as { data?: B } | null)?.data) ?? null))
    .subscribe();
  const onFocus = () => { read().catch(() => undefined); };
  window.addEventListener('focus', onFocus);
  return () => { window.removeEventListener('focus', onFocus); s.removeChannel(ch).catch(() => undefined); };
}

/** Send an item to the coaching team (Form Check, lab check, unmatched food, coach request). */
export async function addQueueItem(item: import('../domain/queue').NewQueueItem): Promise<void> {
  const s = await sb();
  const { error } = await s.from('queue_items').upsert({ id: item.id, item: JSON.parse(JSON.stringify(item)) });
  if (error) throw fail(error.code ?? 'queue-failed', error.message);
}
/** This member's queue items, with coach results once reviewed. */
export async function loadMyQueue(_uid: string): Promise<import('../domain/queue').QueueItem[]> {
  const s = await sb();
  const { data, error } = await s.from('queue_items').select('item');
  if (error) throw fail(error.code ?? 'queue-failed', error.message);
  return (data ?? []).map((r) => r.item as import('../domain/queue').QueueItem);
}

/** Upload a Form Check video to the member's own folder. Returns the storage path. */
export async function uploadFormVideo(uid: string, id: string, file: File, onProgress: (p: number) => void): Promise<string> {
  const s = await sb();
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  const path = `${uid}/${id}.${ext}`;
  onProgress(0.05);
  const { error } = await s.storage.from('form-videos').upload(path, file, { contentType: file.type || 'video/mp4', upsert: true });
  if (error) throw fail('upload-failed', error.message);
  onProgress(1);
  return path;
}

/** Food names coaches have matched to the food table. */
export async function loadAliases(): Promise<Record<string, string>> { return {}; }

/** A playable link to your own uploaded video (valid for an hour). */
export async function formVideoUrl(path: string): Promise<string> {
  const s = await sb();
  const { data, error } = await s.storage.from('form-videos').createSignedUrl(path.replace(/^uploads\/[^/]+\/form\//, ''), 3600);
  if (error || !data) throw fail('video-failed', error?.message ?? 'No link');
  return data.signedUrl;
}

// ---------- wearables and email preferences ----------

/** Wearable connections are made by the server; none until wearables run on Supabase. */
export async function watchDevices(_uid: string, cb: (s: import('../domain/wearables').DevicesStatus | null) => void): Promise<() => void> {
  cb(null);
  return () => undefined;
}
export async function loadWearableDocs(_uid: string, _since: string): Promise<import('../domain/wearables').WearableDoc[]> { return []; }

export async function watchEmailPrefs(uid: string, cb: (p: Partial<import('../domain/reminders').EmailPrefs> | null) => void): Promise<() => void> {
  const s = await sb();
  const { data } = await s.from('email_prefs').select('prefs').eq('user_id', uid).maybeSingle();
  cb((data?.prefs as Partial<import('../domain/reminders').EmailPrefs> | undefined) ?? null);
  return () => undefined;
}
export async function saveEmailPrefs(uid: string, p: import('../domain/reminders').EmailPrefs): Promise<void> {
  const s = await sb();
  const { error } = await s.from('email_prefs').upsert({ user_id: uid, prefs: p });
  if (error) throw fail(error.code ?? 'save-failed', error.message);
}
