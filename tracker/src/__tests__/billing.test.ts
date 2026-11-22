import { describe, expect, it } from 'vitest';
import { applyEvent, DAY, firstPeriod, newBilling, parseWebhook, planFrom, priceOf, refundCheck, statusLine } from '../domain/billing';
import { FOUNDING, PRO, COACHED } from '../data/founding';
import { reducer } from '../state/store';
import { makeSeed } from '../domain/seed';
import { migrate } from '../state/migrate';
import { splitData, joinData } from '../domain/cloudData';

const t0 = new Date('2026-10-15T10:00:00+05:30').getTime();

describe('payments (S23.1)', () => {
  it('prices: ₹199/month, ₹1,999/year, early bird ₹99 (50% off) for 5 slots; Coached has no price yet', () => {
    expect([PRO.monthly, PRO.yearly, FOUNDING.price, FOUNDING.places]).toEqual([199, 1999, 99, 5]);
    expect(FOUNDING.price).toBe(Math.floor(PRO.monthly * (100 - FOUNDING.discount) / 100));
    expect(priceOf('founding')).toBe(FOUNDING.price);
    expect(priceOf('monthly')).toBe(PRO.monthly);
    expect(priceOf('yearly')).toBe(PRO.yearly);
    expect(priceOf('coached')).toBe(COACHED.monthly);
  });
  it('the early bird unlocks Pro now for one month from payment', () => {
    const p = firstPeriod('founding', t0);
    expect(p.accessFrom).toBe(t0);
    expect(p.paidThrough).toBe(firstPeriod('monthly', t0).paidThrough);
    const b = newBilling('founding', { nowMs: t0, paymentId: 'pay_1', amount: 99, subscriptionId: null });
    expect(planFrom(b, t0)).toBe('pro');
    expect(b.renewsAt).toBeNull();
    expect(statusLine(b, t0)).toMatch(/^Early bird · paid through/);
  });
  it('renewals extend access; cancelling keeps Pro until the period ends', () => {
    let b = newBilling('monthly', { nowMs: t0, paymentId: 'pay_1', amount: 399, subscriptionId: 'sub_1' });
    const end = b.paidThroughMs;
    b = applyEvent(b, { type: 'charged', paymentId: 'pay_2', amount: 399, atMs: end, periodEndMs: end + 30 * DAY });
    expect(b.paidThroughMs).toBe(end + 30 * DAY);
    expect(applyEvent(b, { type: 'charged', paymentId: 'pay_2', amount: 399, atMs: end, periodEndMs: end + 60 * DAY })).toBe(b); // same payment twice
    b = applyEvent(b, { type: 'cancelled', atMs: end + DAY, immediate: false });
    expect(b.status).toBe('cancelling');
    expect(planFrom(b, end + 29 * DAY)).toBe('pro');
    expect(planFrom(b, end + 31 * DAY)).toBe('free');
    expect(statusLine(b, end)).toContain('cancelled');
  });
  it('a failed renewal keeps Pro for a short grace period', () => {
    const b = applyEvent(newBilling('monthly', { nowMs: t0, paymentId: 'p', amount: 399, subscriptionId: 's' }), { type: 'halted' });
    expect(planFrom(b, b.paidThroughMs + 2 * DAY)).toBe('pro');
    expect(planFrom(b, b.paidThroughMs + 4 * DAY)).toBe('free');
  });
});

describe('subscription and refunds (S23.2)', () => {
  it('refunds the first payment within 35 days of the paid period starting, once', () => {
    const b = newBilling('monthly', { nowMs: t0, paymentId: 'pay_1', amount: 399, subscriptionId: 'sub_1' });
    expect(refundCheck(b, t0 + 10 * DAY)).toMatchObject({ ok: true, amount: 399, paymentId: 'pay_1' });
    expect(refundCheck(b, t0 + 36 * DAY).ok).toBe(false);
    const r = applyEvent(b, { type: 'refunded', paymentId: 'pay_1', amount: 399, atMs: t0 + 10 * DAY, reason: 'No clear change' });
    expect(planFrom(r, t0 + 10 * DAY + 1)).toBe('free');
    expect(r.payments[0].status).toBe('refunded');
    expect(refundCheck(r, t0 + 11 * DAY).ok).toBe(false);
    expect(applyEvent(r, { type: 'cancelled', atMs: t0, immediate: true }).status).toBe('refunded');
  });
  it('the early bird refund window runs from payment', () => {
    const b = newBilling('founding', { nowMs: t0, paymentId: 'pay_1', amount: 99, subscriptionId: null });
    expect(refundCheck(b, t0 + 30 * DAY).ok).toBe(true);
    expect(refundCheck(b, t0 + 36 * DAY).ok).toBe(false);
  });
  it('coach-activated plans aren’t refunded in the app', () => {
    const b = { ...newBilling('coached', { nowMs: t0, paymentId: 'x', amount: 0, subscriptionId: null }), manual: true };
    expect(refundCheck(b, t0).ok).toBe(false);
  });
});

describe('webhooks and the store', () => {
  it('parses Razorpay events', () => {
    const charged = parseWebhook({ event: 'subscription.charged', created_at: 1_800_000_000, payload: { subscription: { entity: { id: 'sub_9', current_end: 1_802_592_000, notes: { uid: 'u1', kind: 'monthly' } } }, payment: { entity: { id: 'pay_9', amount: 39900 } } } });
    expect(charged).toMatchObject({ subscriptionId: 'sub_9', uid: 'u1', kind: 'monthly', paymentId: 'pay_9', event: { type: 'charged', amount: 399, periodEndMs: 1_802_592_000_000 } });
    const refund = parseWebhook({ event: 'refund.processed', payload: { refund: { entity: { payment_id: 'pay_9', amount: 39900, notes: [] } } } });
    expect(refund.event).toMatchObject({ type: 'refunded', paymentId: 'pay_9', amount: 399 });
    expect(parseWebhook({ event: 'order.paid' }).event).toBeNull();
  });
  it('server billing sets the plan; billing never syncs through the root doc', () => {
    const s0 = { ...makeSeed(), plan: 'free' as const };
    const b = newBilling('founding', { nowMs: Date.now(), paymentId: 'p', amount: 999, subscriptionId: 's' });
    const s = reducer(s0, { type: 'setBilling', billing: b, nowMs: Date.now() });
    expect(s.plan).toBe('pro');
    expect(s.foundingMember).toBe(true);
    expect('billing' in splitData(s).root).toBe(false);
    expect(joinData(splitData(s).root, splitData(s).days).billing).toBeNull();
  });
  it('migrates v4 data to the current schema', () => {
    const { billing, formChecks, fixPlans, labs, coachRequest, ...v4 } = makeSeed();
    void billing; void formChecks; void fixPlans; void labs; void coachRequest;
    const m = migrate({ ...v4, version: 4 })!;
    expect(m.version).toBe(7);
    expect(m).toMatchObject({ billing: null, formChecks: [], fixPlans: [], labs: [], coachRequest: null });
  });
});
