import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { useStore } from '../state/store';
import { useAuth } from '../state/auth';
import { buildReport, publishTime } from '../domain/report';
import { addDays, dayNum, parse, today, weekStart } from '../domain/clock';
import type { WeeklyReport } from '../domain/types';
import { reportFigures } from '../state/selectors';
import { GlassCard, Stat, EmptyState, Chip, Badge, PillButton } from '../components/ui/blocks';

const mon = (d: string) => parse(d).toLocaleDateString('en-GB', { month: 'short' });
const range = (ws: string) => `${dayNum(ws)} – ${dayNum(addDays(ws, 6))} ${mon(addDays(ws, 6))}`;

/** W16 · Weekly report (S17.1): causes and changes accepted in one click. First report free; then Pro. */
export default function W16WeeklyReport() {
  const { week } = useParams();
  const { data, dispatch, can } = useStore();
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const sorted = [...data.reports].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  const report = week === 'latest' || !week ? (sorted.find((r) => r.status === 'published') ?? sorted[0]) : sorted.find((r) => r.weekStart === week);
  const preview = useMemo(() => (report ? null : buildReport(data, weekStart(today()))), [report, data]);
  const r = report ?? preview!;
  const published = r.status === 'published';

  // A free user's first published report is theirs to keep.
  useEffect(() => {
    if (report && published && data.plan === 'free' && !data.firstReportUsed && !report.free) {
      dispatch({ type: 'upsertReport', report: { ...report, free: true } });
      dispatch({ type: 'useFreeReport' });
    }
  }, [report, published, data.plan, data.firstReportUsed, dispatch]);

  const answer = (rep: WeeklyReport, id: string, status: 'accepted' | 'skipped') => {
    dispatch({ type: 'setChange', reportId: rep.id, changeId: id, status });
    const c = rep.changes.find((x) => x.id === id)!;
    auth.syncReport({ ...rep, changes: rep.changes.map((x) => (x.id === id ? { ...x, status } : x)) });
    toast(status === 'accepted' ? `${c.title}: added to your plan` : `${c.title}: skipped`, status === 'accepted' ? 'good' : 'info');
  };
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '');
  const at = (ws: string) => { const d = publishTime(ws); return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '')}`; };
  const status = !report ? { chip: 'Preview', tone: 'neutral' as const, line: `This week so far. Your report arrives ${at(r.weekStart)}.` }
    : published ? { chip: 'Published', tone: 'good' as const, line: `Reviewed by ${r.approvedBy ?? 'your coach'}, published ${when(r.publishedAt)}.` }
      : r.status === 'approved' ? { chip: 'Approved', tone: 'neutral' as const, line: `Approved by ${r.approvedBy}. It publishes ${at(r.weekStart)}.` }
        : { chip: 'Draft', tone: 'neutral' as const, line: `Your coach reviews it before ${at(r.weekStart)}.` };
  const accepted = r.changes.filter((c) => c.status === 'accepted').length;
  const { figures, logged } = reportFigures(r);
  const headline = !report && !logged ? 'Nothing logged this week yet' : r.headline;

  return (
    <AppShell
      active="reviews" title="Weekly report" crumb={<>Week of {range(r.weekStart)}</>}
      feature={report?.free || can('weeklyReport') ? undefined : 'weeklyReport'}
      headAside={r.free ? <Badge tone="good">Your free report</Badge> : can('weeklyReport') ? null : <Badge kind="pro" />}
    >
      <div className="wb-col" style={{ gridColumn: 'span 8' }}>
        <GlassCard className="rv-report">
          <div className="rv-status">
            <Badge tone={status.tone}>{status.chip}</Badge>
            <span>{status.line}</span>
          </div>
          <h2 className="rv-headline">{headline}</h2>
          {logged ? (
            <div className="rv-figures">
              {figures.map((f) => (
                <Stat key={f.key} size="md" label={f.label} value={f.value} dp={f.dp} unit={f.unit} empty={f.empty} />
              ))}
            </div>
          ) : (
            <EmptyState icon="doc" text="Log meals, workouts and a weigh-in or two. Your report is built from them, and fills in here as the week goes." action={{ label: 'Log a meal', to: '/app/log' }} />
          )}
          {r.causes.length ? (
            <div className="rv-causes">
              <h3>Why it happened</h3>
              <ol>
                {r.causes.map((c, i) => (
                  <li key={i}>
                    <span className="rv-n" aria-hidden="true">{i + 1}</span>
                    <div><b>{c.title}</b><span>{c.detail}</span></div>
                    <Chip>{c.tag}</Chip>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </GlassCard>

        {r.changes.length ? (
          <GlassCard title="Changes for next week" aside={<Badge>{published ? `${accepted} of ${r.changes.length} accepted` : 'Accept once published'}</Badge>}>
            <ul className="rv-changes">
              {r.changes.map((c) => (
                <li key={c.id}>
                  <span className="co-week-icon"><Icon name={c.action?.kind === 'sets' ? 'dumbbell' : c.action?.kind === 'windDown' ? 'moon' : c.action?.kind === 'kcal' ? 'bowl' : 'check'} /></span>
                  <div className="rv-change-main">
                    <b>{c.title}</b>
                    <span>{c.detail}{c.action ? '' : '. A habit; nothing changes in your plan.'}</span>
                  </div>
                  {report && published ? (
                    <div className="rv-actions">
                      <PillButton size="sm" variant={c.status === 'accepted' ? 'primary' : 'ghost'} icon={c.status === 'accepted' ? 'check' : undefined} onClick={() => answer(report, c.id, 'accepted')}>{c.status === 'accepted' ? 'Accepted' : 'Accept'}</PillButton>
                      <PillButton size="sm" variant="ghost" onClick={() => answer(report, c.id, 'skipped')}>{c.status === 'skipped' ? 'Skipped' : 'Skip'}</PillButton>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </GlassCard>
        ) : report ? <GlassCard title="Changes for next week"><span className="ui-stat-cap">No changes needed this week.</span></GlassCard> : null}
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 4' }}>
        <GlassCard title={sorted.length ? 'All reports' : 'How reports work'}>
          {sorted.length ? (
            <ul className="rv-list">
              {sorted.map((x) => (
                <li key={x.id}>
                  <Link to={`/app/reviews/weekly/${x.weekStart}`} aria-current={x.id === report?.id ? 'page' : undefined}>
                    <span className="co-week-icon"><Icon name="doc" /></span>
                    <span className="rv-change-main"><b>{range(x.weekStart)}</b><span>{x.status === 'published' ? `${x.changes.filter((c) => c.status === 'accepted').length} of ${x.changes.length} changes accepted` : x.status === 'approved' ? 'Approved, publishing soon' : 'Draft, in review'}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ol className="fc-steps">
              <li><b>You log the week</b><span>Meals, workouts, weigh-ins and sleep.</span></li>
              <li><b>A coach checks it</b><span>The likely reasons progress slowed, from your own numbers.</span></li>
              <li><b>Sunday, 7 PM</b><span>Your report arrives with changes you accept in one tap.</span></li>
            </ol>
          )}
        </GlassCard>
        <GlassCard title="Questions about this week?">
          <span className="ui-stat-cap">The Coach can explain any reason or suggest swaps.</span>
          <PillButton variant="ghost" icon="spark" onClick={() => navigate('/app/coach')}>Ask the Coach</PillButton>
        </GlassCard>
      </div>
    </AppShell>
  );
}
