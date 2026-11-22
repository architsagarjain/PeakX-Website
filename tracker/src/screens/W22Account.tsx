import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, SYNC_LABEL } from '../state/auth';
import { track } from '../state/telemetry';
import { weightTrend } from '../state/selectors';
import { addDays, today } from '../domain/clock';
import { useSoon } from '../components/Toast';
import { Icon, Wordmark, Avatar } from '../components/Icon';
import { Tabs, Segmented, ChoiceGroup, Toggle } from '../components/ui';
import { AppShell } from '../components/Shell';
import { SubscriptionCard } from '../components/Subscription';
import { RemindersCard } from '../components/Reminders';
import { usePayStatus } from '../state/billing';
import { useIsCoach } from '../state/ops';
import { useStore } from '../state/store';
import { useToast } from '../components/Toast';
import type { Plan } from '../domain/types';
import { DIET_LABEL, GOAL_LABEL, WEEKDAYS, clock12 } from '../domain/onboarding';
import { fmt } from '../domain/nutrition';

/** W22 · Account */
export default function W22Account() {
  const navigate = useNavigate();
  const go = (to: string) => navigate(to);
  const soon = useSoon();
  const { data, dispatch, reset, loadDemo } = useStore();
  const toast = useToast();
  const PLANS: [Plan, string][] = [['free', 'Free'], ['pro', 'Pro'], ['coached', 'Coached']];
  const auth = useAuth();
  const pay = usePayStatus();
  const isCoach = useIsCoach();
  const [deleting, setDeleting] = useState(false);
  const trend = weightTrend(data, today());
  const streak = logStreak(data);
  const exportData = async () => {
    const { exportZip } = await import('../domain/export');
    const bytes = exportZip(data);
    const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url; a.download = `peakx-export-${today()}.zip`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    track('data_exported');
    toast('Export downloaded: food, workouts, weight and wearable CSVs', 'good');
  };
  return (
    <>
    {deleting ? <DeleteDialog onClose={() => setDeleting(false)} /> : null}
    <AppShell active="account" title="Account" crumb={<>Profile and settings</>} cols="repeat(12, minmax(0, 1fr))">
      <div className="wb-col" style={{gridColumn: "span 4"}}>
        <div className="px-card" style={{alignItems: "center", gap: "6px", padding: "26px 18px"}}>
          <Avatar name={data.profile.name} demo={data.demo} style={{width: "84px", height: "84px"}} />
          <div style={{display: "flex", alignItems: "center", gap: "8px", marginTop: "6px"}}>
            <span style={{font: "700 34px/38px var(--font-display)", color: "var(--text)"}}>{data.profile.name || "Your profile"}</span>
            {data.plan === 'free' ? <span className="px-status">Free plan</span> : <span className="px-pro">{data.plan === 'coached' ? 'COACHED' : 'PRO'}</span>}
          </div>
          <span className="px-meta">{data.onboarding.done ? [data.profile.age || null, data.profile.city || null].filter(Boolean).join(" · ") || "Plan set up" : "Plan not set up yet"}</span>
          <span className="px-meta" style={{ textAlign: "center", overflowWrap: "anywhere" }}>{auth.user ? `${auth.user.email ?? "Signed in"} · ${auth.user.provider === "google" ? "signed in with Google" : "signed in with email"}` : "Not signed in · saved on this device"}</span>
          <div style={{display: "flex", width: "100%", marginTop: "14px", paddingTop: "14px", borderTop: "1px solid var(--line)"}}>
            <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "0", flex: "1 1 0"}}>
              <div style={{display: "flex", alignItems: "baseline"}}>
                <span style={{font: "700 28px/32px var(--font-display)", color: "var(--text)"}}>{trend.avg ?? trend.latest?.kg ?? "–"}</span>
                <span className="px-meta" style={{marginLeft: "3px"}}>kg</span>
              </div>
              <span className="px-meta">7-day avg</span>
            </div>
            <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "0", flex: "1 1 0"}}>
              <div style={{display: "flex", alignItems: "baseline"}}>
                <span style={{font: "700 28px/32px var(--font-display)", color: "var(--text)"}}>{trend.change > 0 ? "+" : trend.change < 0 ? "−" : ""}{Math.abs(trend.change)}</span>
                <span className="px-meta" style={{marginLeft: "3px"}}>kg</span>
              </div>
              <span className="px-meta">since the 1st</span>
            </div>
            <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: "0", flex: "1 1 0"}}>
              <div style={{display: "flex", alignItems: "baseline"}}>
                <span style={{font: "700 28px/32px var(--font-display)", color: "var(--text)"}}>{streak}</span>
                <span className="px-meta" style={{marginLeft: "3px"}}>days</span>
              </div>
              <span className="px-meta">logging streak</span>
            </div>
          </div>
        </div>
        <div className="px-card" style={{flexDirection: "row", alignItems: "center", gap: "12px", padding: "14px 18px"}}>
          <span className="px-row-icon"><Icon name="phone" /></span>
          <span className="px-row-main">
            <span className="px-row-title">Add to home screen</span>
            <span className="px-row-sub">Opens full screen, works offline</span>
          </span>
          <button className="px-pill sm" type="button" onClick={() => toast("Chrome: menu › Add to home screen. Safari: Share › Add to Home Screen.")}>How</button>
        </div>
        <div className="px-card" style={{flexDirection: "row", alignItems: "center", gap: "12px", padding: "14px 18px"}}>
          <span className="px-row-icon"><Icon name="leaf" /></span>
          <span className="px-row-main">
            <span className="px-row-title">Saved recipes</span>
            <span className="px-row-sub">{data.savedRecipes.length} saved</span>
          </span>
          <button className="px-pill sm" type="button" onClick={() => go("/app/plan/recipes")}>Open</button>
        </div>
      </div>
      <div className="wb-col" style={{gridColumn: "span 4"}}>
        <div className="px-card" style={{gap: "0"}}>
          <div className="px-card-head">
            <span className="px-card-title">Goal &amp; plan</span>
            <div style={{display: "flex", gap: "6px", alignItems: "center"}}>
              <button className="px-icon sm" type="button" aria-label="Edit" onClick={() => go("/app/start/goal")}><Icon name="edit" /></button>
              <button className="px-pill sm" type="button" onClick={() => go("/app/start/plan")}>View all</button>
            </div>
          </div>
          <div className="px-list">
            <div className="px-row">
              <span className="px-row-icon"><Icon name="target" /></span>
              <span className="px-row-main">
                <span className="px-row-title">Goal</span>
                <span className="px-row-sub">{GOAL_LABEL[data.profile.goal]}{data.profile.stuckLift ? ` · ${data.profile.stuckLift.toLowerCase()}` : ""}</span>
              </span>
              <span className="px-row-end"><span className="px-row-value">›</span></span>
            </div>
            <div className="px-row">
              <span className="px-row-icon"><Icon name="list" /></span>
              <span className="px-row-main">
                <span className="px-row-title">Plan</span>
                <span className="px-row-sub">{fmt(data.targets.kcalTraining)} training · {fmt(data.targets.kcalRest)} rest · P {data.targets.protein} g</span>
              </span>
              <span className="px-row-end"><span className="px-row-value">›</span></span>
            </div>
            <div className="px-row">
              <span className="px-row-icon"><Icon name="bowl" /></span>
              <span className="px-row-main">
                <span className="px-row-title">Diet &amp; routine</span>
                <span className="px-row-sub">{DIET_LABEL[data.profile.diet]}{data.profile.vegDays?.length && data.profile.diet !== 'veg' && data.profile.diet !== 'vegan' ? ` (veg on ${data.profile.vegDays.map((i) => WEEKDAYS[i]).join(', ')})` : ''} · {data.profile.mealSources.join(" + ").toLowerCase()} · {data.profile.trainingStyle === 'run' ? 'runs' : data.profile.trainingStyle === 'both' ? 'gym and runs' : 'gym'} {clock12(data.profile.gymTime)}</span>
              </span>
              <span className="px-row-end"><span className="px-row-value">›</span></span>
            </div>
          </div>
        </div>
        <div className="px-card" style={{gap: "0"}}>
          <div className="px-card-head">
            <span className="px-card-title">Devices</span>
            <button className="px-pill sm" type="button" onClick={() => go("/app/devices")}>Manage</button>
          </div>
          <div className="px-list">
            {([['google', 'pulse', 'Fitbit · via Google', 'Steps, sleep, heart rate, workouts'], ['strava', 'path', 'Strava', 'Runs, rides and sport sessions']] as const).map(([k, icon, t, sub]) => (
              <div key={k} className="px-row">
                <span className="px-row-icon"><Icon name={icon} /></span>
                <span className="px-row-main"><span className="px-row-title">{t}</span><span className="px-row-sub">{sub}</span></span>
                <span className="px-row-end">{data.devices[k] ? <span className="px-status good">Connected</span> : <span className="px-status">Not connected</span>}</span>
              </div>
            ))}
            <div className="px-row">
              <span className="px-row-icon"><Icon name="mic" /></span>
              <span className="px-row-main"><span className="px-row-title">Voice logging</span><span className="px-row-sub">{data.profile.voiceLanguages.join(' + ') || 'English'}</span></span>
            </div>
          </div>
        </div>
        <RemindersCard />
      </div>
      <div className="wb-col" style={{gridColumn: "span 4"}}>
        <SubscriptionCard payOn={!!pay?.configured} />
        <div className="px-card" style={{gap: "0"}}>
          <div className="px-card-head"><span className="px-card-title">Coaching</span></div>
          <div className="px-list">
            <button type="button" className="px-row px-row-btn" onClick={() => go(data.plan === "coached" ? "/app/coach" : "/app/upgrade")}>
              <span className="px-row-icon"><Icon name="user" /></span>
              <span className="px-row-main">
                <span className="px-row-title">{data.billing?.coach ? `Your coach: ${data.billing.coach.name}` : "Get a human coach"}</span>
                <span className="px-row-sub">{data.billing?.coach ? "WhatsApp and your weekly call are on the Coach page" : data.coachRequest ? "Request sent · a coach will message you" : "Coached: a named coach, weekly call and WhatsApp"}</span>
              </span>
              <span className="px-row-end"><span className="px-row-value">›</span></span>
            </button>
            {isCoach ? (
              <button type="button" className="px-row px-row-btn" onClick={() => go("/app/coach-desk")}>
                <span className="px-row-icon"><Icon name="list" /></span>
                <span className="px-row-main"><span className="px-row-title">Coach desk</span><span className="px-row-sub">Form Checks, lab checks, report drafts and requests</span></span>
                <span className="px-row-end"><span className="px-row-value">›</span></span>
              </button>
            ) : null}
          </div>
        </div>
        <div className="px-card" style={{gap: "0"}}>
          <div className="px-card-head">
            <span className="px-card-title">Your data</span>
            <div style={{display: "flex", gap: "6px", alignItems: "center"}} />
          </div>
          <div className="px-list">
            <div className="px-row">
              <span className="px-row-icon"><Icon name={auth.user ? "globe" : "phone"} /></span>
              <span className="px-row-main">
                <span className="px-row-title">{auth.user ? "Saved to your account" : "Saved on this device only"}</span>
                <span className="px-row-sub">{auth.user ? SYNC_LABEL[auth.sync] : auth.configured ? "Sign in to keep it on every device" : "Accounts aren’t switched on for this site yet"}</span>
              </span>
              {auth.user ? <span className={`px-status${auth.sync === "saved" ? " good" : auth.sync === "error" || auth.sync === "offline" ? " over" : ""}`}>{auth.sync === "saved" ? "Synced" : auth.sync === "syncing" || auth.sync === "loading" ? "Saving" : auth.sync === "offline" ? "Offline" : auth.sync === "error" ? "Retrying" : ""}</span>
                : <button className="px-pill sm" type="button" onClick={() => go("/app/sign-up?mode=signup")}>Save progress</button>}
            </div>
            <button type="button" className="px-row px-row-btn" onClick={exportData}>
              <span className="px-row-icon"><Icon name="download" /></span>
              <span className="px-row-main">
                <span className="px-row-title">Export my data</span>
                <span className="px-row-sub">Food, workouts, weight and wearable data as CSV (zip)</span>
              </span>
              <span className="px-row-end"><span className="px-row-value">›</span></span>
            </button>
            <div className="px-row">
              <span className="px-row-icon"><Icon name="shield" /></span>
              <span className="px-row-main">
                <span className="px-row-title">Privacy and cookies</span>
                <span className="px-row-sub">Health data is never sold or shared · essential cookies only</span>
              </span>
              <button className="px-pill sm" type="button" onClick={() => go("/privacy")}>Read</button>
            </div>
            <button type="button" className="px-row px-row-btn" onClick={() => setDeleting(true)}>
              <span className="px-row-icon"><Icon name="close" /></span>
              <span className="px-row-main">
                <span className="px-row-title">Delete account</span>
                <span className="px-row-sub">{auth.user ? "Deletes your account and all its data now" : "Clears all data saved on this device"}</span>
              </span>
              <span className="px-row-end"><span className="px-row-value">›</span></span>
            </button>
          </div>
        </div>
        <div style={{display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "12px"}}>
          {pay && !pay.configured ? <div className="px-card" style={{gap: "10px"}}>
            <div className="px-card-head"><span className="px-card-title">Test this build</span><span className="px-meta">Payments aren’t switched on</span></div>
            <div className="px-seg" role="radiogroup" aria-label="Plan">
              {PLANS.map(([k, label]) => (
                <span key={k} role="radio" tabIndex={0} aria-checked={data.plan === k} className={data.plan === k ? 'on' : undefined}
                  onClick={() => { dispatch({ type: 'setPlan', plan: k }); toast(`Now viewing as a ${label} member`, 'good'); }}>{label}</span>
              ))}
            </div>
            <span className="px-meta">Free shows every Pro page locked; Pro unlocks them. Data stays on this device.</span>
            <div style={{display: "flex", gap: "8px", flexWrap: "wrap"}}>
              <button className="px-pill" type="button" onClick={() => { loadDemo(); toast('Demo account loaded', 'good'); }}>Load demo account</button>
              <button className="px-pill" type="button" onClick={() => { reset(); toast('Fresh account on this device', 'good'); }}>Start fresh</button>
            </div>
          </div> : null}
          {auth.user ? <button className="px-cta glass" type="button" style={{flex: "0 0 auto", height: "46px", fontSize: "17px", padding: "0 28px"}} onClick={() => { auth.signOut().then(() => track("sign_out")).catch(() => toast("Couldn’t sign out. Check your connection.")); }}>Sign out</button> : null}
        </div>
      </div>
    </AppShell>
    </>
  );
}

