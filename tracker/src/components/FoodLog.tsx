import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Chips } from './Wizard';
import { useToast } from './Toast';
import { useStore } from '../state/store';
import { recentItems, SLOT_LABEL, SLOTS, slotFor } from '../state/selectors';
import { SLOT_TIME } from '../state/store';
import { catalogue, customItem, itemFrom, searchFoods, withAliases, type Loggable } from '../domain/foodSearch';
import { useFoodAliases } from '../state/aliases';
import { RECIPES, recipeMacros } from '../domain/seed';
import { fmt, rounded } from '../domain/nutrition';
import { today } from '../domain/clock';
import type { ISODate, MealItem, MealSlot } from '../domain/types';

const BASE = catalogue(RECIPES, recipeMacros);
export function useCatalogue() {
  const aliases = useFoodAliases();
  return useMemo(() => withAliases(BASE, aliases), [aliases]);
}

const LABELS = SLOTS.map((s) => SLOT_LABEL[s]);
const slotOf = (label: string) => SLOTS[LABELS.indexOf(label)] ?? 'lunch';

export function QtyStepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const step = (d: number) => onChange(Math.max(0.5, Math.min(10, Math.round((value + d) * 2) / 2)));
  return (
    <div className="px-qty" role="group" aria-label={label}>
      <button type="button" className="px-icon sm" aria-label="Less" onClick={() => step(-0.5)} disabled={value <= 0.5}>−</button>
      <span aria-live="polite">{value === 0.5 ? '½' : value}</span>
      <button type="button" className="px-icon sm" aria-label="More" onClick={() => step(0.5)}>+</button>
    </div>
  );
}

function MacroLine({ kcal, p, c, f }: { kcal: number; p: number; c: number; f: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', flexWrap: 'wrap' }}>
      <span className="px-num md">{fmt(kcal)}</span><span className="px-suffix">kcal · P {p} g · C {c} g · F {f} g</span>
    </div>
  );
}

/** Portion + quantity picker for one loggable. Used when adding and when editing. */
function PortionPicker({ food, portion, qty, setPortion, setQty }: { food: Loggable; portion: number; qty: number; setPortion: (i: number) => void; setQty: (q: number) => void }) {
  const mac = rounded(food.macros(food.portions[portion] ?? food.portions[0], qty));
  return (
    <div className="px-stack" style={{ gap: '10px' }}>
      <Chips label="Portion" options={food.portions.map((p) => p.label)} value={[food.portions[portion]?.label ?? '']} onChange={([v]) => setPortion(food.portions.findIndex((p) => p.label === v))} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <MacroLine kcal={mac.kcal} p={mac.protein} c={mac.carbs} f={mac.fat} />
        <QtyStepper value={qty} onChange={setQty} label="Quantity" />
      </div>
      {food.estimated ? <span className="px-meta">Estimated from IFCT 2017 values, pending review.</span> : null}
    </div>
  );
}

