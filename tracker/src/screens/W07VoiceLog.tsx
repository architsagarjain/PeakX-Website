import { useState } from 'react';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { ParsedItems, VoiceCapture, useVoiceLog } from '../components/VoiceLogPanel';
import { EditItemDialog, FoodLogPanel } from '../components/FoodLog';
import { useStore } from '../state/store';
import { addDays, dayNum, longDate, shortDay, today, weekStart } from '../domain/clock';
import { fmt } from '../domain/nutrition';
import { clock12 } from '../domain/onboarding';
import type { MealItem, MealSlot } from '../domain/types';
import { afterMeal, dayTotals, loggedDays, mealsOn, mealTotal, SLOT_LABEL, SLOTS } from '../state/selectors';
import { GlassCard, Stat, MacroBar, DarkBand, Chip, Badge, PillButton } from '../components/ui/blocks';
import { WeekStrip } from '../components/ui/WeekStrip';

/** W07 · Log: voice first (mic, transcript, parsed items with missing-amount chips), typed search as the other mode, the day's timeline and where the day lands after this meal. */
export default function W07VoiceLog() {
  const { data } = useStore();
  const t = today();
  const [day, setDay] = useState(t);
  const [mode, setMode] = useState<'voice' | 'type'>('voice');
  const [editing, setEditing] = useState<{ mealId: string; item: MealItem; slot: MealSlot } | null>(null);
  const v = useVoiceLog(day);
  const meals = mealsOn(data, day);
  const eaten = dayTotals(data, day);
  const now = afterMeal(data, day);
  const after = afterMeal(data, day, v.total);
  const logged = loggedDays(data, day);
  const isToday = day === t;
  const dayLabel = isToday ? 'today' : `on ${shortDay(day)} ${dayNum(day)}`;

  return (
    <AppShell
      active="log" title="Log your food" crumb={<>Speak in English or Hindi, or type what you ate · {longDate(day)}</>}
      headAside={(
        <div className="lg-mode-toggle" role="radiogroup" aria-label="How to log">
          <button type="button" role="radio" aria-checked={mode === 'voice'} className={mode === 'voice' ? 'on' : undefined} onClick={() => setMode('voice')}><Icon name="mic" />Voice</button>
          <button type="button" role="radio" aria-checked={mode === 'type'} className={mode === 'type' ? 'on' : undefined} onClick={() => setMode('type')}><Icon name="search" />Type food</button>
        </div>
      )}
    >
      {editing ? <EditItemDialog {...editing} onClose={() => setEditing(null)} /> : null}
      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        {mode === 'voice' ? (
          <>
            <VoiceCapture v={v} />
            <ParsedItems v={v} left={now.left} />
          </>
        ) : <FoodLogPanel date={day} />}
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 5' }}>
        <GlassCard
          title={<span className="ui-label">Calories {dayLabel}</span>}
          aside={<Chip tone={now.left >= 0 ? 'lime' : 'coral'}>{now.left >= 0 ? `${fmt(now.left)} kcal left` : `${fmt(-now.left)} kcal over`}</Chip>}
        >
          <Stat value={eaten.kcal} unit={`/ ${fmt(now.target)} kcal`} />
          <div className="ui-track lg-kcal-track"><span style={{ width: `${Math.min(100, (eaten.kcal / Math.max(1, now.target)) * 100)}%` }} /></div>
          <div className="lg-macros">
            <MacroBar label="Protein" consumed={eaten.protein} target={data.targets.protein} tone="lime" />
            <MacroBar label="Carbs" consumed={eaten.carbs} target={data.targets.carbs} />
            <MacroBar label="Fat" consumed={eaten.fat} target={data.targets.fat} />
          </div>
        </GlassCard>

        <GlassCard title={isToday ? 'Today’s timeline' : `${shortDay(day)} ${dayNum(day)}`} aside={<Badge>{meals.length} of 4 logged</Badge>}>
          <div className="lg-days">
            <button type="button" className="ax-icon" aria-label="Earlier week" onClick={() => setDay(addDays(weekStart(day), -1))}><Icon name="back" /></button>
            <WeekStrip date={day} today={t} selected={day} max={t} logged={(x) => logged.has(x)} onSelect={setDay} label="Day to log" />
            <button type="button" className="ax-icon lg-next" aria-label="Later week" disabled={addDays(weekStart(day), 7) > t} onClick={() => { const n = addDays(weekStart(day), 7); setDay(n > t ? t : n); }}><Icon name="back" /></button>
          </div>
          <ol className="lg-timeline">
            {SLOTS.map((s) => {
              const m = meals.find((x) => x.slot === s);
              const current = v.pending && v.slot === s;
              const tot = m ? mealTotal(m) : null;
              return (
                <li key={s} className={`${m ? 'done' : ''}${current ? ' current' : ''}`}>
                  <span className="lg-dot" aria-hidden="true" />
                  <div className="lg-slot">
                    <div className="lg-slot-head">
                      <b>{SLOT_LABEL[s]}</b>
                      {m ? <span className="ui-label">{clock12(m.time)}</span> : null}
                      {current ? <Badge>Adding now</Badge> : null}
                      <span className="lg-slot-kcal">{tot ? <>{fmt(tot.kcal)} kcal · {fmt(tot.protein)} g P</> : current ? <>~{fmt(v.total.kcal)} kcal</> : null}</span>
                    </div>
                    {m ? (
                      <ul className="lg-slot-items">
                        {m.items.map((it) => (
                          <li key={it.id}>
                            <button type="button" onClick={() => setEditing({ mealId: m.id, item: it, slot: m.slot })} aria-label={`Edit ${it.name}, ${it.amount}, ${it.macros.kcal} kcal`}>
                              <span>{it.name} <i>{it.amount}{it.estimated ? ' · estimated' : ''}</i></span>
                              <Icon name="edit" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : current ? <span className="ui-label">{v.rows.map((r) => r.match?.name ?? r.query).join(', ')}</span>
                      : <button type="button" className="lg-slot-add" onClick={() => { v.setSlot(s); setMode('voice'); }}>Not logged · log by voice</button>}
                  </div>
                </li>
              );
            })}
          </ol>
        </GlassCard>
      </div>

      {v.pending ? (
      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <DarkBand title="After this meal" status={<Badge>Not saved yet</Badge>}>
          <GlassCard variant="band" title={<span className="ui-label">Calories left after this</span>}>
            <Stat value={Math.abs(after.left)} unit={after.left >= 0 ? 'kcal left' : 'kcal over'} caption={`Target ${fmt(after.target)} kcal`} />
            <MacroBar label="Of today’s target" consumed={after.target - after.left} target={after.target} unit=" kcal" tone="lime" />
          </GlassCard>
          <GlassCard variant="band" title={<span className="ui-label">Protein</span>}>
            <Stat value={after.protein} unit={`/ ${fmt(after.proteinTarget)} g`} caption={after.gap ? `${after.gap} g to go` : 'Target reached'} />
            <MacroBar label={after.gap ? 'Almost there' : 'Done'} consumed={after.protein} target={after.proteinTarget} tone="lime" />
          </GlassCard>
          <GlassCard variant="band" title={<span className="ui-label">Coach tip</span>}>
            <p className="lg-tip">{after.tip}</p>
            <PillButton variant="accent" onClick={v.log} disabled={v.blocked > 0}>Save to {SLOT_LABEL[v.slot].toLowerCase()}</PillButton>
          </GlassCard>
        </DarkBand>
      </div>
      ) : null}
    </AppShell>
  );
}