/** Days in a row, ending today or yesterday, with at least one meal logged. */
function logStreak(d: { meals: { date: string }[] }): number {
  const days = new Set(d.meals.map((m) => m.date));
  let day = today();
  if (!days.has(day)) day = addDays(day, -1);
  let n = 0;
  while (days.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

/** S8.2 · Delete account: type DELETE to confirm. Signed in: deletes the account and all cloud data; always clears this device. */
function DeleteDialog({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reauth, setReauth] = useState(false);
  const confirm = async () => {
    if (text.trim().toUpperCase() !== 'DELETE') return;
    setBusy(true);
    try {
      const r = await auth.deleteAccount();
      if (r === 'reauth') { setReauth(true); setBusy(false); return; }
      toast(auth.user ? 'Account and data deleted' : 'All data on this device cleared', 'good');
      onClose(); navigate('/');
    } catch { toast('Couldn’t delete right now. Check your connection and try again.'); setBusy(false); }
  };
  return (
    <div className="app-modal-scrim" onClick={onClose}>
      <form className="app-modal" role="dialog" aria-modal="true" aria-label="Delete account" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); confirm(); }}>
        <span className="px-card-title" style={{ fontSize: '24px', lineHeight: '28px' }}>Delete {auth.user ? 'your account' : 'your data'}?</span>
        {reauth ? (
          <span className="px-body">Your saved data is deleted. For your security, sign in once more to remove the sign-in itself, then delete again.</span>
        ) : (
          <span className="px-body grey">{auth.user
            ? 'This deletes your PeakX account, every meal, workout, weigh-in and wearable day saved to it, and the copy on this device. It can’t be undone. Export first if you want a copy.'
            : 'This clears every meal, workout, weigh-in and setting saved in this browser. It can’t be undone.'}</span>
        )}
        {reauth ? null : (
          <label className="px-field"><span className="l">Type DELETE to confirm</span><span className="px-field-row"><input value={text} onChange={(e) => setText(e.target.value)} aria-label="Type DELETE to confirm" autoComplete="off" /></span></label>
        )}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="px-cta glass" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', padding: '0 20px' }} onClick={onClose}>{reauth ? 'Close' : 'Cancel'}</button>
          {reauth ? <button type="button" className="px-cta" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', padding: '0 20px' }} onClick={() => { onClose(); navigate('/app/sign-up'); }}>Sign in again</button>
            : <button type="submit" className="px-cta" disabled={busy || text.trim().toUpperCase() !== 'DELETE'} style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', padding: '0 24px', background: 'var(--danger)', opacity: text.trim().toUpperCase() === 'DELETE' && !busy ? 1 : 0.4 }}>{busy ? 'Deleting…' : 'Delete'}</button>}
        </div>
      </form>
    </div>
  );
}
