import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { ChoiceGroup } from '../components/ui';
import { AppShell } from '../components/Shell';
import { Field, Progress, StepRail, WizardNav } from '../components/Wizard';
import { useStore } from '../state/store';
import { PLATEAU_QUESTIONS, answeredCount, headline, isComplete, rankCauses, shareResultLink } from '../domain/plateau';
import { longDate, today } from '../domain/clock';
import { isEmail } from '../domain/onboarding';
import { track } from '../state/telemetry';

const N = PLATEAU_QUESTIONS.length;

/** W02 · Plateau check · Free. 8 questions, causes ranked live, result with top 3. No sign-up. */
export default function W02PlateauCheck() {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const { answers, step } = data.plateau;
  const done = step >= N && isComplete(answers);
  const qi = Math.min(step, N - 1);
  const q = PLATEAU_QUESTIONS[qi];
  const picked = q.options.findIndex((o) => o.id === answers[q.id]);
  const ranked = rankCauses(answers);
  // Furthest step the rail lets you jump to: every answered question plus the next one.
  const reached = done ? N : Math.min(N - 1, Math.max(step, answeredCount(answers)));

  const go = (s: number) => dispatch({ type: 'plateauGo', step: s });
  const next = () => {
    if (picked < 0) { toast('Pick an answer to continue.'); return; }
    if (qi < N - 1) go(qi + 1);
    else dispatch({ type: 'plateauComplete', date: today() });
  };
  const pick = (i: number) => { if (answeredCount(answers) === 0) track('plateau_check_started'); dispatch({ type: 'plateauAnswer', question: q.id, option: q.options[i].id }); };

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [role="dialog"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter' && !t.closest('button, a')) { e.preventDefault(); next(); }
      const k = Number(e.key);
      if (k >= 1 && k <= q.options.length) pick(k - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const rail = (
    <StepRail tag={done ? 'Your result' : `Question ${qi + 1} of ${N}`} steps={[...PLATEAU_QUESTIONS.map((x) => x.nav), 'Your result']}
      current={done ? N : qi} reached={reached} onJump={go}
      done={[...PLATEAU_QUESTIONS.map((x) => x.options.some((o) => o.id === answers[x.id])), done]}
      note={done ? 'Saved on this device. Change any answer and the result updates.' : 'No sign-up needed. Takes about 2 minutes.'} />
  );

  return (
    <AppShell active="check" title="Plateau check" crumb={done ? <>Your result · {data.plateau.completedOn ? longDate(data.plateau.completedOn) : 'today'}</> : <>Question {qi + 1} of {N} · no sign-up needed</>} cols="minmax(0, 1fr)">
      <div className="px-wizard">
        {rail}
        {done ? <Result /> : (
          <>
            <section className="px-card" style={{ gap: '16px', padding: '30px' }} aria-labelledby="pq">
              <Progress value={(qi + (picked >= 0 ? 1 : 0)) / N} label="Plateau check progress" />
              <div>
                <h2 id="pq" className="px-q">{q.title}</h2>
                <p className="px-body grey" style={{ margin: '6px 0 0' }}>{q.help}</p>
              </div>
              <ChoiceGroup key={q.id} label={q.title} className="px-choices" options={q.options.map((o) => ({ t: o.t, m: o.m }))} value={picked} onChange={pick} />
              <WizardNav onBack={qi > 0 ? () => go(qi - 1) : undefined} onNext={next} nextDisabled={picked < 0} nextLabel={qi === N - 1 ? 'See my result' : 'Next question'} />
              <span className="px-meta">Tip: press 1–4 to pick, Enter for next.</span>
            </section>
            <aside className="px-card" style={{ gap: '2px', padding: '18px' }} aria-live="polite">
              <span className="px-card-title">Likely causes so far</span>
              <span className="px-meta" style={{ marginBottom: '6px' }}>Updates as you answer</span>
              <CauseList ranked={ranked.slice(0, 3)} empty="Answer a question to see your first likely cause." />
              <span className="px-meta" style={{ marginTop: '10px' }}>Your result comes with a free starting plan. Email it to yourself if you like.</span>
            </aside>
          </>
        )}
      </div>
    </AppShell>
  );
}

function CauseList({ ranked, empty, fixes }: { ranked: ReturnType<typeof rankCauses>; empty: string; fixes?: boolean }) {
  if (ranked.length === 0) return <span className="px-body grey" style={{ padding: '12px 0' }}>{empty}</span>;
  return (
    <ol className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {ranked.map((c, i) => (
        <li key={c.id} className="px-row" style={fixes ? { alignItems: 'flex-start', paddingTop: '14px', paddingBottom: '14px' } : undefined}>
          <span className="px-row-icon"><span className="n">{i + 1}</span></span>
          <span className="px-row-main">
            <span className="px-row-title">{c.title}</span>
            <span className="px-row-sub">{c.evidence}</span>
            {fixes ? <span className="px-body" style={{ fontSize: '14px', lineHeight: '19px', marginTop: '6px' }}>{c.fix}</span> : null}
          </span>
          <span className="px-row-end"><span className={`px-level ${c.level}`}>{c.level}</span></span>
        </li>
      ))}
    </ol>
  );
}

function Result() {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const { answers, email } = data.plateau;
  const top = rankCauses(answers).slice(0, 3);
  const [draft, setDraft] = useState(email ?? '');
  const [editing, setEditing] = useState(!email);
  const [err, setErr] = useState('');

  const saveEmail = () => {
    if (!isEmail(draft)) { setErr('Enter an email like name@example.com'); return; }
    dispatch({ type: 'plateauEmail', email: draft });
    setErr(''); setEditing(false);
    toast('Saved. We’ll email your result once email sending goes live.', 'good');
  };
  const startPlan = () => { dispatch({ type: 'onboardingStep', step: 'goal' }); navigate('/app/start/goal'); };

  return (
    <>
      <section className="px-card" style={{ gap: '14px', padding: '30px' }} aria-labelledby="pr">
        <span className="px-tag">Your result</span>
        <h2 id="pr" className="px-q">{headline(answers)}.</h2>
        <p className="px-body grey" style={{ margin: 0 }}>Most plateaus have two or three causes. Fix the top one first; the rest often follow.</p>
        <div className="px-sub"><CauseList ranked={top} empty="No clear cause from your answers. Your starting plan will track the basics for two weeks." fixes /></div>
        <div className="px-wiz-actions">
          <button className="px-cta glass" type="button" onClick={() => dispatch({ type: 'plateauReset' })}>Retake the check</button>
          <button className="px-cta" type="button" onClick={startPlan}>Get my starting plan</button>
        </div>
        <span className="px-meta">Draft guidance, reviewed by the PeakX coaching team. Not medical advice.</span>
      </section>
      <aside className="px-card" style={{ gap: '10px', padding: '18px' }}>
        <span className="px-card-title">Keep your result</span>
        <span className="px-meta">It’s already saved in this browser.</span>
        <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px' }} onClick={() => navigate('/app/sign-up?mode=signup')}>
          <Icon name="shield" /> Save my progress
        </button>
        <a className="px-cta glass" href={shareResultLink(answers, (import.meta.env.VITE_SITE_URL || window.location.origin) + (import.meta.env.BASE_URL.startsWith('/') ? import.meta.env.BASE_URL : '/'))} target="_blank" rel="noopener noreferrer"
          style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', textDecoration: 'none' }} onClick={() => track('result_shared', { via: 'whatsapp' })}>
          <Icon name="share" /> Send to a gym buddy
        </a>
        <span className="px-meta">Opens WhatsApp with your result and a link to the check.</span>
        <div style={{ height: '1px', background: 'var(--line)', margin: '4px 0' }} />
        {editing ? (
          <form className="px-stack" onSubmit={(e) => { e.preventDefault(); saveEmail(); }} noValidate>
            <Field label="Email it to me" error={err}>
              <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Email" />
            </Field>
            <button className="px-cta" type="submit" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px' }}>Email my result</button>
          </form>
        ) : (
          <div className="px-row">
            <span className="px-row-icon"><Icon name="mail" /></span>
            <span className="px-row-main"><span className="px-row-title">We’ll send it to</span><span className="px-row-sub" style={{ overflowWrap: 'anywhere' }}>{email}</span></span>
            <button className="px-pill sm" type="button" onClick={() => setEditing(true)}>Change</button>
          </div>
        )}
        <span className="px-meta">One email with your result and plan. No spam; unsubscribe any time.</span>
      </aside>
    </>
  );
}
