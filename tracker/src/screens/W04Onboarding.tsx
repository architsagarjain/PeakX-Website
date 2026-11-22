import { useAuth } from '../state/auth';
import { connectDevice, useDeviceAvailability } from '../state/devices';
import { useEmailPrefs } from '../components/Reminders';
import { PROVIDER_LABEL, type Provider } from '../domain/wearables';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useSoon, useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { ChoiceGroup } from '../components/ui';
import { AppShell } from '../components/Shell';
import { Chips, Field, Progress, WizardNav } from '../components/Wizard';
import { OnboardingRail, useOnboardingNav } from '../components/OnboardingRail';
import { useStore } from '../state/store';
import {
  ACTIVITY_LABEL, DIET_LABEL, GOAL_LABEL, STYLE_LABEL, WEEKDAYS, ONBOARDING_STEPS, clock12, isStep, profileFromDraft, recipesForDiet, stepIndex, validateStep,
  type OnboardingDraft, type OnboardingStep,
} from '../domain/onboarding';
import { fmt, targetsFor } from '../domain/nutrition';
import { RECIPES } from '../domain/seed';
import type { Diet, Goal, Profile, TrainingStyle } from '../domain/types';

const GOALS: { id: Goal; t: string; m: string }[] = [
  { id: 'plateau', t: 'Break a plateau', m: 'A lift or the scale has stopped moving' },
  { id: 'lose', t: 'Lose fat', m: 'About 0.5 kg a week' },
  { id: 'gain', t: 'Build muscle', m: 'Slow, lean gain' },
  { id: 'recomp', t: 'Lose fat, keep muscle', m: 'Small deficit, high protein' },
];
const DIETS: { id: Diet; t: string; m: string }[] = [
  { id: 'veg', t: 'Vegetarian', m: 'Dal, paneer, curd, soya' },
  { id: 'egg', t: 'Eggetarian', m: 'Vegetarian plus eggs' },
  { id: 'nonveg', t: 'Non-vegetarian', m: 'Chicken, eggs, fish' },
  { id: 'vegan', t: 'Vegan', m: 'No dairy' },
];
const ACTIVITIES = Object.keys(ACTIVITY_LABEL) as Profile['activity'][];
const SOURCES = ['Home', 'PG mess', 'Office canteen', 'Ordering in', 'Eating out'];
const LANGS = ['English', 'Hindi'];

const COPY: Record<Exclude<OnboardingStep, 'plan'>, { q: string; help: string; crumb: string }> = {
  goal: { q: 'What do you want from the next 8 weeks?', help: 'Sets your calories and how fast we push.', crumb: 'Goal' },
  about: { q: 'A little about you', help: 'Used only to work out your calories and protein.', crumb: 'About you' },
  routine: { q: 'When do you train?', help: 'We build your week and move food around your sessions.', crumb: 'Routine' },
  diet: { q: 'What do you usually eat?', help: 'This picks your recipes and teaches the voice log your food.', crumb: 'Diet' },
  devices: { q: 'Connect what you already use', help: 'Optional. Steps and sleep make your targets and reports sharper.', crumb: 'Devices' },
};