/** S9.1 · Typed food logging: search dishes, recipes and ingredients, pick a portion, add to a meal. */
export function FoodLogPanel({ date }: { date: ISODate }) {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const items = useCatalogue();
  const [slot, setSlot] = useState<MealSlot>(date === today() ? slotFor(new Date().getHours()) : 'lunch');
  const [q, setQ] = useState('');
  const [food, setFood] = useState<Loggable | null>(null);
  const [portion, setPortion] = useState(0);
  const [qty, setQty] = useState(1);
  const [custom, setCustom] = useState({ kcal: '', protein: '' });
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchFoods(q, items), [q, items]);
  const recent = recentItems(data, 8);
  const saved = RECIPES.filter((r) => data.savedRecipes.includes(r.id));

  useEffect(() => { setSlot(date === today() ? slotFor(new Date().getHours()) : 'lunch'); }, [date]);

  const log = (item: MealItem) => {
    dispatch({ type: 'logItems', date, slot, time: SLOT_TIME[slot], items: [item] });
    toast(`${item.name} added to ${SLOT_LABEL[slot].toLowerCase()} · ${fmt(item.macros.kcal)} kcal`, 'good');
  };
  const choose = (l: Loggable) => { setFood(l); setPortion(l.defaultPortion); setQty(1); };
  const reset = () => { setFood(null); setQ(''); setCustom({ kcal: '', protein: '' }); input.current?.focus(); };
  const add = () => { if (!food) return; log(itemFrom(food, portion, qty, newId('it'))); reset(); };
  const addCustom = () => {
    const kcal = Number(custom.kcal), protein = Number(custom.protein || 0);
    if (!q.trim() || !(kcal > 0 && kcal < 5000)) { toast('Add a name and calories to save a custom item.'); return; }
    log(customItem(q, kcal, protein, newId('it'))); reset();
  };

  return (
    <section className="px-card" style={{ gap: '12px' }} aria-label="Add food">
      <div className="px-card-head">
        <span className="px-card-title">Add food</span>
        <span className="px-meta">Dishes, recipes and ingredients</span>
      </div>
      <Chips label="Meal" options={LABELS} value={[SLOT_LABEL[slot]]} onChange={([v]) => setSlot(slotOf(v))} />

      {food ? (
        <div className="px-sub" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="px-card-head">
            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}><span className="px-card-title">{food.name}</span><span className="px-meta">{food.hint}</span></span>
            <button className="px-icon sm" type="button" aria-label="Back to search" onClick={() => setFood(null)}><Icon name="close" /></button>
          </div>
          <PortionPicker food={food} portion={portion} qty={qty} setPortion={setPortion} setQty={setQty} />
          <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px' }} onClick={add}>Add to {SLOT_LABEL[slot].toLowerCase()}</button>
        </div>
      ) : (
        <>
          <div className="wb-input">
            <Icon name="search" style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: dal, anda, paneer, roti…" aria-label="Search foods"
              onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { e.preventDefault(); choose(results[0]); } }} />
          </div>
          {q.trim() ? (
            results.length ? (
              <ul className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Results">
                {results.map((r) => {
                  const mac = rounded(r.macros(r.portions[r.defaultPortion], 1));
                  return (
                    <li key={`${r.kind}-${r.id}`}>
                      <button type="button" className="px-row px-row-btn" onClick={() => choose(r)}>
                        <span className="px-row-icon"><Icon name={r.kind === 'ingredient' ? 'leaf' : r.kind === 'recipe' ? 'doc' : 'bowl'} /></span>
                        <span className="px-row-main"><span className="px-row-title">{r.name}</span><span className="px-row-sub">{r.hint}</span></span>
                        <span className="px-row-end"><span className="px-row-value">{fmt(mac.kcal)} kcal</span><span className="px-status">P {mac.protein} g · {r.portions[r.defaultPortion].label}</span></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <form className="px-sub px-stack" style={{ padding: '14px 16px', gap: '10px' }} onSubmit={(e) => { e.preventDefault(); addCustom(); }}>
                <span className="px-body">No match for “{q.trim()}”. Add it as a custom item:</span>
                <div className="px-fields">
                  <label className="px-field"><span className="l">Calories</span><span className="px-field-row"><input inputMode="numeric" aria-label="Calories" value={custom.kcal} onChange={(e) => setCustom({ ...custom, kcal: e.target.value.replace(/[^0-9]/g, '') })} /><span className="sfx">kcal</span></span></label>
                  <label className="px-field"><span className="l">Protein (optional)</span><span className="px-field-row"><input inputMode="numeric" aria-label="Protein" value={custom.protein} onChange={(e) => setCustom({ ...custom, protein: e.target.value.replace(/[^0-9]/g, '') })} /><span className="sfx">g</span></span></label>
                </div>
                <button className="px-cta" type="submit" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px' }}>Add custom item</button>
              </form>
            )
          ) : (
            <div className="px-stack" style={{ gap: '8px' }}>
              <span className="px-subhead">Recent · tap to log the same amount</span>
              <div className="px-chips">
                {recent.length ? recent.map((it) => (
                  <button key={it.id} type="button" className="px-pill" onClick={() => log({ ...it, id: newId('it'), source: 'typed' })}>{it.name} · {it.amount}</button>
                )) : <span className="px-meta">Nothing logged yet.</span>}
              </div>
              {saved.length ? <>
                <span className="px-subhead">Saved recipes</span>
                <div className="px-chips">
                  {saved.map((r) => {
                    const l = items.find((x) => x.kind === 'recipe' && x.id === r.id)!;
                    return <button key={r.id} type="button" className="px-pill" onClick={() => choose(l)}>{r.name}</button>;
                  })}
                </div>
              </> : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Edit a logged item: portion and quantity (or calories for custom items), move it to another meal, or remove it. */
export function EditItemDialog({ mealId, item, slot: startSlot, onClose }: { mealId: string; item: MealItem; slot: MealSlot; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const items = useCatalogue();
  const food = item.ref ? items.find((x) => x.kind === item.ref!.kind && x.id === item.ref!.id) ?? null : null;
  const [portion, setPortion] = useState(food ? Math.max(0, food.portions.findIndex((p) => p.label === item.ref!.portion)) : 0);
  const [qty, setQty] = useState(item.ref?.qty ?? 1);
  const [slot, setSlot] = useState(startSlot);
  const [kcal, setKcal] = useState(String(item.macros.kcal));
  const [protein, setProtein] = useState(String(item.macros.protein));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    let next: MealItem;
    if (food) next = { ...itemFrom(food, portion, qty, item.id, item.source) };
    else {
      const k = Number(kcal), p = Number(protein);
      if (!(k >= 0 && k < 5000)) { toast('Calories must be between 0 and 5,000.'); return; }
      next = { ...item, macros: { ...item.macros, kcal: Math.round(k), protein: Math.round(p || 0) } };
    }
    dispatch({ type: 'editItem', mealId, itemId: item.id, item: next, slot });
    toast(`${item.name} updated`, 'good');
    onClose();
  };
  const remove = () => { dispatch({ type: 'removeItem', mealId, itemId: item.id }); toast(`${item.name} removed`); onClose(); };

  return (
    <div className="app-modal-scrim" onClick={onClose}>
      <form className="app-modal" role="dialog" aria-modal="true" aria-label={`Edit ${item.name}`} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }} style={{ width: 'min(100%, 460px)' }}>
        <span className="px-card-title" style={{ fontSize: '24px', lineHeight: '28px' }}>{item.name}</span>
        {food ? <PortionPicker food={food} portion={portion} qty={qty} setPortion={setPortion} setQty={setQty} /> : (
          <div className="px-fields">
            <label className="px-field"><span className="l">Calories</span><span className="px-field-row"><input inputMode="numeric" aria-label="Calories" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/[^0-9]/g, ''))} /><span className="sfx">kcal</span></span></label>
            <label className="px-field"><span className="l">Protein</span><span className="px-field-row"><input inputMode="numeric" aria-label="Protein" value={protein} onChange={(e) => setProtein(e.target.value.replace(/[^0-9]/g, ''))} /><span className="sfx">g</span></span></label>
          </div>
        )}
        <span className="px-subhead">Meal</span>
        <Chips label="Meal" options={LABELS} value={[SLOT_LABEL[slot]]} onChange={([v]) => setSlot(slotOf(v))} />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button type="button" className="px-cta glass" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', padding: '0 18px', color: 'var(--danger)' }} onClick={remove}>Remove</button>
          <span style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="px-cta glass" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', padding: '0 18px' }} onClick={onClose}>Cancel</button>
            <button type="submit" className="px-cta" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', padding: '0 26px' }}>Save</button>
          </span>
        </div>
      </form>
    </div>
  );
}
