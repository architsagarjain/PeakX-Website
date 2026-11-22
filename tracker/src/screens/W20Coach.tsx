import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon, Avatar } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { useCatalogue } from '../components/FoodLog';
import { useStore, SLOT_TIME } from '../state/store';
import { callAi, useAiStatus } from '../state/ai';
import { idToken } from '../state/cloud';
import { remaining, wearableOn, weightTrend, plateauSummary } from '../state/selectors';
import { lastWeekSummary } from '../state/insights';
import { GlassCard, Stat, Chip, Badge, PillButton } from '../components/ui/blocks';
import { coachContext, DAILY_LIMIT, optionsFromAi, ruleReply, usageLeft } from '../domain/coach';
import { sessionFor } from '../domain/training';
import { today } from '../domain/clock';
import { fmt } from '../domain/nutrition';
import type { CoachMessage, CoachOption } from '../domain/types';

const SUGGESTIONS = ['A dinner under 500 kcal with paneer?', 'High-protein vegetarian dinner ideas', 'Pre-workout snack', 'Why did my bench stall?'];
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });

/** W20 · AI Coach (S19.1, Pro): answers from the user's own data; option cards log straight to dinner. */
export default function W20Coach() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data, dispatch, can, newId } = useStore();
  const cat = useCatalogue();
  const ai = useAiStatus();
  const date = today();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const left = remaining(data, date);
  const plan = sessionFor(data.workouts, data.profile, date, undefined, data.trainingOverrides, data.fixPlans);
  const w = wearableOn(data, date);
  const trend = weightTrend(data, date);
  const plateau = plateauSummary(data);
  const week = lastWeekSummary(data, date);
  const msgsLeft = usageLeft(data, date);
  const messages = data.coach.messages;
  const proteinLeft = Math.max(0, data.targets.protein - left.eaten.protein);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length, busy]);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    if (!can('aiCoach')) { navigate('/app/upgrade'); return; }
    if (msgsLeft <= 0) { toast(`You’ve used today’s ${DAILY_LIMIT} messages. The Coach is back tomorrow.`); return; }
    const mine: CoachMessage = { id: newId('msg'), role: 'user', text: question, at: new Date().toISOString() };
    dispatch({ type: 'coachSend', message: mine, date });
    setText('');
    setBusy(true);
    let reply: Pick<CoachMessage, 'text' | 'options' | 'source'>;
    try {
      if (!ai?.ai) throw new Error('rules');
      const history = [...messages, mine].slice(-10).map((m) => ({ role: m.role, text: m.text }));
      const out = await callAi<{ reply: string; options: { name: string; quantity: number | null; unit: string | null }[] }>('coach', { messages: history, context: coachContext(data, date) }, 30000, await idToken().catch(() => null));
      reply = { text: out.reply, options: optionsFromAi(out.options, cat), source: 'ai' };
    } catch {
      const r = ruleReply(question, data, date, cat);
      reply = { text: r.text, options: r.options, source: 'rules' };
    }
    dispatch({ type: 'coachReply', message: { id: newId('msg'), role: 'coach', at: new Date().toISOString(), ...reply } });
    setBusy(false);
  };

  // Questions sent from This week (?q=…) are asked once on arrival.
  const asked = useRef(false);
  useEffect(() => {
    const q = params.get('q');
    if (q && !asked.current && ai !== null) { asked.current = true; setParams({}, { replace: true }); send(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, ai]);

  const addToDinner = (o: CoachOption) => {
    dispatch({ type: 'logItems', date, slot: 'dinner', time: SLOT_TIME.dinner, items: [{ id: newId('item'), name: o.name, amount: o.amount, macros: o.macros, source: 'typed', ref: o.ref }] });
    toast(`${o.name} added to dinner`, 'good');
  };

  const first = data.profile.name.trim().split(/\s+/)[0];
  return (
    <AppShell active="coach" title="Coach" crumb={<>Answers from your own food log, training and watch data</>} feature="aiCoach">
      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        <section className="ui-card co-chat" aria-label="Conversation with the Coach">
          <header className="co-head">
            <span className="co-avatar"><Icon name="spark" /><i /></span>
            <div>
              <b>PeakX Coach <Chip tone="lime">AI coach</Chip></b>
              <span>{w ? 'Uses your food log, workouts and Fitbit data' : 'Uses your food log and workouts'}</span>
            </div>
            {messages.length ? <PillButton variant="ghost" size="sm" onClick={() => { dispatch({ type: 'coachClear' }); toast('Chat cleared'); }}>Clear</PillButton> : null}
          </header>
          <div className="co-log" role="log" aria-live="polite">
            {!messages.length ? (
              <div className="co-reply">
                <p>Hi {first || 'there'}. You have {fmt(Math.max(0, left.left))} kcal and {proteinLeft} g protein left today{plan && !plan.session.done ? `, with ${plan.session.name.toLowerCase()} at ${data.profile.gymTime}` : ''}. Ask me about meals, training or your plan.</p>
              </div>
            ) : null}
            {messages.map((m) => m.role === 'user' ? (
              <div key={m.id} className="co-me-wrap">
                <div className="co-me">{m.text}</div>
                <span className="ui-label">{first || 'You'} · {time(m.at)}</span>
              </div>
            ) : (
              <div key={m.id} className="co-reply">
                <p>{m.text}</p>
                {m.options?.length ? <OptionCards options={m.options} kcalLeft={left.left} onAdd={addToDinner} /> : null}
                <span className="ui-label">{time(m.at)}{m.source === 'rules' ? ' · worked out from your numbers' : ''}</span>
              </div>
            ))}
            {busy ? <div className="co-reply co-typing" aria-label="The Coach is typing"><span /><span /><span /></div> : null}
            <div ref={end} />
          </div>
          <form className="co-input" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about food, training or your plan" aria-label="Message PeakX Coach" maxLength={500} />
            <span className="ui-label co-left">{msgsLeft} left today</span>
            <button className="co-send" type="submit" aria-label="Send" disabled={busy || !text.trim()}><Icon name="up" /></button>
          </form>
        </section>
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 5' }}>
        <span className="hm-eyebrow plain co-knows">What the coach knows</span>
        <GlassCard className="co-me-card">
          <div className="co-profile">
            <Avatar name={data.profile.name} demo={data.demo} style={{ width: '64px', height: '64px' }} />
            <div>
              <b>{data.profile.name || 'Your profile'}</b>
              <span>{[data.profile.age ? `${data.profile.age}` : null, data.profile.city || null].filter(Boolean).join(' · ') || 'Add your details in Account'}</span>
            </div>
          </div>
          <div className="co-weight">
            <Stat value={trend.latest ? trend.avg ?? trend.latest.kg : null} dp={1} unit="kg" size="md" label="Current weight" empty="No weigh-ins yet" />
            {trend.latest && trend.change ? <Chip tone={trend.status === 'good' ? 'lime' : trend.status === 'off' ? 'coral' : 'neutral'}>{trend.change > 0 ? '+' : '−'}{Math.abs(trend.change)} kg this month</Chip> : null}
          </div>
        </GlassCard>
        {plateau.done && plateau.top ? (
          <GlassCard title={<span className="in-title"><Icon name="target" />Plateau check</span>} aside={<Badge tone={plateau.top.level === 'Low' ? 'neutral' : 'warn'}>{plateau.top.level}</Badge>}>
            <span className="ui-stat-cap">{plateau.headline}.</span>
          </GlassCard>
        ) : null}
        <GlassCard title="Last 7 days" aside={w ? <Badge>Synced</Badge> : null}>
          <ul className="co-week">
            <WeekRow icon="dumbbell" title="Workouts" sub={week.workouts.names.slice(0, 4).join(', ') || 'None logged yet'} value={<Chip tone={week.workouts.planned && week.workouts.done >= week.workouts.planned ? 'lime' : 'neutral'}>{week.workouts.done} / {week.workouts.planned} done</Chip>} />
            <WeekRow icon="bowl" title="Calories" sub={week.kcal !== null ? `Average ${fmt(week.kcal)} / ${fmt(week.kcalTarget ?? 0)} kcal` : 'No meals logged'} value={week.adherence !== null ? <b>{week.adherence}%</b> : null} />
            <WeekRow icon="target" title="Protein target hit" sub={week.protein !== null ? `Average ${Math.round(week.protein)} / ${data.targets.protein} g` : 'No meals logged'} value={week.loggedDays ? <b>{week.proteinDays}<small> / {week.loggedDays} days</small></b> : null} />
            <WeekRow icon="moon" title="Average sleep" sub={week.sleep !== null ? 'From your watch' : 'Connect a watch'} value={week.sleep !== null ? <b>{week.sleep.toFixed(1)} h</b> : null} />
            <WeekRow icon="steps" title="Daily steps" sub={week.steps !== null ? `Goal ${fmt(data.targets.steps)}` : 'Connect a watch'} value={week.steps !== null ? <b>{fmt(Math.round(week.steps))}</b> : null} />
          </ul>
        </GlassCard>
        <GlassCard title={<span className="ui-label">Quick questions</span>}>
          <div className="co-quick">
            {SUGGESTIONS.map((s) => <button key={s} type="button" disabled={busy} onClick={() => send(s)}><span>{s}</span><Icon name="back" /></button>)}
          </div>
          <span className="ui-label">{ai?.ai ? 'Answers come from the AI Coach, using your numbers.' : 'Answers come from your own numbers and our food table.'} Calories on option cards always come from the food table.</span>
        </GlassCard>
        <PersonCard />
      </div>
    </AppShell>
  );
}

function WeekRow({ icon, title, sub, value }: { icon: string; title: string; sub: string; value: React.ReactNode }) {
  return (
    <li>
      <span className="co-week-icon"><Icon name={icon} /></span>
      <span className="co-week-main"><b>{title}</b><span>{sub}</span></span>
      <span className="co-week-val">{value ?? <span className="ui-label">—</span>}</span>
    </li>
  );
}

function OptionCards({ options, kcalLeft, onAdd }: { options: CoachOption[]; kcalLeft: number; onAdd: (o: CoachOption) => void }) {
  const best = useMemo(() => options.reduce((b, o) => (o.macros.protein > b.macros.protein ? o : b), options[0]), [options]);
  return (
    <div className="co-opts">
      {options.map((o, i) => {
        const over = o.macros.kcal > Math.max(0, kcalLeft);
        return (
          <div key={i} className={`co-opt${over ? ' over' : ''}`}>
            <div className="co-opt-head">
              <span className="co-opt-icon"><Icon name="bowl" /></span>
              <div>
                <span className="co-opt-tag">{over ? 'Over what’s left' : o === best && options.length > 1 ? 'Most protein' : `Option ${i + 1}`}</span>
                <b>{o.name}</b>
              </div>
              <PillButton size="sm" variant={o === best && !over ? 'primary' : 'ghost'} icon="plus" onClick={() => onAdd(o)}>Add to dinner</PillButton>
            </div>
            <div className="co-opt-body">{fmt(o.macros.kcal)} kcal · {o.macros.protein} g protein · {o.macros.carbs} g carbs · {o.macros.fat} g fat · {o.amount}</div>
          </div>
        );
      })}
    </div>
  );
}

/** S20.2 · Your named coach (Coached), or the way to get one. */
function PersonCard() {
  const navigate = useNavigate();
  const { data } = useStore();
  const c = data.billing?.coach;
  if (c) {
    const first = data.profile.name.split(' ')[0] || 'there';
    return (
      <div className="px-card" style={{ gap: '6px' }}>
        <div className="px-card-head"><span className="px-card-title">Your coach</span><span className="px-status good">{data.plan === 'coached' ? 'Coached' : 'Assigned'}</span></div>
        <span className="px-num" style={{ fontSize: '30px', lineHeight: '34px' }}>{c.name}</span>
        <span className="px-body grey">Sees the same log, plan and reports as the AI Coach. Since {new Date(c.since).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.</span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
          {c.whatsapp ? <a className="px-pill" href={`https://wa.me/${c.whatsapp}?text=${encodeURIComponent(`Hi ${c.name.split(' ')[0]}, it's ${first} from PeakX.`)}`} target="_blank" rel="noreferrer"><Icon name="phone" style={{ width: '13px', height: '13px' }} /> WhatsApp</a> : null}
          {c.bookingUrl ? <a className="px-pill" href={c.bookingUrl} target="_blank" rel="noreferrer"><Icon name="cal" style={{ width: '13px', height: '13px' }} /> Book this week’s call</a> : null}
          {!c.whatsapp && !c.bookingUrl ? <span className="px-meta">Your coach will message you with how to reach them.</span> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="px-card" style={{ gap: '6px' }}>
      <div className="px-card-head"><span className="px-card-title">Want a person?</span><span className="px-status">{data.coachRequest ? 'Requested' : 'Coached'}</span></div>
      <span className="px-body grey">{data.coachRequest ? 'A coach will message you within a day. Their WhatsApp and booking link show up here once you’re matched.' : 'A named coach, a weekly call and WhatsApp. They see the same data the AI Coach does.'}</span>
      {data.coachRequest ? null : <button className="px-pill" type="button" style={{ alignSelf: 'flex-start', marginTop: '2px' }} onClick={() => navigate('/app/upgrade')}>See Coached</button>}
    </div>
  );
}