/** W04 · Onboarding steps 1–5 (goal, about you, routine, diet, devices). Step 6 is W05 Plan ready. */
export default function W04Onboarding() {
  const { step: param } = useParams();
  const { data, dispatch } = useStore();
  const go = useOnboardingNav();
  const [tried, setTried] = useState<string | null>(null);
  const step = (isStep(param) ? param : 'goal') as OnboardingStep;
  const d = data.onboarding.draft;
  const errors = validateStep(step, d);
  const show = tried === step ? errors : {};
  const i = stepIndex(step);

  const set = (patch: Partial<OnboardingDraft>) => dispatch({ type: 'onboardingSet', patch });
  const next = () => {
    if (Object.keys(errors).length) { setTried(step); return; }
    setTried(null);
    go(ONBOARDING_STEPS[i + 1].id);
  };
  const back = i > 0 ? () => { setTried(null); go(ONBOARDING_STEPS[i - 1].id); } : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'Enter' && !t.closest('button, a, select, textarea') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!isStep(param) || step === 'plan') return <Navigate to="/app/start/goal" replace />;
  const c = COPY[step];

  return (
    <AppShell active="setup" title="Set up your plan" crumb={<>Step {i + 1} of 6 · {c.crumb}</>} cols="minmax(0, 1fr)">
      <div className="px-wizard">
        <OnboardingRail current={step} />
        <section className="px-card" style={{ gap: '16px', padding: '30px' }} aria-labelledby="oq">
          <Progress value={i / 5} label="Setup progress" />
          <div>
            <h2 id="oq" className="px-q">{c.q}</h2>
            <p className="px-body grey" style={{ margin: '6px 0 0' }}>{c.help}</p>
          </div>
          {step === 'goal' && <GoalStep d={d} set={set} err={show} />}
          {step === 'about' && <AboutStep d={d} set={set} err={show} />}
          {step === 'routine' && <RoutineStep d={d} set={set} err={show} />}
          {step === 'diet' && <DietStep d={d} set={set} err={show} />}
          {step === 'devices' && <DevicesStep />}
          <WizardNav onBack={back} onNext={next} nextLabel={step === 'devices' ? 'See my plan' : 'Continue'} />
        </section>
        <PlanSoFar d={d} />
      </div>
    </AppShell>
  );
}

type StepProps = { d: OnboardingDraft; set: (p: Partial<OnboardingDraft>) => void; err: Partial<Record<keyof OnboardingDraft, string>> };

/** Number input that stores 0 while empty, so validation can flag it. */
function Num({ value, onChange, label, min, max, step = 1 }: { value: number; onChange: (n: number) => void; label: string; min: number; max: number; step?: number }) {
  return <input type="number" inputMode="decimal" aria-label={label} min={min} max={max} step={step} value={value ? value : ''} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />;
}

function GoalStep({ d, set, err }: StepProps) {
  return (
    <>
      <ChoiceGroup label="Goal" className="px-choices" options={GOALS} value={GOALS.findIndex((g) => g.id === d.goal)} onChange={(k) => set({ goal: GOALS[k].id })} />
      {d.goal === 'plateau' ? (
        <div className="px-fields">
          <Field label="What’s stuck" error={err.stuckLift}><input type="text" value={d.stuckLift} placeholder="Bench press" onChange={(e) => set({ stuckLift: e.target.value })} aria-label="What’s stuck" /></Field>
          <Field label="For how long" suffix="weeks" error={err.stuckWeeks}><Num label="Weeks stuck" value={d.stuckWeeks} min={1} max={104} onChange={(n) => set({ stuckWeeks: n })} /></Field>
        </div>
      ) : null}
    </>
  );
}

function AboutStep({ d, set, err }: StepProps) {
  return (
    <>
      <div className="px-fields">
        <Field label="First name" error={err.name}><input type="text" autoComplete="given-name" value={d.name} onChange={(e) => set({ name: e.target.value })} aria-label="First name" /></Field>
        <Field label="Age" suffix="years" error={err.age}><Num label="Age" value={d.age} min={16} max={80} onChange={(n) => set({ age: n })} /></Field>
        <Field label="Height" suffix="cm" error={err.heightCm}><Num label="Height in cm" value={d.heightCm} min={130} max={220} onChange={(n) => set({ heightCm: n })} /></Field>
        <Field label="Weight today" suffix="kg" error={err.weightKg}><Num label="Weight in kg" value={d.weightKg} min={35} max={200} step={0.1} onChange={(n) => set({ weightKg: n })} /></Field>
      </div>
      <Row icon="user" title="Sex" sub="Changes the calorie formula by about 160 kcal">
        <Chips label="Sex" options={['Male', 'Female']} value={[d.sex === 'male' ? 'Male' : 'Female']} onChange={([v]) => set({ sex: v === 'Male' ? 'male' : 'female' })} />
      </Row>
    </>
  );
}

const STYLES: TrainingStyle[] = ['gym', 'run', 'both'];

