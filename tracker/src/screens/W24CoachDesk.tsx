import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { useAuth } from '../state/auth';
import { useCatalogue } from '../components/FoodLog';
import { opsGet, opsPost, useCoachProfile, type Coach, type DeskItem, type DeskMember } from '../state/ops';
import { KIND_TITLE, isOverdue, queueStats, sortQueue, type QueueKind, type QueuePayloads } from '../domain/queue';
import { DRILLS, checklistFor, reviewProblems } from '../domain/formcheck';
import { markerDef, statusOf, rangeText } from '../domain/labs';
import { searchFoods } from '../domain/foodSearch';
import type { Drill, FormFinding, LabMarker, PlanChange, WeeklyReport } from '../domain/types';

const ICON: Record<QueueKind, string> = { form: 'video', labs: 'drop', report: 'doc', food: 'bowl', lead: 'user' };
function due(iso: string, now: number): string {
  const h = Math.round((new Date(iso).getTime() - now) / 3_600_000);
  return h >= 0 ? (h < 1 ? 'due within the hour' : `due in ${h} h`) : `${-h} h overdue`;
}
const mins = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** W24 · Coach desk (S20.1, S20.2): one queue for Form Checks, lab checks, report drafts, unmatched foods and coach requests. */
export default function W24CoachDesk() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [coach, setCoach] = useCoachProfile();
  const gate = !auth.configured ? 'The coach desk needs accounts switched on for this site (Firebase and the server key).' : !auth.user ? 'Sign in with your coach account.' : null;
  return (
    <AppShell active="desk" title="Coach desk" crumb={<>{coach ? `Signed in as ${coach.name}` : 'For PeakX coaches'}</>} cols="repeat(12, minmax(0, 1fr))">
      {gate ? (
        <div className="wb-col" style={{ gridColumn: 'span 12' }}>
          <div className="px-card" style={{ gap: '10px', maxWidth: '560px' }}><span className="px-card-title">Coach desk</span><span className="px-body grey">{gate}</span>{auth.configured ? <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', alignSelf: 'flex-start', padding: '0 24px' }} onClick={() => navigate('/app/sign-up?next=/app/coach-desk')}>Sign in</button> : null}</div>
        </div>
      ) : coach === undefined ? <div className="wb-col" style={{ gridColumn: 'span 12' }}><span className="px-body grey">Checking your coach access…</span></div>
        : coach === null ? <JoinForm onJoined={setCoach} /> : <Desk coach={coach} onProfile={setCoach} />}
    </AppShell>
  );
}

function JoinForm({ onJoined }: { onJoined: (c: Coach) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ code: '', name: '', whatsapp: '', bookingUrl: '' });
  const [busy, setBusy] = useState(false);
  const join = async () => {
    setBusy(true);
    try { const r = await opsPost<{ coach: Coach }>({ action: 'join', ...f }); onJoined(r.coach); toast(`Welcome, ${r.coach.name}. You now have coach access.`, 'good'); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="wb-col" style={{ gridColumn: 'span 12' }}>
      <form className="px-card" style={{ gap: '10px', maxWidth: '560px' }} onSubmit={(e) => { e.preventDefault(); join(); }}>
        <span className="px-card-title">Get coach access</span>
        <span className="px-body grey">This account isn’t a coach yet. Enter the setup code (COACH_TOKEN in Vercel) once; members will see your name and can reach you on WhatsApp and your booking link.</span>
        <ProfileFields f={f} setF={(p) => setF({ ...f, ...p })} />
        <label className="px-field"><span className="l">Setup code</span><span className="px-field-row"><input type="password" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} aria-label="Setup code" autoComplete="off" /></span></label>
        <button className="px-cta" type="submit" disabled={busy || !f.code || !f.name.trim()} style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', alignSelf: 'flex-start', padding: '0 24px', opacity: busy || !f.code || !f.name.trim() ? 0.5 : 1 }}>{busy ? 'Checking…' : 'Become a coach'}</button>
      </form>
    </div>
  );
}

