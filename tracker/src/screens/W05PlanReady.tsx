import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { Progress } from '../components/Wizard';
import { OnboardingRail, useOnboardingNav } from '../components/OnboardingRail';
import { useStore } from '../state/store';
import { latestWeight } from '../state/selectors';
import { DIET_LABEL, clock12, firstInvalidStep, recipesForDiet, splitFor } from '../domain/onboarding';
import { fmt, targetsExplain } from '../domain/nutrition';
import { RECIPES } from '../domain/seed';
import { today, weekStart, addDays } from '../domain/clock';

const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** W05 · Plan ready (onboarding step 6). Numbers come from the saved profile, so going back and editing updates them. */
export default function W05PlanReady() {
  const { data } = useStore();
  const navigate = useNavigate();
  const go = useOnboardingNav();
  const toast = useToast();
  const [why, setWhy] = useState(false);

  const bad = firstInvalidStep(data.onboarding.draft);
  if (bad || !data.onboarding.done) return <Navigate to={`/app/start/${bad ?? 'devices'}`} replace />;

  const p = data.profile;
  const t = data.targets;
  const kg = latestWeight(data)?.kg ?? data.onboarding.draft.weightKg;
  const x = targetsExplain(p, kg);
  const split = splitFor(p.trainingDays, p.trainingStyle);
  const recipes = recipesForDiet(p.diet, RECIPES);
  const todayIdx = DAY.findIndex((_, i) => addDays(weekStart(today()), i) === today());
  const sessions = split.filter((s) => s !== 'Rest').length;

  return (
    <AppShell active="setup" title="Your plan is ready" crumb={<>Step 6 of 6</>} cols="minmax(0, 1fr)">
      <div className="px-wizard">
        <OnboardingRail current="plan" />
        <section className="px-card" style={{ gap: '14px', padding: '30px' }} aria-label="Your plan">
          <Progress value={1} label="Setup progress" />
          <div className="wb-hero">
            <span className="px-hero-label">{p.name}, your daily target</span>
            <div className="fig"><span className="px-num xl">{fmt(t.kcalTraining)}</span><span className="px-suffix">kcal</span></div>
            <span className="px-meta" style={{ marginTop: '6px' }}>
              Training days · {fmt(t.kcalRest)} on rest days{data.devices.google ? ' · adjusts to your Fitbit steps' : ''}
            </span>
          </div>
          <div className="px-sub">
            <div className="px-row">
              <span className="px-row-icon"><Icon name="drop" /></span>
              <span className="px-row-main"><span className="px-row-title">Protein</span><span className="px-row-sub">2 g per kg · keeps muscle while you push</span></span>
              <span className="px-row-end"><span className="px-row-value">{t.protein} g</span></span>
            </div>
            <div className="px-row">
              <span className="px-row-icon"><Icon name="grain" /></span>
              <span className="px-row-main"><span className="px-row-title">Carbs and fat</span><span className="px-row-sub">Carbs fuel training; fat about a quarter of calories</span></span>
              <span className="px-row-end"><span className="px-row-value">{t.carbs} g · {t.fat} g</span></span>
            </div>
            <div className="px-row">
              <span className="px-row-icon"><Icon name="leaf" /></span>
              <span className="px-row-main">
                <span className="px-row-title">Starter recipes</span>
                <span className="px-row-sub">{DIET_LABEL[p.diet]} · {recipes.slice(0, 3).map((r) => r.name).join(', ')}{recipes.length > 3 ? '…' : ''}</span>
              </span>
              <span className="px-row-end"><span className="px-row-value">{recipes.length}</span><Link to="/app/plan/recipes" className="px-status good" style={{ textDecoration: 'none' }}>Picked</Link></span>
            </div>
          </div>
          <div>
            <div className="px-card-head" style={{ marginBottom: '10px' }}>
              <span className="px-card-title">Your week</span>
              <span className="px-meta">{sessions} {p.trainingStyle === 'run' ? 'runs' : 'sessions'} · {7 - sessions} rest · {p.trainingStyle === 'run' ? 'running' : 'gym'} at {clock12(p.gymTime)}</span>
            </div>
            <div className="px-week">
              {split.map((s, i) => (
                <div key={i}>
                  <span className={`px-date${i === todayIdx ? ' on' : ''}`} style={{ width: '40px', height: '40px' }} aria-label={i === todayIdx ? 'Today' : undefined}>{DAY[i]}</span>
                  <span className="px-meta">{s}</span>
                </div>
              ))}
            </div>
          </div>
          {why ? (
            <div className="px-sub" style={{ padding: '14px 16px' }}>
              <div className="px-explain">
                <span>Resting energy (Mifflin-St Jeor: {kg} kg, {p.heightCm} cm, {p.age} y)</span><b>{fmt(x.bmr)}</b>
                <span>× activity ({x.activityFactor}) = daily burn</span><b>{fmt(x.tdee)}</b>
                <span>{x.goalDelta < 0 ? 'Deficit' : 'Surplus'} for your goal, rounded to 50</span><b>{x.goalDelta > 0 ? '+' : '−'}{Math.abs(x.goalDelta)}</b>
                <span>Training-day target</span><b>{fmt(x.targets.kcalTraining)}</b>
                <span>Rest days: 150 kcal less</span><b>{fmt(x.targets.kcalRest)}</b>
                <span>Protein: 2 g × {kg} kg</span><b>{x.targets.protein} g</b>
              </div>
              {x.targets.kcalTraining !== t.kcalTraining ? <p className="px-meta" style={{ margin: '10px 0 0' }}>Your current target of {fmt(t.kcalTraining)} kcal was set by your coach. Re-run setup to use the formula.</p> : null}
            </div>
          ) : null}
          <div className="px-wiz-actions">
            <button className="px-cta glass" type="button" aria-expanded={why} onClick={() => setWhy(!why)}>{why ? 'Hide the maths' : 'Why these numbers'}</button>
            <button className="px-cta" type="button" onClick={() => navigate('/')}>Start day 1</button>
          </div>
          <button type="button" className="px-meta" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'var(--text)', textDecoration: 'underline' }} onClick={() => go('goal')}>Change my answers</button>
        </section>
        <aside className="px-card" style={{ gap: '0', padding: '18px' }}>
          <span className="px-card-title">Stay on it</span>
          <span className="px-meta" style={{ marginBottom: '4px' }}>No app install needed</span>
          <div className="px-row">
            <span className="px-row-icon"><Icon name="hex" /></span>
            <span className="px-row-main"><span className="px-row-title">Supplement protocol</span><span className="px-row-sub">What to take and which brand · 3 min</span></span>
            <button className="px-pill sm" type="button" onClick={() => navigate('/app/insights/supplements')}>{data.supplements?.completedOn ? 'Open' : 'Start'}</button>
          </div>
          <div className="px-row">
            <span className="px-row-icon"><Icon name="pulse" /></span>
            <span className="px-row-main"><span className="px-row-title">Fitbit · via Google</span><span className="px-row-sub">Steps, sleep, heart rate</span></span>
            {data.devices.google ? <span className="px-status good">Connected</span> : <button className="px-pill sm" type="button" onClick={() => navigate('/app/devices')}>Connect</button>}
          </div>
          <div className="px-row">
            <span className="px-row-icon"><Icon name="mail" /></span>
            <span className="px-row-main"><span className="px-row-title">Email reminders</span><span className="px-row-sub">Log nudges and Sunday report</span></span>
            <button className="px-pill sm" type="button" onClick={() => navigate('/app/devices')}>Turn on</button>
          </div>
          <div className="px-row">
            <span className="px-row-icon"><Icon name="cal" /></span>
            <span className="px-row-main"><span className="px-row-title">Google Calendar</span><span className="px-row-sub">Add your sessions</span></span>
            <button className="px-pill sm" type="button" onClick={() => navigate('/app/devices')}>Add</button>
          </div>
          <div className="px-row">
            <span className="px-row-icon"><Icon name="phone" /></span>
            <span className="px-row-main"><span className="px-row-title">Home screen</span><span className="px-row-sub">Opens like an app</span></span>
            <button className="px-pill sm" type="button" onClick={() => toast('Chrome: menu › Add to home screen. Safari: Share › Add to Home Screen.')}>How</button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

