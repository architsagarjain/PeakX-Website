import { useEffect, useState } from 'react';
import type { Billing, BillingKind } from '../domain/types';
import { KIND_LABEL } from '../domain/billing';
import { setLiveTaken } from '../data/founding';
import { callAi, AiError } from './ai';
import { idToken } from './cloud';
import { track } from './telemetry';

/**
 * Payments in the app (S23.1, S23.2): which plans can be bought, Razorpay Checkout, cancel and refund.
 * All money logic runs on the server; the app only opens Checkout and shows the result.
 *   One-time (Standard Checkout): /api/create-order → Checkout with order_id → /api/verify-payment
 *   Renewing (plans set up in Razorpay): /api/pay start → Checkout with subscription_id → /api/pay verify
 * The key id comes from the server with each order, so only the server's env holds Razorpay keys.
 */

export interface PayStatus { configured: boolean; kinds: BillingKind[]; recurring: BillingKind[]; founding: { places: number; taken: number; left: number } }
const OFF: PayStatus = { configured: false, kinds: [], recurring: [], founding: { places: 0, taken: 0, left: 0 } };
let status: Promise<PayStatus> | null = null;

export function payStatus(refresh = false): Promise<PayStatus> {
  if (refresh) status = null;
  status ??= fetch('/api/pay', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() as Promise<PayStatus> : OFF))
    .then((s) => ({ ...s, recurring: s.recurring ?? [] }))
    .then((s) => { if (s.founding?.places) setLiveTaken(s.founding.taken); return s; })
    .catch(() => OFF);
  return status;
}
export function usePayStatus(): PayStatus | null {
  const [s, setS] = useState<PayStatus | null>(null);
  useEffect(() => { let live = true; payStatus().then((x) => live && setS(x)); return () => { live = false; }; }, []);
  return s;
}

async function api<T>(body: unknown, endpoint = 'pay'): Promise<T> {
  const token = await idToken();
  if (!token) throw new AiError(401, 'Sign in first');
  return callAi<T>(endpoint, body, 30000, token);
}

type RazorpayResponse = { razorpay_payment_id: string; razorpay_subscription_id?: string; razorpay_order_id?: string; razorpay_signature: string };
declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open(): void; on(e: string, cb: (r: { error?: { description?: string } }) => void): void } } }

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => res(); s.onerror = () => rej(new AiError(0, 'Couldn’t load Razorpay. Check your connection.'));
    document.head.appendChild(s);
  });
}

export class CheckoutClosed extends Error { constructor() { super('Checkout closed'); } }

/** Open Razorpay Checkout for a plan; resolves with the new billing once the server has verified the payment. */
export async function checkout(kind: BillingKind, prefill: { email?: string | null; name?: string | null }): Promise<Billing> {
  track('checkout_started', { kind });
  const recurring = (await payStatus()).recurring.includes(kind);
  // Ask the server first: it decides the amount, so the page can't change the price.
  const start = recurring
    ? await api<{ keyId: string; subscriptionId: string }>({ action: 'start', kind })
    : await api<{ keyId: string; order_id: string; amount: number; currency: string }>({ kind }, 'create-order');
  await loadCheckout();
  return new Promise<Billing>((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: start.keyId,
      ...('subscriptionId' in start ? { subscription_id: start.subscriptionId } : { order_id: start.order_id, amount: start.amount, currency: start.currency }),
      name: 'PeakX',
      description: KIND_LABEL[kind],
      prefill: { email: prefill.email ?? undefined, name: prefill.name ?? undefined },
      theme: { color: '#2F6BFF' },
      handler: async (r: RazorpayResponse) => {
        try {
          const v = recurring
            ? await api<{ billing: Billing }>({ action: 'verify', ...r })
            : await api<{ billing: Billing }>({ razorpay_payment_id: r.razorpay_payment_id, razorpay_order_id: r.razorpay_order_id, razorpay_signature: r.razorpay_signature }, 'verify-payment');
          track('checkout_paid', { kind }); payStatus(true); resolve(v.billing);
        } catch (e) { reject(e); }
      },
      modal: { ondismiss: () => reject(new CheckoutClosed()) },
    });
    rz.on('payment.failed', (r) => { track('checkout_failed', { kind }); reject(new AiError(402, r.error?.description ?? 'The payment didn’t go through')); });
    rz.open();
  });
}

export const cancelRenewal = () => api<{ billing: Billing }>({ action: 'cancel' }).then((r) => r.billing);
export const requestRefund = (reason: string) => api<{ billing: Billing }>({ action: 'refund', reason }).then((r) => r.billing);