function ProfileFields({ f, setF }: { f: { name: string; whatsapp: string; bookingUrl: string }; setF: (p: Partial<{ name: string; whatsapp: string; bookingUrl: string }>) => void }) {
  return (
    <>
      <label className="px-field"><span className="l">Your name, as members see it</span><span className="px-field-row"><input value={f.name} maxLength={60} onChange={(e) => setF({ name: e.target.value })} aria-label="Coach name" /></span></label>
      <label className="px-field"><span className="l">WhatsApp number</span><span className="px-field-row"><input inputMode="tel" value={f.whatsapp} placeholder="98765 43210" onChange={(e) => setF({ whatsapp: e.target.value })} aria-label="WhatsApp number" /></span></label>
      <label className="px-field"><span className="l">Weekly call booking link (Calendly, Cal.com…)</span><span className="px-field-row"><input value={f.bookingUrl} placeholder="https://cal.com/you/weekly" onChange={(e) => setF({ bookingUrl: e.target.value })} aria-label="Booking link" /></span></label>
    </>
  );
}

function Desk({ coach, onProfile }: { coach: Coach; onProfile: (c: Coach) => void }) {
  const toast = useToast();
  const [items, setItems] = useState<DeskItem[]>([]);
  const [members, setMembers] = useState<DeskMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'queue' | 'members' | 'usage' | 'profile'>('queue');
  const [kind, setKind] = useState<QueueKind | 'all' | 'done'>('all');
  const [selId, setSelId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const now = Date.now();

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await opsGet<{ items: DeskItem[]; members: DeskMember[] }>('queue'); setItems(sortQueue(r.items) as DeskItem[]); setMembers(r.members); }
    catch (e) { toast((e as Error).message); } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setElapsed(0); if (!selId) return; const t = setInterval(() => setElapsed((s) => s + 1), 1000); return () => clearInterval(t); }, [selId]);

  const stats = useMemo(() => queueStats(items, now, coach.uid), [items, now, coach.uid]);
  const shown = items.filter((i) => (kind === 'done' ? i.status === 'done' : i.status !== 'done' && (kind === 'all' || i.kind === kind)));
  const sel = items.find((i) => i.id === selId) ?? null;

  const select = async (i: DeskItem) => {
    if (sel && sel.status !== 'done' && elapsed > 5) opsPost({ action: 'time', id: sel.id, timeSec: elapsed }).catch(() => undefined);
    setSelId(i.id);
    if (i.status === 'open') {
      try { await opsPost({ action: 'claim', id: i.id }); setItems((xs) => xs.map((x) => (x.id === i.id ? { ...x, status: 'claimed', claimedBy: { uid: coach.uid, name: coach.name } } : x))); }
      catch (e) { toast((e as Error).message); }
    }
  };
  const act = async (body: Record<string, unknown>, done: string) => {
    if (!sel) return;
    try {
      await opsPost({ ...body, id: sel.id, timeSec: elapsed });
      toast(done, 'good');
      const next = shown.find((i) => i.id !== sel.id && i.status !== 'done');
      setSelId(next?.id ?? null);
      load();
    } catch (e) { toast((e as Error).message); }
  };

  return (
    <>
      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <div className="px-desk-stats">
          <div><span className="px-num md">{stats.open}</span><span className="px-meta">open</span></div>
          <div><span className={`px-num md${stats.overdue ? ' over' : ''}`}>{stats.overdue}</span><span className="px-meta">overdue</span></div>
          <div><span className="px-num md">{stats.doneToday}</span><span className="px-meta">done in 24 h</span></div>
          <div><span className="px-num md">{stats.minutesToday}</span><span className="px-meta">minutes in 24 h</span></div>
          <div><span className="px-num md">{stats.formTurnaroundHours || '–'}</span><span className="px-meta">h Form Check turnaround</span></div>
          <div className="px-desk-tabs">
            {(['queue', 'members', 'usage', 'profile'] as const).map((t) => <button key={t} type="button" className={`px-pill sm${tab === t ? ' on' : ''}`} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'queue' ? 'Queue' : t === 'members' ? `Members · ${members.length}` : t === 'usage' ? 'Usage' : 'Profile'}</button>)}
            <button className="px-icon sm" type="button" aria-label="Refresh the queue" onClick={load}><Icon name="swap" /></button>
          </div>
        </div>
      </div>
      {tab === 'queue' ? (
        <>
          <div className="wb-col" style={{ gridColumn: 'span 5' }}>
            <div className="px-card" style={{ gap: '8px' }}>
              <div className="px-chips">
                {(['all', 'form', 'labs', 'report', 'food', 'lead', 'done'] as const).map((k) => (
                  <button key={k} type="button" className={`px-pill sm${kind === k ? ' on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'all' ? `All · ${stats.open}` : k === 'done' ? 'Done' : `${KIND_TITLE[k]} · ${stats.byKind[k]}`}</button>
                ))}
              </div>
              {loading && !items.length ? <span className="px-body grey">Loading the queue…</span> : shown.length ? (
                <ul className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {shown.map((i) => (
                    <li key={i.id}>
                      <button type="button" className="px-row px-row-btn" aria-current={i.id === selId ? 'true' : undefined} style={i.id === selId ? { background: 'rgba(255,255,255,0.8)' } : undefined} onClick={() => select(i)}>
                        <span className="px-row-icon"><Icon name={ICON[i.kind]} /></span>
                        <span className="px-row-main"><span className="px-row-title">{KIND_TITLE[i.kind]} · {i.member.name || 'Member'}</span><span className="px-row-sub">{i.title}</span></span>
                        <span className="px-row-end">
                          {i.status === 'done' ? <span className="px-status good">Done · {i.doneBy}</span> : <span className={`px-status${isOverdue(i, now) ? ' over' : ''}`}>{i.claimedBy && i.claimedBy.uid !== coach.uid ? `${i.claimedBy.name}` : due(i.dueAt, now)}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <span className="px-body grey" style={{ padding: '8px 0' }}>{kind === 'done' ? 'Nothing done in the last 14 days.' : 'Nothing waiting. Nice.'}</span>}
            </div>
          </div>
          <div className="wb-col" style={{ gridColumn: 'span 7' }}>
            {sel ? (
              <div className="px-card" style={{ gap: '12px' }}>
                <div className="px-card-head">
                  <span className="px-card-title">{KIND_TITLE[sel.kind]} · {sel.member.name || 'Member'}</span>
                  <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {sel.status !== 'done' ? <><span className="px-meta" aria-live="off">{mins(elapsed)}</span><button className="px-pill sm" type="button" onClick={() => { opsPost({ action: 'release', id: sel.id, timeSec: elapsed }).then(load).catch(() => undefined); setSelId(null); }}>Release</button></> : <span className="px-status good">Done by {sel.doneBy}</span>}
                  </span>
                </div>
                <span className="px-meta">{sel.member.plan.toUpperCase()} · sent {new Date(sel.createdAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {sel.status === 'done' ? `took ${Math.round(sel.timeSec / 60)} min` : due(sel.dueAt, now)}</span>
                {sel.status === 'done' ? <span className="px-body grey">This item is closed. The member already sees the result.</span>
                  : sel.kind === 'form' ? <FormEditor key={sel.id} item={sel} onSend={(review) => act({ action: 'reviewForm', review }, 'Review sent')} />
                    : sel.kind === 'labs' ? <LabsEditor key={sel.id} item={sel} onSend={(markers, note) => act({ action: 'checkLabs', markers, note }, 'Lab check sent')} />
                      : sel.kind === 'report' ? <ReportEditor key={sel.id} item={sel} onSend={(changes) => act({ action: 'approveReport', changes }, 'Report approved; it publishes Sunday 7 PM')} />
                        : sel.kind === 'food' ? <FoodEditor key={sel.id} item={sel} onSend={(mapTo, note) => act({ action: 'resolveFood', mapTo, note }, mapTo ? 'Matched; members logging it get the right numbers' : 'Marked as no match')} />
                          : <LeadEditor key={sel.id} item={sel} onAssign={() => act({ action: 'assign' }, 'You’re their coach now. Message them on WhatsApp.')} onActivate={(months) => opsPost({ action: 'activateCoached', uid: sel.uid, months, name: sel.member.name }).then(() => act({ action: 'assign' }, `Coached on for ${months} month${months > 1 ? 's' : ''}`)).catch((e) => toast((e as Error).message))} />}
              </div>
            ) : <div className="px-card" style={{ gap: '6px' }}><span className="px-card-title">Pick an item</span><span className="px-body grey">Opening an item claims it for you and starts the timer, so two coaches don’t review the same set.</span></div>}
          </div>
        </>
      ) : tab === 'members' ? (
        <div className="wb-col" style={{ gridColumn: 'span 12' }}>
          <div className="px-card" style={{ gap: '0' }}>
            <div className="px-card-head"><span className="px-card-title">Coached members</span><span className="px-meta">Assigned from coach requests</span></div>
            {members.length ? (
              <div className="px-list">
                {members.map((m) => (
                  <div key={m.uid} className="px-row" style={{ flexWrap: 'wrap', rowGap: '6px' }}>
                    <span className="px-row-icon"><Icon name="user" /></span>
                    <span className="px-row-main" style={{ flexBasis: 0 }}><span className="px-row-title">{m.name || 'Member'} · coach {m.coachName}</span><span className="px-row-sub">{[m.email, `since ${new Date(m.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, m.until ? `paid to ${new Date(m.until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'not on Coached yet'].filter(Boolean).join(' · ')}</span></span>
                    {m.email ? <a className="px-pill sm" href={`mailto:${m.email}`}>Email</a> : null}
                    <button className="px-pill sm" type="button" onClick={() => opsPost({ action: 'activateCoached', uid: m.uid, months: 1, name: m.name }).then(() => { toast('Coached extended by a month', 'good'); load(); }).catch((e) => toast((e as Error).message))}>+1 month Coached</button>
                  </div>
                ))}
              </div>
            ) : <span className="px-body grey" style={{ padding: '10px 0' }}>No Coached members yet. Requests show up in the queue.</span>}
          </div>
        </div>
      ) : tab === 'usage' ? <UsageCard /> : <ProfileCard coach={coach} onSaved={onProfile} />}
    </>
  );
}

function ProfileCard({ coach, onSaved }: { coach: Coach; onSaved: (c: Coach) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: coach.name, whatsapp: coach.whatsapp ?? '', bookingUrl: coach.bookingUrl ?? '' });
  return (
    <div className="wb-col" style={{ gridColumn: 'span 12' }}>
      <form className="px-card" style={{ gap: '10px', maxWidth: '560px' }} onSubmit={(e) => { e.preventDefault(); opsPost<{ coach: Coach }>({ action: 'profile', ...f }).then((r) => { onSaved(r.coach); toast('Saved. Your members see the new details.', 'good'); }).catch((err) => toast((err as Error).message)); }}>
        <span className="px-card-title">Your coach profile</span>
        <ProfileFields f={f} setF={(p) => setF({ ...f, ...p })} />
        <button className="px-cta" type="submit" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', alignSelf: 'flex-start', padding: '0 24px' }}>Save</button>
      </form>
    </div>
  );
}

function FormEditor({ item, onSend }: { item: DeskItem; onSend: (r: Record<string, unknown>) => void }) {
  const p = item.payload as QueuePayloads['form'];
  const [findings, setFindings] = useState<FormFinding[]>(checklistFor(p.exercise));
  const [score, setScore] = useState(80);
  const [summary, setSummary] = useState('');
  const [cue, setCue] = useState({ text: '', detail: '' });
  const [drills, setDrills] = useState<Drill[]>([]);
  const [load, setLoad] = useState(0);
  const [weeks, setWeeks] = useState(2);
  const review = { score, summary, findings, cue: cue.text.trim() ? cue : null, drills, loadChangeKg: load, recheckWeeks: weeks };
  const problems = reviewProblems(review);
  return (
    <>
      <div className="px-media px-video">{item.videoUrl ? <video src={item.videoUrl} controls playsInline preload="metadata" aria-label="Member’s set" /> : <div className="px-video-empty"><Icon name="video" /><span>{p.fileName}</span><span className="px-meta" style={{ color: 'var(--text-3)' }}>Video link unavailable; refresh the queue</span></div>}</div>
      <span className="px-body"><b>{p.exercise}</b> · {p.kg} kg × {p.reps}{p.note ? ` · “${p.note}”` : ''}</span>
      <div className="px-list">
        {findings.map((f, i) => (
          <div key={f.title} className="px-row px-desk-finding">
            <span className="px-row-title" style={{ minWidth: '110px' }}>{f.title}</span>
            <input className="px-desk-in" value={f.detail} placeholder="What you saw" onChange={(e) => setFindings(findings.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} aria-label={`${f.title} detail`} />
            <input className="px-desk-in sm" value={f.value} placeholder="Value" onChange={(e) => setFindings(findings.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} aria-label={`${f.title} value`} />
            <button type="button" className={`px-pill sm${f.ok ? ' on' : ''}`} aria-pressed={f.ok} onClick={() => setFindings(findings.map((x, j) => (j === i ? { ...x, ok: !x.ok } : x)))}>{f.ok ? 'Good' : 'Fix'}</button>
          </div>
        ))}
      </div>
      <div className="px-fields">
        <label className="px-field"><span className="l">Score / 100</span><span className="px-field-row"><input inputMode="numeric" value={score} onChange={(e) => setScore(Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0))} aria-label="Score" /></span></label>
        <label className="px-field"><span className="l">Summary (one line)</span><span className="px-field-row"><input value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} aria-label="Summary" /></span></label>
        <label className="px-field"><span className="l">Cue</span><span className="px-field-row"><input value={cue.text} maxLength={60} placeholder="Spread the floor." onChange={(e) => setCue({ ...cue, text: e.target.value })} aria-label="Cue" /></span></label>
        <label className="px-field"><span className="l">How to use the cue</span><span className="px-field-row"><input value={cue.detail} maxLength={200} onChange={(e) => setCue({ ...cue, detail: e.target.value })} aria-label="Cue detail" /></span></label>
      </div>
      <span className="px-subhead">Drills · add by fault</span>
      <div className="px-chips">{Object.keys(DRILLS).map((k) => <button key={k} type="button" className="px-pill sm" onClick={() => setDrills([...drills, ...DRILLS[k].filter((d) => !drills.some((x) => x.name === d.name))])}>+ {k}</button>)}</div>
      {drills.length ? <div className="px-list">{drills.map((d) => <div key={d.name} className="px-row"><span className="px-row-main"><span className="px-row-title">{d.name}</span><span className="px-row-sub">{d.note}</span></span><span className="px-row-end"><span className="px-row-value">{d.sets} × {d.reps}</span></span><button className="px-icon sm" type="button" aria-label={`Remove ${d.name}`} onClick={() => setDrills(drills.filter((x) => x !== d))}><Icon name="close" /></button></div>)}</div> : null}
      <div className="px-fields">
        <label className="px-field"><span className="l">Load change until re-check</span><span className="px-field-row"><select value={load} onChange={(e) => setLoad(Number(e.target.value))} aria-label="Load change">{[-10, -5, -2.5, 0, 2.5, 5].map((v) => <option key={v} value={v}>{v > 0 ? `+${v}` : v} kg</option>)}</select></span></label>
        <label className="px-field"><span className="l">Re-check after</span><span className="px-field-row"><select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} aria-label="Re-check weeks">{[1, 2, 3, 4].map((v) => <option key={v} value={v}>{v} week{v > 1 ? 's' : ''}</option>)}</select></span></label>
      </div>
      {problems.length ? <span className="px-meta">{problems[0]}</span> : null}
      <button className="px-cta" type="button" aria-disabled={!!problems.length} style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', alignSelf: 'flex-end', padding: '0 28px' }} onClick={() => { if (!problems.length) onSend(review); }}>Send review</button>
    </>
  );
}

function LabsEditor({ item, onSend }: { item: DeskItem; onSend: (m: LabMarker[], note: string) => void }) {
  const p = item.payload as QueuePayloads['labs'];
  const [rows, setRows] = useState(p.markers.map((m) => ({ ...m, text: String(m.value) })));
  const [note, setNote] = useState('');
  return (
    <>
      <span className="px-body grey">Compare the member’s numbers with their report (ask on WhatsApp for the PDF if needed). Fix any typo, then confirm.</span>
      <div className="px-list">
        {rows.map((r, i) => { const d = markerDef(r.id); const v = Number(r.text); return d ? (
          <div key={r.id} className="px-row px-lab-row">
            <span className="px-row-main"><span className="px-row-title">{d.name}</span><span className="px-row-sub">{rangeText(d, 'male')} (men; ranges differ for women)</span></span>
            <span className="px-field-row px-lab-input"><input inputMode="decimal" value={r.text} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, text: e.target.value.replace(/[^\d.]/g, '') } : x)))} aria-label={d.name} /><span className="sfx">{d.unit}</span></span>
            <span className="px-row-end"><span className={`px-status ${statusOf(d, v, 'male') === 'normal' ? 'good' : 'over'}`}>{statusOf(d, v, 'male')}</span></span>
          </div>) : null; })}
      </div>
      <label className="px-field"><span className="l">Note to the member (optional)</span><span className="px-field-row"><input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Values match your PDF." aria-label="Note" /></span></label>
      <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', alignSelf: 'flex-end', padding: '0 28px' }} onClick={() => onSend(rows.filter((r) => Number(r.text) > 0).map((r) => ({ id: r.id, value: Number(r.text), unit: r.unit })), note)}>Confirm numbers</button>
    </>
  );
}

function ReportEditor({ item, onSend }: { item: DeskItem; onSend: (changes: PlanChange[]) => void }) {
  const r = (item as DeskItem & { report?: Pick<WeeklyReport, 'headline' | 'causes' | 'changes'> | null }).report;
  const [keep, setKeep] = useState<Record<string, boolean>>({});
  if (!r) return <span className="px-body grey">The draft couldn’t be loaded. Refresh the queue.</span>;
  const kept = r.changes.filter((c) => keep[c.id] !== false);
  return (
    <>
      <span className="px-q" style={{ fontSize: '26px', lineHeight: '30px' }}>{r.headline}</span>
      <span className="px-subhead">Why</span>
      <ul className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{r.causes.map((c, i) => <li key={i} className="px-row"><span className="px-row-main"><span className="px-row-title">{c.title}</span><span className="px-row-sub">{c.detail}</span></span><span className="px-row-end"><span className="px-level">{c.tag}</span></span></li>)}</ul>
      <span className="px-subhead">Changes · untick any you disagree with</span>
      <ul className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>{r.changes.map((c) => <li key={c.id} className="px-row"><span className="px-row-main"><span className="px-row-title">{c.title}</span><span className="px-row-sub">{c.detail}</span></span><button type="button" className={`px-pill sm${keep[c.id] !== false ? ' on' : ''}`} aria-pressed={keep[c.id] !== false} onClick={() => setKeep({ ...keep, [c.id]: keep[c.id] === false })}>{keep[c.id] !== false ? 'Keep' : 'Dropped'}</button></li>)}</ul>
      <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', alignSelf: 'flex-end', padding: '0 28px' }} onClick={() => onSend(kept)}>Approve{kept.length < r.changes.length ? ` with ${kept.length} change${kept.length === 1 ? '' : 's'}` : ''}</button>
    </>
  );
}

function FoodEditor({ item, onSend }: { item: DeskItem; onSend: (mapTo: string | null, note: string) => void }) {
  const p = item.payload as QueuePayloads['food'];
  const cat = useCatalogue();
  const [q, setQ] = useState(p.name);
  const hits = useMemo(() => { const h = searchFoods(q, cat, 6); return h.length || !q.includes(' ') ? h : searchFoods(q.split(' ')[0], cat, 6); }, [q, cat]);
  return (
    <>
      <span className="px-body">“{p.name}” was logged {p.count} times and isn’t in the food table. Match it to the closest food, or mark it as no match so it’s added in the next food-table update.</span>
      <label className="px-field"><span className="l">Search the food table</span><span className="px-field-row"><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search foods" /></span></label>
      <div className="px-list">{hits.map((h) => <div key={h.kind + h.id} className="px-row"><span className="px-row-main"><span className="px-row-title">{h.name}</span><span className="px-row-sub">{h.hint}</span></span><button className="px-pill sm" type="button" onClick={() => onSend(`${h.kind}:${h.id}`, '')}>Match</button></div>)}</div>
      <button className="px-pill" type="button" style={{ alignSelf: 'flex-end' }} onClick={() => onSend(null, 'Needs a new food-table entry')}>No match · add in next update</button>
    </>
  );
}

function LeadEditor({ item, onAssign, onActivate }: { item: DeskItem; onAssign: () => void; onActivate: (months: number) => void }) {
  const p = item.payload as QueuePayloads['lead'];
  const [months, setMonths] = useState(1);
  return (
    <>
      <span className="px-body">{item.detail}</span>
      {p.message ? <span className="px-body grey">“{p.message}”</span> : null}
      {item.email ? <a className="px-pill" href={`mailto:${item.email}?subject=${encodeURIComponent('Your PeakX coach')}`} style={{ alignSelf: 'flex-start' }}>Email {item.email}</a> : null}
      <span className="px-body grey">Assign yourself to show your WhatsApp and booking link in their app. If they’ve paid you outside the app, switch Coached on too.</span>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '16px', padding: '0 20px' }} onClick={onAssign}>Assign to me</button>
        <span className="px-field-row px-lab-input" style={{ flexBasis: '120px' }}><select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Months of Coached">{[1, 2, 3, 6].map((m) => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}</select></span>
        <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '16px', padding: '0 20px' }} onClick={() => onActivate(months)}>Assign + Coached on</button>
      </div>
    </>
  );
}

const KEY_EVENTS: [string, string][] = [['app_open', 'App opens'], ['plateau_check_completed', 'Plateau checks'], ['sign_in', 'Sign-ins'], ['meal_logged', 'Meals logged'], ['set_logged', 'Sets logged'], ['upgrade_viewed', 'Pricing views'], ['checkout_paid', 'Payments'], ['form_check_sent', 'Form Checks']];

/** Usage (S24.2): daily counts from /api/events and recent errors. */
function UsageCard() {
  const toast = useToast();
  const [u, setU] = useState<{ days: { date: string; events?: Record<string, number>; errors?: Record<string, number> }[]; errors: { at: string; message: string; screen: string; action: string }[] } | null>(null);
  useEffect(() => { opsGet<typeof u>('usage').then(setU).catch((e) => toast((e as Error).message)); }, [toast]);
  if (!u) return <div className="wb-col" style={{ gridColumn: 'span 12' }}><span className="px-body grey">Loading usage…</span></div>;
  const days = u.days.slice(0, 7).reverse();
  return (
    <>
      <div className="wb-col" style={{ gridColumn: 'span 8' }}>
        <div className="px-card" style={{ gap: '8px' }}>
          <div className="px-card-head"><span className="px-card-title">Last 7 days</span><span className="px-meta">From the app’s own events; set VITE_TELEMETRY_URL=/api/events</span></div>
          {days.length ? (
            <div className="px-table-wrap">
              <table className="px-table">
                <thead><tr><th scope="col">Event</th>{days.map((d) => <th key={d.date} scope="col">{new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</th>)}<th scope="col">Total</th></tr></thead>
                <tbody>{KEY_EVENTS.map(([k, label]) => { const xs = days.map((d) => d.events?.[k] ?? 0); return <tr key={k}><th scope="row">{label}</th>{xs.map((x, i) => <td key={i}>{x || '·'}</td>)}<td><b>{xs.reduce((a, b) => a + b, 0)}</b></td></tr>; })}</tbody>
              </table>
            </div>
          ) : <span className="px-body grey">No events yet.</span>}
        </div>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 4' }}>
        <div className="px-card" style={{ gap: '0' }}>
          <div className="px-card-head"><span className="px-card-title">Recent errors</span><span className="px-meta">{u.errors.length}</span></div>
          {u.errors.length ? <div className="px-list">{u.errors.slice(0, 10).map((e, i) => <div key={i} className="px-row"><span className="px-row-main"><span className="px-row-title" style={{ fontSize: '14px', overflowWrap: 'anywhere' }}>{e.message}</span><span className="px-row-sub">{new Date(e.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {e.screen}{e.action ? ` · after ${e.action}` : ''}</span></span></div>)}</div> : <span className="px-body grey" style={{ padding: '10px 0' }}>No errors. Nice.</span>}
        </div>
      </div>
    </>
  );
}
