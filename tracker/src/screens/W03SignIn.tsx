import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { Field } from '../components/Wizard';
import { useStore } from '../state/store';
import { headline, isComplete } from '../domain/plateau';
import { isEmail } from '../domain/onboarding';
import { useAuth } from '../state/auth';

/**
 * W03 · Log in or create an account. Never a gate: everything works without an account.
 * Accounts run on Supabase (email + password, Google when switched on). The first sign-in of a new
 * account uploads this device's data, including the plateau result; an existing account loads its data.
 */
export default function W03SignIn() {
  const { data, dispatch } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const [params] = useSearchParams();
  const { answers, email } = data.plateau;
  const checked = isComplete(answers);
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [name, setName] = useState(data.profile.name || '');
  const [mail, setMail] = useState(email ?? '');
  const [pass, setPass] = useState('');
  const [errs, setErrs] = useState<{ mail?: string; pass?: string }>({});
  const [busy, setBusy] = useState(false);
  const back = params.get('next');
  const nextStop = back && /^\/(app\/[a-z0-9/-]*)?$/.test(back) ? back : '/';

  const submit = async () => {
    const e: typeof errs = {};
    if (!isEmail(mail)) e.mail = 'Enter an email like name@example.com';
    if (pass.length < 8) e.pass = 'At least 8 characters';
    setErrs(e);
    if (e.mail || e.pass) return;
    dispatch({ type: 'plateauEmail', email: mail });
    if (!auth.configured) { toast('Accounts aren’t switched on for this site yet. Your progress is saved in this browser.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') await auth.signUp(mail, pass, name);
      else await auth.signIn(mail, pass);
      navigate(mode === 'signup' && !data.onboarding.done ? '/app/start/goal' : nextStop);
    } catch { /* toast shown by auth */ } finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true);
    try { await auth.google(); } catch { /* toast shown by auth */ } finally { setBusy(false); }
  };

  const signup = mode === 'signup';
  return (
    <AppShell active="account" title={signup ? 'Create account' : 'Log in'} crumb={<>Optional · keeps your data on every device</>} cols="minmax(0, 1fr)">
      <div className="su-grid">
        <div className="su-hero">
          <div className="px-num su-head">
            {signup ? <>Save your progress,{' '}<span style={{ color: 'var(--text-3)' }}>on every device.</span></> : <>Welcome back.{' '}<span style={{ color: 'var(--text-3)' }}>Pick up where you left off.</span></>}
          </div>
          <div className="px-card" style={{ gap: '0', maxWidth: '460px', marginTop: '10px' }}>
            <div className="px-row">
              <span className="px-row-icon"><Icon name="target" /></span>
              {checked ? (
                <span className="px-row-main">
                  <span className="px-row-title">Your plateau check is saved</span>
                  <span className="px-row-sub">Likely cause: {headline(answers).toLowerCase()}</span>
                </span>
              ) : (
                <span className="px-row-main">
                  <span className="px-row-title">No plateau check yet</span>
                  <span className="px-row-sub"><Link to="/app/plateau-check">Take it in 2 minutes</Link> and it’s saved here too</span>
                </span>
              )}
            </div>
            <div className="px-row">
              <span className="px-row-icon"><Icon name="shield" /></span>
              <span className="px-row-main"><span className="px-row-title">Your data stays yours</span><span className="px-row-sub">Health data is never sold or shared</span></span>
            </div>
            <div className="px-row">
              <span className="px-row-icon"><Icon name="globe" /></span>
              <span className="px-row-main"><span className="px-row-title">Any browser, any device</span><span className="px-row-sub">Phone at the gym, laptop for planning</span></span>
            </div>
          </div>
        </div>
        <form className="px-card su-form" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          {auth.user ? (
            <>
              <div className="px-num" style={{ fontSize: '40px', lineHeight: '44px' }}>You’re signed in</div>
              <span className="px-body grey" style={{ overflowWrap: 'anywhere' }}>{auth.user.email ?? 'Your account'} · your progress saves to your account automatically.</span>
              <Link to={nextStop} className="px-cta" style={{ flex: '0 0 auto', width: '100%', textDecoration: 'none' }}>Continue</Link>
              <Link to="/app/account" className="px-meta" style={{ color: 'var(--text)' }}>Account and sync</Link>
            </>
          ) : (
            <>
              <div className="su-switch" role="tablist" aria-label="Account">
                <button type="button" role="tab" aria-selected={!signup} className={!signup ? 'on' : undefined} onClick={() => setMode('login')}>Log in</button>
                <button type="button" role="tab" aria-selected={signup} className={signup ? 'on' : undefined} onClick={() => setMode('signup')}>Create account</button>
              </div>
              <div>
                <div className="px-num" style={{ fontSize: '40px', lineHeight: '44px' }}>{signup ? 'Create your account' : 'Log in to PeakX'}</div>
                <div className="px-body grey" style={{ marginTop: '4px' }}>{signup ? 'Takes 20 seconds. No email to confirm.' : 'Use the email and password you signed up with.'}</div>
              </div>
              {auth.googleOn ? <>
                <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', width: '100%' }} disabled={busy} onClick={google}>Continue with Google</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ flexGrow: 1, height: '1px', background: 'var(--line)' }} />
                  <span className="px-meta">or</span>
                  <span style={{ flexGrow: 1, height: '1px', background: 'var(--line)' }} />
                </div>
              </> : null}
              {signup ? (
                <Field label="First name (optional)">
                  <input type="text" autoComplete="given-name" placeholder="Arjun" value={name} onChange={(e) => setName(e.target.value)} aria-label="First name" />
                </Field>
              ) : null}
              <Field label="Email" error={errs.mail}>
                <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={mail} onChange={(e) => setMail(e.target.value)} aria-label="Email" />
              </Field>
              <Field label="Password" error={errs.pass}>
                <input type="password" autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? 'At least 8 characters' : 'Your password'} value={pass} onChange={(e) => setPass(e.target.value)} aria-label="Password" />
              </Field>
              <button className="px-cta" type="submit" disabled={busy} style={{ flex: '0 0 auto', width: '100%' }}>{busy ? 'One moment…' : signup ? 'Create account' : 'Log in'}</button>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" className="su-link" onClick={() => setMode(signup ? 'login' : 'signup')}>{signup ? 'Have an account? Log in' : 'New here? Create an account'}</button>
                <Link to={nextStop} className="px-meta" style={{ color: 'var(--text)' }}>Continue without an account</Link>
              </div>
              <span className="px-meta">{!auth.configured ? 'Accounts switch on soon; your data stays here meanwhile.' : data.demo ? 'You start with a fresh account; the demo stays behind.' : signup ? 'What you’ve logged on this device moves to your new account.' : 'Your saved account data replaces what’s on this device.'}</span>
              <span className="px-meta" style={{ color: 'var(--text-2)' }}>By continuing you agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>. We use essential cookies and anonymous usage analytics.</span>
            </>
          )}
        </form>
      </div>
    </AppShell>
  );
}
