import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { activate, foundingTaken, getBilling } from '../../api/_lib/billing';
import { supaUser } from '../../api/_lib/supa';
import { POST as payPost, GET as payGet } from '../../api/pay';
import { FOUNDING, PRO } from '../data/founding';

/** A tiny in-memory PostgREST + Razorpay stand-in: enough of select / upsert / ignore-duplicates / rpc, orders and payments. */
function fakeSupabase() {
  const tables: Record<string, Map<string, Record<string, unknown>>> = {};
  const rzp = { orders: new Map<string, Record<string, unknown>>(), payments: new Map<string, Record<string, unknown>>(), keysOk: true, calls: [] as string[] };
  const keyOf: Record<string, string> = { billing: 'user_id', app_meta: 'key' };
  const t = (n: string) => (tables[n] ??= new Map());
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const u = new URL(url);
    const ok = (body: unknown) => new Response(body === null ? '' : JSON.stringify(body), { status: 200 });
    if (u.host === 'api.razorpay.com') {
      rzp.calls.push(`${init.method ?? 'GET'} ${u.pathname}`);
      if (!rzp.keysOk) return new Response(JSON.stringify({ error: { description: 'Authentication failed' } }), { status: 401 });
      const m = u.pathname.match(/^\/v1\/(orders|payments)(?:\/([^/]+))?(\/capture)?$/);
      if (m?.[1] === 'orders' && !m[2]) { const o = { id: `order_${rzp.orders.size + 1}`, ...JSON.parse(String(init.body)) }; rzp.orders.set(o.id, o); return ok(o); }
      if (m?.[1] === 'orders') return ok(rzp.orders.get(m[2]));
      if (m?.[1] === 'payments' && m[3]) { rzp.payments.get(m[2])!.status = 'captured'; return ok(rzp.payments.get(m[2])); }
      if (m?.[1] === 'payments') return ok(rzp.payments.get(m[2]));
      return new Response('{}', { status: 404 });
    }
    if (u.pathname === '/auth/v1/user') {
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer good' ? ok({ id: 'u1', email: 'a@b.co', user_metadata: { full_name: 'Arjun' } }) : new Response('{}', { status: 401 });
    }
    const name = u.pathname.replace('/rest/v1/', '');
    if (name === 'rpc/bump_counter') {
      const { k, delta, base } = JSON.parse(String(init.body));
      const cur = (t('app_meta').get(k)?.value as { taken: number } | undefined)?.taken ?? base;
      const taken = Math.max(0, cur + delta);
      t('app_meta').set(k, { key: k, value: { taken } });
      return ok(taken);
    }
    const pk = keyOf[name] ?? 'id';
    if ((init.method ?? 'GET') === 'GET') {
      const [col, v] = [...u.searchParams].find(([k]) => !['select', 'limit'].includes(k))!;
      const row = [...t(name).values()].find((r) => String(r[col]) === v.replace(/^eq\./, ''));
      return ok(row ? [row] : []);
    }
    const row = JSON.parse(String(init.body)) as Record<string, unknown>;
    const prefer = (init.headers as Record<string, string>).Prefer ?? '';
    const exists = t(name).has(String(row[pk]));
    if (prefer.includes('ignore-duplicates')) { if (!exists) t(name).set(String(row[pk]), row); return ok(exists ? [] : [row]); }
    t(name).set(String(row[pk]), { ...(t(name).get(String(row[pk])) ?? {}), ...row });
    return ok(null);
  });
  return { tables, rzp, fetchMock };
}

