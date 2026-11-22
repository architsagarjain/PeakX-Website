import { RECIPES } from '../domain/seed';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { track } from '../state/telemetry';
import { Segmented } from '../components/ui';
import { AppShell } from '../components/Shell';
import { useStore } from '../state/store';
import { usePayStatus } from '../state/billing';
import { useCheckout, useCoachRequest } from '../components/Checkout';
import { COACHED, FOUNDING, PRO, inr, placesLeft, placesLine } from '../data/founding';
import type { BillingKind } from '../domain/types';

const OPTIONS: [string, BillingKind][] = [['Early bird', 'founding'], ['Monthly', 'monthly'], ['Yearly', 'yearly']];

/** W21 · Pricing (S23.1): early bird offer, monthly and yearly Pro through Razorpay; Coached on request. */
export default function W21Pricing() {
  const navigate = useNavigate();
  const { data } = useStore();
  const pay = usePayStatus();
  const { buy, busy } = useCheckout();
  const coach = useCoachRequest();
  const full = placesLeft() === 0;
  const [pick, setPick] = useState<BillingKind>(full ? 'monthly' : 'founding');
  useEffect(() => { track('upgrade_viewed'); }, []);
  useEffect(() => { if (full && pick === 'founding') setPick('monthly'); }, [full, pick]);

  const paid = data.plan !== 'free';
  // Without a Razorpay plan a kind is a one-time payment for one period (no auto-renewal), so say that.
  const renews = !pay?.configured || pay.recurring.includes(pick);
  const hero = pick === 'founding' ? { price: inr(FOUNDING.price), sfx: 'for your first month', meta: `${FOUNDING.discount}% off ${inr(PRO.monthly)} · ${placesLine()} · ${renews ? `then ${inr(PRO.monthly)} a month` : 'one payment, no auto-renewal'}` }
    : pick === 'monthly' ? { price: inr(PRO.monthly), sfx: 'a month', meta: renews ? 'Cancel any time in Account · renews monthly' : 'One payment for a month of Pro · no auto-renewal' }
      : { price: inr(PRO.yearly), sfx: 'a year', meta: `${inr(PRO.monthly * 12 - PRO.yearly)} less than 12 months · ${renews ? 'renews yearly' : 'one payment, no auto-renewal'}` };
  const cta = paid ? (data.plan === 'coached' ? 'You’re on Coached · manage' : 'You’re on Pro · manage') : pick === 'founding' ? (full ? 'Early bird closed' : `Get the early bird · ${inr(FOUNDING.price)}`) : pick === 'monthly' ? `Start Pro · ${inr(PRO.monthly)}/month` : `Start Pro · ${inr(PRO.yearly)}/year`;
  const coachedBuyable = !!COACHED.monthly && !!pay?.kinds.includes('coached');

  return (
    <AppShell active="upgrade" title="Upgrade" crumb={<>{full ? `Pro from ${inr(PRO.monthly)} a month` : `${FOUNDING.name}: ${placesLine().toLowerCase()}`}</>} cols="minmax(0, 1fr)">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
        <div className="wb-hero" style={{ alignItems: 'center', textAlign: 'center' }}>
          <span className="px-hero-label">{pick === 'founding' ? `${FOUNDING.name} · ${FOUNDING.discount}% off` : 'PeakX Pro'}</span>
          <div className="fig">
            <span className="px-num xl">{hero.price}</span>
            <span className="px-suffix">{hero.sfx}</span>
          </div>
          <span className="px-meta" style={{ marginTop: '6px' }}>{hero.meta}</span>
        </div>
        <Segmented label="Billing" items={OPTIONS.filter(([, k]) => !(full && k === 'founding')).map(([l]) => l)} value={OPTIONS.find(([, k]) => k === pick)![0]} onChange={(l) => setPick(OPTIONS.find(([x]) => x === l)![1])} style={{ width: '320px', maxWidth: '100%', marginTop: '12px' }} />
      </div>
      <div className="px-plans">
        <div className="px-card wb-plan">
          <div className="px-card-head">
            <span className="px-card-title" style={{ fontSize: '24px', lineHeight: '28px' }}>Free</span>
            {data.plan === 'free' ? <span className="px-status">Your plan now</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}><span className="px-num lg">₹0</span></div>
          <span className="wb-ft">Plateau check and starting plan</span>
          <span className="wb-ft">Voice meal logging, calories per meal</span>
          <span className="wb-ft">Recipe library: {RECIPES.length} high-protein Indian recipes</span>
          <span className="wb-ft">Fitbit and Strava sync, basic charts</span>
          <span className="wb-ft">Your first weekly report</span>
          <span className="wb-ft no">Plan stays fixed as you progress</span>
          <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', marginTop: '8px' }} onClick={() => navigate('/')}>{data.plan === 'free' ? 'Stay on Free' : 'Back to the app'}</button>
        </div>
        <div className="px-card wb-plan on">
          <div className="px-card-head">
            <span className="px-card-title" style={{ fontSize: '24px', lineHeight: '28px' }}>Pro</span>
            {pick === 'founding' && !full ? <span className="px-pro" style={{ background: 'var(--lime-glow)', color: 'var(--text)' }}>{placesLeft()} SLOTS LEFT</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span className="px-num lg">{hero.price}</span>
            <span className="px-suffix">{pick === 'founding' ? <>first month <s style={{ color: 'var(--text-3)' }}>{inr(PRO.monthly)}</s></> : pick === 'monthly' ? '/month' : '/year'}</span>
          </div>
          <span className="wb-ft">Everything in Free</span>
          <span className="wb-ft">Weekly report with one-click changes</span>
          <span className="wb-ft">Detailed analytics: food, training, sleep</span>
          <span className="wb-ft">Recipes fitted to your targets, meal plan, grocery list</span>
          <span className="wb-ft">Form Check reviewed by a coach</span>
          <span className="wb-ft">Blood work, AI Coach, mess mode, sport programs</span>
          <button className={`px-cta${paid ? ' glass' : pick === 'founding' ? ' orange' : ''}`} type="button" style={{ flex: '0 0 auto', marginTop: '8px' }} aria-disabled={!paid && ((pick === 'founding' && full) || !!busy)}
            onClick={() => { if (paid) navigate('/app/account'); else if (!(pick === 'founding' && full) && !busy) buy(pick); }}>{busy === pick ? 'Opening Razorpay…' : cta}</button>
        </div>
        <div className="px-card wb-plan">
          <div className="px-card-head">
            <span className="px-card-title" style={{ fontSize: '24px', lineHeight: '28px' }}>Coached</span>
            <span className="px-status">Human coach</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            {COACHED.monthly ? <><span className="px-num lg">{inr(COACHED.monthly)}</span><span className="px-suffix">/month</span></> : <span className="px-num lg" style={{ fontSize: '36px' }}>On request</span>}
          </div>
          <span className="wb-ft">Everything in Pro</span>
          <span className="wb-ft">A named coach on WhatsApp</span>
          <span className="wb-ft">A weekly call</span>
          <span className="wb-ft">Your coach writes your weekly report</span>
          <span className="wb-ft">Coach signs off every plan change</span>
          <span className="wb-ft no">Limited slots per coach</span>
          <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', marginTop: '8px' }} aria-disabled={coach.busy || busy === 'coached'}
            onClick={() => { if (data.plan === 'coached') navigate('/app/coach'); else if (coachedBuyable) buy('coached'); else coach.ask(); }}>
            {data.plan === 'coached' ? 'Message your coach' : coachedBuyable ? (busy === 'coached' ? 'Opening Razorpay…' : 'Start Coached') : data.coachRequest ? 'Request sent' : 'Request a coach'}
          </button>
        </div>
      </div>
      <span className="px-meta" style={{ textAlign: 'center', marginTop: '22px', color: 'var(--text-2)', fontSize: '12px' }}>
        Full refund if your first Pro report doesn’t give you one clear change · UPI or card via Razorpay{pay?.recurring.length ? ' · cancel any time in Account' : ''}
      </span>
      <span className="px-meta" style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px' }}><Link to="/terms" style={{ color: 'inherit' }}>Terms</Link> · <Link to="/refunds" style={{ color: 'inherit' }}>Refunds and cancellation</Link> · <Link to="/privacy" style={{ color: 'inherit' }}>Privacy</Link></span>
    </AppShell>
  );
}
