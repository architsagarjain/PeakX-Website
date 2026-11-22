import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { useStore } from '../state/store';
import { useAuth } from '../state/auth';
import { addQueueItem, uploadFormVideo } from '../state/cloud';
import { track } from '../state/telemetry';
import { LIFTS, MAX_MB, MAX_SECONDS, REVIEW_HOURS, fixCount, recheckDue, videoDuration } from '../domain/formcheck';
import { lastPerformance } from '../domain/training';
import { newQueueItem } from '../domain/queue';
import { addDays, today } from '../domain/clock';
import type { FormCheck } from '../domain/types';
import { GlassCard, EmptyState, Chip, Badge, PillButton } from '../components/ui/blocks';
import { Ring } from '../components/ui/charts';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const mmss = (s: number | null) => (s === null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

/** W17 · Form Check upload (S18.1, Pro): one working set on video, reviewed by a coach within 24 hours. */
export default function W17FormUpload() {
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const { data, dispatch, newId } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const t = today();
  const [lift, setLift] = useState(data.profile.stuckLift && LIFTS.includes(data.profile.stuckLift) ? data.profile.stuckLift : 'Back squat');
  const last = useMemo(() => lastPerformance(data.workouts, lift, addDays(t, 1))?.log.sets.slice().sort((a, b) => b.kg - a.kg)[0], [data.workouts, lift, t]);
  const [kg, setKg] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const due = recheckDue(data.fixPlans, t);

  const kgN = Number(kg || last?.kg || 0), repsN = Number(reps || last?.reps || 0);
  const pick = async (f: File | undefined) => {
    setErr(''); setFile(null); setDuration(null);
    if (!f) return;
    if (!f.type.startsWith('video/')) { setErr('That isn’t a video. Use MP4 or MOV.'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setErr(`That video is ${Math.round(f.size / 1048576)} MB; the limit is ${MAX_MB} MB. Trim it to one set.`); return; }
    const d = await videoDuration(f);
    if (d !== null && d > MAX_SECONDS) { setErr(`That video is ${mmss(d)} long; keep it under ${MAX_SECONDS} seconds. Trim it to one set.`); return; }
    setFile(f); setDuration(d);
  };

  const canSend = !!file && kgN > 0 && repsN > 0 && progress === null;
  const send = async () => {
    if (!file || !auth.user) return;
    const id = newId('fc');
    const check: FormCheck = { id, exercise: lift, kg: kgN, reps: repsN, note: note.trim().slice(0, 200), submittedAt: new Date().toISOString(), fileName: file.name, sizeMB: Math.round(file.size / 104857.6) / 10, durationSec: duration, status: 'uploading', review: null };
    dispatch({ type: 'addFormCheck', check });
    setProgress(0);
    try {
      const videoPath = await uploadFormVideo(auth.user.uid, id, file, setProgress);
      await addQueueItem(newQueueItem('form', { id, uid: auth.user.uid, member: { name: data.profile.name, plan: data.plan }, title: `${lift} · ${kgN} kg × ${repsN}`, detail: check.note || `${check.sizeMB} MB${duration ? ` · ${mmss(duration)}` : ''}`, payload: { formId: id, exercise: lift, kg: kgN, reps: repsN, note: check.note, videoPath, fileName: file.name, durationSec: duration }, nowMs: Date.now() }));
      dispatch({ type: 'updateFormCheck', id, patch: { status: 'queued', videoPath } });
      track('form_check_sent', { lift });
      toast(`Sent. Your coach replies by ${new Date(Date.now() + REVIEW_HOURS * 3_600_000).toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.`, 'good');
      navigate(`/app/reviews/form-check/${id}`);
    } catch (e) {
      dispatch({ type: 'updateFormCheck', id, patch: { status: 'failed' } });
      toast((e as { code?: string }).code?.includes('unauthorized') ? 'Upload refused. Form Check is part of Pro.' : 'Upload didn’t finish. Check your connection and try again.');
    } finally { setProgress(null); }
  };

  const sendLabel = !auth.configured ? 'Needs accounts switched on' : !auth.user ? 'Sign in to send' : progress !== null ? `Uploading ${Math.round(progress * 100)}%` : 'Send to coach';
  const latest = data.formChecks.filter((f) => f.review).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  const trySend = () => { if (!auth.configured) return; if (!auth.user) navigate('/app/sign-up?next=/app/reviews/form-check'); else if (canSend) send(); else setErr(!file ? 'Choose a video first.' : 'Add the weight and reps of the set.'); };
  return (
    <AppShell active="form" title="Form check" crumb={<>Send one working set. A coach replies within {REVIEW_HOURS} hours with what to fix.</>} feature="formCheck">
      {due ? (
        <div className="wb-col" style={{ gridColumn: 'span 12' }}>
          <div className="hm-setup fc-due">
            <span className="hm-setup-icon"><Icon name="video" /></span>
            <div className="hm-setup-text"><b>Time to re-check your {due.lift.toLowerCase()}</b><span>Your fix plan ended {when(due.until)}. Send a new set to see if it worked.</span></div>
            <div className="hm-setup-actions"><PillButton size="sm" onClick={() => { setLift(due.lift); dispatch({ type: 'removeFixPlan', id: due.id }); }}>Re-check</PillButton></div>
          </div>
        </div>
      ) : null}
      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <GlassCard className="fc-upload" title={<span className="in-title"><Icon name="video" />Record or upload a set</span>} aside={<Badge>Reviewed by a coach</Badge>}>
          <div className="fc-tips">
            {[['phone', 'Side view, phone at hip height', 'About 45° from the side, 3–4 metres away. Prop it on a bench or bag.'], ['scan', 'Whole body in frame', 'Head to feet and the whole bar path visible.'], ['dumbbell', 'One working set', '3–5 reps at your normal working weight, not a warm-up.']].map(([icon, t1, m]) => (
              <div key={t1} className="fc-tip"><Icon name={icon} /><div><b>{t1}</b><span>{m}</span></div></div>
            ))}
          </div>
          <div className="fc-form">
            <div className="px-fields px-fields-3">
              <label className="px-field"><span className="l">Lift</span><span className="px-field-row"><select value={lift} onChange={(e) => { setLift(e.target.value); setKg(''); setReps(''); }} aria-label="Lift">{LIFTS.map((l) => <option key={l}>{l}</option>)}</select></span></label>
              <label className="px-field"><span className="l">Weight</span><span className="px-field-row"><input inputMode="decimal" value={kg} placeholder={last ? String(last.kg) : '0'} onChange={(e) => setKg(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Weight in kg" /><span className="sfx">kg</span></span></label>
              <label className="px-field"><span className="l">Reps</span><span className="px-field-row"><input inputMode="numeric" value={reps} placeholder={last ? String(last.reps) : '0'} onChange={(e) => setReps(e.target.value.replace(/\D/g, ''))} aria-label="Reps" /><span className="sfx">reps</span></span></label>
            </div>
            <input ref={camera} type="file" accept="video/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <input ref={input} type="file" accept="video/mp4,video/quicktime,video/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            {!file ? (
              <div className="fc-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
                <span className="fc-drop-text"><b>Drop a video of one set here</b><span>MP4 or MOV · up to {MAX_SECONDS} seconds and {MAX_MB} MB</span></span>
                <div className="fc-drop-actions">
                  <PillButton icon="camera" onClick={() => camera.current?.click()}>Record with camera</PillButton>
                  <PillButton variant="ghost" icon="upload" onClick={() => input.current?.click()}>Upload video</PillButton>
                </div>
              </div>
            ) : (
              <div className="fc-file">
                <span className="lg-item-icon"><Icon name="video" /></span>
                <span className="fc-file-main"><b>{file.name}</b><span>{[mmss(duration), `${Math.round(file.size / 104857.6) / 10} MB`].filter(Boolean).join(' · ')}</span></span>
                {progress !== null ? <b className="fc-pct">{Math.round(progress * 100)}%</b> : <Chip tone="lime">Ready</Chip>}
                {progress === null ? <button className="lg-x" type="button" aria-label="Remove video" onClick={() => { setFile(null); if (input.current) input.current.value = ''; if (camera.current) camera.current.value = ''; }}><Icon name="close" /></button> : null}
                {progress !== null ? <div className="ui-track fc-progress"><span className="t-lime" style={{ width: `${progress * 100}%` }} /></div> : null}
              </div>
            )}
            {err ? <span className="px-err" role="alert">{err}</span> : null}
            <label className="px-field"><span className="l">Anything the coach should know? (optional)</span><span className="px-field-row"><input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Set 3 of 4, felt my knees cave" aria-label="Note for the coach" /></span></label>
            <div className="fc-send">
              <span className="ui-label">{auth.configured ? 'Only you and your coach can see the video.' : 'Form Check needs accounts and video storage switched on for this site.'}</span>
              <PillButton onClick={trySend} disabled={!auth.configured} icon="share">{sendLabel}</PillButton>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 5' }}>
        {latest?.review ? (
          <GlassCard title={<span className="ui-label">Latest review</span>} aside={<Badge>{when(latest.submittedAt)}</Badge>}>
            <div className="fc-score">
              <div><span className="ui-label">{latest.exercise} · {latest.kg} kg × {latest.reps}</span><b>{latest.review.score} / 100</b></div>
              <Ring pct={latest.review.score / 100} size={72} stroke={6} label={`Coach score ${latest.review.score} out of 100`}><b className="fc-ring">{latest.review.score}</b></Ring>
            </div>
            <p className="fc-verdict"><b>{latest.review.coach}:</b> {latest.review.summary}</p>
            <PillButton variant="ghost" to={`/app/reviews/form-check/${latest.id}`}>Open the review</PillButton>
          </GlassCard>
        ) : (
          <GlassCard title={<span className="ui-label">How it works</span>}>
            <ol className="fc-steps">
              <li><b>Send one set</b><span>Filmed from the side, whole body in frame.</span></li>
              <li><b>A coach reviews it</b><span>Within {REVIEW_HOURS} hours: what’s good, what to fix, and one cue.</span></li>
              <li><b>Add the fix plan</b><span>Warm-up drills and a load change go into your sessions until the re-check.</span></li>
            </ol>
          </GlassCard>
        )}
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        <GlassCard title="Form history" aside={<Badge>{data.formChecks.length} check{data.formChecks.length === 1 ? '' : 's'}</Badge>}>
          {data.formChecks.length ? (
            <ul className="fc-history">
              {data.formChecks.map((f) => (
                <li key={f.id}>
                  <Link to={`/app/reviews/form-check/${f.id}`}>
                    <span className="lg-item-icon"><Icon name="video" /></span>
                    <span className="fc-file-main"><b>{f.exercise}</b><span>{when(f.submittedAt)} · {f.kg} kg × {f.reps}</span></span>
                    {f.review ? <span className="fc-hist-end"><b>{f.review.score} / 100</b>{fixCount(f.review) ? <Chip tone="coral">{fixCount(f.review)} to fix</Chip> : <Chip tone="lime">Good</Chip>}</span>
                      : <Chip tone={f.status === 'failed' ? 'coral' : 'neutral'}>{f.status === 'failed' ? 'Upload failed' : f.status === 'uploading' ? 'Uploading' : f.status === 'in_review' ? 'In review' : 'Waiting for coach'}</Chip>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon="video" text="Your checks and coach reviews show up here." />}
        </GlassCard>
      </div>
    </AppShell>
  );
}
