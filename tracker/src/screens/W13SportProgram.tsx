import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { Chips } from '../components/Wizard';
import { useStore } from '../state/store';
import { addDays, dayNum, longDate, parse, shortDay, today, weekStart } from '../domain/clock';
import { clock12 } from '../domain/onboarding';
import { fmt } from '../domain/nutrition';
import { SPORTS, matchDayMeals, matchDayTargets, nextMatch, phaseDates, programWeek, programWeekNo, type SportId } from '../domain/sport';

const IDS = Object.keys(SPORTS) as SportId[];
const short = (d: string) => `${dayNum(d)} ${parse(d).toLocaleDateString('en-GB', { month: 'short' })}`;
const daysAway = (d: string) => Math.round((parse(d).getTime() - parse(today()).getTime()) / 864e5);
const MEAL_ICON = { Pre: 'bowl', 'Top-up': 'cup', During: 'drop', Post: 'grain' } as const;

/** W13 · Sport program · Pro. 8-week blocks; match days move the week; match-day meals. */
export default function W13SportProgram() {
  const { data, dispatch } = useStore();
  const t = today();
  const s = data.sport;

  if (!s) {
    return (
      <AppShell active="plan" title="Plan" crumb={<>Sport program <span className="px-pro" style={{ marginLeft: '6px' }}>Pro</span></>} cols="repeat(12, minmax(0, 1fr))" feature="sportProgram">
        <div className="wb-col" style={{ gridColumn: 'span 7' }}>
          <div className="px-card" style={{ gap: '14px', padding: '26px' }}>
            <h2 className="px-q" style={{ fontSize: '36px', lineHeight: '40px' }}>Train for your sport</h2>
            <p className="px-body grey" style={{ margin: 0 }}>An 8-week strength and conditioning block that moves around your match days, with meals for match day.</p>
            <Chips label="Sport" options={IDS.map((i) => SPORTS[i].name)} value={[]} onChange={([v]) => dispatch({ type: 'setSport', sport: IDS.find((i) => SPORTS[i].name === v)!, start: weekStart(t) })} />
          </div>
        </div>
      </AppShell>
    );
  }
  return <Program />;
}

