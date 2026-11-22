import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { Chips } from '../components/Wizard';
import { RunLogger } from '../components/RunLogger';
import { useStore } from '../state/store';
import { addDays, longDate, shortDay, today } from '../domain/clock';
import { clock12 } from '../domain/onboarding';
import { e1rm, fmt } from '../domain/nutrition';
import {
  SESSION_LABELS, buildSession, estimatedMinutes, isPR, lastPerformance, planDay, planWeek, sessionFor, sessionVolume, targetReps, targetSets,
} from '../domain/training';
import { fmtPace, kindForLabel, paceSec, runGuide, runsOn } from '../domain/runs';
import type { WorkoutSession } from '../domain/types';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** W08 · Workout: today's session from the plan, logged set by set with last time's numbers, rest timer and PRs. Run days (S11.3) log a run instead. */
export default function W08Workout() {
  const { data } = useStore();
  const t = today();
  const [override, setOverride] = useState<string | null>(null);
  const planned = sessionFor(data.workouts, data.profile, t, `wo-${t}`, data.trainingOverrides, data.fixPlans);
  const session = planned?.session ?? (override ? buildSession(override, t, data.profile.gymTime, data.workouts, `wo-${t}`, data.trainingOverrides) : null);
  const saved = !!planned?.saved;

  if (!session) return planDay(data.profile, t).run ? <RunDay onTrain={setOverride} /> : <RestDay onTrain={setOverride} />;
  return <Session key={session.id + override} session={session} saved={saved} />;
}

function RestDay({ onTrain }: { onTrain: (label: string) => void }) {
  const { data } = useStore();
  const t = today();
  const next = [...planWeek(data.profile, t), ...planWeek(data.profile, addDays(t, 7))].find((d) => d.date > t && d.training);
  return (
    <AppShell active="log" title="Log" crumb={<>Workout · rest day</>} cols="repeat(12, minmax(0, 1fr))">
      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        <div className="px-card" style={{ gap: '14px', padding: '26px' }}>
          <div className="wb-hero">
            <span className="px-hero-label">{longDate(t)}</span>
            <div className="fig"><span className="px-num xl">Rest</span><span className="px-suffix">day</span></div>
            <span className="px-meta" style={{ marginTop: '6px' }}>{next ? `Next: ${next.label} on ${shortDay(next.date)} at ${clock12(data.profile.gymTime)}` : 'No sessions planned this week'}</span>
          </div>
          <p className="px-body grey" style={{ margin: 0 }}>Muscles grow between sessions. A walk and a good night’s sleep do more today than an extra workout.</p>
          <span className="px-subhead">Training anyway? Pick a session</span>
          <Chips label="Session" options={SESSION_LABELS} value={[]} onChange={([v]) => onTrain(v)} />
        </div>
        <RunLogger title="Went for a run?" />
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 5' }}><WeekPlan /></div>
    </AppShell>
  );
}

/** A planned run (training style Running): what to do today, then log it. */
function RunDay({ onTrain }: { onTrain: (label: string) => void }) {
  const { data } = useStore();
  const t = today();
  const label = planDay(data.profile, t).label;
  const kind = kindForLabel(label);
  const runs = data.runs ?? [];
  const guide = runGuide(kind, runs, t);
  const done = runsOn(runs, t);
  const ran = done.reduce((s, r) => s + r.km, 0);
  return (
    <AppShell active="log" title="Log" crumb={<>Run · {done.length ? 'done' : 'planned'}</>} cols="repeat(12, minmax(0, 1fr))">
      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        <div className="px-card" style={{ gap: '14px', padding: '26px' }}>
          <div className="wb-hero">
            <span className="px-hero-label">{longDate(t)} · {clock12(data.profile.gymTime)}</span>
            <div className="fig"><span className="px-num xl">{done.length ? Math.round(ran * 10) / 10 : guide.km}</span><span className="px-suffix">km · {guide.title.toLowerCase()}{done.length ? ' done' : ''}</span></div>
            {done.length ? <span className="px-meta" style={{ marginTop: '6px' }}>Average pace {fmtPace(paceSec(ran, done.reduce((s, r) => s + r.seconds, 0)))}</span> : null}
          </div>
          <p className="px-body grey" style={{ margin: 0 }}>{guide.detail}</p>
        </div>
        <RunLogger key={kind} title={done.length ? 'Log another run' : `Log today’s ${guide.title.toLowerCase()}`} kind={kind} suggestKm={done.length ? undefined : guide.km} />
        <div className="px-card" style={{ gap: '10px' }}>
          <span className="px-subhead">Lifting today instead? Pick a session</span>
          <Chips label="Session" options={SESSION_LABELS} value={[]} onChange={([v]) => onTrain(v)} />
        </div>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 5' }}><WeekPlan /></div>
    </AppShell>
  );
}

