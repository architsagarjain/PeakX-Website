import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { useCatalogue } from '../components/FoodLog';
import { useStore, SLOT_TIME } from '../state/store';
import { dayTotals, kcalTarget, mealsOn, recoveryNote, SLOT_LABEL, wearableOn, weekPlanDays, workoutDetail } from '../state/selectors';
import { dayDiet, dayStatus, groceryList, groceryText, mealHas, mealMacros, planKey, planWeek, replanDay, swapMeal, weekdayIndex, type DayTarget } from '../domain/mealPlan';
import { amountLabel, itemFrom } from '../domain/foodSearch';
import { RECIPES, recipeMacros } from '../domain/seed';
import { addDays, dayNum, parse, shortDay, today, weekStart } from '../domain/clock';
import { clock12 } from '../domain/onboarding';
import { fmt } from '../domain/nutrition';
import type { MealSlot, PlannedItem } from '../domain/types';
import { GlassCard, Stat, MacroBar, DarkBand, EmptyState, Chip, Badge, PillButton } from '../components/ui/blocks';

const LK = { recipes: RECIPES, recipeMacros };
const mon = (d: string) => parse(d).toLocaleDateString('en-GB', { month: 'short' });
const long = (d: string) => parse(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtG = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(g % 1000 ? 1 : 0)} kg` : `${g} g`);
const STATUS = { done: 'Done', missed: 'Not logged', today: 'Today', planned: 'Planned' } as const;

/** W11 · Plan (S14.1 meal plan, Pro): the week's workouts and meals, a day's meals with swap and log, its workout against last session, and recovery. */
export default function W11MealPlan() {
  const { data, dispatch, can, newId } = useStore();
  const toast = useToast();
  const cat = useCatalogue();
  const t = today();
  const ws = weekStart(t);
  const diet = data.profile.diet;
  const vegDays = data.profile.vegDays ?? [];
  const key = planKey(diet, vegDays);
  // A plan built for another diet (or before veg days existed) is out of date: rebuild it.
  const plan = data.mealPlan?.weekStart === ws && data.mealPlan.dietKey === key ? data.mealPlan : null;
  const [sel, setSel] = useState(t);
  const target = (d: string): DayTarget => ({ kcal: kcalTarget(data, d).base, protein: data.targets.protein });
  const rebuild = () => { dispatch({ type: 'setMealPlan', plan: planWeek(ws, target, diet, LK, vegDays) }); };

  useEffect(() => { if (!plan && can('mealPlan')) rebuild(); /* eslint-disable-next-line */ }, [plan, ws]);
  const mixed = diet === 'nonveg' || diet === 'egg';
  const isVegDay = vegDays.includes(weekdayIndex(sel));
  const toggleVegDay = () => {
    const wd = weekdayIndex(sel);
    const next = isVegDay ? vegDays.filter((x) => x !== wd) : [...vegDays, wd];
    dispatch({ type: 'setVegDays', days: next, plan: plan ? replanDay(plan, sel, target(sel), diet, LK, next) : undefined });
    toast(isVegDay ? `${long(sel).split(' ')[0]}s are back to ${diet === 'egg' ? 'egg' : 'non-veg'} meals` : `${long(sel).split(' ')[0]}s are veg days now, every week`, 'good');
  };

  const list = useMemo(() => (plan ? groceryList(plan, LK) : []), [plan]);
  const weekLabel = `${dayNum(ws)}–${dayNum(addDays(ws, 6))} ${mon(addDays(ws, 6))}`;
  const days = weekPlanDays(data, t);
  const day = plan?.days.find((d) => d.date === sel) ?? null;
  const workout = workoutDetail(data, sel);
  const eaten = dayTotals(data, sel);
  const logged = mealsOn(data, sel);
  const dayTarget = kcalTarget(data, sel).total;
  const w = wearableOn(data, t);
  const note = recoveryNote(data, t);
  const planned = day ? dayStatus(day, target(day.date), LK) : null;
  const main = workout?.exercises[0];
  const rest = workout?.exercises.slice(1) ?? [];

  const label = (it: PlannedItem) => {
    const l = cat.find((c) => c.kind === it.kind && c.id === it.id);
    if (!l) return '';
    if (it.kind === 'dish') { const exact = l.portions.find((p) => p.grams === Math.round(it.servings * 100)); return exact ? exact.label : amountLabel(l.portions[l.defaultPortion], it.servings); }
    return amountLabel(l.portions[0], it.servings);
  };
  const logMeal = (slot: MealSlot) => {
    if (!day) return;
    const m = day.meals.find((x) => x.slot === slot)!;
    const items = m.items.map((it) => {
      const l = cat.find((c) => c.kind === it.kind && c.id === it.id)!;
      const pi = it.kind === 'dish' ? l.defaultPortion : 0;
      return { ...itemFrom(l, pi, it.servings, newId('it'), it.kind === 'recipe' ? 'recipe' : 'typed') };
    });
    dispatch({ type: 'logItems', date: day.date, slot, time: SLOT_TIME[slot], items });
    dispatch({ type: 'markPlannedLogged', date: day.date, slot });
    toast(`${m.name} logged as ${SLOT_LABEL[slot].toLowerCase()} · ${fmt(mealMacros(m, LK).kcal)} kcal`, 'good');
  };
  const swap = (slot: MealSlot) => {
    if (!plan || !day) return;
    const next = swapMeal(plan, day.date, slot, target(day.date), dayDiet(diet, vegDays, day.date), LK);
    dispatch({ type: 'setMealPlan', plan: next });
    const m = next.days.find((d) => d.date === day.date)!.meals.find((x) => x.slot === slot)!;
    toast(`Swapped to ${m.name}`);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(groceryText(list, weekLabel)); toast('Grocery list copied', 'good'); }
    catch { toast('Couldn’t copy. Use Download instead.'); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([groceryText(list, weekLabel)], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = `peakx-groceries-${ws}.txt`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <AppShell
      active="plan" title="This week" feature="mealPlan"
      crumb={<>Your workout and meal plan for {long(ws)} to {long(addDays(ws, 6))}</>}
      headAside={(
        <div className="pl-head-aside">
          <Chip tone="lime">Daily target: {fmt(data.targets.kcalTraining)} kcal · {data.targets.protein} g protein</Chip>
          {can('mealPlan') ? <PillButton variant="ghost" size="sm" icon="swap" onClick={() => { rebuild(); toast('New meal plan for this week', 'good'); }}>Rebuild meals</PillButton> : null}
        </div>
      )}
    >
      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <div className="pl-days" role="tablist" aria-label="Day of the week">
          {days.map((x) => (
            <button key={x.date} type="button" role="tab" aria-selected={x.date === sel} className={`pl-day s-${x.status}${x.date === sel ? ' on' : ''}`} onClick={() => setSel(x.date)}>
              <span className="pl-day-top"><span>{shortDay(x.date)} {dayNum(x.date)}</span>{x.status === 'done' ? <Icon name="check" /> : x.status === 'today' ? <i className="pl-today">Today</i> : null}</span>
              <b>{x.label}</b>
              <span className="pl-day-foot"><span>{fmt(x.target)} kcal</span><span>{STATUS[x.status]}</span></span>
              <span className="ui-track"><span style={{ width: `${Math.min(100, (x.eaten / Math.max(1, x.target)) * 100)}%` }} /></span>
            </button>
          ))}
        </div>
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 5' }}>
        <GlassCard title={sel === t ? 'Today’s meals' : `Meals · ${shortDay(sel)} ${dayNum(sel)}`} aside={<span className="pl-pct">{Math.round((eaten.kcal / Math.max(1, dayTarget)) * 100)}%<small>eaten</small></span>}>
          <span className="ui-stat-cap">Logged {fmt(eaten.kcal)} / {fmt(dayTarget)} kcal · Protein {fmt(eaten.protein)} / {data.targets.protein} g</span>
          <div className="ui-track pl-meals-track"><span className="t-lime" style={{ width: `${Math.min(100, (eaten.kcal / Math.max(1, dayTarget)) * 100)}%` }} /></div>
          {planned ? <span className="ui-label">The plan for this day adds up to {fmt(planned.kcal)} kcal and {fmt(planned.protein)} g protein{planned.kcalOk ? ', within 5% of target' : ''}.</span> : null}
          {mixed && can('mealPlan') ? (
            <label className="pl-vegday">
              <input type="checkbox" checked={isVegDay} onChange={toggleVegDay} />
              <span><b>Veg day</b> · only vegetarian meals on {long(sel).split(' ')[0]}s{isVegDay ? '' : `. Use it for days you can’t have ${diet === 'egg' ? 'eggs' : 'non-veg'} at home.`}</span>
            </label>
          ) : null}
        </GlassCard>
        {day ? day.meals.map((m, i) => {
          const mm = mealMacros(m, LK);
          const done = m.logged || logged.some((x) => x.slot === m.slot);
          return (
            <GlassCard key={m.slot} className={`pl-meal${done ? ' done' : ''}`}>
              <div className="pl-meal-head">
                <span className="ui-label">Meal {i + 1} · {clock12(SLOT_TIME[m.slot])}</span>
                {done ? <Badge tone="good"><Icon name="check" />Logged</Badge> : <Badge>Planned</Badge>}
              </div>
              <div className="pl-meal-main">
                <div>
                  <h3>{mixed ? <DietDot kind={mealHas(m, 'nonveg', LK) ? 'nonveg' : mealHas(m, 'egg', LK) ? 'egg' : 'veg'} /> : null}{m.name}</h3>
                  <span className="pl-meal-sub">{m.items.map((it) => `${cat.find((c) => c.kind === it.kind && c.id === it.id)?.name.replace(/ \(.*\)/, '') ?? it.id} · ${label(it)}`).join(' + ')}</span>
                  <span className="pl-meal-mac">{fmt(mm.protein)} g P · {fmt(mm.carbs)} g C · {fmt(mm.fat)} g F</span>
                </div>
                <Chip tone={done ? 'neutral' : 'lime'}>{fmt(mm.kcal)} kcal</Chip>
              </div>
              {done ? null : (
                <div className="pl-meal-actions">
                  <button type="button" className="pl-swap" onClick={() => swap(m.slot)}><Icon name="swap" />Swap meal</button>
                  {day.date <= t ? <PillButton size="sm" onClick={() => logMeal(m.slot)}>Log now</PillButton> : <span className="ui-label">Log on the day</span>}
                </div>
              )}
            </GlassCard>
          );
        }) : (
          <GlassCard><EmptyState icon="list" text="No meal plan for this week yet." action={{ label: 'Build this week’s plan', onClick: rebuild }} /></GlassCard>
        )}
        {plan ? (
          <GlassCard title="Grocery list" aside={<><PillButton variant="ghost" size="sm" onClick={copy}>Copy</PillButton><PillButton variant="ghost" size="sm" icon="download" onClick={download} aria-label="Download grocery list">Save</PillButton></>}>
            <details className="pl-grocery-details">
            <summary>{list.reduce((n, g) => n + g.items.length, 0)} items for {weekLabel}, summed and rounded up</summary>
            <div className="pl-groceries">
              {list.map((g) => (
                <div key={g.group}>
                  <span className="ui-label">{g.group}</span>
                  <ul>{g.items.map((i) => <li key={i.name}><span>{i.name}</span><b>{fmtG(i.grams)}</b></li>)}</ul>
                </div>
              ))}
            </div>
            </details>
          </GlassCard>
        ) : null}
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        {workout ? (
          <>
            <GlassCard className="pl-workout">
              <div className="pl-workout-head">
                <div>
                  <span className="hm-eyebrow pl-eyebrow">{sel === t ? 'Today’s workout' : `${shortDay(sel)} ${dayNum(sel)} workout`}</span>
                  <h2>{workout.session.name}</h2>
                  <span className="ui-label pl-workout-meta"><Icon name="clock" />{clock12(workout.session.time)} <Icon name="dumbbell" />{workout.exercises.length} exercises</span>
                </div>
                {sel === t ? <PillButton variant="accent" icon={workout.session.done ? 'check' : 'play'} to="/app/log/workout">{workout.session.done ? 'See the session' : workout.saved ? 'Continue workout' : 'Start workout'}</PillButton>
                  : sel < t ? <Badge>{workout.session.done ? 'Done' : 'Not logged'}</Badge> : <Badge>Planned</Badge>}
              </div>
            </GlassCard>
            {main ? (
              <GlassCard className="pl-main">
                <div className="pl-main-head">
                  <div>
                    <span className="pl-main-tags"><span className="ui-label">Exercise 01 · main lift</span>{main.change && main.change > 0 ? <Chip tone="lime">+{main.change} kg from last time</Chip> : null}</span>
                    <h3>{main.name}</h3>
                    <span className="ui-stat-cap">Target: {main.plannedSets} sets × {main.reps} reps{main.targetKg ? ` @ ${main.targetKg} kg` : ''}{main.last ? ` · last session was ${main.last.kg} kg × ${main.last.reps}` : ' · first time logging this'}</span>
                  </div>
                  {main.targetKg ? <Badge><Icon name="target" />Target {main.targetKg} kg</Badge> : null}
                </div>
                <table className="pl-sets">
                  <thead><tr><th scope="col">Set</th><th scope="col">Target</th><th scope="col">Logged</th><th scope="col">Status</th></tr></thead>
                  <tbody>
                    {Array.from({ length: main.plannedSets }, (_, i) => {
                      const s = main.sets[i];
                      const next = !s && i === main.sets.length && sel === t;
                      return (
                        <tr key={i} className={next ? 'next' : s ? 'done' : undefined}>
                          <th scope="row">Set {i + 1}</th>
                          <td>{main.targetKg ? `${main.targetKg} kg × ${main.reps}` : `${main.reps} reps`}</td>
                          <td>{s ? `${s.kg} kg × ${s.reps}` : '—'}</td>
                          <td>{s ? <Badge tone="good"><Icon name="check" />Done</Badge> : next ? <Chip tone="lime">Next set</Chip> : <span className="ui-label">Upcoming</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {main.note ? <span className="ui-label">{main.note}</span> : null}
              </GlassCard>
            ) : null}
            {rest.map((e, i) => (
              <GlassCard key={e.name} className="pl-ex">
                <span className="pl-ex-n">{String(i + 2).padStart(2, '0')}</span>
                <div className="pl-ex-main">
                  <b>{e.name}</b>
                  <span>{e.plannedSets} sets × {e.reps} reps{e.targetKg ? ` @ ${e.targetKg} kg` : ''}{e.last ? ` · last ${e.last.kg} kg × ${e.last.reps}` : ''}</span>
                </div>
                {e.sets.length >= e.plannedSets ? <Badge tone="good">Done</Badge> : e.sets.length ? <Badge>{e.sets.length} of {e.plannedSets}</Badge> : <Badge>Upcoming</Badge>}
              </GlassCard>
            ))}
          </>
        ) : (
          <GlassCard className="pl-workout">
            <span className="hm-eyebrow pl-eyebrow">{sel === t ? 'Today' : `${shortDay(sel)} ${dayNum(sel)}`}</span>
            <h2 className="pl-rest-title">Rest day</h2>
            <p className="pl-rest">Walk, stretch and still hit your protein. Muscle grows on rest days.</p>
            {sel <= t ? <PillButton variant="ghost" to="/app/log/workout" icon="dumbbell">Log a workout anyway</PillButton> : null}
          </GlassCard>
        )}
      </div>

      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <DarkBand eyebrow={w ? 'Synced today' : undefined} title="Recovery today" status={w ? null : <PillButton variant="band" size="sm" to="/app/devices">Connect a device</PillButton>}>
          <GlassCard variant="band" title={<span className="ui-label">Sleep</span>}>
            <Stat value={w ? w.sleepHours : null} dp={1} unit="h" caption={w ? `Target ${data.targets.sleepHours} h` : undefined} empty="Connect Fitbit or Google Fit to see last night’s sleep." />
          </GlassCard>
          <GlassCard variant="band" title={<span className="ui-label">Resting heart rate</span>}>
            <Stat value={w ? w.restingHr : null} unit="bpm" empty="Shows here after your first sync." />
          </GlassCard>
          <GlassCard variant="band" title={<span className="ui-label">Steps so far</span>}>
            <Stat value={w ? w.steps : null} unit={`/ ${fmt(data.targets.steps)}`} empty="Shows here after your first sync." />
            {w ? <MacroBar label="Daily goal" consumed={w.steps} target={data.targets.steps} unit="" tone="lime" /> : null}
          </GlassCard>
          <GlassCard variant="band" title={<span className="ui-label pl-advice">Before you train</span>}>
            <p className="lg-tip">{note ?? 'Sleep and heart rate from your watch help pick today’s weights. Until then, go by how the warm-up feels.'}</p>
          </GlassCard>
        </DarkBand>
      </div>
    </AppShell>
  );
}

/** The Indian food mark: green dot for veg, brown for non-veg, yellow for egg. */
function DietDot({ kind }: { kind: 'veg' | 'egg' | 'nonveg' }) {
  const label = kind === 'nonveg' ? 'Non-veg' : kind === 'egg' ? 'Egg' : 'Veg';
  return <span className={`pl-diet pl-diet-${kind}`} role="img" aria-label={label} title={label} />;
}
