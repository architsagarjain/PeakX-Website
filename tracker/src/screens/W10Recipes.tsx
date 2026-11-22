import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Tabs } from '../components/ui';
import { AppShell } from '../components/Shell';
import { Chips } from '../components/Wizard';
import { QtyStepper, useCatalogue } from '../components/FoodLog';
import { useStore, SLOT_TIME } from '../state/store';
import { SLOT_LABEL, SLOTS, slotFor } from '../state/selectors';
import { RECIPES, recipeMacros } from '../domain/seed';
import { filterRecipes, scaledProtein, type RecipeFilter } from '../domain/recipes';
import { itemFrom } from '../domain/foodSearch';
import { fmt, rounded } from '../domain/nutrition';
import { today } from '../domain/clock';
import { FOUNDING, PRO, earlyBirdOpen, inr } from '../data/founding';
import { usePayStatus } from '../state/billing';
import { foodChanges, recipesFor } from '../domain/labs';
import type { Diet, MealSlot, Recipe } from '../domain/types';

const TABS: [string, RecipeFilter['diet']][] = [['All', 'all'], ['Veg', 'veg'], ['Eggetarian', 'egg'], ['Non-veg', 'nonveg']];
const TOGGLES: [keyof Pick<RecipeFilter, 'highProtein' | 'under500' | 'under20' | 'mess'>, string][] = [['highProtein', 'High protein'], ['under500', 'Under 500 kcal'], ['under20', 'Under 20 min'], ['mess', 'Mess-friendly']];
const DIET_MARK: Record<Diet, { label: string; color: string }> = { veg: { label: 'Veg', color: 'var(--lime-ink)' }, egg: { label: 'Egg', color: '#C9A227' }, nonveg: { label: 'Non-veg', color: 'var(--danger)' }, vegan: { label: 'Vegan', color: 'var(--lime-ink)' } };

