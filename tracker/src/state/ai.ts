import { useEffect, useState } from 'react';

/**
 * Talks to the PeakX serverless functions (/api/*). Every AI feature has a built-in fallback,
 * so when /api isn't deployed (local dev, preview without keys) the app still works.
 */

export interface AiStatus { ai: boolean; model: string | null; email: boolean }
let status: Promise<AiStatus> | null = null;

export function aiStatus(): Promise<AiStatus> {
  status ??= fetch('/api/health', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : { ai: false, model: null, email: false }))
    .catch(() => ({ ai: false, model: null, email: false }));
  return status;
}

export function useAiStatus(): AiStatus | null {
  const [s, setS] = useState<AiStatus | null>(null);
  useEffect(() => { let live = true; aiStatus().then((x) => live && setS(x)); return () => { live = false; }; }, []);
  return s;
}

export class AiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function callAi<T>(path: string, body: unknown, timeoutMs = 30000, token?: string | null): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), signal: ctl.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new AiError(r.status, (data as { error?: string }).error ?? 'Request failed');
    return data as T;
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(0, (e as Error).name === 'AbortError' ? 'The AI took too long' : 'Couldn’t reach the AI service');
  } finally { clearTimeout(t); }
}

/** Blob → base64 (no data: prefix), for sending audio or photos. */
export function toBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}
