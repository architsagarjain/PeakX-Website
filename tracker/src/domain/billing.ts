import type { Billing, BillingKind, Plan } from './types.js';
import { COACHED, FOUNDING, PRO } from '../data/founding.js';

/**
 * Payments (S23.1, S23.2). Pure rules shared by the app and the server: prices, access periods,
 * applying Razorpay events, and the refund promise. Amounts are in rupees; Razorpay uses paise.
 */

export const DAY = 86_400_000;
export const GRACE_DAYS = 3;          // access continues this long after a missed renewal
export const REFUND_DAYS = 35;        // 4 weeks of Pro + the first weekly report, plus a week to ask

export const KIND_LABEL: Record<BillingKind, string> = { founding: 'Early bird', monthly: 'Pro monthly', yearly: 'Pro yearly', coached: 'Coached' };

/** Price in rupees, or null when it isn't set (Coached for now). */
export function priceOf(kind: BillingKind): number | null {
  return kind === 'founding' ? FOUNDING.price : kind === 'monthly' ? PRO.monthly : kind === 'yearly' ? PRO.yearly : COACHED.monthly;
}
export const planOfKind = (kind: BillingKind): Exclude<Plan, 'free'> => (kind === 'coached' ? 'coached' : 'pro');

const iso = (ms: number) => new Date(ms).toISOString();
function addMonths(ms: number, n: number): number { const d = new Date(ms); d.setMonth(d.getMonth() + n); return d.getTime(); }
/** The first paid period, from payment: a month for the early bird offer and monthly, a year for yearly. */
export function firstPeriod(kind: BillingKind, nowMs: number): { accessFrom: number; paidThrough: number } {
  return { accessFrom: nowMs, paidThrough: kind === 'yearly' ? addMonths(nowMs, 12) : addMonths(nowMs, 1) };
}

export function newBilling(kind: BillingKind, o: { nowMs: number; paymentId: string; amount: number; subscriptionId: string | null; periodEndMs?: number }): Billing {
  const p = firstPeriod(kind, o.nowMs);
  const paidThrough = o.periodEndMs ?? p.paidThrough;
  return {
    plan: planOfKind(kind), kind, status: 'active', subscriptionId: o.subscriptionId,
    startedAt: iso(o.nowMs), accessFrom: iso(p.accessFrom), paidThrough: iso(paidThrough), paidThroughMs: paidThrough,
    renewsAt: o.subscriptionId ? iso(paidThrough) : null,
    payments: [{ id: o.paymentId, at: iso(o.nowMs), amount: o.amount, kind, status: 'paid' }],
    refund: null, coach: null,
  };
}

export type BillingEvent =
  | { type: 'charged'; paymentId: string; amount: number; atMs: number; periodEndMs: number | null }
  | { type: 'cancelled'; atMs: number; immediate: boolean }
  | { type: 'halted' }
  | { type: 'completed' }
  | { type: 'refunded'; paymentId: string; amount: number; atMs: number; reason: string };

/** Apply a payment event. Idempotent for repeated charges of the same payment. */
export function applyEvent(b: Billing, e: BillingEvent): Billing {
  switch (e.type) {
    case 'charged': {
      if (b.payments.some((p) => p.id === e.paymentId)) return b;
      const end = e.periodEndMs ?? (b.kind === 'yearly' ? addMonths(Math.max(b.paidThroughMs, e.atMs), 12) : addMonths(Math.max(b.paidThroughMs, e.atMs), 1));
      const paidThroughMs = Math.max(b.paidThroughMs, end);
      return { ...b, status: 'active', paidThrough: iso(paidThroughMs), paidThroughMs, renewsAt: b.status === 'cancelling' ? null : iso(paidThroughMs), payments: [...b.payments, { id: e.paymentId, at: iso(e.atMs), amount: e.amount, kind: b.kind === 'founding' ? 'monthly' : b.kind, status: 'paid' }] };
    }
    case 'cancelled':
      if (b.status === 'refunded') return b;
      return e.immediate && e.atMs >= b.paidThroughMs ? { ...b, status: 'ended', renewsAt: null } : { ...b, status: 'cancelling', renewsAt: null };
    case 'halted': return b.status === 'refunded' ? b : { ...b, status: 'halted', renewsAt: null };
    case 'completed': return b.status === 'refunded' ? b : { ...b, status: 'ended', renewsAt: null };
    case 'refunded':
      return {
        ...b, status: 'refunded', renewsAt: null, paidThrough: iso(e.atMs), paidThroughMs: e.atMs,
        payments: b.payments.map((p) => (p.id === e.paymentId ? { ...p, status: 'refunded' } : p)),
        refund: { at: iso(e.atMs), reason: b.refund?.reason ?? e.reason, amount: e.amount, status: 'processed' },
      };
  }
}

/** The plan this billing gives right now: paid tiers while paid through (plus grace), otherwise Free. */
export function planFrom(b: Billing | null, nowMs: number): Plan {
  if (!b || b.status === 'refunded' || b.status === 'ended') return 'free';
  const grace = b.status === 'active' || b.status === 'halted' ? GRACE_DAYS * DAY : 0;
  return nowMs <= b.paidThroughMs + grace ? b.plan : 'free';
}