function DietMark({ diet }: { diet: Diet }) {
  const d = DIET_MARK[diet];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', font: '500 11px/14px var(--font-body)', color: 'var(--text-2)' }}>
      <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '2px', boxShadow: `inset 0 0 0 1.3px ${d.color}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: '4px', height: '4px', borderRadius: '9px', background: d.color }} />
      </span>{d.label}
    </span>
  );
}

/** W10 · Recipe library · Free. Filter, open a recipe, log it to a meal, save it. */
export default function W10Recipes() {
  const { data, dispatch, can } = useStore();
  const [diet, setDiet] = useState<RecipeFilter['diet']>('all');
  const [on, setOn] = useState<Partial<Record<string, boolean>>>({});
  const [savedOnly, setSavedOnly] = useState(false);
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  useEffect(() => { const next = params.get('q'); if (next !== null) setQ(next); }, [params]);
  const list = useMemo(() => filterRecipes(RECIPES, { diet, ...on, q, saved: savedOnly ? data.savedRecipes : undefined }), [diet, on, q, savedOnly, data.savedRecipes]);
  const [selId, setSelId] = useState(RECIPES.find((r) => r.id === params.get('open'))?.id ?? RECIPES.find((r) => r.id === 'soya-chunk-pulao')?.id ?? RECIPES[0].id);
  // Blood work food changes (S18.2) mark the recipes that help.
  const helps = useMemo(() => {
    const lab = data.labs[0];
    if (!lab) return new Map<string, string[]>();
    return new Map(recipesFor(foodChanges(lab.markers, data.profile.sex, data.profile.diet), RECIPES, 'nonveg', 200).map((x) => [x.recipe.id, x.markers]));
  }, [data.labs, data.profile.sex, data.profile.diet]);
  const sel = RECIPES.find((r) => r.id === selId)!;
  const detail = useRef<HTMLDivElement>(null);
  const open = (r: Recipe) => { setSelId(r.id); if (window.innerWidth < 1100) setTimeout(() => detail.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); };
  const toggleSave = (r: Recipe) => dispatch({ type: 'toggleSaved', recipeId: r.id });

  return (
    <AppShell active="recipes" title="Recipes" crumb={<>Library · {RECIPES.length} recipes · free</>} cols="repeat(12, minmax(0, 1fr))">
      <div className="wb-col" style={{ gridColumn: 'span 12' }}>
        <div className="px-rec-bar">
          <Tabs items={TABS.map((t) => t[0])} initial="All" style={{ alignSelf: 'auto' }} onChange={(v) => setDiet(TABS.find((t) => t[0] === v)![1])} />
          <div className="px-chips">
            {TOGGLES.map(([k, label]) => (
              <button key={k} className={`px-pill${on[k] ? ' on' : ''}`} type="button" aria-pressed={!!on[k]} onClick={() => setOn({ ...on, [k]: !on[k] })}>{label}</button>
            ))}
            <button className={`px-pill${savedOnly ? ' on' : ''}`} type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>Saved · {data.savedRecipes.length}</button>
          </div>
          <div className="wb-input" style={{ height: '38px', minWidth: '200px', flex: '1 1 200px', maxWidth: '280px' }}>
            <Icon name="search" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Paneer, soya, eggs…" aria-label="Search recipes" />
          </div>
          <span className="px-meta" aria-live="polite">{list.length} of {RECIPES.length} recipes match</span>
        </div>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 8' }}>
        {list.length ? (
          <div className="px-rec-grid">
            {list.map((r) => {
              const m = rounded(recipeMacros(r));
              const saved = data.savedRecipes.includes(r.id);
              return (
                <article key={r.id} className={`px-card px-rec${r.id === selId ? ' on' : ''}`}>
                  <button type="button" className="px-rec-open" onClick={() => open(r)} aria-label={`Open ${r.name}`}>
                    <div className="px-card-head"><DietMark diet={r.diet} /><span className="px-meta">{r.minutes} min</span></div>
                    <span className="px-card-title" style={{ fontSize: '20px', lineHeight: '24px', minHeight: '48px' }}>{r.name}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline' }}><span className="px-num md">{m.protein}</span><span className="px-suffix">g protein</span></div>
                    <span className="px-meta">{fmt(m.kcal)} kcal · C {m.carbs} g · F {m.fat} g</span>
                    {helps.get(r.id) ? <span className="px-status good" style={{ marginTop: '2px' }}>Good for your {helps.get(r.id)!.join(' and ')}</span> : null}
                  </button>
                  <div className="px-card-head" style={{ marginTop: '6px' }}>
                    <button className="px-pill sm" type="button" onClick={() => open(r)}>Log</button>
                    <button className={`px-icon sm${saved ? ' dark' : ''}`} type="button" aria-pressed={saved} aria-label={saved ? `Unsave ${r.name}` : `Save ${r.name}`} onClick={() => toggleSave(r)}
                      style={saved ? { background: 'var(--text)', color: '#FFFFFF' } : undefined}><Icon name={saved ? 'check' : 'plus'} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-chart-empty" style={{ minHeight: '200px' }}>No recipes match these filters. Try removing one.</div>
        )}
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 4' }} ref={detail}>
        <RecipeDetail recipe={sel} />
        <div className="px-card" style={{ gap: '6px' }}>
          <div className="px-card-head"><span className="px-card-title" style={{ display: 'inline-flex', gap: '7px', alignItems: 'center' }}>Fit it to my targets {can('mealPlan') ? null : <span className="px-pro">Pro</span>}</span></div>
          <span className="px-body grey">{can('mealPlan')
            ? <>Your meal plan scales library recipes to your {data.targets.protein} g protein day and builds the grocery list.</>
            : <>Pro scales this to {scaledProtein(data.targets.protein)} g protein for your {data.targets.protein} g day, swaps it into your week, and adds it to the grocery list.</>}</span>
          <FitButton pro={can('mealPlan')} />
        </div>
      </div>
    </AppShell>
  );
}

function FitButton({ pro }: { pro: boolean }) {
  const navigate = useNavigate();
  usePayStatus();   // live early bird count
  return pro
    ? <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', marginTop: '4px' }} onClick={() => navigate('/app/plan/meals')}>Open my meal plan</button>
    : <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', marginTop: '4px' }} onClick={() => navigate('/app/upgrade')}>{earlyBirdOpen() ? `Get Pro · ${inr(FOUNDING.price)} first month` : `Get Pro · ${inr(PRO.monthly)}/month`}</button>;
}

function RecipeDetail({ recipe: r }: { recipe: Recipe }) {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const items = useCatalogue();
  const [steps, setSteps] = useState(false);
  const [slot, setSlot] = useState<MealSlot>(slotFor(new Date().getHours()));
  const [qty, setQty] = useState(1);
  const m = rounded(recipeMacros(r));
  const saved = data.savedRecipes.includes(r.id);
  const log = () => {
    const l = items.find((x) => x.kind === 'recipe' && x.id === r.id)!;
    const item = { ...itemFrom(l, 0, qty, newId('it'), 'recipe') };
    dispatch({ type: 'logItems', date: today(), slot, time: SLOT_TIME[slot], items: [item] });
    toast(`${r.name} logged as ${SLOT_LABEL[slot].toLowerCase()} · ${fmt(item.macros.kcal)} kcal`, 'good');
  };
  return (
    <section className="px-card" style={{ gap: '8px' }} aria-label={r.name}>
      <div className="px-card-head"><DietMark diet={r.diet} /><span className="px-meta">{r.minutes} min · serves {r.servings}</span></div>
      <div className="px-card-head" style={{ alignItems: 'flex-start' }}>
        <h2 className="px-card-title" style={{ fontSize: '26px', lineHeight: '30px', margin: 0 }}>{r.name}</h2>
        <button className="px-pill sm" type="button" aria-pressed={saved} onClick={() => { dispatch({ type: 'toggleSaved', recipeId: r.id }); toast(saved ? 'Removed from saved' : 'Saved · it shows up in Log for one-tap logging', saved ? 'info' : 'good'); }}>{saved ? 'Saved' : 'Save'}</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline' }}><span className="px-num lg">{m.protein}</span><span className="px-suffix">g protein · {fmt(m.kcal)} kcal</span></div>
      {steps ? (
        <ol className="px-steps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      ) : (
        <div>
          {r.ingredients.map((i) => (
            <div className="px-kv" key={i.name} style={{ padding: '8px 0' }}>
              <span className="k" style={{ font: '700 15px/20px var(--font-display)', color: 'var(--text)' }}>{i.name}</span>
              <span className="v"><span className="d" style={{ marginRight: '14px' }}>{i.grams} g</span>{Math.round(i.macros.kcal)}</span>
            </div>
          ))}
        </div>
      )}
      <span className="px-meta">Nutrition estimated from IFCT 2017 values, per ingredient; pending review.</span>
      <span className="px-subhead">Log to</span>
      <Chips label="Meal" options={SLOTS.map((s) => SLOT_LABEL[s])} value={[SLOT_LABEL[slot]]} onChange={([v]) => setSlot(SLOTS.find((s) => SLOT_LABEL[s] === v) ?? 'lunch')} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span className="px-meta">Servings · {fmt(m.kcal * qty)} kcal</span>
        <QtyStepper value={qty} onChange={setQty} label="Servings" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
        <button className="px-cta glass" type="button" aria-expanded={steps} style={{ flex: '0 0 auto', height: '44px', fontSize: '14px', padding: '0 20px' }} onClick={() => setSteps(!steps)}>{steps ? 'Ingredients' : 'Steps'}</button>
        <button className="px-cta" type="button" style={{ flex: '1 1 160px', minWidth: 0, height: '44px', fontSize: '14px' }} onClick={log}>Log as {SLOT_LABEL[slot].toLowerCase()}</button>
      </div>
    </section>
  );
}