function Program() {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const t = today();
  const s = data.sport!;
  const sp = SPORTS[s.sport];
  const week = programWeekNo(s.start, t);
  const days = programWeek(s, t);
  const done = days.filter((d) => d.date < t && d.kind === 'session').length;
  const planned = days.filter((d) => d.kind === 'session' || d.kind === 'light').length;
  const next = nextMatch(s, t);
  const meals = next ? matchDayMeals(data.profile.diet, next.time) : [];
  const md = matchDayTargets(data.targets);
  const [date, setDate] = useState(addDays(t, 7));
  const [time, setTime] = useState('10:00');
  const [label, setLabel] = useState(`${sp.matchWord}`);
  const finished = week > 8;

  const add = () => {
    if (!date || date < t) { toast('Pick a date from today on.'); return; }
    dispatch({ type: 'addMatch', match: { id: newId('match'), date, time, label: label.trim() || sp.matchWord } });
    toast(`${label || sp.matchWord} added for ${shortDay(date)} ${short(date)} · the week around it adjusts`, 'good');
  };

  return (
    <AppShell active="plan" title="Plan" crumb={<>Sport program <span className="px-pro" style={{ marginLeft: '6px' }}>Pro</span></>} cols="repeat(12, minmax(0, 1fr))" feature="sportProgram">
      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 6px', gap: '12px', flexWrap: 'wrap' }}>
          <div className="wb-hero">
            <span className="px-hero-label">Strength &amp; conditioning · {sp.name.toLowerCase()}</span>
            <div className="fig"><span className="px-num xl">{Math.min(8, Math.max(1, week))}</span><span className="px-suffix">/ 8 weeks</span></div>
            <span style={{ marginTop: '6px' }}><span className={`px-status${done ? ' good' : ''}`}>{finished ? 'Block finished · start a new one' : `${done} of ${planned} sessions done this week`}</span></span>
          </div>
          <Chips label="Sport" options={IDS.map((i) => SPORTS[i].name)} value={[sp.name]} onChange={([v]) => { const id = IDS.find((i) => SPORTS[i].name === v)!; if (id !== s.sport) { dispatch({ type: 'setSport', sport: id, start: weekStart(t) }); toast(`${v} program starts this week`); } }} />
        </div>
        <div className="px-card" style={{ gap: '10px' }}>
          <div className="px-card-head"><span className="px-card-title">This week</span><span className="px-meta">{short(days[0].date)} – {short(days[6].date)} · {planned} sessions</span></div>
          <div className="px-week">
            {days.map((d) => (
              <div key={d.date} title={d.note}>
                <span className={`px-date${d.date === t ? ' on' : ''}`} style={{ width: '42px', height: '42px', ...(d.kind === 'match' ? { boxShadow: 'inset 0 0 0 1.5px #1A1A1A' } : {}) }}><small>{shortDay(d.date)}</small>{dayNum(d.date)}</span>
                <span className="px-meta" style={{ color: d.kind === 'match' ? 'var(--text)' : undefined, fontWeight: d.kind === 'match' ? 500 : 400 }}>{d.label}</span>
                <span style={{ font: '500 10px/10px var(--font-body)', color: d.date < t && d.kind === 'session' ? 'var(--lime-ink)' : 'transparent' }}>✓</span>
              </div>
            ))}
          </div>
          {days.some((d) => d.note && d.kind !== 'match') ? (
            <ul className="px-meta" style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {days.filter((d) => d.note && d.kind !== 'match').map((d) => <li key={d.date}>{shortDay(d.date)} {d.label}: {d.note}</li>)}
            </ul>
          ) : null}
        </div>
        <div className="px-card" style={{ gap: '0' }}>
          <div className="px-card-head"><span className="px-card-title">8-week block</span><span className="px-meta">Started {short(s.start)}</span></div>
          <div className="px-list">
            {sp.phases.map((p) => {
              const [a, b] = phaseDates(s, p);
              const ms = s.matches.filter((m) => m.date >= a && m.date <= b);
              const state = t > b ? 'Done' : t >= a ? 'Now' : '';
              return (
                <div className="px-row" key={p.name}>
                  <span className="px-row-icon"><span className="n" style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{p.weeks[0]}–{p.weeks[1]}</span></span>
                  <span className="px-row-main"><span className="px-row-title">{p.name}</span><span className="px-row-sub">{short(a)} – {short(b)} · {p.focus}</span></span>
                  <span className="px-row-end">
                    <span className="px-row-value">{ms.length ? ms.map((m) => `${shortDay(m.date)} ${short(m.date)}`).join(', ') : state}</span>
                    {ms.length ? <span className="px-status">{ms.length > 1 ? `${sp.matchWord} days` : `${sp.matchWord} day`}{state ? ` · ${state.toLowerCase()}` : ''}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 5' }}>
        <div className="px-card" style={{ gap: '6px' }}>
          <div className="px-card-head">
            <span className="px-card-title">Next {sp.matchWord.toLowerCase()}</span>
            {next ? <button className="px-pill sm" type="button" onClick={() => navigate('/app/devices')}>Add to Google Calendar</button> : null}
          </div>
          {next ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline' }}><span className="px-num lg">{dayNum(next.date)}</span><span className="px-suffix">{parse(next.date).toLocaleDateString('en-GB', { month: 'short' })} · {longDate(next.date).split(' ')[0]}, {clock12(next.time)}</span></div>
              <span className="px-meta">{next.label} · {daysAway(next.date) === 0 ? 'today' : `${daysAway(next.date)} days away`} · the day before becomes a light session</span>
            </>
          ) : <span className="px-body grey">No {sp.matchWord.toLowerCase()}es planned. Add one below and the week moves around it.</span>}
          <form className="px-stack" style={{ gap: '8px', marginTop: '8px' }} onSubmit={(e) => { e.preventDefault(); add(); }}>
            <div className="px-fields" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
              <label className="px-field"><span className="l">Date</span><span className="px-field-row"><input type="date" min={t} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Match date" style={{ fontSize: '18px' }} /></span></label>
              <label className="px-field"><span className="l">Start</span><span className="px-field-row"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Start time" style={{ fontSize: '18px' }} /></span></label>
            </div>
            <div className="px-inline-form">
              <label className="px-field"><span className="l">Name</span><span className="px-field-row"><input value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Match name" style={{ fontSize: '18px' }} /></span></label>
              <button className="px-cta" type="submit" style={{ flex: '0 0 auto', height: 'auto', minHeight: '46px', fontSize: '17px', padding: '0 22px' }}>Add {sp.matchWord.toLowerCase()}</button>
            </div>
          </form>
          {s.matches.filter((m) => m.date >= t).length ? (
            <div className="px-list" style={{ marginTop: '4px' }}>
              {s.matches.filter((m) => m.date >= t).map((m) => (
                <div className="px-row" key={m.id}>
                  <span className="px-row-icon"><Icon name="cal" /></span>
                  <span className="px-row-main"><span className="px-row-title">{m.label}</span><span className="px-row-sub">{shortDay(m.date)} {short(m.date)} · {clock12(m.time)}</span></span>
                  <button className="px-icon sm" type="button" aria-label={`Remove ${m.label} on ${short(m.date)}`} onClick={() => { dispatch({ type: 'removeMatch', id: m.id }); toast('Removed · the week goes back to normal'); }}><Icon name="close" /></button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {next ? (
          <div className="px-card" style={{ gap: '0' }}>
            <div className="px-card-head"><span className="px-card-title">{sp.matchWord}-day meals</span><span className="px-pill sm" style={{ cursor: 'default' }}>{shortDay(next.date)} {short(next.date)}</span></div>
            <span className="px-subhead">Carbs +80 g on {sp.matchWord.toLowerCase()} day ({fmt(md.kcalTraining)} kcal); protein stays at {md.protein} g</span>
            <div className="px-list">
              {meals.map((m) => (
                <div className="px-row" key={m.tag}>
                  <span className="px-row-icon"><Icon name={MEAL_ICON[m.tag]} /></span>
                  <span className="px-row-main"><span className="px-row-title">{m.name}</span><span className="px-row-sub">{clock12(m.time)} · {m.when}</span></span>
                  <span className="px-row-end"><span className="px-row-value">{m.macros.kcal ? `${fmt(m.macros.kcal)} kcal` : '—'}</span><span className="px-status">{m.tag}</span></span>
                </div>
              ))}
            </div>
            <span className="px-meta" style={{ marginTop: '8px' }}>Draft guidance for coach review. Nutrition estimated from IFCT 2017.</span>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
