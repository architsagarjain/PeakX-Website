import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { Chips } from '../components/Wizard';
import { BarChart, ChartEmpty } from '../components/Charts';
import { useStore } from '../state/store';
import { callAi, useAiStatus } from '../state/ai';
import { SETS_RANGE, caloriesByWeekday, findings, proteinByDay, setsPerMuscle, sleepBuckets, sleepVsLift, type Finding } from '../state/analytics';
import { MAIN_LIFTS } from '../state/insights';
import { dayNum, parse, today } from '../domain/clock';
import { toCsv } from '../domain/export';

const RANGES: [string, number][] = [['Last 4 weeks', 28], ['Last 8 weeks', 56]];
const lbl = (d: string) => `${dayNum(d)} ${parse(d).toLocaleDateString('en-GB', { month: 'short' })}`;

/** W15 · Detailed analytics (S16.2, Pro): the charts that explain a plateau, and three findings. */
export default function W15Analytics() {
  const { data } = useStore();
  const navigate = useNavigate();
  const ai = useAiStatus();
  const t = today();
  const [days, setDays] = useState(28);
  const lifts = MAIN_LIFTS.filter((n) => data.workouts.some((w) => w.exercises.some((e) => e.name === n && e.sets.length)));
  const [lift, setLift] = useState(lifts[0] ?? 'Bench press');
  const wd = useMemo(() => caloriesByWeekday(data, t, days), [data, t, days]);
  const protein = useMemo(() => proteinByDay(data, t, days), [data, t, days]);
  const pairs = useMemo(() => sleepVsLift(data, lift, t, days), [data, lift, t, days]);
  const buckets = sleepBuckets(pairs);
  const sets = useMemo(() => setsPerMuscle(data, t, days), [data, t, days]);
  const base = useMemo(() => findings(data, t, days, lift), [data, t, days, lift]);
  const [worded, setWorded] = useState<Record<string, { title: string; detail: string }>>({});

  useEffect(() => {
    if (!ai?.ai || !base.length) return;
    let live = true;
    callAi<{ findings: { id: string; title: string; detail: string }[] }>('findings', { findings: base.map(({ id, title, detail, numbers }) => ({ id, title, detail, numbers })) })
      .then((r) => { if (live) setWorded(Object.fromEntries(r.findings.map((f) => [f.id, f]))); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [ai?.ai, base]);

  const shown: Finding[] = base.map((f) => ({ ...f, ...(worded[f.id] ?? {}) }));
  const exportCsv = () => {
    const csv = [
      'Calories by weekday', toCsv(['weekday', 'avg_kcal', 'avg_target'], wd.map((x) => [x.label, x.kcal, x.target])),
      'Protein by day', toCsv(['date', 'protein_g'], protein.map((x) => [x.date, x.protein])),
      `Sleep before ${lift}`, toCsv(['date', 'sleep_h', 'reps_completed_pct', 'top_kg'], pairs.map((p) => [p.date, p.sleep, p.completion, p.kg])),
      'Weekly sets per muscle', toCsv(['muscle', 'sets_per_week'], sets.map((s) => [s.muscle, s.perWeek])),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `peakx-analytics-${t}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <AppShell active="insights" title="Insights" crumb={<>Detailed analytics <span className="px-pro" style={{ marginLeft: '6px' }}>Pro</span></>} cols="repeat(12, minmax(0, 1fr))" feature="analytics">
      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '0 4px' }}>
          <Chips label="Range" options={RANGES.map((r) => r[0])} value={[RANGES.find((r) => r[1] === days)![0]]} onChange={([v]) => setDays(RANGES.find((r) => r[0] === v)![1])} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="px-pill" type="button" onClick={() => navigate('/app/insights')}>Basic charts</button>
            <button className="px-pill" type="button" onClick={exportCsv}><Icon name="download" /> Export CSV</button>
          </div>
        </div>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <section className="px-card" style={{ gap: '4px' }} aria-label="Findings">
          <div className="px-card-head"><span className="px-card-title">What changes because of this</span><span className="px-meta">{ai?.ai && Object.keys(worded).length ? 'Worded by the AI Coach from your numbers' : 'From your logs'}</span></div>
          {shown.length ? (
            <ol className="px-findings">
              {shown.map((f, i) => (
                <li key={f.id}><span className="lp-n" style={{ fontSize: '28px' }}>{i + 1}</span><div><span className="px-card-title" style={{ fontSize: '19px', lineHeight: '24px' }}>{f.title}</span><span className="px-body grey">{f.detail}</span></div></li>
              ))}
            </ol>
          ) : <ChartEmpty>Nothing stands out yet. Log food and workouts for two weeks and findings appear here.</ChartEmpty>}
          {shown.length ? <button className="px-pill" type="button" style={{ alignSelf: 'flex-start', marginTop: '6px' }} onClick={() => navigate('/app/reviews/weekly/latest')}>See this week’s report</button> : null}
        </section>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 6' }}>
        <section className="px-card" style={{ gap: '8px' }} aria-label="Calories by weekday">
          <div className="px-card-head"><span className="px-card-title">Calories by weekday</span><span className="px-meta">Average eaten · pink = 150+ kcal over</span></div>
          <BarChart unit="kcal" target={Math.round(wd.reduce((s, x) => s + x.target, 0) / 7)} targetLabel="Avg target" label="Average calories by weekday"
            bars={wd.map((x) => ({ label: x.label, value: x.kcal, tone: x.kcal !== null && x.kcal - x.target > 150 ? 'over' : 'past' }))} empty="Log meals to compare weekdays." />
        </section>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 6' }}>
        <section className="px-card" style={{ gap: '8px' }} aria-label="Sleep against lifts">
          <div className="px-card-head">
            <span className="px-card-title">Sleep against {lift.toLowerCase()}</span>
            {lifts.length > 1 ? <Chips label="Lift" options={lifts} value={[lift]} onChange={([v]) => setLift(v)} /> : null}
          </div>
          {data.devices.google || data.devices.strava ? (
            <BarChart unit="% of planned reps" label={`Share of planned ${lift} reps completed, by sleep the night before`}
              bars={buckets.map((b) => ({ label: `${b.label} (${b.sessions})`, value: b.completion, tone: b.label === 'Under 6 h' ? 'over' : 'past' }))} empty={`No ${lift.toLowerCase()} sessions with sleep data yet.`} />
          ) : <ChartEmpty>Connect a wearable to compare sleep with your lifts.</ChartEmpty>}
          <span className="px-meta">Bars show the share of planned reps you finished; the number of sessions is in brackets.</span>
        </section>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 6' }}>
        <section className="px-card" style={{ gap: '8px' }} aria-label="Protein by day">
          <div className="px-card-head"><span className="px-card-title">Protein by day</span><span className="px-meta">Target {data.targets.protein} g</span></div>
          <BarChart unit="g" target={data.targets.protein} label="Protein per day"
            bars={protein.map((x) => ({ label: lbl(x.date), value: x.protein, tone: x.protein !== null && x.protein < data.targets.protein * 0.9 ? 'over' : 'past' }))} empty="Log meals to see protein by day." />
        </section>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 6' }}>
        <section className="px-card" style={{ gap: '8px' }} aria-label="Weekly sets per muscle">
          <div className="px-card-head"><span className="px-card-title">Weekly sets per muscle</span><span className="px-meta">{SETS_RANGE[0]}–{SETS_RANGE[1]} is the usual range for growth</span></div>
          <BarChart unit="sets a week" dp={1} target={SETS_RANGE[0]} targetLabel="Low end" label="Hard sets per muscle per week"
            bars={sets.map((s) => ({ label: s.muscle, value: s.perWeek || null, tone: s.perWeek < SETS_RANGE[0] ? 'over' : 'past' }))} empty="Log workouts to count sets per muscle." />
        </section>
      </div>
    </AppShell>
  );
}