function RoutineStep({ d, set, err }: StepProps) {
  const style = d.trainingStyle ?? 'gym';
  const run = style === 'run';
  return (
    <>
      <div className="px-sub">
        <Row icon="dumbbell" title="How do you train?" sub={run ? 'We plan easy, tempo and long runs, and you log distance and time' : style === 'both' ? 'Gym sessions in your plan; log runs on any day' : 'Lifting sessions with weights and reps'} stack>
          <Chips label="How do you train" options={STYLES.map((x) => STYLE_LABEL[x])} value={[STYLE_LABEL[style]]} onChange={([v]) => set({ trainingStyle: STYLES.find((x) => STYLE_LABEL[x] === v) ?? 'gym' })} />
        </Row>
        <Row icon={run ? 'steps' : 'dumbbell'} title={run ? 'Runs a week' : 'Sessions a week'} sub={err.trainingDays ?? (run ? 'We keep at least one rest day' : 'Gym and sport; we keep at least one rest day')} stack>
          <Chips label={run ? 'Runs a week' : 'Sessions a week'} options={['2', '3', '4', '5', '6']} value={[String(d.trainingDays)]} onChange={([v]) => set({ trainingDays: Number(v) })} />
        </Row>
        <Row icon="clock" title={run ? 'Usual run time' : 'Usual gym time'} sub={err.gymTime ?? 'Pre-workout meal and reminders use this'}>
          <input type="time" className="px-pill" value={d.gymTime} onChange={(e) => set({ gymTime: e.target.value })} aria-label={run ? 'Usual run time' : 'Usual gym time'} style={{ font: '500 13px/1 var(--font-body)' }} />
        </Row>
      </div>
      <span className="px-card-title" style={{ fontSize: '18px' }}>Outside {run ? 'your runs' : 'the gym'}, your day is mostly…</span>
      <ChoiceGroup label="Daily activity" className="px-choices" options={ACTIVITIES.map((a) => ({ t: ACTIVITY_LABEL[a], m: { sedentary: 'Under 5,000 steps', light: '5,000–7,500 steps', moderate: '7,500–10,000 steps', active: 'Over 10,000 steps' }[a] }))}
        value={ACTIVITIES.indexOf(d.activity)} onChange={(k) => set({ activity: ACTIVITIES[k] })} />
    </>
  );
}

function DietStep({ d, set, err }: StepProps) {
  return (
    <>
      <ChoiceGroup label="Diet" className="px-choices" options={DIETS} value={DIETS.findIndex((x) => x.id === d.diet)} onChange={(k) => set({ diet: DIETS[k].id })} />
      <div className="px-sub">
        {d.diet === 'nonveg' || d.diet === 'egg' ? (
          <Row icon="leaf" title="Veg-only days (optional)" sub={`Days you can’t have ${d.diet === 'egg' ? 'eggs' : 'non-veg'} at home. Your meal plan keeps them vegetarian; other days mix veg and ${d.diet === 'egg' ? 'egg' : 'non-veg'}.`} stack>
            <Chips multi label="Veg-only days" options={WEEKDAYS} value={(d.vegDays ?? []).map((i) => WEEKDAYS[i])} onChange={(v) => set({ vegDays: v.map((x) => WEEKDAYS.indexOf(x)).sort((a, b) => a - b) })} />
          </Row>
        ) : null}
        <Row icon="bowl" title="Where do most meals come from?" sub={err.mealSources ?? 'Pick all that apply'} stack>
          <Chips multi label="Meal sources" options={SOURCES} value={d.mealSources} onChange={(v) => set({ mealSources: v })} />
        </Row>
        <Row icon="mic" title="Language for voice logging" sub={err.voiceLanguages ?? 'You can mix them'} stack>
          <Chips multi label="Voice languages" options={LANGS} value={d.voiceLanguages} onChange={(v) => set({ voiceLanguages: v })} />
        </Row>
      </div>
    </>
  );
}

