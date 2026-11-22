import { handle, json, rateLimit, readJson, HttpError } from './_lib/http.js';
import { supaConfigured, supaUser } from './_lib/supa.js';
import { activate, activateOrder, bumpFounding, foundingTaken as takenOnServer, getBilling, saveSubscription, setBilling, subscriptionOwner } from './_lib/billing.js';
import { assertPlanPrice, availableKinds, checkoutSigOk, keyId, orderSigOk, payConfigured, recurringKinds, rzp } from './_lib/razorpay.js';
import { applyEvent, firstPeriod, planFrom, priceOf, refundCheck, KIND_LABEL } from '../src/domain/billing.js';
import { FOUNDING } from '../src/data/founding.js';
import type { Billing, BillingKind } from '../src/domain/types.js';

/**
 * Payments (S23.1, S23.2). Every POST needs a signed-in member (Authorization: Bearer <Supabase token>).
 *   GET  /api/pay                              → { configured, kinds, recurring, founding: { places, taken, left } }
 *
 *   One-time payments, Razorpay Standard Checkout with orders (kinds without a plan id):
 *   POST /api/create-order { kind }            → { order_id, amount (paise), currency, keyId, … }
 *   POST /api/verify-payment { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 *                                              → checks HMAC(order_id|payment_id), unlocks the plan, returns billing
 *   (both are rewrites to /api/pay?op=…, so they share this function)
 *
 *   Renewing subscriptions (kinds with a plan id):
 *   POST /api/pay { action: 'start', kind }    → Razorpay subscription for Checkout
 *   POST /api/pay { action: 'verify', … }      → checks the Checkout signature, unlocks the plan, returns billing
 *
 *   POST /api/pay { action: 'cancel' }         → stops renewal; access runs to the end of the paid period
 *   POST /api/pay { action: 'refund', reason } → the refund promise: full refund of the first payment
 * Billing lives in the Supabase table `billing`, which only the server writes (see _lib/billing.ts).
 */

