import { db } from './supa.js';
import { HttpError } from './http.js';
import { liveMode, rzp } from './razorpay.js';
import { newBilling, KIND_LABEL } from '../../src/domain/billing.js';
import { FOUNDING } from '../../src/data/founding.js';
import type { Billing, BillingKind } from '../../src/domain/types.js';

/**
 * Billing storage on Supabase (written only by the server):
 *   billing(user_id, data)                  the member's Billing; the app reads its own row
 *   pay_subscriptions(id, user_id, kind)    Razorpay subscription → member
 *   pay_payments(id, user_id, …)            Razorpay payment → member
 *   app_meta('early_bird' | 'early_bird_test') { taken }   early bird slots used, live and test counted
 *                                          apart (bump_counter keeps it atomic)
 */

export async function getBilling(uid: string): Promise<Billing | undefined> {
  const row = await db.one<{ data: Billing }>('billing', 'user_id', uid, 'data');
  return row?.data ?? undefined;
}
export const setBilling = (uid: string, b: Billing) => db.upsert('billing', { user_id: uid, data: b });

export async function subscriptionOwner(id: string): Promise<{ uid: string; kind: BillingKind } | undefined> {
  const r = await db.one<{ user_id: string | null; kind: BillingKind }>('pay_subscriptions', 'id', id, 'user_id,kind');
  return r?.user_id ? { uid: r.user_id, kind: r.kind } : undefined;
}
export const saveSubscription = (id: string, uid: string, kind: BillingKind) => db.upsert('pay_subscriptions', { id, user_id: uid, kind });

export async function paymentOwner(id: string): Promise<string | null> {
  return (await db.one<{ user_id: string | null }>('pay_payments', 'id', id, 'user_id'))?.user_id ?? null;
}
export const savePayment = (id: string, uid: string, kind: BillingKind, subscriptionId: string | null, amount: number) =>
  db.upsert('pay_payments', { id, user_id: uid, kind, subscription_id: subscriptionId, amount });

const earlyBirdKey = () => (liveMode() ? 'early_bird' : 'early_bird_test');
export async function foundingTaken(): Promise<number> {
  const r = await db.one<{ value: { taken?: number } }>('app_meta', 'key', earlyBirdKey(), 'value');
  return Number(r?.value?.taken ?? FOUNDING.taken);
}
export const bumpFounding = (delta: number) => db.rpc<number>('bump_counter', { k: earlyBirdKey(), delta, base: FOUNDING.taken });

/** Create billing for a first payment (safe to call twice for the same payment), count founding places. Shared with the webhook. */
export async function activate(uid: string, kind: BillingKind, subscriptionId: string | null, paymentId: string, amount: number): Promise<Billing> {
  // Checkout's verify call and the webhook can arrive together: whoever records the payment first activates.
  const first = await db.insertNew('pay_payments', { id: paymentId, user_id: uid, kind, subscription_id: subscriptionId, amount });
  if (!first) {
    for (let i = 0; i < 5; i++) {
      const b = await getBilling(uid);
      if (b?.payments.some((p) => p.id === paymentId)) return b;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  const cur = await getBilling(uid);
  if (cur?.payments.some((p) => p.id === paymentId)) return cur;
  const fresh = newBilling(kind, { nowMs: Date.now(), paymentId, amount, subscriptionId });
  const next: Billing = cur && cur.status !== 'refunded'
    ? { ...fresh, payments: [...cur.payments, ...fresh.payments], coach: cur.coach, refund: cur.refund }
    : { ...fresh, coach: cur?.coach ?? null, refund: cur?.refund ?? null };
  await setBilling(uid, next);
  if (kind === 'founding' && first) await bumpFounding(1);
  return next;
}

/**
 * Unlock the plan for a paid order. The order (created by this server) says who and what; the client
 * only proves payment. Captures the payment if the account doesn't auto-capture. Shared by /api/verify-payment and the webhook.
 */
export async function activateOrder(orderId: string, paymentId: string, expectUid: string | null): Promise<Billing> {
  const order = await rzp<{ amount: number; currency: string; notes?: Record<string, string> | unknown[] }>('GET', `/orders/${orderId}`);
  const notes = order.notes && !Array.isArray(order.notes) ? order.notes as Record<string, string> : {};
  const kind = notes.kind as BillingKind | undefined;
  if (!notes.uid || !kind || !(kind in KIND_LABEL)) throw new HttpError(400, 'That order isn’t a PeakX plan');
  if (expectUid && notes.uid !== expectUid) throw new HttpError(403, 'That payment belongs to another account');
  const pay = await rzp<{ status: string; order_id: string; amount: number; currency: string }>('GET', `/payments/${paymentId}`);
  if (pay.order_id !== orderId) throw new HttpError(400, 'That payment isn’t for this order');
  if (pay.amount !== order.amount || pay.currency !== order.currency) throw new HttpError(400, 'The amount paid doesn’t match the order');
  if (pay.status === 'authorized') await rzp('POST', `/payments/${paymentId}/capture`, { amount: pay.amount, currency: pay.currency });
  else if (pay.status !== 'captured') throw new HttpError(402, 'The payment didn’t go through');
  return activate(notes.uid, kind, null, paymentId, pay.amount / 100);
}
