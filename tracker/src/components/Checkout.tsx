import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast';
import { useAuth } from '../state/auth';
import { useStore } from '../state/store';
import { checkout, CheckoutClosed, payStatus } from '../state/billing';
import { addQueueItem } from '../state/cloud';
import { newQueueItem } from '../domain/queue';
import { KIND_LABEL } from '../domain/billing';
import { track } from '../state/telemetry';
import type { BillingKind } from '../domain/types';

/** Buying a plan from any screen (S23.1): checks payments and sign-in, opens Checkout, applies the result. */
export function useCheckout() {
  const auth = useAuth();
  const { dispatch } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<BillingKind | null>(null);

  const buy = async (kind: BillingKind) => {
    track('upgrade_clicked', { plan: kind });
    const pay = await payStatus();
    if (!pay.configured) { toast('Payments aren’t switched on for this site yet.'); return; }
    if (!pay.kinds.includes(kind)) { toast(`${KIND_LABEL[kind]} isn’t on sale yet.`); return; }
    if (!auth.user) { toast('Sign in first, so your plan works on every device.'); navigate('/app/sign-up?next=/app/upgrade'); return; }
    setBusy(kind);
    try {
      const billing = await checkout(kind, { email: auth.user.email, name: auth.user.name });
      dispatch({ type: 'setBilling', billing, nowMs: Date.now() });
      toast(kind === 'coached' ? 'Welcome to Coached. Your coach will message you within a day.' : 'Pro is unlocked. Welcome in.', 'good');
      navigate('/');
    } catch (e) {
      if (!(e instanceof CheckoutClosed)) toast((e as Error).message || 'Payment didn’t go through');
    } finally { setBusy(null); }
  };
  return { buy, busy };
}

/** Ask for a human coach (S20.2): goes to the coach queue; a coach assigns themselves. */
export function useCoachRequest() {
  const auth = useAuth();
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const ask = async (message = '') => {
    if (data.coachRequest) { toast(data.coachRequest.status === 'assigned' ? 'You already have a coach.' : 'Request sent. A coach will message you within a day.'); return; }
    if (!auth.configured) { toast('Coach requests need accounts, which aren’t switched on for this site yet.'); return; }
    if (!auth.user) { toast('Sign in first so a coach can reach you.'); navigate('/app/sign-up?next=/app/upgrade'); return; }
    setBusy(true);
    try {
      const at = new Date().toISOString();
      await addQueueItem(newQueueItem('lead', { id: newId('lead'), uid: auth.user.uid, member: { name: data.profile.name, plan: data.plan }, title: data.profile.name || 'New member', detail: `${data.profile.city || 'City not set'} · goal: ${data.profile.goal}${data.profile.stuckLift ? ` · stuck on ${data.profile.stuckLift}` : ''}`, payload: { message: message.trim().slice(0, 500) }, nowMs: Date.now() }));
      dispatch({ type: 'requestCoach', at });
      track('coach_requested');
      toast('Request sent. A coach will message you within a day.', 'good');
    } catch { toast('Couldn’t send the request. Check your connection.'); }
    finally { setBusy(false); }
  };
  return { ask, busy };
}