describe('billing on Supabase', () => {
  let fake: ReturnType<typeof fakeSupabase>;
  beforeEach(() => {
    fake = fakeSupabase();
    vi.stubGlobal('fetch', fake.fetchMock);
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('activates once per payment and counts an early bird slot once', async () => {
    const a = await activate('u1', 'founding', 'sub_1', 'pay_1', 99);
    const b = await activate('u1', 'founding', 'sub_1', 'pay_1', 99);
    expect(a.payments).toHaveLength(1);
    expect(b.payments).toHaveLength(1);
    expect((await getBilling('u1'))?.subscriptionId).toBe('sub_1');
    expect(await foundingTaken()).toBe(FOUNDING.taken + 1);
    expect([...fake.tables.app_meta.keys()]).toEqual(['early_bird_test']);   // test keys never use live slots
  });

  it('sends only the secret key as apikey, never in Authorization', async () => {
    await getBilling('u1');
    const headers = fake.fetchMock.mock.calls[0][1]!.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_secret_test');
    expect(headers.Authorization).toBeUndefined();
  });

  it('reads the signed-in member from a Supabase access token', async () => {
    const req = (t: string) => new Request('https://peakx.live/api/pay', { headers: { Authorization: `Bearer ${t}` } });
    expect(await supaUser(req('good'))).toEqual({ uid: 'u1', email: 'a@b.co', name: 'Arjun' });
    await expect(supaUser(req('bad'))).rejects.toMatchObject({ status: 401 });
  });
});

describe('Standard Checkout: create-order and verify-payment', () => {
  let fake: ReturnType<typeof fakeSupabase>;
  const SECRET = 'test_secret';
  const call = (op: string, body: unknown, token = 'good') => payPost(new Request(`https://peakx.live/api/pay?op=${op}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
  }));
  const sign = (orderId: string, paymentId: string) => createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  beforeEach(() => {
    fake = fakeSupabase();
    vi.stubGlobal('fetch', fake.fetchMock);
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_test');
    vi.stubEnv('RAZORPAY_KEY_ID', 'rzp_test_key');
    vi.stubEnv('RAZORPAY_KEY_SECRET', SECRET);
    vi.stubEnv('RAZORPAY_PLAN_MONTHLY', '');
    vi.stubEnv('RAZORPAY_PLAN_YEARLY', '');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('sells every priced plan as a one-time order when no plan ids are set', async () => {
    const s = await (await payGet(new Request('https://peakx.live/api/pay'))).json();
    expect(s).toMatchObject({ configured: true, kinds: ['founding', 'monthly', 'yearly'], recurring: [] });
  });

  it('creates an order at the app price, in paise, tagged with the member', async () => {
    const res = await call('create-order', { kind: 'monthly', amount: 1 });   // a client amount is ignored
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ order_id: 'order_1', amount: PRO.monthly * 100, currency: 'INR', keyId: 'rzp_test_key' });
    expect(body).not.toHaveProperty('key_secret');
    expect(fake.rzp.orders.get('order_1')).toMatchObject({ amount: PRO.monthly * 100, notes: { uid: 'u1', kind: 'monthly' } });
  });

  it('needs a signed-in member', async () => {
    expect((await call('create-order', { kind: 'monthly' }, '')).status).toBe(401);
    expect((await call('create-order', { kind: 'monthly' }, 'bad')).status).toBe(401);
  });

  it('returns 500 when Razorpay rejects the keys', async () => {
    fake.rzp.keysOk = false;
    const res = await call('create-order', { kind: 'monthly' });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/rejected the API keys/);
  });

  it('rejects missing fields and a wrong signature without unlocking anything', async () => {
    await call('create-order', { kind: 'monthly' });
    fake.rzp.payments.set('pay_1', { id: 'pay_1', status: 'captured', order_id: 'order_1', amount: PRO.monthly * 100, currency: 'INR' });
    expect((await call('verify-payment', { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1' })).status).toBe(400);
    expect((await call('verify-payment', { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_1', 'pay_2') })).status).toBe(400);
    expect(await getBilling('u1')).toBeUndefined();
  });

  it('unlocks Pro for a month after a valid signature, capturing an authorized payment', async () => {
    await call('create-order', { kind: 'monthly' });
    fake.rzp.payments.set('pay_1', { id: 'pay_1', status: 'authorized', order_id: 'order_1', amount: PRO.monthly * 100, currency: 'INR' });
    const res = await call('verify-payment', { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_1', 'pay_1') });
    const { billing } = await res.json();
    expect(res.status).toBe(200);
    expect(billing).toMatchObject({ plan: 'pro', kind: 'monthly', status: 'active', subscriptionId: null, renewsAt: null });
    expect(billing.payments[0]).toMatchObject({ id: 'pay_1', amount: PRO.monthly });
    expect(fake.rzp.calls).toContain('POST /v1/payments/pay_1/capture');
    // A second plan can't be bought while this one is active.
    expect((await call('create-order', { kind: 'yearly' })).status).toBe(409);
  });

  it('refuses a payment for an order made for someone else', async () => {
    fake.rzp.orders.set('order_x', { id: 'order_x', amount: 39900, currency: 'INR', notes: { uid: 'someone-else', kind: 'monthly' } });
    fake.rzp.payments.set('pay_x', { id: 'pay_x', status: 'captured', order_id: 'order_x', amount: 39900, currency: 'INR' });
    const res = await call('verify-payment', { razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: sign('order_x', 'pay_x') });
    expect(res.status).toBe(403);
  });

  it('closes the early bird after 5 paid slots, while monthly stays on sale', async () => {
    fake.tables.app_meta = new Map([['early_bird_test', { key: 'early_bird_test', value: { taken: FOUNDING.places } }]]);
    const res = await call('create-order', { kind: 'founding' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/closed/);
    expect((await call('create-order', { kind: 'monthly' })).status).toBe(200);
  });

  it('sells the early bird at ₹99 and counts the slot when paid', async () => {
    const body = await (await call('create-order', { kind: 'founding' })).json();
    expect(body.amount).toBe(9900);
    fake.rzp.payments.set('pay_e', { id: 'pay_e', status: 'captured', order_id: body.order_id, amount: 9900, currency: 'INR' });
    const res = await call('verify-payment', { razorpay_order_id: body.order_id, razorpay_payment_id: 'pay_e', razorpay_signature: sign(body.order_id, 'pay_e') });
    expect((await res.json()).billing).toMatchObject({ kind: 'founding', plan: 'pro' });
    expect(await foundingTaken()).toBe(1);
  });
});