function WeekPlan() {
  const { data } = useStore();
  const t = today();
  return (
    <div className="px-card" style={{ gap: '0' }}>
      <div className="px-card-head"><span className="px-card-title">This week’s plan</span><span className="px-meta">{data.profile.trainingDays} {data.profile.trainingStyle === 'run' ? 'runs' : 'sessions'} · from your setup</span></div>
      <div className="px-list">
        {planWeek(data.profile, t).map((d) => {
          const w = data.workouts.find((x) => x.date === d.date);
          const r = runsOn(data.runs ?? [], d.date);
          const km = Math.round(r.reduce((s, x) => s + x.km, 0) * 10) / 10;
          const sub = [w ? `${w.exercises.reduce((s, e) => s + e.sets.length, 0)} sets · ${fmt(sessionVolume(w))} kg` : '', r.length ? `${km} km run` : ''].filter(Boolean).join(' · ');
          return (
            <div className="px-row" key={d.date}>
              <span className="px-row-icon"><Icon name={d.run || (!w && r.length) ? 'steps' : d.training ? 'dumbbell' : 'moon'} /></span>
              <span className="px-row-main"><span className="px-row-title">{shortDay(d.date)} · {d.label}</span><span className="px-row-sub">{sub || (d.training ? clock12(data.profile.gymTime) : 'Recovery')}</span></span>
              <span className="px-row-end">{d.date === t ? <span className="px-status">Today</span> : w?.done || r.length ? <span className="px-status good">Done</span> : d.date < t && d.training ? <span className="px-status over">Missed</span> : null}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Session({ session: initial, saved }: { session: WorkoutSession; saved: boolean }) {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const t = today();
  // Once started, read the live copy from the store.
  const session = data.workouts.find((w) => w.id === initial.id) ?? data.workouts.find((w) => w.date === t && saved) ?? initial;
  const started = data.workouts.some((w) => w.id === session.id);
  const firstOpen = Math.max(0, session.exercises.findIndex((e) => e.sets.length < targetSets(e)));
  const [active, setActive] = useState(firstOpen);
  const ex = session.exercises[active];
  const lastLog = useMemo(() => lastPerformance(data.workouts, ex.name, t), [data.workouts, ex.name, t]);
  const prevKg = ex.sets.length ? ex.sets[ex.sets.length - 1].kg : ex.targetKg ?? lastLog?.log.sets[0]?.kg ?? 20;
  const [reps, setReps] = useState(String(targetReps(ex)));
  const [kg, setKg] = useState(String(prevKg));
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [warm, setWarm] = useState(false);

  useEffect(() => { setReps(String(targetReps(ex))); setKg(String(prevKg)); /* eslint-disable-next-line */ }, [active, ex.sets.length]);
  useEffect(() => {
    if (!restEnd && !session.startedAt) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [restEnd, session.startedAt]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== 'Enter' || el.closest('input, button, a, textarea, select, [role="dialog"]') || session.done) return;
      e.preventDefault(); logSet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { if (restEnd && now >= restEnd) { setRestEnd(null); toast('Rest over · next set'); } }, [now, restEnd, toast]);

  const restLeft = restEnd ? Math.ceil((restEnd - now) / 1000) : 0;
  const elapsed = session.startedAt ? Math.floor((now - Date.parse(session.startedAt)) / 60000) : 0;
  const totalSets = session.exercises.reduce((s, e) => s + e.sets.length, 0);
  const plannedSets = session.exercises.reduce((s, e) => s + targetSets(e), 0);
  const allDone = session.exercises.every((e) => e.sets.length >= targetSets(e));

  const logSet = () => {
    const r = Number(reps), k = Number(kg);
    if (!(r >= 1 && r <= 50) || !(k >= 0 && k <= 500)) { toast('Enter reps (1–50) and weight (0–500 kg).'); return; }
    if (!started) dispatch({ type: 'startSession', session: { ...session, startedAt: new Date().toISOString() } });
    const set = { reps: r, kg: Math.round(k * 4) / 4 };
    const pr = isPR(data.workouts, ex.name, set, t);
    dispatch({ type: 'logSet', sessionId: session.id, exercise: active, set });
    toast(pr ? `New best on ${ex.name}: estimated 1-rep max ${e1rm(set.kg, set.reps)} kg` : `Set ${ex.sets.length + 1} logged · ${r} × ${set.kg} kg`, pr ? 'good' : 'info');
    const doneNow = ex.sets.length + 1 >= targetSets(ex);
    setRestEnd(Date.now() + ex.restSec * 1000); setNow(Date.now());
    if (doneNow) {
      const nextOpen = session.exercises.findIndex((e, i) => i !== active && e.sets.length < targetSets(e));
      if (nextOpen >= 0) setActive(nextOpen);
    }
  };
  const finish = () => {
    if (!started) { toast('Log at least one set first.'); return; }
    dispatch({ type: 'finishSession', sessionId: session.id });
    const prs = session.exercises.reduce((n, e) => n + e.sets.filter((s) => isPR(data.workouts.filter((w) => w.id !== session.id), e.name, s, t)).length, 0);
    toast(`Session saved · ${totalSets} sets · ${fmt(sessionVolume(session))} kg${prs ? ` · ${prs} PR${prs > 1 ? 's' : ''}` : ''}`, 'good');
    navigate('/');
  };

  const rows = Math.max(targetSets(ex), ex.sets.length + (ex.sets.length >= targetSets(ex) ? 0 : 1));
  return (
    <AppShell active="log" title="Log" crumb={<>Workout · {session.done ? 'done' : started ? 'in progress' : 'ready'}</>} cols="repeat(12, minmax(0, 1fr))">
      <PrintSheet session={session} />
      <div className="wb-col px-later-on-phone" style={{ gridColumn: 'span 5' }}>
        <div style={{ padding: '0 6px' }}>
          <div className="wb-hero">
            <span className="px-hero-label">{session.name} · {shortDay(t)} {longDate(t).split(' ').slice(1).join(' ')}, {clock12(session.time)}</span>
            <div className="fig"><span className="px-num xl">{started ? elapsed : estimatedMinutes(session)}</span><span className="px-suffix">min {started ? 'so far' : 'planned'} · {session.exercises.length} exercises</span></div>
            <span className="px-meta" style={{ marginTop: '6px' }}>{totalSets} of {plannedSets} sets · {fmt(sessionVolume(session))} kg volume</span>
          </div>
        </div>
        <div className="px-card" style={{ gap: '0' }}>
          <div className="px-card-head">
            <span className="px-card-title">{session.exercises.length} exercises</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button className="px-icon sm" type="button" aria-label="Print sheet" title="Print sheet" onClick={() => window.print()}><Icon name="download" /></button>
              <button className="px-pill sm" type="button" aria-expanded={warm} onClick={() => setWarm(!warm)}>Warm-up</button>
            </div>
          </div>
          {warm ? <p className="px-body grey" style={{ margin: '8px 0 4px', fontSize: '14px' }}>5 minutes easy cardio, then for the first lift: 8 reps at 50% and 4 reps at 75% of your working weight.</p> : null}
          <ol className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {session.exercises.map((e, i) => {
              const done = e.sets.length >= targetSets(e);
              return (
                <li key={e.name}>
                  <button type="button" className="px-row px-row-btn" aria-current={i === active ? 'step' : undefined} onClick={() => setActive(i)}>
                    <span className="px-row-icon"><span className={`n${i === active ? ' ring' : ''}`}>{i + 1}</span></span>
                    <span className="px-row-main"><span className="px-row-title">{e.name}</span><span className="px-row-sub">{e.target} · rest {mmss(e.restSec)}{e.note && !e.sets.length ? ` · ${e.note}` : ''}</span></span>
                    <span className="px-row-end">
                      <span className="px-row-value">{e.targetKg ?? '–'} kg</span>
                      <span className={`px-status${done ? ' good' : ''}`}>{done ? 'Done' : i === active ? `Now · set ${e.sets.length + 1}` : e.sets.length ? `${e.sets.length}/${targetSets(e)}` : 'To do'}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <RunLogger title="Running today too?" compact={data.profile.trainingStyle !== 'both' && !(data.runs ?? []).some((r) => r.date === t)} />
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        <form className="px-card" style={{ gap: '12px' }} onSubmit={(e) => { e.preventDefault(); logSet(); }}>
          <div className="px-card-head">
            <span className="px-card-title">{active + 1} of {session.exercises.length} · {ex.name}</span>
            {started ? <span className="px-chip">{elapsed} min elapsed</span> : null}
          </div>
          <div style={{ display: 'flex', gap: '4px' }} aria-hidden="true">
            {session.exercises.map((e, i) => <span key={i} style={{ flexGrow: 1, height: '3px', borderRadius: '2px', background: e.sets.length >= targetSets(e) || i === active ? 'var(--text)' : 'var(--track)' }} />)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
            <div className="wb-hero">
              <span className="px-hero-label">Working weight</span>
              <div className="fig"><span className="px-num xl">{ex.targetKg ?? prevKg}</span><span className="px-suffix">kg · {ex.target}</span></div>
              {ex.note ? <span className="px-meta" style={{ marginTop: '6px' }}>{ex.note}</span> : null}
            </div>
            {restEnd ? (
              <div className="px-pill" role="timer" aria-live="off" aria-label={`Rest timer, ${mmss(restLeft)} left`} style={{ height: '46px', padding: '0 6px 0 16px', gap: '10px' }}>
                Rest <span style={{ font: '700 24px/1 var(--font-display)' }}>{mmss(restLeft)}</span>
                <button className="px-pill sm" type="button" onClick={() => setRestEnd((x) => (x ?? Date.now()) + 30000)}>+30s</button>
                <button className="px-pill sm" type="button" onClick={() => setRestEnd(null)}>Skip</button>
              </div>
            ) : null}
          </div>
          <div className="px-sub">
            <span className="px-subhead" style={{ display: 'block' }}>Target {ex.target}{lastLog ? ` · last time (${shortDay(lastLog.date)}) in grey` : ' · first time on this lift'}</span>
            <ol className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {Array.from({ length: rows }, (_, k) => {
                const s = ex.sets[k];
                const prev = lastLog?.log.sets[k];
                const isInput = !s && k === ex.sets.length;
                const pr = s ? isPR(data.workouts.filter((w) => w.id !== session.id), ex.name, s, t) : false;
                return (
                  <li key={k} className="px-row" style={{ flexWrap: 'wrap', rowGap: '8px' }}>
                    <span className="px-row-icon"><span className={`n${isInput ? ' ring' : ''}`}>{k + 1}</span></span>
                    <span className="px-row-main"><span className="px-row-title">Set {k + 1}</span><span className="px-row-sub" style={{ color: 'var(--text-3)' }}>{prev ? `Last: ${prev.reps} × ${prev.kg}` : 'No previous set'}</span></span>
                    {s ? (
                      <span className="px-row-end" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span className="px-row-value">{s.reps} × {s.kg}</span>
                          <span className={`px-status good`}>{pr ? 'PR' : prev && e1rm(s.kg, s.reps) > e1rm(prev.kg, prev.reps) ? 'Up on last time' : 'Done'}</span>
                        </span>
                        <button className="px-icon sm" type="button" aria-label={`Remove set ${k + 1}`} onClick={() => dispatch({ type: 'removeSet', sessionId: session.id, exercise: active, index: k })}><Icon name="close" /></button>
                      </span>
                    ) : isInput ? (
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
                        <label className="px-field px-setfield"><input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value.replace(/[^0-9]/g, ''))} aria-label={`Set ${k + 1} reps`} /><span className="l">reps</span></label>
                        <label className="px-field px-setfield"><input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value.replace(/[^0-9.]/g, ''))} aria-label={`Set ${k + 1} weight in kg`} style={{ width: '52px' }} /><span className="l">kg</span></label>
                      </span>
                    ) : <span className="px-row-end"><span className="px-status">Planned</span></span>}
                  </li>
                );
              })}
            </ol>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="px-meta">Change reps or weight above if the set went differently</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {allDone || session.done ? null : <span className="px-meta">Press ↵ to log</span>}
              {ex.sets.length < targetSets(ex) + 2 && !session.done ? <button className="px-cta" type="submit" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', padding: '0 36px' }}>Log set {ex.sets.length + 1}</button> : null}
              {started && !session.done ? <button className={`px-cta${allDone ? '' : ' glass'}`} type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', padding: '0 22px' }} onClick={finish}>Finish session</button> : null}
            </div>
          </div>
        </form>
        {(() => {
          const ni = session.exercises.findIndex((e, i) => i > active && e.sets.length < targetSets(e));
          if (ni < 0) return null;
          const n = session.exercises[ni];
          return (
            <button type="button" className="px-card px-next" onClick={() => setActive(ni)}>
              <span className="px-row-icon"><Icon name="dumbbell" /></span>
              <span className="px-row-main"><span className="px-row-title">Next: {n.name}</span><span className="px-row-sub">{n.target} · rest {mmss(n.restSec)}</span></span>
              <span className="px-row-end"><span className="px-row-value">{n.targetKg} kg</span></span>
            </button>
          );
        })()}
      </div>
    </AppShell>
  );
}

/** Print-only gym sheet: exercises, targets, last time and empty boxes to fill in by hand. */
function PrintSheet({ session }: { session: WorkoutSession }) {
  const { data } = useStore();
  return (
    <section className="px-print-sheet" aria-hidden="true">
      <h2>{session.name} · {longDate(session.date)}</h2>
      <p>{data.profile.name} · gym at {clock12(session.time)} · PeakX</p>
      <table>
        <thead><tr><th>Exercise</th><th>Target</th><th>Weight</th><th>Last time</th>{[1, 2, 3, 4].map((i) => <th key={i}>Set {i}</th>)}</tr></thead>
        <tbody>
          {session.exercises.map((e) => {
            const last = lastPerformance(data.workouts, e.name, session.date);
            return (
              <tr key={e.name}>
                <td>{e.name}</td><td>{e.target}</td><td>{e.targetKg ?? ''} kg</td>
                <td>{last ? last.log.sets.map((s) => `${s.reps}×${s.kg}`).join(', ') : '–'}</td>
                {[0, 1, 2, 3].map((k) => <td key={k} className="box">{e.sets[k] ? `${e.sets[k].reps} × ${e.sets[k].kg}` : ''}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
