import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { useStore } from '../state/store';
import { useAuth } from '../state/auth';
import { formVideoUrl } from '../state/cloud';
import { track } from '../state/telemetry';
import { fixPlanFrom, REVIEW_HOURS } from '../domain/formcheck';
import { addDays, today } from '../domain/clock';
import { GlassCard, DarkBand, EmptyState, Chip, Badge, PillButton } from '../components/ui/blocks';
import { Ring } from '../components/ui/charts';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const dayLabel = (d: string) => when(`${d}T12:00:00`);

/** W18 · Form Check report (S18.1): the coach's results and fix plan; the drills go into training in one click. */
export default function W18FormReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const { data, dispatch } = useStore();
  const check = data.formChecks.find((f) => f.id === id);
  const [video, setVideo] = useState<string | null>(null);
  useEffect(() => { if (check?.videoPath && auth.user) formVideoUrl(check.videoPath).then(setVideo).catch(() => setVideo(null)); }, [check?.videoPath, auth.user]);
  useEffect(() => { if (check && check.status !== 'reviewed') auth.refreshQueue(); }, [check?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!check) {
    return (
      <AppShell active="form" title="Form check" crumb={<>Coach review</>} cols="minmax(0, 1fr)" feature="formCheck">
        <GlassCard style={{ maxWidth: '560px' }}><EmptyState icon="video" text="This check isn’t on this device. It may have been sent from another device before you signed in." action={{ label: 'All form checks', to: '/app/reviews/form-check' }} /></GlassCard>
      </AppShell>
    );
  }
  const r = check.review;
  const plan = data.fixPlans.find((p) => p.source === check.id);
  const from = addDays(today(), 1);
  const hours = r ? Math.max(1, Math.round((new Date(r.at).getTime() - new Date(check.submittedAt).getTime()) / 3_600_000)) : 0;
  const add = () => {
    const p = fixPlanFrom(check, from);
    if (!p) return;
    dispatch({ type: 'addFixPlan', plan: p });
    track('fix_plan_added', { lift: check.exercise });
    toast(`Fix plan added to every ${check.exercise.toLowerCase()} session until ${dayLabel(p.until)}`, 'good');
  };

  const flagged = r ? r.findings.filter((f) => !f.ok) : [];
  const good = r ? r.findings.filter((f) => f.ok) : [];
  const status = check.status === 'failed' ? 'The upload didn’t finish' : check.status === 'in_review' ? 'Your coach is reviewing it' : 'Waiting for your coach';
  return (
    <AppShell
      active="form" title="Form check" feature="formCheck"
      crumb={<>{check.exercise} · {check.kg} kg × {check.reps} · {when(check.submittedAt)}</>}
      headAside={<PillButton variant="ghost" size="sm" icon="back" to="/app/reviews/form-check">All form checks</PillButton>}
    >
      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        <div className="fc-video">
          {video ? <video src={video} controls playsInline preload="metadata" aria-label={`Video of ${check.exercise}`} /> : (
            <div className="fc-video-empty">
              <span className="co-avatar"><Icon name="video" /></span>
              <b>{check.fileName}{check.durationSec ? ` · ${Math.floor(check.durationSec / 60)}:${String(check.durationSec % 60).padStart(2, '0')}` : ''}</b>
              <span>{auth.user ? 'Video stays with your account' : 'Sign in to watch the video here'}</span>
            </div>
          )}
          {r ? <div className="fc-video-chips">{r.findings.slice(0, 3).map((f) => <Chip key={f.title} tone={f.ok ? 'lime' : 'coral'}>{f.title}: {f.value}</Chip>)}</div> : null}
        </div>
        {good.length ? (
          <div className="fc-good">
            {good.map((f) => (
              <GlassCard key={f.title}>
                <span className="ui-label">{f.title}</span>
                <span className="fc-good-val">{f.value}</span>
                <span className="fc-good-sub"><Icon name="check" />{f.detail}</span>
              </GlassCard>
            ))}
          </div>
        ) : null}
        {check.note ? <GlassCard title={<span className="ui-label">Your note</span>}><span className="ui-stat-cap">{check.note}</span></GlassCard> : null}
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 5' }}>
        {r ? (
          <>
            <GlassCard className="fc-scorecard">
              <div className="fc-score">
                <div><span className="ui-label">Coach score</span><b>{r.score} / 100</b></div>
                <Ring pct={r.score / 100} size={72} stroke={6} label={`Coach score ${r.score} out of 100`}><b className="fc-ring">{r.score}</b></Ring>
              </div>
              <p className="fc-verdict"><b>{r.coach}:</b> {r.summary}</p>
              <div className="fc-kv">
                <div><span className="ui-label">Good</span><b>{good.length} of {r.findings.length}</b></div>
                <div><span className="ui-label">To fix</span><b>{flagged.length || 'None'}</b></div>
                <div><span className="ui-label">Reviewed in</span><b>{hours} h</b></div>
              </div>
            </GlassCard>
            {flagged.map((f) => (
              <GlassCard key={f.title} className="fc-flag">
                <div className="fc-flag-head"><b><i />{f.title}</b><span>{f.value || 'To fix'}</span></div>
                <span className="ui-stat-cap">{f.detail}</span>
                {r.cue ? <div className="fc-cue"><Icon name="spark" /><div><span className="ui-label">Coach cue</span><b>“{r.cue.text}”</b><span>{r.cue.detail}</span></div></div> : null}
              </GlassCard>
            ))}
            {r.drills.length || r.loadChangeKg ? (
              plan ? (
                <GlassCard className="fc-added">
                  <span className="fc-added-text"><Icon name="check" />In your plan until {dayLabel(plan.until)}</span>
                  <PillButton variant="ghost" size="sm" onClick={() => { dispatch({ type: 'removeFixPlan', id: plan.id }); toast('Fix plan removed from training'); }}>Remove</PillButton>
                </GlassCard>
              ) : <PillButton variant="accent" icon="plus" className="fc-add" onClick={add}>Add fix plan and warm-up drills from {dayLabel(from)}</PillButton>
            ) : null}
          </>
        ) : (
          <GlassCard title={status} aside={<Badge tone={check.status === 'failed' ? 'warn' : 'neutral'}>{check.status === 'failed' ? 'Failed' : check.status === 'in_review' ? 'In review' : 'Queued'}</Badge>}>
            <span className="ui-stat-cap">{check.status === 'failed' ? 'Nothing reached your coach. Send it again from Form check.' : `Sent ${when(check.submittedAt)}. Reply by ${new Date(new Date(check.submittedAt).getTime() + REVIEW_HOURS * 3_600_000).toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}; it shows here.`}</span>
            {check.status === 'failed' ? <PillButton onClick={() => { dispatch({ type: 'removeFormCheck', id: check.id }); navigate('/app/reviews/form-check'); }}>Try again</PillButton> : null}
          </GlassCard>
        )}
      </div>

      {r && (r.drills.length || r.loadChangeKg) ? (
        <div className="wb-col" style={{ gridColumn: 'span 12' }}>
          <DarkBand eyebrow="Fix plan" title={`Warm-up for your next ${check.exercise.toLowerCase()} session`} status={<Badge>{r.recheckWeeks} week{r.recheckWeeks > 1 ? 's' : ''}, then re-check</Badge>}>
            {r.drills.map((d, i) => (
              <GlassCard key={d.name} variant="band" title={<span className="fc-drill-n">Drill {String(i + 1).padStart(2, '0')}</span>} aside={<Badge>{d.sets} × {d.reps}</Badge>}>
                <b className="fc-drill">{d.name}</b>
                <span className="hm-band-text">{d.note}</span>
              </GlassCard>
            ))}
            {r.loadChangeKg ? (
              <GlassCard variant="band" title={<span className="fc-drill-n">Load</span>} aside={<Badge>{r.loadChangeKg > 0 ? '+' : '−'}{Math.abs(r.loadChangeKg)} kg</Badge>}>
                <b className="fc-drill">{check.exercise} at {Math.max(0, check.kg + r.loadChangeKg)} kg</b>
                <span className="hm-band-text">Clean reps first, for {r.recheckWeeks} week{r.recheckWeeks > 1 ? 's' : ''}.</span>
              </GlassCard>
            ) : null}
          </DarkBand>
        </div>
      ) : null}
    </AppShell>
  );
}
