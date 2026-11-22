import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { BarChart } from '../components/Charts';
import { useStore } from '../state/store';
import { plateauSummary, weightAvg7 } from '../state/selectors';
import { MAIN_LIFTS, dailySeries, liftSeries, liftSummary, periodSummary, syncStatus, trainingHeatmap, weeklyBuckets } from '../state/insights';
import { addDays, dayNum, parse, today } from '../domain/clock';
import { fmt } from '../domain/nutrition';
import { emptySupplements } from '../domain/supplements';
import { GlassCard, Stat, EmptyState, Chip, Badge, PillButton } from '../components/ui/blocks';
import { BarSpark, ComboChart, Heatmap, Sparkline } from '../components/ui/charts';

const RANGES: [string, number][] = [['Last 7 days', 7], ['Last 4 weeks', 28], ['Last 8 weeks', 56]];
const lbl = (d: string) => `${dayNum(d)} ${parse(d).toLocaleDateString('en-GB', { month: 'short' })}`;
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** W14 · Insights · Free. Averages for the period, calories against weight by week, training consistency, lifts, plateau check and device sync. */
export default function W14Insights() {
  const { data } = useStore();
  const t = today();
  const [days, setDays] = useState(28);
  const [lift, setLift] = useState<string | null>(null);
  const series = useMemo(() => dailySeries(data, t, days), [data, t, days]);
  const sum = useMemo(() => periodSummary(data, t, days), [data, t, days]);
  const weeks = useMemo(() => weeklyBuckets(data, t, 8), [data, t]);
  const heat = useMemo(() => trainingHeatmap(data.workouts, t, 12), [data.workouts, t]);
  const sync = syncStatus(data);
  const plateau = plateauSummary(data);
  const supps = data.supplements ?? emptySupplements();
  const avgTarget = Math.round(series.reduce((s, x) => s + x.target, 0) / series.length);
  const kcalDiff = sum.kcalIn.now !== null ? Math.round(sum.kcalIn.now - avgTarget) : null;
  const wNow = weightAvg7(data, t);
  const wFirst = weeks.find((w) => w.weight !== null)?.weight ?? null;
  const thisWeekVol = weeks[7].volume, lastWeekVol = weeks[6].volume;
  const volChange = lastWeekVol ? Math.round(((thisWeekVol - lastWeekVol) / lastWeekVol) * 100) : null;
  const sleepNights = series.filter((x) => x.sleep !== null);
  const sleepAtGoal = sleepNights.length ? Math.round((sleepNights.filter((x) => x.sleep! >= data.targets.sleepHours).length / sleepNights.length) * 100) : null;
  const lifts = MAIN_LIFTS.map((n) => liftSummary(data.workouts, n, t, Math.max(days, 28))).filter((x): x is NonNullable<typeof x> => !!x);
  const shownLift = lift ?? lifts[0]?.name ?? null;
  const wearable = data.devices.google || data.devices.strava;
  const hasWeeks = weeks.some((w) => w.kcal !== null || w.weight !== null);

  return (
    <AppShell
      active="insights" title="Insights" crumb={<>Your progress over the {RANGES.find((r) => r[1] === days)![0].toLowerCase()}</>}
      headAside={(
        <div className="lg-mode-toggle" role="radiogroup" aria-label="Range">
          {RANGES.map(([l, n]) => <button key={n} type="button" role="radio" aria-checked={days === n} className={days === n ? 'on' : undefined} onClick={() => setDays(n)}>{l}</button>)}
        </div>
      )}
    >
      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <div className="hm-quad in-stats">
          <GlassCard title={<span className="ui-label">Average daily calories</span>} aside={kcalDiff !== null ? <Chip tone={Math.abs(kcalDiff) <= avgTarget * 0.05 ? 'lime' : 'neutral'}>{Math.abs(kcalDiff) <= avgTarget * 0.05 ? 'On target' : kcalDiff < 0 ? 'Under target' : 'Over target'}</Chip> : null}>
            <Stat value={sum.kcalIn.now !== null ? Math.round(sum.kcalIn.now) : null} unit="kcal" size="md" empty="Log meals to see your average."
              caption={kcalDiff !== null ? `${fmt(Math.abs(kcalDiff))} kcal ${kcalDiff < 0 ? 'below' : 'above'} your ${fmt(avgTarget)} target · ${sum.daysLogged} of ${days} days logged` : undefined} />
            {sum.kcalIn.now !== null ? <div className="ui-track"><span className="t-lime" style={{ width: `${Math.min(100, (sum.kcalIn.now / avgTarget) * 100)}%` }} /></div> : null}
          </GlassCard>
          <GlassCard title={<span className="ui-label">Weekly training volume</span>} aside={volChange !== null ? <Chip tone={volChange >= 0 ? 'lime' : 'neutral'}>{sign(volChange)}{Math.abs(volChange)}% this week</Chip> : null}>
            <Stat value={thisWeekVol ? thisWeekVol / 1000 : null} dp={1} unit="tonnes" size="md" caption={thisWeekVol ? 'Weight × reps across every set this week' : undefined} empty="Log a workout to see volume." />
            {weeks.some((w) => w.volume) ? <BarSpark values={weeks.slice(-6).map((w) => w.volume)} highlight={5} height={36} label="Training volume, last 6 weeks" /> : null}
          </GlassCard>
          <GlassCard title={<span className="ui-label">Resting heart rate</span>} aside={sync.connected && sum.restingHr !== null ? <Badge>Average</Badge> : null}>
            <Stat value={sum.restingHr !== null ? Math.round(sum.restingHr) : null} unit="bpm" size="md" caption={sum.restingHr !== null ? 'Synced from your watch' : undefined} empty="Connect Fitbit or Google Fit to see it." />
            {sum.restingHr !== null ? <Sparkline values={data.wearable.filter((w) => w.date > addDays(t, -days)).sort((a, b) => a.date.localeCompare(b.date)).map((w) => w.restingHr)} label="Resting heart rate over the period" height={36} fluid /> : null}
          </GlassCard>
          <GlassCard title={<span className="ui-label">Average sleep</span>} aside={sleepAtGoal !== null ? <Chip tone={sleepAtGoal >= 70 ? 'lime' : 'neutral'}>{sleepAtGoal}% of nights at goal</Chip> : null}>
            <Stat value={sum.sleep.now !== null ? Math.round(sum.sleep.now * 10) / 10 : null} dp={1} unit="h" size="md" caption={sum.sleep.now !== null ? `Goal ${data.targets.sleepHours} h a night` : undefined} empty="Connect a watch to see sleep." />
            {sum.sleep.now !== null ? <Sparkline values={series.map((x) => x.sleep)} label="Sleep per night over the period" height={36} fluid /> : null}
          </GlassCard>
        </div>
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        <GlassCard title="Calories vs. weight" aside={<div className="in-legend"><span className="sw bar" />Calories<span className="sw line" />Weight</div>}>
          <span className="ui-stat-cap">{wFirst !== null && wNow !== null ? `Weight moved from ${wFirst} kg to ${wNow} kg over 8 weeks, against your weekly average calories.` : 'Weekly average calories against your weight, over 8 weeks.'}</span>
          {hasWeeks ? (
            <>
              <ComboChart
                bars={weeks.map((w) => w.kcal)} line={weeks.map((w) => w.weight)} lineUnit=" kg"
                labels={weeks.map((w, i) => (i === 7 ? 'This wk' : lbl(w.start)))}
                highlight={weeks.map((w, i) => (w.kcal !== null && Math.abs(w.kcal - avgTarget) <= avgTarget * 0.05 ? i : -1)).filter((i) => i >= 0)}
                label={`Weekly average calories and weight for the last 8 weeks${wNow !== null ? `; weight now ${wNow} kg` : ''}`}
              />
              <div className="in-chart-foot">
                {wNow !== null ? <Chip tone="band">Current: {wNow} kg</Chip> : null}
                <span className="ui-label">Lime bars are weeks within 5% of your calorie target</span>
              </div>
            </>
          ) : <EmptyState icon="trend" text="Log meals and a few weigh-ins to see how they move together." action={{ label: 'Log a meal', to: '/app/log' }} />}
        </GlassCard>
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 5' }}>
        <GlassCard
          variant={plateau.top && plateau.top.level !== 'Low' ? 'coral' : 'light'} className="in-plateau"
          title={<span className="in-title"><Icon name="target" />Plateau check</span>}
          aside={plateau.top ? <Badge tone={plateau.top.level === 'Low' ? 'neutral' : 'warn'}>{plateau.top.level} likelihood</Badge> : null}
        >
          {plateau.done && plateau.top ? (
            <>
              <div className="in-note">{plateau.headline}. {plateau.top.evidence}.</div>
              <div className="in-next"><Icon name="spark" /><div><span className="ui-label">Next step</span><span>{plateau.top.fix}</span></div></div>
            </>
          ) : <div className="in-note">Eight questions about sleep, food and training. You get the likely cause of a stall and what to change.</div>}
          <PillButton to="/app/plateau-check" icon="play" className="in-full">{plateau.done ? 'Run plateau check again' : 'Take the plateau check'}</PillButton>
          <PillButton variant="ghost" to="/app/insights/analytics" className="in-full">Detailed analytics{data.plan === 'free' ? <Badge kind="pro" /> : null}</PillButton>
        </GlassCard>
        <GlassCard
          className="in-supps" to="/app/insights/supplements"
          title={<span className="in-title"><Icon name="hex" />Supplement protocol</span>}
          aside={supps.completedOn ? <Badge>Built {dayNum(supps.completedOn)} {parse(supps.completedOn).toLocaleDateString('en-GB', { month: 'short' })}</Badge> : <Badge>3 min</Badge>}
          linkLabel={supps.completedOn ? 'Open your supplement protocol' : 'Take the supplement check'}
        >
          <div className="in-note">{supps.completedOn
            ? 'What to take, how much, when and which brand, from your answers and blood work.'
            : 'Ten quick questions, plus your blood work if you have it. Get what to take, the dose and which brand to buy.'}</div>
        </GlassCard>
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        <GlassCard title="Workout consistency" aside={<Badge>{heat.sessions} workout{heat.sessions === 1 ? '' : 's'} in 12 weeks</Badge>}>
          <span className="ui-stat-cap">Each square is a day; darker means more volume.</span>
          {heat.sessions ? (
            <>
              <Heatmap rows={heat.rows} rowLabels={WEEKDAYS} colLabels={heat.starts.map((_, i) => `W${i + 1}`)} label={`Training days over the last 12 weeks: ${heat.sessions} workouts`} />
              <div className="in-legend"><span className="sw l0" />Rest<span className="sw l2" />Lighter<span className="sw l4" />Heavier</div>
            </>
          ) : <EmptyState icon="dumbbell" text="Log your workouts to build a 12-week picture." action={{ label: 'Log a workout', to: '/app/log/workout' }} />}
        </GlassCard>
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 5' }}>
        <GlassCard title="Lifts" aside={<span className="ui-label">Estimated 1-rep max</span>}>
          {lifts.length ? (
            <ul className="in-lifts">
              {lifts.map((l) => (
                <li key={l.name}>
                  <button type="button" aria-pressed={shownLift === l.name} onClick={() => setLift(l.name)}>
                    <span className="in-lift-main"><b>{l.name}</b><span>{l.top.kg} kg × {l.top.reps} · {l.stalled ? `${l.flatWeeks} weeks flat` : `${l.sessions} sessions`}</span></span>
                    <Sparkline values={liftSeries(data.workouts, l.name, t, Math.max(days, 28)).map((p) => p.e1rm)} label={`${l.name} estimated 1-rep max`} width={90} height={30} tone={l.stalled ? 'coral' : 'ink'} />
                    <span className="in-lift-end"><b>{l.best} kg</b>{l.stalled ? <Chip tone="coral">Stalled</Chip> : <Chip tone={l.changePct > 0 ? 'lime' : 'neutral'}>{l.changePct > 0 ? `+${l.changePct}%` : 'Steady'}</Chip>}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="dumbbell" text="Log a workout to track bench, squat and deadlift." action={{ label: 'Log a workout', to: '/app/log/workout' }} />}
        </GlassCard>
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 6' }}>
        <GlassCard title="Protein by day" aside={<span className="ui-label">Target {data.targets.protein} g</span>}>
          <BarChart height={140} unit="g" target={data.targets.protein} label={`Protein per day over the last ${days} days`}
            bars={series.map((x) => ({ label: lbl(x.date), value: x.protein, tone: x.date === t ? 'current' : 'past' }))} empty="Log meals to see protein by day." />
        </GlassCard>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 6' }}>
        <GlassCard title="Steps by day" aside={<span className="ui-label">Goal {fmt(data.targets.steps)}</span>}>
          {wearable ? <BarChart height={140} unit="steps" target={data.targets.steps} targetLabel="Goal" label={`Steps per day over the last ${days} days`}
            bars={series.map((x) => ({ label: lbl(x.date), value: x.steps, tone: x.date === t ? 'current' : 'past' }))} empty="No step data yet." />
            : <EmptyState icon="steps" text="Connect Fitbit or Google Fit to see steps." action={{ label: 'Connect', to: '/app/devices' }} />}
        </GlassCard>
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <GlassCard title="Connected apps" aside={<PillButton variant="ghost" size="sm" icon="plus" to="/app/devices">{sync.connected ? 'Manage devices' : 'Connect an app'}</PillButton>}>
          <span className="ui-stat-cap">Where your steps, sleep and heart rate come from.</span>
          <div className="in-apps">
            <div className="in-app">
              <div className="in-app-head">
                <span className="in-app-icon"><Icon name="pulse" /></span>
                <div><b>Fitbit and Google Fit</b><span>{sync.connected ? (sync.lastSync ? `Last synced ${sync.lastSync === t ? 'today' : lbl(sync.lastSync)}` : 'Connected, waiting for the first sync') : 'Not connected'}</span></div>
                {sync.connected ? <Chip tone="lime">Connected</Chip> : <Badge>Off</Badge>}
              </div>
              {sync.connected && sync.latest ? (
                <dl className="in-app-kv">
                  <div><dt>Steps</dt><dd>{fmt(sync.latest.steps)}</dd></div>
                  <div><dt>Sleep</dt><dd>{sync.latest.sleepHours} h</dd></div>
                  <div><dt>Resting heart rate</dt><dd>{sync.latest.restingHr} bpm</dd></div>
                  <div><dt>Active minutes</dt><dd>{sync.latest.activeMinutes} min</dd></div>
                </dl>
              ) : <span className="ui-label">Steps add to your calorie target, and sleep shapes your weekly report.</span>}
            </div>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}
