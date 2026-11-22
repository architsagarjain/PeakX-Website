import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';
import { supaConfigured } from './supa.js';
import type { BillingKind } from '../../src/domain/types.js';
import { priceOf } from '../../src/domain/billing.js';

/**
 * Razorpay REST client (S23.1). Env:
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET   API keys (test keys start rzp_test_). Enough for one-time
 *                                          payments (Standard Checkout with orders).
 *   RAZORPAY_WEBHOOK_SECRET                the secret you type when adding the webhook (optional)
 *   RAZORPAY_PLAN_MONTHLY / _YEARLY / _COACHED   optional plan ids (plan_…). A kind with a plan renews
 *                                          automatically (subscription); without one it is a one-time
 *                                          payment for one period (order).
 * The early bird offer ('founding' kind) is ₹99 for the first month. With a monthly plan it is a
 * subscription on that plan with ₹99 charged up front and the first full charge a month later;
 * without one, ₹99 buys one month.
 */

const BASE = 'https://api.razorpay.com/v1';
export const keyId = () => process.env.RAZORPAY_KEY_ID ?? '';
/** Live keys take real money; test keys don't (and don't use up early bird slots). */
export const liveMode = () => keyId().startsWith('rzp_live_');
/** Keys and server data access (billing is stored in Supabase). */
export const payConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && supaConfigured());

export function planId(kind: BillingKind): string | null {
  const v = kind === 'yearly' ? process.env.RAZORPAY_PLAN_YEARLY : kind === 'coached' ? process.env.RAZORPAY_PLAN_COACHED : process.env.RAZORPAY_PLAN_MONTHLY;
  return v || null;
}
const KINDS: BillingKind[] = ['founding', 'monthly', 'yearly', 'coached'];
/** Which kinds can be bought right now (keys and a price in the app). */
export function availableKinds(): BillingKind[] {
  if (!payConfigured()) return [];
  return KINDS.filter((k) => priceOf(k) !== null);
}
/** The kinds sold as renewing subscriptions (they have a plan id); the rest are one-time orders. */
export const recurringKinds = (): BillingKind[] => availableKinds().filter((k) => planId(k));

export async function rzp<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!payConfigured()) throw new HttpError(503, 'Payments are not configured');
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({})) as T & { error?: { description?: string } };
  if (!res.ok) {
    console.error('Razorpay', method, path, res.status, JSON.stringify(data).slice(0, 400));
    if (res.status === 401) throw new HttpError(500, 'Razorpay rejected the API keys. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    throw new HttpError(500, data.error?.description ?? 'The payment service did not answer');
  }
  return data;
}

export const hmac = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex');
export function sameSig(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
/** Checkout signature for subscriptions: HMAC(payment_id|subscription_id, key secret). */
export const checkoutSigOk = (paymentId: string, subscriptionId: string, sig: string) =>
  sameSig(hmac(process.env.RAZORPAY_KEY_SECRET ?? '', `${paymentId}|${subscriptionId}`), sig);
/** Checkout signature for orders (Standard Checkout): HMAC(order_id|payment_id, key secret). */
export const orderSigOk = (orderId: string, paymentId: string, sig: string) =>
  sameSig(hmac(process.env.RAZORPAY_KEY_SECRET ?? '', `${orderId}|${paymentId}`), sig);
/** Webhook signature: HMAC(raw body, webhook secret). */
export const webhookSigOk = (raw: string, sig: string) =>
  !!process.env.RAZORPAY_WEBHOOK_SECRET && sameSig(hmac(process.env.RAZORPAY_WEBHOOK_SECRET, raw), sig);

/** Refuse to sell at a price different from the one the app shows. */
const checked = new Map<string, number>();
export async function assertPlanPrice(kind: BillingKind): Promise<string> {
  const id = planId(kind);
  const rupees = kind === 'founding' ? priceOf('monthly') : priceOf(kind);
  if (!id || rupees === null) throw new HttpError(400, 'That plan isn’t available');
  if (checked.get(id) !== rupees) {
    const plan = await rzp<{ item: { amount: number; currency: string } }>('GET', `/plans/${id}`);
    if (plan.item.amount !== rupees * 100 || plan.item.currency !== 'INR') throw new HttpError(500, `Razorpay plan ${id} is ₹${plan.item.amount / 100}, but the app shows ₹${rupees}. Fix the plan before selling.`);
    checked.set(id, rupees);
  }
  return id;
}
