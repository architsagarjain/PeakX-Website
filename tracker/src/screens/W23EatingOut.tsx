import { useState } from 'react';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { AppShell } from '../components/Shell';
import { Chips } from '../components/Wizard';
import { useStore, SLOT_TIME } from '../state/store';
import { remaining, SLOT_LABEL, SLOTS, slotFor } from '../state/selectors';
import { PLACES, isEstimated, orderMacros, orderTag, type Order } from '../domain/eatingOut';
import { fmt } from '../domain/nutrition';
import { today } from '../domain/clock';
import type { MealSlot } from '../domain/types';

/** W23 · Eating out (S14.3, Pro): what to order by type of place, with kcal and protein per order. */
export default function W23EatingOut() {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const t = today();
  const [placeId, setPlaceId] = useState(PLACES[0].id);
  const [slot, setSlot] = useState<MealSlot>(slotFor(new Date().getHours()) === 'breakfast' ? 'lunch' : slotFor(new Date().getHours()));
  const place = PLACES.find((p) => p.id === placeId)!;
  const left = remaining(data, t).left;
  const orders = place.orders.map((o) => ({ o, m: orderMacros(o) })).sort((a, b) => (b.m.protein / b.m.kcal) - (a.m.protein / a.m.kcal));

  const log = (o: Order) => {
    const m = orderMacros(o);
    dispatch({ type: 'logItems', date: t, slot, time: SLOT_TIME[slot], items: [{ id: newId('it'), name: o.name, amount: place.name, macros: m, source: 'typed', estimated: true }] });
    toast(`${o.name} logged as ${SLOT_LABEL[slot].toLowerCase()} · ${fmt(m.kcal)} kcal`, 'good');
  };

  return (
    <AppShell active="plan" title="Plan" crumb={<>Eating out <span className="px-pro" style={{ marginLeft: '6px' }}>Pro</span></>} cols="repeat(12, minmax(0, 1fr))" feature="eatingOut">
      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 6px', gap: '12px', flexWrap: 'wrap' }}>
          <div className="wb-hero">
            <span className="px-hero-label">Left today</span>
            <div className="fig"><span className="px-num xl">{fmt(Math.max(0, left))}</span><span className="px-suffix">kcal</span></div>
            <span className="px-meta" style={{ marginTop: '6px' }}>Orders sorted by protein per calorie · log one in a tap</span>
          </div>
        </div>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 4' }}>
        <div className="px-card" style={{ gap: '0' }}>
          <div className="px-card-head"><span className="px-card-title">Where are you eating?</span></div>
          <ul className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {PLACES.map((p) => (
              <li key={p.id}>
                <button type="button" className="px-row px-row-btn" aria-pressed={p.id === placeId} onClick={() => setPlaceId(p.id)} style={p.id === placeId ? { fontWeight: 500 } : undefined}>
                  <span className="px-row-icon"><Icon name={p.id === placeId ? 'check' : 'bowl'} /></span>
                  <span className="px-row-main"><span className="px-row-title">{p.name}</span><span className="px-row-sub">{p.hint}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 8' }}>
        <div className="px-card" style={{ gap: '8px' }}>
          <div className="px-card-head"><span className="px-card-title">{place.name}</span><Chips label="Meal" options={SLOTS.map((s) => SLOT_LABEL[s])} value={[SLOT_LABEL[slot]]} onChange={([v]) => setSlot(SLOTS.find((s) => SLOT_LABEL[s] === v) ?? 'dinner')} /></div>
          <ul className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {orders.map(({ o, m }) => {
              const tag = orderTag(m);
              const fits = m.kcal <= Math.max(0, left);
              return (
                <li key={o.name} className="px-row" style={{ flexWrap: 'wrap', rowGap: '6px' }}>
                  <span className="px-row-main" style={{ flexBasis: 0 }}>
                    <span className="px-row-title">{o.name}</span>
                    <span className="px-row-sub">P {m.protein} g · C {m.carbs} g · F {m.fat} g{isEstimated(o) ? ' · estimate' : ''}{o.tip ? ` · ${o.tip}` : ''}</span>
                  </span>
                  <span className="px-row-end"><span className="px-row-value">{fmt(m.kcal)} kcal</span>
                    <span className={`px-status${tag === 'High protein' ? ' good' : tag === 'Heavy' ? ' over' : ''}`}>{tag ?? (fits ? 'Fits today' : `${fmt(m.kcal - left)} over`)}</span></span>
                  <button className="px-pill sm" type="button" onClick={() => log(o)}>Log</button>
                </li>
              );
            })}
          </ul>
          {place.avoid ? <span className="px-meta">Watch out: {place.avoid}</span> : null}
          <span className="px-meta">Restaurant portions vary. Estimates are for a typical Indian serving; draft content for nutrition review.</span>
        </div>
      </div>
    </AppShell>
  );
}
