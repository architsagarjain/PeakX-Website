/**
 * Errors and usage (S4.2). Events and errors go to VITE_TELEMETRY_URL as JSON (navigator.sendBeacon)
 * when it is set — any collector works (a Vercel/Cloudflare function, PostHog capture endpoint, etc.).
 * Without it, nothing leaves the browser; the last 50 entries stay in memory for debugging
 * (window.__peakx.telemetry) and are printed in development.
 *
 * Never put health values, food names or emails in props: counts, screens and ids only.
 */

const endpoint = (import.meta.env as Record<string, string | undefined>).VITE_TELEMETRY_URL;
const dev = import.meta.env.DEV && import.meta.env.MODE !== 'test';

export type TelemetryEvent =
  | 'app_open' | 'screen_view'
  | 'plateau_check_started' | 'plateau_check_completed'
  | 'onboarding_completed'
  | 'sign_in' | 'sign_up' | 'sign_in_link_sent' | 'sign_out' | 'account_deleted' | 'data_exported'
  | 'meal_logged' | 'set_logged' | 'session_finished' | 'weight_logged' | 'recipe_saved'
  | 'upgrade_viewed' | 'upgrade_clicked'
  | 'checkout_started' | 'checkout_paid' | 'checkout_failed' | 'renewal_cancelled' | 'refund_requested'
  | 'form_check_sent' | 'fix_plan_added' | 'labs_saved' | 'coach_requested'
  | 'result_shared'
  | 'supplement_check_started' | 'supplement_check_completed' | 'supplement_unlock_clicked' | 'supplement_buy_clicked';

interface Entry { kind: 'event' | 'error'; name: string; props?: Record<string, string | number | boolean>; screen: string; at: string }
const buffer: Entry[] = [];
let lastAction = '';

const screen = () => (typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, '') || '/');
const session = (() => { try { const k = 'peakx.sid'; let s = sessionStorage.getItem(k); if (!s) { s = Math.random().toString(36).slice(2, 10); sessionStorage.setItem(k, s); } return s; } catch { return 'nosession'; } })();

/**
 * Where a visit came from: `?ref=` before the hash (peakx.live/?ref=reddit#/welcome) or inside it
 * (#/welcome?ref=reddit). Lowercase letters, digits and dashes only, 40 characters at most.
 */
export function parseRef(search: string, hash = ''): string | null {
  const inHash = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
  const raw = new URLSearchParams(search).get('ref') ?? new URLSearchParams(inHash).get('ref') ?? '';
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || null;
}

/** Microsoft Clarity (tag in index.html). Its stub queues calls until the script loads; absent in tests. */
const clarity = (...args: unknown[]) => {
  try { (window as unknown as { clarity?: (...a: unknown[]) => void }).clarity?.(...args); } catch { /* never break the app */ }
};

/** This visit's ref and the first ref this browser ever arrived with (kept in localStorage). */
let source = { ref: '', firstRef: '' };
function captureRef() {
  const ref = parseRef(window.location.search, window.location.hash) ?? '';
  let firstRef = ref;
  try {
    const k = 'peakx.ref';
    const saved = localStorage.getItem(k);
    if (saved) firstRef = saved; else if (ref) localStorage.setItem(k, ref);
  } catch { /* storage blocked: this visit's ref still counts */ }
  source = { ref, firstRef };
  if (ref) clarity('set', 'ref', ref);
  if (firstRef) clarity('set', 'first_ref', firstRef);
}

function send(e: Entry) {
  buffer.push(e); if (buffer.length > 50) buffer.shift();
  if (typeof window !== 'undefined') (window as unknown as { __peakx?: { telemetry: Entry[] } }).__peakx = { telemetry: buffer };
  if (dev) console.debug('[telemetry]', e.kind, e.name, e.props ?? '', e.screen);
  // Event names only (no props), so Clarity can count funnels like plateau_check_completed → sign_up by ref.
  if (e.kind === 'event' && typeof window !== 'undefined') clarity('event', e.name);
  if (!endpoint || typeof navigator === 'undefined') return;
  const body = JSON.stringify({ ...e, session, ...source, release: (import.meta.env as Record<string, string | undefined>).VITE_RELEASE ?? 'dev' });
  try { if (!navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }))) fetch(endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined); } catch { /* never break the app */ }
}

export function track(name: TelemetryEvent, props?: Entry['props']) {
  send({ kind: 'event', name, props, screen: screen(), at: new Date().toISOString() });
}

/** Remember the last store action so error reports say what the user was doing. */
export function noteAction(type: string) { lastAction = type; }

export function reportError(err: unknown, where = 'unknown') {
  const e = err instanceof Error ? err : new Error(String(err));
  send({ kind: 'error', name: e.name || 'Error', props: { message: e.message.slice(0, 300), where, lastAction, stack: (e.stack ?? '').split('\n').slice(0, 6).join(' | ').slice(0, 800) }, screen: screen(), at: new Date().toISOString() });
}

export function recent(): readonly Entry[] { return buffer; }

/** Store actions that count as product events. */
const ACTION_EVENTS: Partial<Record<string, TelemetryEvent>> = {
  logItems: 'meal_logged', logSet: 'set_logged', finishSession: 'session_finished', logWeight: 'weight_logged',
  plateauComplete: 'plateau_check_completed', onboardingFinish: 'onboarding_completed', toggleSaved: 'recipe_saved',
};
export function trackAction(type: string) {
  noteAction(type);
  const ev = ACTION_EVENTS[type];
  if (ev) track(ev);
}

let installed = false;
export function installGlobalHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, 'window.onerror'));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'unhandledrejection'));
  captureRef();
  track('app_open');
}