type Body =
  | { action: 'start'; kind: BillingKind }
  | { action: 'order'; kind: BillingKind }
  | { action: 'verify-order'; razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
  | { action: 'verify'; razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }
  | { action: 'cancel' }
  | { action: 'refund'; reason: string };

async function foundingTaken(): Promise<number> {
  return supaConfigured() ? takenOnServer() : FOUNDING.taken;
}

/** One plan at a time; the early bird offer once per member while slots last. */
async function assertCanBuy(uid: string, kind: BillingKind): Promise<void> {
  if (!availableKinds().includes(kind)) throw new HttpError(400, `${KIND_LABEL[kind] ?? 'That plan'} isn’t available yet`);
  const cur = await getBilling(uid);
  if (cur && planFrom(cur, Date.now()) !== 'free' && cur.status === 'active') throw new HttpError(409, `You’re already on ${KIND_LABEL[cur.kind]}`);
  if (kind === 'founding') {
    if (cur?.payments.some((p) => p.kind === 'founding')) throw new HttpError(409, 'You’ve already used the early bird offer');
    if ((await foundingTaken()) >= FOUNDING.places) throw new HttpError(409, 'The early bird offer has closed. Pro is ₹199 a month.');
  }
}

export const GET = handle(async () => {
  const taken = await foundingTaken().catch(() => FOUNDING.taken);
  return json({ configured: payConfigured(), kinds: availableKinds(), recurring: recurringKinds(), founding: { places: FOUNDING.places, taken, left: Math.max(0, FOUNDING.places - taken) } });
});

export const POST = handle(async (req) => {
  rateLimit(req, 'pay', 30, 60 * 60_000);
  const op = new URL(req.url).searchParams.get('op');
  const raw = await readJson<Record<string, unknown>>(req, 10_000);
  const body = (op === 'create-order' ? { ...raw, action: 'order' } : op === 'verify-payment' ? { ...raw, action: 'verify-order' } : raw) as Body;
  const user = await supaUser(req);

  if (body.action === 'order') {
    const kind = body.kind;
    await assertCanBuy(user.uid, kind);
    if (recurringKinds().includes(kind)) throw new HttpError(400, `${KIND_LABEL[kind]} renews automatically; start it as a subscription`);
    const rupees = priceOf(kind)!;
    const amount = Math.round(rupees * 100);
    if (amount < 100) throw new HttpError(400, 'The amount must be at least ₹1');
    const order = await rzp<{ id: string; amount: number; currency: string }>('POST', '/orders', {
      amount, currency: 'INR', receipt: `px_${kind}_${Date.now()}`.slice(0, 40), notes: { uid: user.uid, kind },
    });
    return json({ order_id: order.id, amount: order.amount, currency: order.currency, keyId: keyId(), kind, email: user.email, name: user.name });
  }

  if (body.action === 'verify-order') {
    const { razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig } = body;
    if (!pid || !oid || !sig) throw new HttpError(400, 'razorpay_payment_id, razorpay_order_id and razorpay_signature are required');
    if (!orderSigOk(oid, pid, sig)) throw new HttpError(400, 'Payment couldn’t be verified');
    const billing = await activateOrder(oid, pid, user.uid);
    return json({ ok: true, billing });
  }

  if (body.action === 'start') {
    const kind = body.kind;
    await assertCanBuy(user.uid, kind);
    const plan = await assertPlanPrice(kind);
    const notes = { uid: user.uid, kind };
    const now = Date.now();
    const sub = await rzp<{ id: string }>('POST', '/subscriptions', kind === 'founding'
      ? { plan_id: plan, total_count: 120, quantity: 1, customer_notify: 1, start_at: Math.floor(firstPeriod('founding', now).paidThrough / 1000), notes,
          addons: [{ item: { name: `PeakX early bird · first month of Pro at ${FOUNDING.discount}% off`, amount: FOUNDING.price * 100, currency: 'INR' } }] }
      : { plan_id: plan, total_count: kind === 'yearly' ? 10 : 120, quantity: 1, customer_notify: 1, notes });
    await saveSubscription(sub.id, user.uid, kind);
    return json({ keyId: keyId(), subscriptionId: sub.id, kind, amount: priceOf(kind), email: user.email, name: user.name });
  }

  if (body.action === 'verify') {
    const { razorpay_payment_id: pid, razorpay_subscription_id: sid, razorpay_signature: sig } = body;
    if (!pid || !sid || !sig || !checkoutSigOk(pid, sid, sig)) throw new HttpError(400, 'Payment couldn’t be verified');
    const index = await subscriptionOwner(sid);
    if (!index || index.uid !== user.uid) throw new HttpError(403, 'That payment belongs to another account');
    const pay = await rzp<{ amount: number; status: string }>('GET', `/payments/${pid}`);
    if (!['captured', 'authorized'].includes(pay.status)) throw new HttpError(402, 'The payment didn’t go through');
    const billing = await activate(user.uid, index.kind, sid, pid, pay.amount / 100);
    return json({ billing });
  }

  if (body.action === 'cancel') {
    const cur = await getBilling(user.uid);
    if (!cur || cur.status !== 'active' || !cur.subscriptionId) throw new HttpError(409, 'There’s no renewal to cancel');
    const notStarted = cur.renewsAt && cur.payments.length === 1 && cur.kind === 'founding';
    await rzp('POST', `/subscriptions/${cur.subscriptionId}/cancel`, { cancel_at_cycle_end: notStarted ? 0 : 1 });
    const next = applyEvent(cur, { type: 'cancelled', atMs: Date.now(), immediate: false });
    await setBilling(user.uid, next);
    return json({ billing: next });
  }

  if (body.action === 'refund') {
    const cur = await getBilling(user.uid);
    const result = refundCheck(cur ?? null, Date.now());
    if (result.ok === false) throw new HttpError(409, (result as { reason: string }).reason);
    const check = result as { amount: number; paymentId: string };
    const reason = String(body.reason ?? '').trim().slice(0, 500) || 'No reason given';
    await setBilling(user.uid, { ...cur!, refund: { at: new Date().toISOString(), reason, amount: check.amount, status: 'failed' } });
    await rzp('POST', `/payments/${check.paymentId}/refund`, { notes: { reason: reason.slice(0, 250), uid: user.uid } });
    if (cur!.subscriptionId && cur!.status === 'active') await rzp('POST', `/subscriptions/${cur!.subscriptionId}/cancel`, { cancel_at_cycle_end: 0 }).catch(() => undefined);
    const next = applyEvent({ ...cur!, refund: null }, { type: 'refunded', paymentId: check.paymentId, amount: check.amount, atMs: Date.now(), reason });
    await setBilling(user.uid, next);
    if (cur!.kind === 'founding') await bumpFounding(-1);
    return json({ billing: next });
  }

  throw new HttpError(400, 'Unknown action');
});
