import { HttpError } from './http.js';

/**
 * Supabase from the server, over plain REST (no SDK, so nothing extra loads in a function).
 * Env: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY (the project's secret key,
 * sb_secret_… or the legacy service_role JWT). The secret key bypasses row-level security, so it lives
 * only in Vercel env vars.
 */

const base = () => (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
export const supaConfigured = () => !!(base() && secret());

async function rest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown, prefer?: string): Promise<T> {
  if (!supaConfigured()) throw new HttpError(503, 'Server data access is not configured');
  const res = await fetch(`${base()}/rest/v1/${path}`, {
    method,
    headers: { apikey: secret(), 'Content-Type': 'application/json', Accept: 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) { console.error('Supabase', method, path.split('?')[0], res.status, text.slice(0, 300)); throw new HttpError(502, 'The data service did not answer'); }
  return (text ? JSON.parse(text) : null) as T;
}

const eq = (v: string) => `eq.${encodeURIComponent(v)}`;

export const db = {
  /** One row where `col` = `value`, or null. */
  async one<T>(table: string, col: string, value: string, select = '*'): Promise<T | null> {
    const rows = await rest<T[]>('GET', `${table}?select=${select}&${col}=${eq(value)}&limit=1`);
    return rows[0] ?? null;
  },
  /** Insert or replace by primary key. */
  upsert: (table: string, row: Record<string, unknown>) => rest<null>('POST', table, row, 'resolution=merge-duplicates,return=minimal'),
  /** Insert unless the key exists; true when this call inserted it (used to skip repeated webhooks). */
  async insertNew(table: string, row: Record<string, unknown>): Promise<boolean> {
    const rows = await rest<unknown[]>('POST', table, row, 'resolution=ignore-duplicates,return=representation');
    return Array.isArray(rows) && rows.length > 0;
  },
  rpc: <T>(fn: string, args: Record<string, unknown>) => rest<T>('POST', `rpc/${fn}`, args),
};

export interface SignedIn { uid: string; email: string | null; name: string | null }

/** The signed-in member from `Authorization: Bearer <Supabase access token>`. */
export async function supaUser(req: Request): Promise<SignedIn> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in first');
  if (!supaConfigured()) throw new HttpError(503, 'Server data access is not configured');
  const res = await fetch(`${base()}/auth/v1/user`, { headers: { apikey: secret(), Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) throw new HttpError(401, 'Your sign-in has expired. Sign in again.');
  if (!res.ok) throw new HttpError(502, 'Couldn’t check your sign-in');
  const u = await res.json() as { id: string; email?: string; user_metadata?: { name?: string; full_name?: string } };
  return { uid: u.id, email: u.email ?? null, name: u.user_metadata?.name ?? u.user_metadata?.full_name ?? null };
}
