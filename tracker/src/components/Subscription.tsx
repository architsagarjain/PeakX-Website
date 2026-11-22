import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { useStore } from '../state/store';
import { cancelRenewal, requestRefund } from '../state/billing';
import { KIND_LABEL, refundCheck, statusLine } from '../domain/billing';
import { track } from '../state/telemetry';
import type { Billing } from '../domain/types';

const day = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** S23.2 · Subscription: plan, renewal, payments, cancel and the refund promise. */
export function SubscriptionCard({ payOn }: { payOn: boolean }) {
  const { data } = useStore();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'cancel' | 'refund' | null>(null);
  const b = data.billing;
  const now = Date.now();
  const refund = refundCheck(b, now);
  const sub = b ? statusLine(b, now) : data.plan === 'free' ? 'Free plan · upgrade any time' : payOn ? `${data.plan === 'coached' ? 'Coached' : 'Pro'} on this device only · sign in to see billing` : `${data.plan === 'coached' ? 'Coached' : 'Pro'} (test build)`;
  return (
    <div className="px-card" style={{ gap: '0' }}>
      {dialog ? <BillingDialog kind={dialog} billing={b!} onClose={() => setDialog(null)} /> : null}
      <div className="px-card-head">
        <span className="px-card-title">Subscription</span>
        {b && b.status !== 'refunded' && b.status !== 'ended' ? <span className={`px-status${b.status === 'active' ? ' good' : ' over'}`}>{b.status === 'active' ? 'Active' : b.status === 'cancelling' ? 'Not renewing' : 'Payment failed'}</span> : null}
      </div>
      <div className="px-list">
        <div className="px-row">
          <span className="px-row-icon"><Icon name="card" /></span>
          <span className="px-row-main">
            <span className="px-row-title">{b ? KIND_LABEL[b.kind] : data.plan === 'free' ? 'Free' : data.plan === 'coached' ? 'Coached' : 'Pro'}</span>
            <span className="px-row-sub">{sub}</span>
          </span>
          {(!b && data.plan === 'free') || (b && b.status !== 'active') ? <button className="px-pill sm" type="button" onClick={() => navigate('/app/upgrade')}>{b ? 'Subscribe again' : 'Upgrade'}</button> : null}
        </div>
        {b?.status === 'halted' ? (
          <div className="px-row"><span className="px-row-icon"><Icon name="bell" /></span><span className="px-row-main"><span className="px-row-title">Renewal didn’t go through</span><span className="px-row-sub">Razorpay retries for a few days and emails you a link to pay. Pro stays on meanwhile.</span></span></div>
        ) : null}
        {b?.payments.map((p) => (
          <div key={p.id} className="px-row">
            <span className="px-row-icon"><Icon name="doc" /></span>
            <span className="px-row-main"><span className="px-row-title">{rupees(p.amount)} · {KIND_LABEL[p.kind]}</span><span className="px-row-sub">{day(p.at)} · {p.id}</span></span>
            <span className="px-row-end"><span className={`px-status${p.status === 'paid' ? ' good' : ''}`}>{p.status === 'paid' ? 'Paid' : 'Refunded'}</span></span>
          </div>
        ))}
        {b?.manual ? <div className="px-row"><span className="px-row-icon"><Icon name="user" /></span><span className="px-row-main"><span className="px-row-title">Managed by your coach</span><span className="px-row-sub">Ask them to change or end it</span></span></div> : null}
      </div>
      {b && !b.manual && (b.status === 'active' || refund.ok) ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '10px' }}>
          {b.status === 'active' && b.subscriptionId ? <button className="px-pill sm" type="button" onClick={() => setDialog('cancel')}>Cancel renewal</button> : null}
          {refund.ok ? <button className="px-pill sm" type="button" onClick={() => setDialog('refund')}>Ask for a refund</button> : null}
        </div>
      ) : null}
    </div>
  );
}

function BillingDialog({ kind, billing, onClose }: { kind: 'cancel' | 'refund'; billing: Billing; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const check = refundCheck(billing, Date.now());
  const go = async () => {
    setBusy(true);
    try {
      const b = kind === 'cancel' ? await cancelRenewal() : await requestRefund(reason);
      dispatch({ type: 'setBilling', billing: b, nowMs: Date.now() });
      track(kind === 'cancel' ? 'renewal_cancelled' : 'refund_requested');
      toast(kind === 'cancel' ? `Renewal cancelled. Pro stays on until ${day(b.paidThrough)}.` : 'Refund on its way. It reaches your account in 5–7 working days.', 'good');
      onClose();
    } catch (e) { toast((e as Error).message || 'That didn’t work. Try again.'); setBusy(false); }
  };
  return (
    <div className="app-modal-scrim" onClick={onClose}>
      <form className="app-modal" role="dialog" aria-modal="true" aria-label={kind === 'cancel' ? 'Cancel renewal' : 'Ask for a refund'} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); go(); }}>
        <span className="px-card-title" style={{ fontSize: '24px', lineHeight: '28px' }}>{kind === 'cancel' ? 'Cancel renewal?' : 'Ask for a refund'}</span>
        {kind === 'cancel'
          ? <span className="px-body grey">You won’t be charged again. Pro stays on until {day(billing.paidThrough)}, then you’re back on Free with all your data.</span>
          : <>
              <span className="px-body grey">Our promise: a full refund if your first Pro report doesn’t give you one clear change. You get {check.ok ? rupees(check.amount) : ''} back and move to Free straight away; your data stays.</span>
              <label className="px-field"><span className="l">What didn’t work? (helps us improve)</span><span className="px-field-row"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} aria-label="Reason for refund" /></span></label>
            </>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="px-cta glass" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', padding: '0 20px' }} onClick={onClose}>Keep {kind === 'cancel' ? 'renewing' : 'Pro'}</button>
          <button type="submit" className="px-cta" disabled={busy} style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', padding: '0 22px', opacity: busy ? 0.5 : 1 }}>{busy ? 'Working…' : kind === 'cancel' ? 'Cancel renewal' : `Refund ${check.ok ? rupees(check.amount) : ''}`}</button>
        </div>
      </form>
    </div>
  );
}
