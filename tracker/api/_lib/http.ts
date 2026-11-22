/**
 * Shared helpers for PeakX serverless functions (Vercel, Node runtime, Web Request/Response handlers).
 * Secrets live only in Vercel env vars (GEMINI_API_KEY …), never in the client bundle.
 */

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

/** Same-site requests only (plus ALLOWED_ORIGINS), so the AI key can't be used from other sites. */
export function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return; // same-origin fetches from some browsers omit it
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = new URL(origin).host === host || allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  if (!ok) throw new HttpError(403, 'Origin not allowed');
}

/** Best-effort per-IP limit for one function instance (stateless platforms reset it; the app also limits per user). */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(req: Request, key: string, max: number, windowMs: number) {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const k = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || b.reset < now) { buckets.set(k, { n: 1, reset: now + windowMs }); return; }
  if (++b.n > max) throw new HttpError(429, 'Too many requests, try again later');
}

export async function readJson<T>(req: Request, maxBytes = 2_000_000): Promise<T> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'Request too large');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request too large');
  try { return JSON.parse(text) as T; } catch { throw new HttpError(400, 'Invalid JSON'); }
}

/** Wrap a handler: origin check, JSON errors, never leak internals. */
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try { checkOrigin(req); return await fn(req); }
    catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Something went wrong' }, 500);
    }
  };
}
