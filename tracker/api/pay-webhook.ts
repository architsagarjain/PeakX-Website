import { handle, json, HttpError } from './_lib/http.js';
import { db } from './_lib/supa.js';
import { rzp, webhookSigOk } from './_lib/razorpay.js';
import { applyEvent, parseWebhook, type WebhookBody } from '../src/domain/billing.js';
import { activate, activateOrder, getBilling, paymentOwner, savePayment, setBilling, subscriptionOwner } from './_lib/billing.js';
import type { Billing, BillingKind } from '../src/domain/types.js';

/**
 * POST /api/pay-webhook: Razorpay webhook (S23.1). Add it in Razorpay → Settings → Webhooks with the
 * events subscription.* , payment.captured and refund.processed, and the same secret as
 * RAZORPAY_WEBHOOK_SECRET. Keeps the tier right even if the user closed the tab after paying.
 */
export const POST = handle(async (req) => {
  const raw = await req.text();
  if (!webhookSigOk(raw, req.headers.get('x-razorpay-signature') ?? '')) throw new HttpError(401, 'Bad signature');
  const eventId = req.headers.get('x-razorpay-event-id');
  if (eventId && !(await db.insertNew('pay_events', { id: eventId }))) return json({ ok: true, duplicate: true });
  const w = parseWebhook(JSON.parse(raw) as WebhookBody);

  // A one-time order paid by Standard Checkout: unlock it even if the tab closed before /api/verify-payment.
  if (w.name === 'payment.captured' && w.orderId && w.paymentId && !w.subscriptionId) {
    try { await activateOrder(w.orderId, w.paymentId, null); return json({ ok: true, order: true }); }
    catch (e) { if (!(e instanceof HttpError && e.status === 400)) throw e; }   // not a PeakX order: carry on
  }

  // Who is it about? Subscription index first, then the payment index, then notes.
  let uid = w.uid, kind: BillingKind | null = w.kind;
  if (w.subscriptionId) { const s = await subscriptionOwner(w.subscriptionId); if (s) { uid = s.uid; kind = s.kind; } }
  if (!uid && w.paymentId) uid = await paymentOwner(w.paymentId);
  if (!uid) return json({ ok: true, ignored: 'unknown user' });

  let b: Billing | undefined = await getBilling(uid);

  // First payment arrived before (or without) the app's verify call: create billing.
  const isFirst = !b || b.status === 'refunded' || (w.subscriptionId && b.subscriptionId !== w.subscriptionId);
  if (isFirst && kind && w.subscriptionId && w.paymentId && ['payment.captured', 'subscription.charged', 'subscription.authenticated', 'subscription.activated'].includes(w.name)) {
    const amount = w.amount ?? (await rzp<{ amount: number }>('GET', `/payments/${w.paymentId}`)).amount / 100;
    b = await activate(uid, kind, w.subscriptionId, w.paymentId, amount);
    return json({ ok: true, created: true });
  }
  if (!b || !w.event) return json({ ok: true, ignored: w.name });
  if (w.subscriptionId && b.subscriptionId && w.subscriptionId !== b.subscriptionId) return json({ ok: true, ignored: 'old subscription' });
  await setBilling(uid, applyEvent(b, w.event));
  if (w.paymentId && w.event.type === 'charged') await savePayment(w.paymentId, uid, b.kind, b.subscriptionId ?? null, w.event.amount);
  return json({ ok: true });
});
