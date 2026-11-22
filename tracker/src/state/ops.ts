import { useEffect, useState } from 'react';
import { callAi, AiError } from './ai';
import { idToken } from './cloud';
import { useAuth } from './auth';
import type { QueueItem } from '../domain/queue';

/** Coach desk client (S20.1): who's a coach, the queue, and coach actions. All checks happen on the server. */

export interface Coach { uid: string; name: string; email: string | null; whatsapp: string | null; bookingUrl: string | null }
export interface DeskItem extends QueueItem { videoUrl?: string | null; email?: string }
export interface DeskMember { uid: string; name: string | null; coachUid: string; coachName: string; since: string; until?: string; email: string | null; paying?: boolean }

async function token(): Promise<string> { const t = await idToken(); if (!t) throw new AiError(401, 'Sign in first'); return t; }

export async function opsGet<T>(view: 'me' | 'queue' | 'usage'): Promise<T> {
  const r = await fetch(`/api/ops?view=${view}`, { headers: { Authorization: `Bearer ${await token()}`, Accept: 'application/json' } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new AiError(r.status, (data as { error?: string }).error ?? 'Request failed');
  return data as T;
}
export const opsPost = async <T = { ok: true }>(body: Record<string, unknown>) => callAi<T>('ops', body, 30000, await token());

const cache = new Map<string, Coach | null>();
/** The signed-in user's coach profile, or null. Undefined while checking. */
export function useCoachProfile(): [Coach | null | undefined, (c: Coach | null) => void] {
  const { user } = useAuth();
  const [coach, setCoach] = useState<Coach | null | undefined>(user ? cache.get(user.uid) : null);
  useEffect(() => {
    if (!user) { setCoach(null); return; }
    if (cache.has(user.uid)) { setCoach(cache.get(user.uid)!); return; }
    let live = true;
    opsGet<{ coach: Coach | null }>('me').then((r) => { cache.set(user.uid, r.coach); if (live) setCoach(r.coach); }).catch(() => live && setCoach(null));
    return () => { live = false; };
  }, [user]);
  const set = (c: Coach | null) => { if (user) cache.set(user.uid, c); setCoach(c); };
  return [coach, set];
}
export const useIsCoach = () => !!useCoachProfile()[0];