function DevicesStep() {
  const { data } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const avail = useDeviceAvailability();
  const [prefs, savePrefs] = useEmailPrefs();
  const connect = async (p: Provider) => {
    if (!auth.configured) { toast('Device sync needs accounts switched on for this site.'); return; }
    if (!auth.user) { toast('Save your progress first, then connect.'); navigate('/app/sign-up?next=/app/devices'); return; }
    if (avail && !avail[p]) { toast(`${PROVIDER_LABEL[p]} sync isn’t switched on for this site yet.`); return; }
    try { await connectDevice(p); } catch (e) { toast((e as Error).message); }
  };
  const status = (on: boolean, p: Provider) => on
    ? <span className="px-status good">Connected</span>
    : <button className="px-pill sm" type="button" onClick={() => connect(p)}>Connect</button>;
  return (
    <div className="px-sub">
      <Row icon="pulse" title="Fitbit · via Google" sub="Steps, sleep, heart rate">{status(data.devices.google, 'google')}</Row>
      <Row icon="path" title="Strava" sub="Runs, rides and sport sessions">{status(data.devices.strava, 'strava')}</Row>
      <Row icon="mail" title="Email reminders" sub="Log nudge at 9 PM and the Sunday report">{prefs?.logNudge ? <span className="px-status good">On</span> : <button className="px-pill sm" type="button" onClick={() => { if (!auth.user) { toast('Save your progress first, then turn reminders on.'); navigate('/app/sign-up?next=/app/devices'); return; } if (prefs) savePrefs({ ...prefs, logNudge: true, reportEmail: true, unsubscribedAt: null }).then(() => toast('Reminders on', 'good')).catch(() => toast('Couldn’t save. Check your connection.')); }}>Turn on</button>}</Row>
      <Row icon="phone" title="Home screen" sub="Opens like an app, no install">
        <button className="px-pill sm" type="button" onClick={() => toast('Chrome: menu › Add to home screen. Safari: Share › Add to Home Screen.')}>How</button>
      </Row>
      <Row icon="gear" title="Manage later" sub="Everything here is also in Devices">
        <button className="px-pill sm" type="button" onClick={() => navigate('/app/devices')}>Open Devices</button>
      </Row>
    </div>
  );
}

function Row({ icon, title, sub, children, stack }: { icon: string; title: string; sub: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className="px-row" style={stack ? { flexWrap: 'wrap', rowGap: '10px' } : { flexWrap: 'wrap', rowGap: '8px' }}>
      <span className="px-row-icon"><Icon name={icon} /></span>
      <span className="px-row-main" style={{ flexBasis: 0 }}><span className="px-row-title">{title}</span><span className="px-row-sub">{sub}</span></span>
      <span style={stack ? { flexBasis: '100%', paddingLeft: '34px' } : { marginLeft: 'auto' }}>{children}</span>
    </div>
  );
}

/** Right column: the plan filling in as the user answers. */
function PlanSoFar({ d }: { d: OnboardingDraft }) {
  const { data } = useStore();
  const aboutOk = Object.keys(validateStep('about', d)).length === 0;
  const t = aboutOk ? targetsFor(profileFromDraft(d, data.profile), d.weightKg) : null;
  const recipes = recipesForDiet(d.diet, RECIPES).length;
  const kv = (k: string, v: ReactNode) => (
    <div className="px-kv"><span className="k" style={{ color: 'var(--text-3)', font: '400 12px/19px var(--font-body)' }}>{k}</span><span className="v">{v}</span></div>
  );
  const later = (s: string) => <span className="d">{s}</span>;
  return (
    <aside className="px-card" style={{ gap: '2px', padding: '18px' }} aria-live="polite">
      <span className="px-card-title">Your plan so far</span>
      <span className="px-meta" style={{ marginBottom: '6px' }}>Fills in as you answer</span>
      {kv('Goal', GOAL_LABEL[d.goal])}
      {d.goal === 'plateau' ? kv('Stuck', d.stuckLift ? `${d.stuckLift}, ${d.stuckWeeks || '?'} weeks` : later('add it')) : null}
      {kv('Calories', t ? `${fmt(t.kcalTraining)} kcal` : later('after About you'))}
      {kv('Protein', t ? `${t.protein} g` : later('after About you'))}
      {kv('Training', `${STYLE_LABEL[d.trainingStyle ?? 'gym']} · ${d.trainingDays} days · ${clock12(d.gymTime)}`)}
      {kv('Diet', `${DIET_LABEL[d.diet]}${(d.diet === 'nonveg' || d.diet === 'egg') && d.vegDays?.length ? ` · veg on ${d.vegDays.map((i) => WEEKDAYS[i]).join(', ')}` : ''}`)}
      {kv('Recipes', `${recipes} starter recipes`)}
      {kv('Devices', data.devices.google || data.devices.strava ? [data.devices.google && 'Fitbit', data.devices.strava && 'Strava'].filter(Boolean).join(' + ') : later('optional'))}
    </aside>
  );
}