/** The refund promise: a full refund of the first payment if asked within 35 days of the first paid period starting. */
export function refundCheck(b: Billing | null, nowMs: number): { ok: true; amount: number; paymentId: string; until: string } | { ok: false; reason: string } {
  if (!b || !b.payments.length) return { ok: false, reason: 'No payment to refund' };
  if (b.manual) return { ok: false, reason: 'This plan was set up by your coach; ask them about refunds' };
  if (b.refund || b.status === 'refunded') return { ok: false, reason: 'You’ve already had a refund' };
  const first = b.payments[0];
  const until = new Date(b.accessFrom).getTime() + REFUND_DAYS * DAY;
  if (nowMs > until) return { ok: false, reason: `The refund window closed on ${new Date(until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` };
  return { ok: true, amount: first.amount, paymentId: first.id, until: iso(until) };
}

const day = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** One line for the Account screen. */
export function statusLine(b: Billing | null, nowMs: number): string {
  if (!b) return 'Free plan · upgrade any time';
  const next = b.kind === 'founding' || b.kind === 'monthly' ? priceOf('monthly') : priceOf(b.kind);
  switch (b.status) {
    case 'active': return b.renewsAt ? `${KIND_LABEL[b.kind]} · renews${next ? ` at ${rupees(next)}` : ''} on ${day(b.renewsAt)}` : `${KIND_LABEL[b.kind]} · paid through ${day(b.paidThrough)}`;
    case 'cancelling': return `${KIND_LABEL[b.kind]} · cancelled, Pro until ${day(b.paidThrough)}`;
    case 'halted': return nowMs <= b.paidThroughMs + GRACE_DAYS * DAY ? 'Renewal payment failed · update your payment method' : 'Renewal failed · back on Free';
    case 'refunded': return `Refunded ${rupees(b.refund?.amount ?? 0)} on ${day(b.refund?.at ?? b.paidThrough)} · back on Free`;
    case 'ended': return `${KIND_LABEL[b.kind]} ended ${day(b.paidThrough)} · back on Free`;
  }
}

// ---------- Razorpay webhooks ----------

interface RzpEntity { id?: string; amount?: number; order_id?: string | null; invoice_id?: string | null; current_end?: number | null; notes?: Record<string, string> | unknown[]; payment_id?: string; subscription_id?: string; status?: string }
export interface WebhookBody { event: string; created_at?: number; payload?: Record<string, { entity?: RzpEntity } | undefined> }
export interface ParsedWebhook { name: string; subscriptionId: string | null; paymentId: string | null; orderId: string | null; uid: string | null; kind: BillingKind | null; amount: number | null; event: BillingEvent | null }

const notesOf = (e?: RzpEntity) => (e?.notes && !Array.isArray(e.notes) ? (e.notes as Record<string, string>) : {});

/** Turn a Razorpay webhook into the subscription/payment it's about and a billing event. Unknown events → event null. */
export function parseWebhook(body: WebhookBody): ParsedWebhook {
  const sub = body.payload?.subscription?.entity, pay = body.payload?.payment?.entity, ref = body.payload?.refund?.entity;
  const notes = { ...notesOf(pay), ...notesOf(sub) };
  const atMs = (body.created_at ?? Math.floor(Date.now() / 1000)) * 1000;
  const kind = (['founding', 'monthly', 'yearly', 'coached'] as const).find((k) => k === notes.kind) ?? null;
  const base = { name: body.event, subscriptionId: sub?.id ?? pay?.subscription_id ?? notes.subscription_id ?? null, paymentId: ref?.payment_id ?? pay?.id ?? null, orderId: pay && !pay.invoice_id ? pay.order_id ?? null : null, uid: notes.uid ?? null, kind, amount: null as number | null };
  switch (body.event) {
    case 'subscription.charged':
      return { ...base, amount: (pay?.amount ?? 0) / 100, event: pay?.id ? { type: 'charged', paymentId: pay.id, amount: (pay.amount ?? 0) / 100, atMs, periodEndMs: sub?.current_end ? sub.current_end * 1000 : null } : null };
    case 'subscription.cancelled': return { ...base, event: { type: 'cancelled', atMs, immediate: false } };
    case 'subscription.halted': return { ...base, event: { type: 'halted' } };
    case 'subscription.completed': return { ...base, event: { type: 'completed' } };
    case 'refund.processed':
      return { ...base, amount: (ref?.amount ?? 0) / 100, event: ref?.payment_id ? { type: 'refunded', paymentId: ref.payment_id, amount: (ref.amount ?? 0) / 100, atMs, reason: notesOf(ref).reason ?? 'Refund' } : null };
    case 'payment.captured': case 'subscription.authenticated': case 'subscription.activated':
      return { ...base, amount: pay?.amount ? pay.amount / 100 : null, event: null };   // handled as "create billing if missing"
    default: return { ...base, event: null };
  }
}
