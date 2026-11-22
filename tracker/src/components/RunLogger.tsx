import { useState } from 'react';
import { useToast } from './Toast';
import { Icon } from './Icon';
import { Chips, Field } from './Wizard';
import { useStore } from '../state/store';
import { latestWeight } from '../state/selectors';
import { shortDay, today } from '../domain/clock';
import { fmt } from '../domain/nutrition';
import { RUN_KINDS, RUN_LABEL, fmtDuration, fmtPace, paceSec, parseDuration, runKcal, runsOn, validateRun, weekRuns } from '../domain/runs';
import type { RunKind } from '../domain/types';

/**
 * Log a run (S11.3): type, distance and time, with pace and an estimated calorie burn before saving.
 * Shows today's runs (removable) and this week's total. Used on run days, rest days and under a gym session.
 */
export function RunLogger({ title = 'Log a run', kind: initialKind = 'easy', suggestKm, compact = false }: { title?: string; kind?: RunKind; suggestKm?: number; compact?: boolean }) {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const t = today();
  const runs = data.runs ?? [];
  const [kind, setKind] = useState<RunKind>(initialKind);
  const [km, setKm] = useState(suggestKm ? String(suggestKm) : '');
  const [time, setTime] = useState('');
  const [hr, setHr] = useState('');
  const [tried, setTried] = useState(false);
  const [open, setOpen] = useState(!compact);

  const kmN = Number(km);
  const sec = parseDuration(time);
  const err = validateRun(kmN, sec);
  const ok = !err.km && !err.time;
  const weightKg = latestWeight(data)?.kg ?? 70;
  const todays = runsOn(runs, t);
  const week = weekRuns(runs, t);

  const save = () => {
    setTried(true);
    if (!ok || sec === null) return;
    const hrN = Number(hr);
    dispatch({ type: 'logRun', run: { id: newId('run'), date: t, km: Math.round(kmN * 100) / 100, seconds: sec, kind, ...(hrN >= 60 && hrN <= 220 ? { avgHr: Math.round(hrN) } : {}) } });
    toast(`${RUN_LABEL[kind]} run logged · ${kmN} km at ${fmtPace(paceSec(kmN, sec))} · about ${fmt(runKcal(weightKg, kmN))} kcal`, 'good');
    setKm(''); setTime(''); setHr(''); setTried(false);
  };

  return (
    <form className="px-card" style={{ gap: '12px' }} onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="px-card-head">
        <span className="px-card-title">{title}</span>
        <span className="px-meta">{week.count ? `${week.km} km this week · ${week.count} run${week.count > 1 ? 's' : ''}` : 'No runs this week yet'}</span>
      </div>
      {open ? (
        <>
          <Chips label="Run type" options={RUN_KINDS.map((k) => k.label)} value={[RUN_LABEL[kind]]} onChange={([v]) => setKind(RUN_KINDS.find((k) => k.label === v)?.id ?? 'easy')} />
          <div className="px-fields">
            <Field label="Distance" suffix="km" error={tried ? err.km : undefined}>
              <input inputMode="decimal" value={km} placeholder="5" onChange={(e) => setKm(e.target.value.replace(/[^0-9.]/g, ''))} aria-label="Distance in km" />
            </Field>
            <Field label="Time" suffix="min:sec" error={tried ? err.time : undefined}>
              <input inputMode="numeric" value={time} placeholder="mm:ss" onChange={(e) => setTime(e.target.value.replace(/[^0-9:.]/g, ''))} aria-label="Time as minutes or minutes:seconds" />
            </Field>
            <Field label="Average heart rate (optional)" suffix="bpm">
              <input inputMode="numeric" value={hr} placeholder="–" onChange={(e) => setHr(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Average heart rate" />
            </Field>
            <div className="px-field" aria-live="polite">
              <span className="l">Pace · calories (estimate)</span>
              <span className="v">{ok && sec ? <>{fmtPace(paceSec(kmN, sec)).replace(' /km', '')}<span>/km · {fmt(runKcal(weightKg, kmN))} kcal</span></> : <span style={{ marginLeft: 0 }}>Add distance and time</span>}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="px-meta">Counts as a training day for your calories</span>
            <button className="px-cta" type="submit" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', padding: '0 30px' }}>Save run</button>
          </div>
        </>
      ) : (
        <button className="px-pill" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}><Icon name="plus" />Add a run</button>
      )}
      {todays.length ? (
        <div className="px-list">
          {todays.map((r) => (
            <div className="px-row" key={r.id}>
              <span className="px-row-icon"><Icon name="steps" /></span>
              <span className="px-row-main"><span className="px-row-title">{RUN_LABEL[r.kind]} run · {r.km} km</span><span className="px-row-sub">{fmtDuration(r.seconds)} · {fmtPace(paceSec(r.km, r.seconds))}{r.avgHr ? ` · ${r.avgHr} bpm` : ''} · about {fmt(runKcal(weightKg, r.km))} kcal</span></span>
              <span className="px-row-end"><button className="px-icon sm" type="button" aria-label={`Remove ${r.km} km run`} onClick={() => { dispatch({ type: 'removeRun', id: r.id }); toast('Run removed'); }}><Icon name="close" /></button></span>
            </div>
          ))}
        </div>
      ) : null}
      {!compact && week.list.some((r) => r.date !== t) ? (
        <div className="px-list">
          {week.list.filter((r) => r.date !== t).map((r) => (
            <div className="px-row" key={r.id}>
              <span className="px-row-icon"><Icon name="steps" /></span>
              <span className="px-row-main"><span className="px-row-title">{shortDay(r.date)} · {RUN_LABEL[r.kind]} · {r.km} km</span><span className="px-row-sub">{fmtDuration(r.seconds)} · {fmtPace(paceSec(r.km, r.seconds))}</span></span>
            </div>
          ))}
        </div>
      ) : null}
    </form>
  );
}
