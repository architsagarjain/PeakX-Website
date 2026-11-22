import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { useStore } from '../state/store';
import { WeightDialog } from '../components/WeightDialog';
import { today, longDate, addDays, shortDay, dayNum, parse } from '../domain/clock';
import { fmt } from '../domain/nutrition';
import { mealMacros } from '../domain/mealPlan';
import { RECIPES, recipeMacros } from '../domain/seed';
import { ONBOARDING_STEPS, stepIndex } from '../domain/onboarding';
import { FEATURE_COPY } from '../state/entitlements';
import {
  remaining, wearableOn, SLOT_LABEL, slotFor, weightTrend, weightSeries, weekVolumeSummary, loggedDays,
  plateauSummary, latestFormReview, nextPlannedMeal, wearableSeries,
} from '../state/selectors';
import { planDay, sessionFor, targetSets } from '../domain/training';
import { fmtPace, kindForLabel, paceSec, runGuide, runsOn } from '../domain/runs';
import { GlassCard, Stat, MacroBar, DarkBand, EmptyState, Chip, Badge, PillButton } from '../components/ui/blocks';
import { Sparkline, BarSpark } from '../components/ui/charts';
import { WeekStrip } from '../components/ui/WeekStrip';

const LOOKUP = { recipes: RECIPES, recipeMacros };
const shortMonth = (d: string) => parse(d).toLocaleDateString('en-GB', { month: 'short' });
const dayMonth = (d: string) => parse(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const DISMISS = 'peakx.setupBanner.dismissed';
const readDismissed = () => { try { return sessionStorage.getItem(DISMISS) === '1'; } catch { return false; } };

/** W06 · Home: today at a glance, the new-user setup banner, and today's plan in the dark band. */
export default function W06ThisWeek() {
  const { data, can, loadDemo } = useStore();
  const [weightOpen, setWeightOpen] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);
  const d = today();
  const hour = new Date().getHours();
  const r = remaining(data, d);
  const t = data.targets;
  const w = wearableOn(data, d);
  const planned = sessionFor(data.workouts, data.profile, d, undefined, data.trainingOverrides, data.fixPlans);
  const session = planned?.session;
  const runDay = planDay(data.profile, d);
  const runsToday = runsOn(data.runs ?? [], d);
  const runKm = Math.round(runsToday.reduce((x, y) => x + y.km, 0) * 10) / 10;
  const runTitle = !session && (runDay.run || runsToday.length) ? (runDay.run ? runDay.label : 'Run') : null;
  const guide = runDay.run ? runGuide(kindForLabel(runDay.label), data.runs ?? [], d) : null;
  const vol = weekVolumeSummary(data, d);
  const trend = weightTrend(data, d);
  const plateau = plateauSummary(data);
  const form = latestFormReview(data);
  const meal = nextPlannedMeal(data, d, hour, (m) => mealMacros(m, LOOKUP));
  const logged = loggedDays(data, d);
  // Plan weeks count from the first thing the user logged.
  const first = [...data.meals.map((m) => m.date), ...data.weights.map((x) => x.date), ...data.workouts.map((x) => x.date)].sort()[0];
  const weekNo = first ? Math.floor((parse(d).getTime() - parse(first).getTime()) / (7 * 864e5)) + 1 : null;
  const name = data.profile.name.trim().split(/\s+/)[0];
  const greeting = `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}${name ? `, ${name}` : ''}`;
  const setupAt = Math.max(0, stepIndex(data.onboarding.step));
  const setupPct = Math.round((setupAt / ONBOARDING_STEPS.length) * 100);
  const dismiss = () => { setDismissed(true); try { sessionStorage.setItem(DISMISS, '1'); } catch { /* private mode */ } };
  const setsDone = session ? session.exercises.reduce((x, e) => x + e.sets.length, 0) : 0;
  const setsPlanned = session ? session.exercises.reduce((x, e) => x + targetSets(e), 0) : 0;
  const habits = [
    w ? { label: 'Steps', value: w.steps, target: t.steps, unit: '' } : null,
    { label: 'Protein', value: r.eaten.protein, target: t.protein, unit: 'g' },
    w ? { label: 'Sleep', value: w.sleepHours, target: t.sleepHours, unit: 'h' } : null,
  ].filter((h): h is NonNullable<typeof h> => !!h);
  const onTrack = habits.filter((h) => h.value >= h.target).length;

  return (
    <>
    {weightOpen ? <WeightDialog onClose={() => setWeightOpen(false)} /> : null}
    <AppShell
      active="week" title={greeting}
      crumb={<>{weekNo && data.onboarding.done ? `Week ${weekNo} of your plan · ` : ''}{longDate(d)}</>}
      headAside={<WeekStrip date={d} today={d} logged={(x) => logged.has(x)} label="This week’s logging" />}
    >
      {!data.onboarding.done && !dismissed ? (
        <div className="hm-setup" role="region" aria-label="Set up your plan">
          <span className="hm-setup-icon"><Icon name="list" /></span>
          <div className="hm-setup-text">
            <b>Set up your plan</b>
            <span>Two minutes. Your calorie and protein targets come from your answers.</span>
          </div>
          {setupAt > 0 ? (
            <div className="hm-setup-progress">
              <div className="ui-track"><span style={{ width: `${setupPct}%` }} /></div>
              <span>{setupAt} of {ONBOARDING_STEPS.length}</span>
            </div>
          ) : null}
          <div className="hm-setup-actions">
            <PillButton variant="ghost" size="sm" onClick={() => loadDemo()}>See a demo</PillButton>
            <PillButton size="sm" to={`/app/start/${data.onboarding.step === 'plan' ? 'goal' : data.onboarding.step}`}>{setupAt > 0 ? 'Continue setup' : 'Set up my plan'}</PillButton>
          </div>
          <button type="button" className="hm-setup-x" aria-label="Hide for now" onClick={dismiss}><Icon name="close" /></button>
        </div>
      ) : null}

      <div className="wb-col hm-hero-col" style={{ gridColumn: 'span 7' }}>
        <section className="hm-hero">
          {form?.review ? (
            <>
              <div className="hm-hero-top">
                <span className="ui-chip c-band"><i className="hm-dot" />Latest form check</span>
                <div className="hm-hero-chips">
                  {form.review.findings.slice(0, 3).map((f) => <Chip key={f.title} tone={f.ok ? 'lime' : 'coral'}>{f.title}: {f.value}</Chip>)}
                </div>
              </div>
              <div className="hm-hero-body">
                <h2>{form.exercise} · {form.kg} kg × {form.reps}</h2>
                <p>{form.review.summary}</p>
                {form.review.cue ? <div className="hm-hero-cue"><Icon name="check" /><span><b>{form.review.cue.text}</b> {form.review.cue.detail}</span></div> : null}
              </div>
              <div className="hm-hero-foot">
                <span>Reviewed by {form.review.coach}</span>
                <PillButton variant="accent" to={`/app/reviews/form-check/${form.id}`}>Open the review</PillButton>
              </div>
            </>
          ) : (
            <>
              <div className="hm-hero-top">
                <span className="ui-chip c-band"><i className="hm-dot" />Form check</span>
                {can('formCheck') ? null : <Badge kind="pro" />}
              </div>
              <div className="hm-hero-body">
                <h2>{FEATURE_COPY.formCheck.title}</h2>
                <p>{FEATURE_COPY.formCheck.pitch}</p>
              </div>
              <div className="hm-hero-foot">
                <span>Squat, bench, deadlift and more</span>
                <PillButton variant="accent" icon="upload" to="/app/reviews/form-check">Upload a set</PillButton>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="wb-col hm-right" style={{ gridColumn: 'span 5' }}>
        <GlassCard
          title="Calories left" aside={<Badge>Target {fmt(r.target.total)} kcal</Badge>}
          to="/app/log" linkLabel={`Calories left: ${fmt(Math.abs(r.left))} kcal ${r.left >= 0 ? 'left' : 'over'}. Open today’s food log`}
        >
          <Stat
            value={Math.abs(r.left)} unit={r.left >= 0 ? 'kcal left' : 'kcal over'}
            caption={data.onboarding.done
              ? <>{fmt(r.eaten.kcal)} kcal eaten today{r.target.stepBonus ? ` · +${r.target.stepBonus} kcal from steps` : ''}</>
              : 'A starting target until you set up your plan.'}
          />
          <div className="hm-macros">
            <MacroBar label="Protein" consumed={r.eaten.protein} target={t.protein} />
            <MacroBar label="Carbs" consumed={r.eaten.carbs} target={t.carbs} tone="lime" />
            <MacroBar label="Fat" consumed={r.eaten.fat} target={t.fat} />
          </div>
        </GlassCard>
        <GlassCard
          title="Training volume"
          aside={vol.change !== null ? <Chip tone={vol.change >= 0 ? 'lime' : 'neutral'}>{vol.change >= 0 ? '+' : '−'}{Math.abs(vol.change)}% vs last week</Chip> : null}
        >
          {vol.total > 0 ? (
            <div className="hm-vol">
              <Stat value={vol.total / 1000} dp={1} unit="t this week" size="md" />
              <BarSpark
                values={vol.days.map((v) => (v.date > d ? null : v.kg))} labels={vol.days.map((v) => shortDay(v.date).slice(0, 1))}
                highlight={vol.days.findIndex((v) => v.date === d)} height={64}
                label={`Training volume by day this week, ${(vol.total / 1000).toFixed(1)} tonnes so far`}
              />
            </div>
          ) : <EmptyState icon="dumbbell" text="Log a workout to see this week’s volume." action={{ label: 'Log a workout', to: '/app/log/workout' }} />}
        </GlassCard>
      </div>

      <div className="wb-col hm-wide" style={{ gridColumn: 'span 12' }}>
        {w ? (
          <div className="hm-quad">
            <GlassCard title={<span className="ui-label">Steps</span>} aside={<Badge>Synced today</Badge>}>
              <Stat value={w.steps} unit="steps" size="md" caption={`Goal ${fmt(t.steps)}`} />
              <div className="hm-quad-foot">
                <MacroBar label={`${Math.round((w.steps / t.steps) * 100)}%`} consumed={w.steps} target={t.steps} unit="" tone="lime" />
              </div>
            </GlassCard>
            <GlassCard title={<span className="ui-label">Sleep</span>}>
              <Stat value={w.sleepHours} dp={1} unit="h" size="md" caption={`Target ${t.sleepHours} h`} />
              <Sparkline values={wearableSeries(data, d, 'sleepHours')} label="Sleep over the last 7 nights" height={40} fluid />
            </GlassCard>
            <GlassCard title={<span className="ui-label">Resting heart rate</span>}>
              <Stat value={w.restingHr} unit="bpm" size="md" caption="Last 7 days" />
              <Sparkline values={wearableSeries(data, d, 'restingHr')} label="Resting heart rate over the last 7 days" height={40} fluid />
            </GlassCard>
            <GlassCard title={<span className="ui-label">Active minutes</span>}>
              <Stat value={w.activeMinutes} unit="min" size="md" caption="Last 7 days" />
              <Sparkline values={wearableSeries(data, d, 'activeMinutes')} label="Active minutes over the last 7 days" height={40} fluid />
            </GlassCard>
          </div>
        ) : (
          <GlassCard className="hm-connect">
            <span className="ui-empty-icon"><Icon name="pulse" /></span>
            <div className="hm-connect-text">
              <b>{data.devices.google ? 'No sync yet today' : 'Steps, sleep and heart rate'}</b>
              <span>{data.devices.google ? 'Open the Fitbit or Google Fit app to sync, then check back.' : 'Connect Fitbit or Google Fit to see them here and earn calories from steps.'}</span>
            </div>
            <PillButton variant="ghost" size="sm" to="/app/devices">{data.devices.google ? 'Devices' : 'Connect'}</PillButton>
          </GlassCard>
        )}
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        {plateau.done && plateau.top ? (
          <GlassCard
            variant={plateau.top.level === 'Low' ? 'light' : 'coral'} className="hm-plateau"
            title={<span className="hm-eyebrow"><i />Plateau check · {plateau.top.level.toLowerCase()} likelihood</span>}
            aside={<Badge tone={plateau.top.level === 'Low' ? 'neutral' : 'warn'}>Checked {dayNum(plateau.completedOn!)} {shortMonth(plateau.completedOn!)}</Badge>}
          >
            <h3 className="hm-plateau-title">{plateau.headline}</h3>
            <p className="hm-plateau-body">{plateau.top.fix}</p>
            <div className="hm-plateau-foot">
              <span className="ui-label">From your answers: {plateau.top.evidence.toLowerCase()}</span>
              <PillButton to="/app/plateau-check" icon="target">See the full result</PillButton>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="hm-plateau" title={<span className="hm-eyebrow plain">Plateau check</span>}>
            <h3 className="hm-plateau-title">Find out why progress stalled</h3>
            <p className="hm-plateau-body">Eight questions about sleep, food and training. You get the likely cause and what to change.</p>
            <div className="hm-plateau-foot">
              <span className="ui-label">Free · 2 minutes</span>
              <PillButton to="/app/plateau-check">Take the plateau check</PillButton>
            </div>
          </GlassCard>
        )}
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 5' }}>
        <GlassCard
          className="hm-weight" title="Weight"
          aside={trend.latest
            ? <>{trend.change !== 0 ? <Chip tone={trend.status === 'good' ? 'lime' : trend.status === 'off' ? 'coral' : 'neutral'}>{trend.change > 0 ? '+' : '−'}{Math.abs(trend.change)} kg this month</Chip> : null}<PillButton variant="ghost" size="sm" onClick={() => setWeightOpen(true)}>Log</PillButton></>
            : null}
        >
          {trend.latest ? (
            <>
              <Stat
                value={trend.avg ?? trend.latest.kg} dp={1} unit="kg · 7-day average" size="md"
                caption={`Last weigh-in ${trend.latest.kg} kg${trend.latest.date === d ? ' today' : ` on ${shortDay(trend.latest.date)} ${dayNum(trend.latest.date)}`} · ${trend.status === 'good' ? 'on pace' : trend.status === 'steady' ? 'steady' : 'off pace for your goal'}`}
              />
              <Sparkline values={weightSeries(data, d, 28).map((p) => p.avg)} label={`Weight, 7-day average over the last 28 days, now ${trend.avg} kg`} height={120} tone="lime" fill fluid />
              <div className="hm-weight-axis"><span>{dayNum(addDays(d, -27))} {shortMonth(addDays(d, -27))}</span><span>Today</span></div>
            </>
          ) : <EmptyState icon="target" text="Log a weigh-in in the morning, before food, to start your trend." action={{ label: 'Log weight', onClick: () => setWeightOpen(true) }} />}
        </GlassCard>
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <DarkBand
          eyebrow="Today’s plan" title={<>{dayMonth(d)} · {session ? session.name : runTitle ?? 'Rest day'}</>}
          status={<PillButton variant="band" size="sm" icon="cal" to="/app/plan/meals">Week plan</PillButton>}
        >
          <GlassCard variant="band" title={session ? session.name : runTitle ?? 'Rest day'} aside={<Badge>{session ? `${session.exercises.length} exercises` : runTitle ? (runsToday.length ? `${runKm} km done` : `${guide?.km ?? ''} km`) : 'Recovery'}</Badge>}>
            {!session && runTitle ? (
              <>
                <p className="hm-band-text">{runsToday.length ? `${runKm} km at ${fmtPace(paceSec(runKm, runsToday.reduce((x, y) => x + y.seconds, 0)))} logged today.` : guide?.detail}</p>
                <PillButton variant={runsToday.length ? 'band' : 'accent'} to="/app/log/workout" icon={runsToday.length ? 'check' : 'play'}>{runsToday.length ? 'See your run' : 'Log your run'}</PillButton>
              </>
            ) : session ? (
              <>
                <p className="hm-band-text">{session.exercises.slice(0, 4).map((e) => e.name).join(', ')}{session.exercises.length > 4 ? ' and more' : ''}.</p>
                <MacroBar label="Sets done" consumed={setsDone} target={setsPlanned} unit="" tone="lime" />
                <PillButton variant={session.done ? 'band' : 'accent'} to="/app/log/workout" icon={session.done ? 'check' : 'play'}>
                  {session.done ? 'See the session' : planned?.saved ? 'Continue workout' : 'Start workout'}
                </PillButton>
              </>
            ) : (
              <>
                <p className="hm-band-text">Walk, stretch and still hit your protein. Muscle grows on rest days.</p>
                <PillButton variant="band" to="/app/log/workout" icon="dumbbell">Log a workout anyway</PillButton>
              </>
            )}
          </GlassCard>

          {meal ? (
            <GlassCard variant="band" title={meal.name} aside={<Badge>Planned · {SLOT_LABEL[meal.slot]}</Badge>}>
              <div className="hm-band-macros">
                <Stat value={meal.macros.kcal} unit="kcal" size="md" />
                <Chip tone="band">{fmt(meal.macros.protein)} g protein</Chip>
              </div>
              <PillButton variant="band" to="/app/log" icon="mic">Log {SLOT_LABEL[meal.slot].toLowerCase()}</PillButton>
            </GlassCard>
          ) : (
            <GlassCard variant="band" title={`Next: ${SLOT_LABEL[slotFor(hour)].toLowerCase()}`} aside={<Badge>{r.left >= 0 ? `${fmt(r.left)} kcal left` : `${fmt(-r.left)} kcal over`}</Badge>}>
              <p className="hm-band-text">Say what you ate, in English or Hindi: “do roti, ek katori dal”.</p>
              <PillButton variant="accent" to="/app/log" icon="mic">Log by voice</PillButton>
            </GlassCard>
          )}

          <GlassCard variant="band" title="Daily habits" aside={<Badge>{onTrack} of {habits.length} done</Badge>}>
            <div className="hm-habits">
              {habits.map((h) => <MacroBar key={h.label} label={h.label} consumed={h.value} target={h.target} unit={h.unit} tone="lime" />)}
            </div>
            {w ? null : <Link className="hm-band-link" to="/app/devices">Connect a device for steps and sleep</Link>}
          </GlassCard>
        </DarkBand>
      </div>
    </AppShell>
    </>
  );
}
