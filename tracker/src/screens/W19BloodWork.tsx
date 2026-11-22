import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { useStore } from '../state/store';
import { useAuth } from '../state/auth';
import { callAi, toBase64, useAiStatus } from '../state/ai';
import { addQueueItem } from '../state/cloud';
import { track } from '../state/telemetry';
import { MARKERS, calendarLink, doctorNote, foodChanges, markerDef, matchMarker, needsDoctor, rangeText, recipesFor, statusOf, toStandard } from '../domain/labs';
import { newQueueItem } from '../domain/queue';
import { RECIPES } from '../domain/seed';
import { addDays, today } from '../domain/clock';
import type { LabReport } from '../domain/types';

interface Row { id: string; value: string }
interface Draft { date: string; fileName: string | null; source: 'ai' | 'manual'; rows: Row[]; unmatched: string[] }
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** W19 · Blood work (S18.2, Pro): read a lab report, confirm the numbers, get food changes, a doctor note and a re-test reminder. */
export default function W19BloodWork() {
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const ai = useAiStatus();
  const { data, dispatch, newId } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const sex = data.profile.sex, diet = data.profile.diet;
  const lab = data.labs.find((l) => l.id === viewId) ?? data.labs[0] ?? null;
  const changes = useMemo(() => (lab ? foodChanges(lab.markers, sex, diet) : []), [lab, sex, diet]);
  const helps = useMemo(() => recipesFor(changes, RECIPES, diet), [changes, diet]);

  const manual = (fileName: string | null = null): Draft => ({ date: today(), fileName, source: 'manual', rows: MARKERS.map((m) => ({ id: m.id, value: '' })), unmatched: [] });
  const read = async (f: File | undefined) => {
    setErr('');
    if (!f) return;
    if (!/pdf|image\//.test(f.type)) { setErr('Use a PDF or a photo of the report.'); return; }
    if (f.size > 8 * 1024 * 1024) { setErr('That file is over 8 MB. Export a smaller PDF or take a photo of each page.'); return; }
    if (!ai?.ai) { setDraft(manual(f.name)); toast('Type the numbers from your report; automatic reading isn’t switched on here.'); return; }
    setBusy(true);
    try {
      const out = await callAi<{ date: string | null; markers: { name: string; value: number; unit: string }[] }>('labs', { file: await toBase64(f), mime: f.type === 'image/jpg' ? 'image/jpeg' : f.type }, 90000);
      const rows: Row[] = [], unmatched: string[] = [];
      for (const m of out.markers) {
        const def = matchMarker(m.name);
        if (!def) { unmatched.push(m.name); continue; }
        if (!rows.some((r) => r.id === def.id)) rows.push({ id: def.id, value: String(toStandard(def, m.value, m.unit)) });
      }
      if (!rows.length) { setDraft(manual(f.name)); toast('Couldn’t find the markers we track in that file. Type them in instead.'); return; }
      setDraft({ date: out.date ?? today(), fileName: f.name, source: 'ai', rows, unmatched: unmatched.slice(0, 20) });
    } catch { setDraft(manual(f.name)); toast('Couldn’t read that file. Type the numbers from your report instead.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };

  const save = async () => {
    if (!draft) return;
    const markers = draft.rows.filter((r) => r.value.trim() && Number(r.value) > 0).map((r) => ({ id: r.id, value: Math.round(Number(r.value) * 100) / 100, unit: markerDef(r.id)!.unit }));
    if (!markers.length) { setErr('Add at least one value.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || draft.date > today()) { setErr('Check the report date.'); return; }
    const report: LabReport = { id: newId('lab'), date: draft.date, fileName: draft.fileName, source: draft.source, markers, coachCheck: null, sentForCheck: false, retestOn: addDays(draft.date, 90) };
    dispatch({ type: 'saveLab', lab: report });
    track('labs_saved', { markers: markers.length });
    setDraft(null); setViewId(report.id); setErr('');
    if (auth.user) {
      try {
        await addQueueItem(newQueueItem('labs', { id: report.id, uid: auth.user.uid, member: { name: data.profile.name, plan: data.plan }, title: `${markers.length} markers · ${fmtDate(report.date)}`, detail: report.fileName ?? 'Typed in', payload: { labId: report.id, date: report.date, markers }, nowMs: Date.now() }));
        dispatch({ type: 'saveLab', lab: { ...report, sentForCheck: true } });
        toast('Saved. A coach will check the numbers against your report.', 'good');
      } catch { toast('Saved on this device. The coach check needs Pro and a connection.', 'good'); }
    } else toast('Saved. Sign in to have a coach check the numbers.', 'good');
  };

  const copyNote = async () => { if (!lab) return; try { await navigator.clipboard.writeText(doctorNote(lab, sex, data.profile.name)); toast('Note copied. Paste it in WhatsApp or email to your doctor.', 'good'); } catch { toast('Couldn’t copy. Use Download instead.'); } };
  const download = () => {
    if (!lab) return;
    const url = URL.createObjectURL(new Blob([doctorNote(lab, sex, data.profile.name)], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = `peakx-lab-summary-${lab.date}.txt`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const out = lab ? lab.markers.filter((m) => { const d = markerDef(m.id); return d && statusOf(d, m.value, sex) !== 'normal'; }) : [];
  const doctor = lab ? lab.markers.filter((m) => { const d = markerDef(m.id); return d && needsDoctor(d, m.value); }) : [];
  const filePicker = <input ref={input} type="file" accept="application/pdf,image/*" hidden onChange={(e) => read(e.target.files?.[0])} />;

  return (
    <AppShell active="labs" title="Blood work" crumb={<>{lab ? `Report from ${fmtDate(lab.date)}, checked by a coach` : 'Turn your lab report into food changes'}</>} cols="repeat(12, minmax(0, 1fr))" feature="bloodWork">
      {filePicker}
      {draft ? (
        <div className="wb-col" style={{ gridColumn: 'span 12' }}>
          <div className="px-card" style={{ gap: '12px', maxWidth: '760px' }}>
            <div className="px-card-head"><span className="px-card-title">{draft.source === 'ai' ? 'Check the numbers we read' : 'Type the numbers from your report'}</span><span className="px-meta">{draft.fileName ?? 'No file'}</span></div>
            <span className="px-body grey">{draft.source === 'ai' ? 'Compare each value with your report and fix anything that’s off. Nothing changes until you save.' : 'Fill in the markers your report has; leave the rest empty. Use the units shown.'}</span>
            <label className="px-field" style={{ maxWidth: '260px' }}><span className="l">Report date</span><span className="px-field-row"><input type="date" value={draft.date} max={today()} onChange={(e) => setDraft({ ...draft, date: e.target.value })} aria-label="Report date" /></span></label>
            <div className="px-list">
              {draft.rows.map((r, i) => {
                const def = markerDef(r.id)!;
                const v = Number(r.value);
                const st = r.value && v > 0 ? statusOf(def, v, sex) : null;
                return (
                  <div key={r.id} className="px-row px-lab-row">
                    <span className="px-row-main"><span className="px-row-title">{def.name}</span><span className="px-row-sub">{rangeText(def, sex)}</span></span>
                    <span className="px-field-row px-lab-input"><input inputMode="decimal" value={r.value} onChange={(e) => setDraft({ ...draft, rows: draft.rows.map((x, j) => (j === i ? { ...x, value: e.target.value.replace(/[^\d.]/g, '') } : x)) })} aria-label={`${def.name} in ${def.unit}`} placeholder="–" /><span className="sfx">{def.unit}</span></span>
                    <span className="px-row-end" style={{ minWidth: '64px' }}>{st ? <span className={`px-status ${st === 'normal' ? 'good' : 'over'}`}>{st === 'normal' ? 'Normal' : st === 'low' ? 'Low' : 'High'}</span> : null}</span>
                  </div>
                );
              })}
            </div>
            {draft.source === 'ai' ? <button className="px-pill sm" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setDraft({ ...draft, rows: [...draft.rows, ...MARKERS.filter((m) => !draft.rows.some((r) => r.id === m.id)).map((m) => ({ id: m.id, value: '' }))] })}>Add a marker we missed</button> : null}
            {draft.unmatched.length ? <span className="px-meta">Also on the report, not used yet: {draft.unmatched.join(', ')}</span> : null}
            {err ? <span className="px-err" role="alert">{err}</span> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', padding: '0 22px' }} onClick={() => { setDraft(null); setErr(''); }}>Cancel</button>
              <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', padding: '0 26px' }} onClick={save}>Save report</button>
            </div>
          </div>
        </div>
      ) : !lab ? (
        <div className="wb-col" style={{ gridColumn: 'span 12' }}>
          <div className="px-card" style={{ gap: '12px', maxWidth: '640px' }}>
            <span className="px-card-title">Turn your lab report into food changes</span>
            <span className="px-body grey">Upload a recent blood test. We read Vitamin D, B12, iron, sugar, cholesterol, thyroid and uric acid, you confirm the numbers, and a coach checks them. Not a diagnosis.</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', padding: '0 26px' }} onClick={() => input.current?.click()}>{busy ? 'Reading…' : 'Upload PDF or photo'}</button>
              <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', padding: '0 22px' }} onClick={() => setDraft(manual())}>Type the numbers</button>
            </div>
            {err ? <span className="px-err" role="alert">{err}</span> : null}
          </div>
        </div>
      ) : (
        <>
          <div className="wb-col" style={{ gridColumn: 'span 7' }}>
            <div className="px-lab-top">
              <div className="wb-hero">
                <span className="px-hero-label">Report · {fmtDate(lab.date)}</span>
                <div className="fig"><span className="px-num xl">{out.length}</span><span className="px-suffix">/ {lab.markers.length} markers out of range</span></div>
                <span className="px-meta" style={{ marginTop: '6px' }}>Not a diagnosis. For anything out of range, talk to a doctor.</span>
                {out.length ? <span style={{ marginTop: '6px' }}><span className="px-status over">{out.map((m) => markerDef(m.id)!.name).join(', ')}</span></span> : <span style={{ marginTop: '6px' }}><span className="px-status good">All in range</span></span>}
              </div>
              <div className="wb-drop px-lab-drop">
                <Icon name="doc" />
                <span className="px-row-title">Add a new lab report</span>
                <span className="px-meta">PDF or photo{ai?.ai ? ' · read in about a minute' : ''}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="px-pill" type="button" onClick={() => input.current?.click()}>{busy ? 'Reading…' : 'Choose file'}</button>
                  <button className="px-pill" type="button" onClick={() => setDraft(manual())}>Type it</button>
                </div>
                {err ? <span className="px-err" role="alert">{err}</span> : null}
              </div>
            </div>
            <div className="px-card" style={{ gap: '0' }}>
              <div className="px-card-head"><span className="px-card-title">Markers</span>{data.labs.length > 1 ? <span className="px-meta">{data.labs.length} reports</span> : null}</div>
              <span className="px-subhead">{lab.fileName ? `From ${lab.fileName}` : 'Typed in'} · {lab.coachCheck ? `checked by ${lab.coachCheck.by}` : lab.sentForCheck ? 'waiting for a coach to check' : auth.user ? 'not sent for a coach check' : 'sign in for a coach check'}</span>
              <div className="px-list">
                {lab.markers.map((m) => {
                  const d = markerDef(m.id)!; const st = statusOf(d, m.value, sex);
                  return (
                    <div key={m.id} className="px-row">
                      <span className="px-row-icon"><Icon name={d.icon} /></span>
                      <span className="px-row-main"><span className="px-row-title">{d.name}</span><span className="px-row-sub">{rangeText(d, sex)}</span></span>
                      <span className="px-row-end"><span className="px-row-value">{m.value}{d.unit === '%' ? '%' : ` ${d.unit}`}</span><span className={`px-status ${st === 'normal' ? 'good' : 'over'}`}>{st === 'normal' ? 'Normal' : st === 'low' ? 'Low' : 'High'}</span></span>
                    </div>
                  );
                })}
              </div>
              {lab.coachCheck?.note ? <span className="px-meta" style={{ paddingTop: '8px' }}>Coach: {lab.coachCheck.note}</span> : null}
              {data.labs.length > 1 ? (
                <div className="px-chips" style={{ paddingTop: '10px' }}>
                  {data.labs.map((l) => <button key={l.id} type="button" className={`px-pill sm${l.id === lab.id ? ' on' : ''}`} aria-pressed={l.id === lab.id} onClick={() => setViewId(l.id)}>{fmtDate(l.date)}</button>)}
                </div>
              ) : null}
            </div>
          </div>
          <div className="wb-col" style={{ gridColumn: 'span 5' }}>
            <div className="px-card" style={{ gap: '0' }}>
              <div className="px-card-head"><span className="px-card-title">What to change in your food</span>{helps.length ? <button className="px-pill sm" type="button" onClick={() => navigate(`/app/plan/recipes?open=${helps[0].recipe.id}`)}>In your recipes</button> : null}</div>
              {changes.length ? (
                <div className="px-list">
                  {changes.map((c) => (
                    <div key={c.marker} className="px-row">
                      <span className="px-row-icon"><Icon name={markerDef(c.marker)!.icon} /></span>
                      <span className="px-row-main"><span className="px-row-title">{c.title}</span><span className="px-row-sub">{c.detail}</span></span>
                      <span className="px-row-end"><span className="px-row-value">{c.often}</span></span>
                    </div>
                  ))}
                </div>
              ) : <span className="px-body grey" style={{ padding: '10px 0' }}>Everything is in range, so no changes. Keep eating the way you are.</span>}
              {helps.length ? (
                <>
                  <span className="px-subhead" style={{ paddingTop: '8px' }}>Recipes that help</span>
                  <div className="px-chips">{helps.map((h) => <button key={h.recipe.id} type="button" className="px-pill sm" onClick={() => navigate(`/app/plan/recipes?open=${h.recipe.id}`)}>{h.recipe.name}</button>)}</div>
                </>
              ) : null}
            </div>
            <div className="px-card" style={{ gap: '8px' }}>
              <div className="px-card-head"><span className="px-card-title">Discuss with your doctor</span><span className="px-row-icon"><Icon name="user" /></span></div>
              <span className="px-body">{doctor.length ? `${doctor.map((m) => markerDef(m.id)!.name).join(' and ')} ${doctor.length > 1 ? 'are' : 'is'} far enough out of range that you should see a doctor soon. Food changes alone may not be enough.` : out.length ? `${out.map((m) => markerDef(m.id)!.name).join(' and ')} at these levels ${out.length > 1 ? 'are' : 'is'} often treated with supplements or other care. The dose and how long is your doctor’s call.` : 'Nothing needs a doctor’s attention from these numbers. Share the summary at your next check-up.'}</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="px-pill" type="button" onClick={copyNote}><Icon name="share" style={{ width: '13px', height: '13px' }} /> Copy note</button>
                <button className="px-pill" type="button" onClick={download}><Icon name="download" style={{ width: '13px', height: '13px' }} /> Download summary</button>
              </div>
            </div>
            <div className="px-card" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '14px 18px' }}>
              <span className="px-row-icon"><Icon name="cal" /></span>
              <span className="px-row-main">
                <span className="px-row-title">Re-test in 3 months</span>
                <span className="px-row-sub">{data.reminders.retest ? <>Around {fmtDate(data.reminders.retest)} · <a href={calendarLink(data.reminders.retest)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>add to Google Calendar</a></> : 'Reminder off'}</span>
              </span>
              <button type="button" className={`px-pill sm${data.reminders.retest ? ' on' : ''}`} aria-pressed={!!data.reminders.retest} onClick={() => dispatch({ type: 'setRetest', date: data.reminders.retest ? null : lab.retestOn })}>{data.reminders.retest ? 'On' : 'Off'}</button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
