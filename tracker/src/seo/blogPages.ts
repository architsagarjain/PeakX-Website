import type { Diet, Goal, Macros, MealSlot, Profile, Sex } from '../domain/types';
import { DISHES, dishDiet, dishMacros, type Dish } from '../domain/foods';
import { add, fmt, rounded, scale, targetsExplain, ZERO } from '../domain/nutrition';
import { APP, CATEGORIES, esc, jsonLd, layout, pathOf as caloriePath, slugOf, swapsFor, type Page, type SitemapEntry } from './foodPages';

/**
 * Static blog at /blog/: articles worked out from the same food table and target formulas the app uses,
 * so every page carries its own numbers. Built at `vite build` time next to the calorie guide.
 *
 * Families (each has a topic hub at /blog/topic/<family>/):
 *   compare      "Roti vs paratha"                      pairs of dishes in one category
 *   meals        "Dal tadka with 2 roti"                a curry or sabzi with a bread or rice
 *   verdicts     "Is poha good for weight loss?"        each dish for fat loss and for muscle gain
 *   best         "Best breakfasts for weight loss"      category rankings, and high-protein foods by diet
 *   targets      "Calories to lose weight at 70 kg"     daily targets by weight, sex and goal
 *   diet-plans   "1,800 calorie vegetarian diet plan"   a full Indian day at a calorie level
 *   protein      "120 g protein a day, vegetarian"      a full Indian day that reaches a protein level
 *   steps        "10,000 steps at 70 kg"                walking calories by steps and body weight
 */

export const BLOG_UPDATED = '2026-11-11';
const REF = 'blog';
const NUTRITION_FINE = 'Food numbers are estimated from IFCT 2017 (National Institute of Nutrition) values, rounded, and not yet reviewed by the PeakX nutrition team. Targets use the Mifflin-St Jeor equation, the same one the app uses. For guidance, not medical advice.';
const STEPS_FINE = 'Walking calories are net estimates (about 0.5 kcal per kg of body weight per km on flat ground, 76 cm stride, 100 steps a minute). Food numbers are estimated from IFCT 2017 values. For guidance, not medical advice.';

// ---------- shared helpers ----------

const BY_ID = new Map(DISHES.map((d) => [d.id, d]));
export function dish(id: string): Dish {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Unknown dish ${id}`);
  return d;
}
const per = (d: Dish, servings = 1): Macros => scale(dishMacros(d), servings);
export const density = (m: Macros) => (m.kcal ? (m.protein / m.kcal) * 100 : 0);
const one = (n: number) => (Math.round(n * 10) / 10).toString();
const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const pct = (part: number, whole: number) => Math.round((part / whole) * 100);
const FRAC: Record<string, string> = { '0.5': '½', '1.5': '1½', '2.5': '2½', '3.5': '3½' };
const frac = (n: number) => FRAC[String(n)] ?? String(n);
const fatShare = (m: Macros) => (m.kcal ? (m.fat * 9) / m.kcal : 0);

export const DIETS: Diet[] = ['veg', 'egg', 'nonveg', 'vegan'];
const DIET_SLUG: Record<Diet, string> = { veg: 'vegetarian', egg: 'eggetarian', nonveg: 'non-veg', vegan: 'vegan' };
const DIET_NAME: Record<Diet, string> = { veg: 'vegetarian', egg: 'eggetarian', nonveg: 'non-veg', vegan: 'vegan' };
/** What someone on each diet eats. Vegan here means no dairy, egg or meat. */
const CAN_EAT: Record<Diet, Diet[]> = { vegan: ['vegan'], veg: ['vegan', 'veg'], egg: ['vegan', 'veg', 'egg'], nonveg: ['vegan', 'veg', 'egg', 'nonveg'] };
export const canEat = (diet: Diet, d: Dish) => CAN_EAT[diet].includes(dishDiet(d));
const categoryOf = (d: Dish) => CATEGORIES.find((c) => c.ids.includes(d.id))!;

/** Portion label for some servings of a dish: "3 roti", "1½ katori", "12 pieces". */
export function portionText(d: Dish, servings: number): string {
  const listed = d.portions.find((p) => p.grams === Math.round(servings * 100));
  if (listed) return listed.label;
  if (servings === 1) return d.serving;
  if (d.serving.startsWith('1 katori')) return `${frac(servings)} katori`;
  // Count words come from the plural portion label: "4 roti" → 1 roti a serving, "6 pieces" → 6 a serving.
  const counted = d.portions.map((p) => ({ p, m: p.label.match(/^(\d+) ([a-z]+)$/) })).filter((x) => x.m && Number(x.m[1]) > 1).pop();
  if (counted) {
    const n = (servings * Number(counted.m![1]) * 100) / counted.p.grams;
    if (Number.isInteger(n)) return `${n} ${counted.m![2]}`;
  }
  return `${frac(servings)} × ${d.serving}`;
}

// ---------- day plans ----------

export interface PlanLine { slot: MealSlot; id: string; servings: number }
export interface DayPlan { lines: PlanLine[]; total: Macros }

const BREAKFAST = ['moong-chilla', 'paneer-sandwich', 'egg-bhurji', 'besan-chilla', 'omelette', 'oats-porridge', 'poha-dish', 'idli', 'upma', 'pb-toast'];
const LUNCH = ['rajma', 'chicken-curry', 'chole', 'palak-paneer', 'fish-curry', 'egg-curry', 'dal-tadka', 'matar-paneer', 'moong-dal', 'butter-chicken', 'kadhi', 'sambar'];
const DINNER = ['paneer-bhurji', 'chicken-tikka', 'moong-dal', 'tandoori-chicken', 'dal-makhani', 'egg-bhurji', 'chole', 'fish-curry', 'dal-tadka', 'palak-paneer'];
const SABZI = ['bhindi', 'mix-veg', 'lauki-sabzi', 'aloo-gobi', 'baingan-bharta'];
const SNACK = ['sprouts', 'boiled-eggs', 'chana-chaat', 'whey-shake', 'curd-bowl'];
const BOOST: Record<Diet, string[]> = {
  nonveg: ['chicken-tikka', 'boiled-eggs', 'whey-shake'],
  egg: ['boiled-eggs', 'whey-shake', 'paneer-bhurji'],
  veg: ['whey-shake', 'paneer-bhurji', 'curd-bowl'],
  vegan: ['sprouts', 'moong-chilla', 'chole'],
};
const EXTRA_ENERGY = ['pb-toast', 'banana-shake', 'poha-dish'];
const CARB_CAP: Record<string, number> = { roti: 5, 'plain-rice': 2.5 };
const BOOST_SLOT = (id: string): MealSlot => (id === 'whey-shake' ? 'snacks' : id === 'boiled-eggs' ? 'breakfast' : 'dinner');

/** Pick from a pool for a diet, preferring dishes that are the diet's own kind (egg dishes for egg eaters…). */
function pick(pool: string[], diet: Diet, seed: number, used: Set<string>): string {
  const ok = pool.filter((id) => !used.has(id) && canEat(diet, dish(id)));
  const own = ok.filter((id) => dishDiet(dish(id)) === diet);
  const ordered = diet === 'egg' || diet === 'nonveg' ? [...own, ...ok.filter((id) => !own.includes(id))] : ok;
  if (!ordered.length) throw new Error(`No ${diet} dish left in pool ${pool.join(',')}`);
  return ordered[seed % Math.min(3, ordered.length)];
}

/**
 * A one-day Indian plan near a calorie and protein target: a fixed meal shape, protein topped up with the
 * diet's best protein foods, then rotis and rice adjusted for calories. Pages print the totals it reaches.
 */
export function buildDay(diet: Diet, kcal: number, protein: number, seed = 0): DayPlan {
  const used = new Set<string>();
  const lines: PlanLine[] = [];
  const put = (slot: MealSlot, id: string, servings: number) => { lines.push({ slot, id, servings }); used.add(id); };
  put('breakfast', pick(BREAKFAST, diet, seed, used), 1);
  put('lunch', pick(LUNCH, diet, seed + 1, used), 1);
  put('lunch', 'roti', 2);
  if (diet !== 'vegan') put('lunch', 'raita', 1);
  put('snacks', pick(SNACK, diet, seed + 2, used), 1);
  put('dinner', pick(DINNER, diet, seed + 3, used), 1);
  put('dinner', pick(SABZI, diet, seed, used), 1);
  put('dinner', seed % 2 ? 'plain-rice' : 'roti', seed % 2 ? 1 : 2);

  const total = () => lines.reduce((s, l) => add(s, per(dish(l.id), l.servings)), ZERO);

  const boosts = BOOST[diet];
  let next = 0;
  for (let i = 0; i < 16 && total().protein < protein - 4; i++) {
    let added = false;
    for (let k = 0; k < boosts.length && !added; k++) {
      const id = boosts[(next + k) % boosts.length];
      const line = lines.find((l) => l.id === id);
      if (line && line.servings >= 2) continue;
      if (line) line.servings += id === 'whey-shake' ? 1 : 0.5;
      else put(BOOST_SLOT(id), id, id === 'whey-shake' ? 1 : 0.5);
      next = (next + k + 1) % boosts.length;
      added = true;
    }
    if (!added) break;
  }

  const carbs = () => lines.filter((l) => l.id in CARB_CAP);
  const grow = (): boolean => {
    const c = carbs().filter((l) => l.servings < CARB_CAP[l.id]).sort((a, b) => a.servings / CARB_CAP[a.id] - b.servings / CARB_CAP[b.id])[0];
    if (c) { c.servings += c.id === 'roti' ? 1 : 0.5; return true; }
    const extra = EXTRA_ENERGY.find((id) => canEat(diet, dish(id)) && (lines.find((l) => l.id === id)?.servings ?? 0) < 2);
    if (!extra) return false;
    const line = lines.find((l) => l.id === extra);
    if (line) line.servings += 0.5; else put('snacks', extra, 1);
    return true;
  };
  const SHRINK: [string | 'carbs', number][] = [['carbs', 0], ['raita', 0], ['sabzi', 0.5], ['snack', 0.5], ['breakfast', 0.5], ['mains', 0.5]];
  const shrink = (): boolean => {
    for (const [what] of SHRINK) {
      if (what === 'carbs') {
        const c = carbs().filter((l) => l.servings > (l.id === 'roti' ? 1 : 0.5)).sort((a, b) => b.servings - a.servings)[0];
        if (c) { c.servings -= c.id === 'roti' ? 1 : 0.5; return true; }
        continue;
      }
      const target = what === 'raita' ? lines.find((l) => l.id === 'raita' && l.servings > 0)
        : what === 'sabzi' ? lines.find((l) => SABZI.includes(l.id) && l.servings > 0.5)
        : what === 'snack' ? lines.find((l) => l.slot === 'snacks' && l.id !== 'whey-shake' && l.servings > 0.5)
        : what === 'breakfast' ? lines.find((l) => l.slot === 'breakfast' && l.id !== 'boiled-eggs' && l.servings > 0.5)
        : lines.find((l) => (l.slot === 'lunch' || l.slot === 'dinner') && !(l.id in CARB_CAP) && l.id !== 'raita' && !SABZI.includes(l.id) && l.servings > 0.5);
      if (target) { target.servings = what === 'raita' ? 0 : target.servings - 0.5; return true; }
    }
    return false;
  };
  let last = 0;
  for (let i = 0; i < 40; i++) {
    const gap = total().kcal - kcal;
    if (Math.abs(gap) <= 50) break;
    const dir = gap < 0 ? 1 : -1;
    if (last && dir !== last && Math.abs(gap) < 110) break; // one roti either way: stop instead of flip-flopping
    if (!(dir > 0 ? grow() : shrink())) break;
    last = dir;
  }
  const order: MealSlot[] = ['breakfast', 'lunch', 'snacks', 'dinner'];
  const kept = lines.filter((l) => l.servings > 0).sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  return { lines: kept, total: kept.reduce((s, l) => add(s, per(dish(l.id), l.servings)), ZERO) };
}

const SLOT_NAME: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snacks: 'Evening snack', dinner: 'Dinner' };

function planTable(plan: DayPlan): string {
  const order: MealSlot[] = ['breakfast', 'lunch', 'snacks', 'dinner'];
  const rows = order.map((slot) => {
    const ls = plan.lines.filter((l) => l.slot === slot);
    if (!ls.length) return '';
    const sub = rounded(ls.reduce((s, l) => add(s, per(dish(l.id), l.servings)), ZERO));
    const items = ls.map((l) => {
      const d = dish(l.id);
      const m = rounded(per(d, l.servings));
      return `<tr><th scope="row"><a href="${caloriePath(d)}">${esc(d.name)}</a></th><td class="l">${esc(portionText(d, l.servings))}</td><td>${m.kcal}</td><td>${m.protein} g</td></tr>`;
    }).join('');
    return `<tr class="slot"><th scope="rowgroup" colspan="2">${SLOT_NAME[slot]}</th><td>${sub.kcal}</td><td>${sub.protein} g</td></tr>${items}`;
  }).join('');
  const t = rounded(plan.total);
  return `<div class="scroll"><table><thead><tr><th scope="col">Food</th><th scope="col" class="l">Portion</th><th scope="col">kcal</th><th scope="col">Protein</th></tr></thead><tbody>${rows}<tr class="slot"><th scope="row" colspan="2">Day total</th><td>${fmt(t.kcal)}</td><td>${t.protein} g</td></tr></tbody></table></div>`;
}

function topSources(plan: DayPlan, n = 3): string {
  const byFood = plan.lines.map((l) => ({ d: dish(l.id), p: per(dish(l.id), l.servings).protein }))
    .sort((a, b) => b.p - a.p).slice(0, n);
  return byFood.map((x) => `${low(x.d.name)} (${Math.round(x.p)} g)`).join(', ');
}

function stats(m: Macros, first = 'kcal'): string {
  const r = rounded(m);
  return `<div class="stats">
  <div class="stat hero"><b>${fmt(r.kcal)}</b><span>${first}</span></div>
  <div class="stat"><b>${r.protein} g</b><span>protein</span></div>
  <div class="stat"><b>${r.carbs} g</b><span>carbs</span></div>
  <div class="stat"><b>${r.fat} g</b><span>fat</span></div>
</div>`;
}

// ---------- article shell ----------

type Family = 'compare' | 'meals' | 'verdicts' | 'best' | 'targets' | 'diet-plans' | 'protein' | 'steps';
interface FamilyInfo { name: string; blurb: string }
const FAMILY: Record<Family, FamilyInfo> = {
  'targets': { name: 'Calorie targets', blurb: 'Daily calories and protein to lose fat or build muscle, by body weight, for men and women.' },
  'diet-plans': { name: 'Indian diet plans', blurb: 'A full day of Indian meals at each calorie level, vegetarian, eggetarian, non-veg and vegan.' },
  'protein': { name: 'Protein plans', blurb: 'How to reach a daily protein number on an Indian diet, with the foods doing the work.' },
  'compare': { name: 'Food comparisons', blurb: 'Two everyday dishes side by side: calories, protein and which one suits your goal.' },
  'meals': { name: 'Meal calories', blurb: 'Calories and protein in the plates people actually eat: dal with roti, rajma with rice and more.' },
  'verdicts': { name: 'Is it good for you?', blurb: 'Whether a dish helps fat loss or muscle gain, worked out from its numbers.' },
  'best': { name: 'Best foods', blurb: 'Dishes ranked for fat loss, muscle gain and protein in each food group and diet.' },
  'steps': { name: 'Walking and steps', blurb: 'Calories burned walking, by step count and body weight, in rotis and cups of chai.' },
};
const FAMILY_ORDER: Family[] = ['targets', 'diet-plans', 'protein', 'compare', 'meals', 'verdicts', 'best', 'steps'];
const topicPath = (f: Family) => `/blog/topic/${f}/`;

export interface Article { family: Family; slug: string; title: string; h1: string; description: string; body: string; links: [string, string][] }
const articlePath = (slug: string) => `/blog/${slug}/`;

function relatedList(title: string, links: [string, string][]): string {
  if (!links.length) return '';
  return `<h2>${esc(title)}</h2><ul class="list">${links.map(([path, label]) => `<li><a href="${path}">${esc(label)}</a></li>`).join('')}</ul>`;
}

function articleHtml(site: string, a: Article): string {
  const path = articlePath(a.slug);
  const fam = FAMILY[a.family];
  const ld = jsonLd([
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [['PeakX', APP], ['Blog', '/blog/'], [fam.name, topicPath(a.family)], [a.h1, path]]
        .map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${site}${p}` })),
    },
    {
      '@context': 'https://schema.org', '@type': 'Article', headline: a.h1.slice(0, 110), description: a.description,
      datePublished: BLOG_UPDATED, dateModified: BLOG_UPDATED, inLanguage: 'en-IN', mainEntityOfPage: `${site}${path}`,
      image: `${site}${APP}og.png?v=3`,
      author: { '@type': 'Organization', name: 'PeakX', url: `${site}/` },
      publisher: { '@type': 'Organization', name: 'PeakX', logo: { '@type': 'ImageObject', url: `${site}${APP}icons/apple-touch-icon.png` } },
    },
  ]);
  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${APP}">PeakX</a> › <a href="/blog/">Blog</a> › <a href="${topicPath(a.family)}">${esc(fam.name)}</a></nav>
<article>
<h1>${esc(a.h1)}</h1>
<p class="meta">PeakX · ${esc(fam.name)} · Updated ${BLOG_UPDATED}</p>
${a.body}
</article>
${relatedList('Keep reading', a.links)}`;
  return layout(site, path, a.title, a.description, body, ld, REF, a.family === 'steps' ? STEPS_FINE : NUTRITION_FINE, BLOG_UPDATED).replace('</style>', `${BLOG_CSS}</style>`);
}

// ---------- family: calorie targets ----------

const WEIGHTS: Record<Sex, [number, number]> = { male: [45, 120], female: [40, 110] };
const HEIGHT: Record<Sex, number> = { male: 172, female: 158 };
const SEX_WORD: Record<Sex, string> = { male: 'man', female: 'woman' };
type TargetGoal = Extract<Goal, 'lose' | 'gain'>;
const GOAL_SLUG: Record<TargetGoal, string> = { lose: 'lose-weight', gain: 'gain-muscle' };
const GOAL_WORD: Record<TargetGoal, string> = { lose: 'lose weight', gain: 'gain muscle' };
const ACT: [Profile['activity'], string][] = [['sedentary', 'Desk job, little exercise'], ['light', 'Light: 1–3 workouts a week'], ['moderate', 'Moderate: 3–5 workouts a week'], ['active', 'Active: 6–7 hard sessions a week']];

const person = (sex: Sex, goal: Goal, activity: Profile['activity'] = 'moderate', age = 26): Profile => ({
  name: '', city: '', age, sex, heightCm: HEIGHT[sex], goal, diet: 'veg', mealSources: [], voiceLanguages: [], trainingDays: 4, gymTime: '19:00', activity,
});
export const targetSlug = (goal: TargetGoal, kg: number, sex: Sex) => `calories-to-${GOAL_SLUG[goal]}-${kg}kg-${SEX_WORD[sex]}`;

function targetArticles(): Article[] {
  const out: Article[] = [];
  for (const sex of ['male', 'female'] as Sex[]) {
    const [lo, hi] = WEIGHTS[sex];
    for (let kg = lo; kg <= hi; kg++) {
      for (const goal of ['lose', 'gain'] as TargetGoal[]) {
        const x = targetsExplain(person(sex, goal), kg);
        const t = x.targets;
        const word = SEX_WORD[sex];
        const actRows = ACT.map(([a, label]) => {
          const e = targetsExplain(person(sex, goal, a), kg);
          return `<tr><th scope="row">${label}</th><td>${fmt(e.tdee)}</td><td>${fmt(e.targets.kcalTraining)}</td><td>${fmt(e.targets.kcalRest)}</td></tr>`;
        }).join('');
        const ageRows = [20, 26, 30, 35, 40, 50].map((age) => {
          const e = targetsExplain(person(sex, goal, 'moderate', age), kg);
          return `<tr><th scope="row">${age}</th><td>${fmt(e.bmr)}</td><td>${fmt(e.tdee)}</td><td>${fmt(e.targets.kcalTraining)}</td></tr>`;
        }).join('');
        const plan = buildDay('veg', t.kcalTraining, t.protein, kg);
        const pr = rounded(plan.total);
        const pace = goal === 'lose'
          ? `A ${-x.goalDelta} kcal daily gap is about ${one((-x.goalDelta * 7) / 7700)} kg of fat a week, so losing 5 kg takes roughly ${Math.ceil(5 / ((-x.goalDelta * 7) / 7700))} weeks. Expect the scale to jump around by 1 kg from water and salt; judge the trend over 2–3 weeks.`
          : `A ${x.goalDelta} kcal surplus with hard training adds roughly 0.2–0.3 kg a week, a pace that keeps most of the gain as muscle. If your waist grows faster than your lifts, drop 100–150 kcal.`;
        const sign = sex === 'male' ? '+ 5' : '− 161';
        const near = (n: number) => (n >= lo && n <= hi ? n : null);
        const links: [string, string][] = [];
        for (const n of [kg - 1, kg + 1, kg - 5, kg + 5].map(near).filter((n): n is number => n !== null)) {
          links.push([articlePath(targetSlug(goal, n, sex)), `Calories to ${GOAL_WORD[goal]} at ${n} kg (${word})`]);
        }
        links.push([articlePath(targetSlug(goal === 'lose' ? 'gain' : 'lose', kg, sex)), `Calories to ${GOAL_WORD[goal === 'lose' ? 'gain' : 'lose']} at ${kg} kg (${word})`]);
        const other: Sex = sex === 'male' ? 'female' : 'male';
        if (kg >= WEIGHTS[other][0] && kg <= WEIGHTS[other][1]) links.push([articlePath(targetSlug(goal, kg, other), ), `Calories to ${GOAL_WORD[goal]} at ${kg} kg (${SEX_WORD[other]})`]);
        const planKcal = nearestPlanKcal(t.kcalTraining);
        for (const diet of ['egg', 'nonveg'] as Diet[]) links.push([articlePath(dietPlanSlug(planKcal, diet)), `${fmt(planKcal)} calorie ${DIET_NAME[diet]} Indian diet plan`]);
        const pLevel = nearestProtein(t.protein);
        if (pLevel) links.push([articlePath(proteinSlug(pLevel, 'veg')), `${pLevel} g protein a day on a vegetarian diet`]);

        const h1 = `Calories to ${GOAL_WORD[goal]} for a ${kg} kg ${word}`;
        out.push({
          family: 'targets', slug: targetSlug(goal, kg, sex), h1,
          title: `${h1}: ${fmt(t.kcalTraining)} kcal and ${t.protein} g protein a day`,
          description: `A ${kg} kg ${word} who trains 3–5 days a week needs about ${fmt(t.kcalTraining)} kcal and ${t.protein} g protein a day to ${GOAL_WORD[goal]}. Table by activity and age, the maths, and a sample Indian day.`,
          links,
          body: `
<p class="lede">About <b>${fmt(t.kcalTraining)} kcal</b> on training days and ${fmt(t.kcalRest)} kcal on rest days, with ${t.protein} g protein, if you are 26, ${HEIGHT[sex]} cm and train 3–5 days a week. Your maintenance is about ${fmt(x.tdee)} kcal.</p>
${stats({ kcal: t.kcalTraining, protein: t.protein, carbs: t.carbs, fat: t.fat }, 'kcal a day')}
<h2>How the number is worked out</h2>
<ol class="notes">
<li>Resting energy (Mifflin-St Jeor): 10 × ${kg} + 6.25 × ${HEIGHT[sex]} − 5 × 26 ${sign} = <b>${fmt(x.bmr)} kcal</b>.</li>
<li>Times ${x.activityFactor} for moderate activity = <b>${fmt(x.tdee)} kcal</b> to stay the same weight.</li>
<li>${goal === 'lose' ? 'Minus' : 'Plus'} ${Math.abs(x.goalDelta)} kcal to ${GOAL_WORD[goal]}, rounded to 50 = <b>${fmt(t.kcalTraining)} kcal</b>. Rest days are 150 kcal lower.</li>
<li>Protein at 2 g per kg = ${t.protein} g. Fat at 25% of calories = ${t.fat} g. Carbs fill the rest: ${t.carbs} g.</li>
</ol>
<h2>By how active you are</h2>
<div class="scroll"><table><thead><tr><th scope="col">Activity</th><th scope="col">Maintain</th><th scope="col">Training day</th><th scope="col">Rest day</th></tr></thead><tbody>${actRows}</tbody></table></div>
<h2>By age (moderately active)</h2>
<div class="scroll"><table><thead><tr><th scope="col">Age</th><th scope="col">Resting</th><th scope="col">Maintain</th><th scope="col">Target</th></tr></thead><tbody>${ageRows}</tbody></table></div>
<p class="fine">Height matters too: every 5 cm taller adds about 31 kcal to resting energy, or about 50 kcal a day at moderate activity.</p>
<h2>What to expect</h2>
<p>${pace}</p>
<h2>A vegetarian Indian day at this target</h2>
<p>This day lands at ${fmt(pr.kcal)} kcal and ${pr.protein} g protein. Most of the protein comes from ${topSources(plan)}.</p>
${planTable(plan)}`,
        });
      }
    }
  }
  return out;
}

// ---------- family: diet plans ----------

const PLAN_KCAL: number[] = Array.from({ length: 21 }, (_, i) => 1200 + i * 100);
const nearestPlanKcal = (k: number) => PLAN_KCAL.reduce((a, b) => (Math.abs(b - k) < Math.abs(a - k) ? b : a));
export const dietPlanSlug = (kcal: number, diet: Diet) => `${kcal}-calorie-${DIET_SLUG[diet]}-indian-diet-plan`;
/** Protein aimed for in a diet plan: about 25% of calories, a little less for vegan days. */
const planProtein = (kcal: number, diet: Diet) => Math.round((kcal * (diet === 'vegan' ? 0.18 : 0.25)) / 4 / 5) * 5;

/** Roughly which body weight a calorie level is the fat-loss target for (26 years, moderate activity). */
function whoFits(kcal: number, sex: Sex): number | null {
  let best: number | null = null; let gap = Infinity;
  const [lo, hi] = WEIGHTS[sex];
  for (let kg = lo; kg <= hi; kg++) {
    const g = Math.abs(targetsExplain(person(sex, 'lose'), kg).targets.kcalTraining - kcal);
    if (g < gap) { gap = g; best = kg; }
  }
  return gap <= 60 ? best : null;
}

function dietPlanArticles(): Article[] {
  const out: Article[] = [];
  PLAN_KCAL.forEach((kcal, i) => {
    for (const diet of DIETS) {
      const plan = buildDay(diet, kcal, planProtein(kcal, diet), i);
      const r = rounded(plan.total);
      const man = whoFits(kcal, 'male'); const woman = whoFits(kcal, 'female');
      const fits = [man && `a ${man} kg man`, woman && `a ${woman} kg woman`].filter(Boolean).join(' or ');
      const fitLine = fits
        ? `${fmt(kcal)} kcal is about the fat-loss target for ${fits} who is 26 and trains 3–5 days a week.`
        : kcal < 1400 ? `${fmt(kcal)} kcal is low for most adults who train. Use it only if a doctor or coach has set it for you.`
        : `${fmt(kcal)} kcal is around maintenance or a lean bulk for most active men; check your own target before you use it.`;
      const links: [string, string][] = [];
      for (const k of [kcal - 100, kcal + 100]) if (PLAN_KCAL.includes(k)) links.push([articlePath(dietPlanSlug(k, diet)), `${fmt(k)} calorie ${DIET_NAME[diet]} Indian diet plan`]);
      for (const d of DIETS) if (d !== diet) links.push([articlePath(dietPlanSlug(kcal, d)), `${fmt(kcal)} calorie ${DIET_NAME[d]} Indian diet plan`]);
      const pl = nearestProtein(r.protein);
      if (pl && diet !== 'vegan') links.push([articlePath(proteinSlug(pl, diet)), `${pl} g protein a day on a ${DIET_NAME[diet]} diet`]);
      const h1 = `${fmt(kcal)} calorie ${DIET_NAME[diet]} Indian diet plan`;
      out.push({
        family: 'diet-plans', slug: dietPlanSlug(kcal, diet), h1,
        title: `${h1} with ${r.protein} g protein: a full day of meals`,
        description: `A ${fmt(kcal)} kcal ${DIET_NAME[diet]} Indian day: breakfast, lunch, snack and dinner in katori and roti portions, ${r.protein} g protein, with calories for every item.`,
        links,
        body: `
<p class="lede">A full day of ${DIET_NAME[diet]} Indian food at ${fmt(r.kcal)} kcal, in portions you can measure with a katori and a count of rotis. ${esc(fitLine)}</p>
${stats(r, 'kcal')}
<h2>The day</h2>
${planTable(plan)}
<h2>Why it is built this way</h2>
<ul class="notes">
<li>Protein is ${r.protein} g (${pct(r.protein * 4, r.kcal)}% of calories). Most of it comes from ${topSources(plan)}.</li>
<li>Rotis and rice are the dial: one roti is about 99 kcal and half a katori of rice about 97 kcal, so add or remove them to move the day by 100 kcal.</li>
<li>Oil is the hidden number. The recipes assume 5–8 g per katori of dal or sabzi; a heavy hand adds 50–100 kcal per dish.</li>
${diet === 'vegan' ? '<li>Without dairy, pulses and sprouts carry the protein. Add soya chunks (a handful gives about 13 g) if you need more.</li>' : ''}
</ul>`,
      });
    }
  });
  return out;
}

// ---------- family: protein plans ----------

const PROTEIN_LEVELS = Array.from({ length: 15 }, (_, i) => 60 + i * 10);
const nearestProtein = (p: number) => {
  const n = PROTEIN_LEVELS.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));
  return Math.abs(n - p) <= 10 ? n : null;
};
export const proteinSlug = (g: number, diet: Diet) => `${g}g-protein-a-day-${DIET_SLUG[diet]}-indian-diet`;
const proteinKcal = (g: number) => Math.min(3200, Math.max(1600, Math.round((g * 14) / 100) * 100));

let proteinCache: Article[] | null = null;
function proteinArticles(): Article[] {
  if (proteinCache) return proteinCache;
  const out: Article[] = [];
  PROTEIN_LEVELS.forEach((g, i) => {
    for (const diet of ['veg', 'egg', 'nonveg'] as Diet[]) {
      const kcal = proteinKcal(g);
      const plan = buildDay(diet, kcal, g, i + 1);
      const r = rounded(plan.total);
      if (r.protein < g - 6) continue; // only publish levels the day really reaches
      const lines = plan.lines.map((l) => ({ d: dish(l.id), s: l.servings, p: per(dish(l.id), l.servings).protein })).sort((a, b) => b.p - a.p);
      const rows = lines.slice(0, 6).map((x) => `<tr><th scope="row"><a href="${caloriePath(x.d)}">${esc(x.d.name)}</a></th><td class="l">${esc(portionText(x.d, x.s))}</td><td>${Math.round(x.p)} g</td><td>${pct(x.p, r.protein)}%</td></tr>`).join('');
      const links: [string, string][] = [];
      for (const n of [g - 10, g + 10]) if (PROTEIN_LEVELS.includes(n)) links.push([articlePath(proteinSlug(n, diet)), `${n} g protein a day on a ${DIET_NAME[diet]} diet`]);
      for (const d of ['veg', 'egg', 'nonveg'] as Diet[]) if (d !== diet) links.push([articlePath(proteinSlug(g, d)), `${g} g protein a day on a ${DIET_NAME[d]} diet`]);
      links.push([articlePath(bestDietSlug(diet)), `High-protein ${DIET_NAME[diet]} Indian foods`]);
      const h1 = `How to eat ${g} g protein a day on a ${DIET_NAME[diet]} Indian diet`;
      out.push({
        family: 'protein', slug: proteinSlug(g, diet), h1,
        title: `${g} g protein a day, ${DIET_NAME[diet]} Indian diet: a full day at ${fmt(r.kcal)} kcal`,
        description: `A ${DIET_NAME[diet]} Indian day that reaches ${r.protein} g protein in ${fmt(r.kcal)} kcal, meal by meal, with the foods doing the work and who needs ${g} g.`,
        links,
        body: `
<p class="lede">${g} g protein suits someone of about ${Math.round(g / 2.2)}–${Math.round(g / 1.6)} kg who lifts (1.6–2.2 g per kg). Here is a ${DIET_NAME[diet]} day that gets there: ${r.protein} g protein in ${fmt(r.kcal)} kcal.</p>
${stats(r, 'kcal')}
<h2>The day</h2>
${planTable(plan)}
<h2>Where the protein comes from</h2>
<div class="scroll"><table><thead><tr><th scope="col">Food</th><th scope="col" class="l">Portion</th><th scope="col">Protein</th><th scope="col">Share</th></tr></thead><tbody>${rows}</tbody></table></div>
<ul class="notes">
<li>Spread it out: ${Math.round(r.protein / 4)} g a meal across four meals is easier to eat and to use than one big serving.</li>
<li>Rotis and rice add up: ${pct(lines.filter((x) => x.d.id in CARB_CAP).reduce((s, x) => s + x.p, 0), r.protein)}% of today's protein comes from them, which is why the dal or paneer alone looks short.</li>
${g >= 150 ? '<li>At this level a whey scoop or extra eggs or chicken is the practical way to close the gap without going far over your calories.</li>' : ''}
</ul>`,
      });
    }
  });
  proteinCache = out;
  return out;
}

// ---------- family: comparisons ----------

export const compareSlug = (a: Dish, b: Dish) => {
  const [x, y] = [slugOf(a), slugOf(b)].sort();
  return `${x}-vs-${y}`;
};

function compareArticles(): Article[] {
  const out: Article[] = [];
  for (const cat of CATEGORIES) {
    const ds = cat.ids.map(dish);
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        const [a, b] = [ds[i], ds[j]].sort((p, q) => slugOf(p).localeCompare(slugOf(q)));
        const ma = per(a); const mb = per(b); const ra = rounded(ma); const rb = rounded(mb);
        const lighter = ra.kcal <= rb.kcal ? a : b; const heavier = lighter === a ? b : a;
        const protein = ma.protein >= mb.protein ? a : b;
        const dense = density(ma) >= density(mb) ? a : b;
        const kcalGap = Math.abs(ra.kcal - rb.kcal);
        const loss = Math.abs(density(ma) - density(mb)) >= 0.5 ? dense : lighter;
        const gain = Math.abs(ma.protein - mb.protein) >= 2 ? protein : heavier;
        const equal = (x: Dish, y: Dish) => one(per(x).kcal / per(y).kcal);
        const row = (label: string, va: string, vb: string) => `<tr><th scope="row">${label}</th><td>${va}</td><td>${vb}</td></tr>`;
        const table = `<div class="scroll"><table><thead><tr><th scope="col">Per serving</th><th scope="col">${esc(a.name)}</th><th scope="col">${esc(b.name)}</th></tr></thead><tbody>
${row('Serving', esc(a.serving), esc(b.serving))}${row('Calories', `${ra.kcal} kcal`, `${rb.kcal} kcal`)}${row('Protein', `${ra.protein} g`, `${rb.protein} g`)}${row('Carbs', `${ra.carbs} g`, `${rb.carbs} g`)}${row('Fat', `${ra.fat} g`, `${rb.fat} g`)}${row('Protein per 100 kcal', `${one(density(ma))} g`, `${one(density(mb))} g`)}${row('Calories from fat', `${pct(fatShare(ma) * 100, 100)}%`, `${pct(fatShare(mb) * 100, 100)}%`)}</tbody></table></div>`;
        const notes = [
          kcalGap < 15 ? `Calories are close: ${ra.kcal} vs ${rb.kcal} kcal a serving.` : `${heavier.name} has ${kcalGap} kcal more a serving than ${low(lighter.name)}. One serving of ${low(heavier.name)} has the calories of about ${equal(heavier, lighter)} servings of ${low(lighter.name)}.`,
          Math.abs(ra.protein - rb.protein) < 2 ? `Protein is about the same (${ra.protein} vs ${rb.protein} g).` : `${protein.name} has more protein: ${Math.round(per(protein).protein)} g vs ${Math.round(per(protein === a ? b : a).protein)} g.`,
          `For protein per calorie, ${low(dense.name)} wins with ${one(density(per(dense)))} g per 100 kcal.`,
        ];
        if (dishDiet(a) !== dishDiet(b)) notes.push(`They suit different diets: ${low(a.name)} is ${DIET_NAME[dishDiet(a)]} and ${low(b.name)} is ${DIET_NAME[dishDiet(b)]}.`);
        const links: [string, string][] = [
          [caloriePath(a), `Calories in ${low(a.name)}, by portion`], [caloriePath(b), `Calories in ${low(b.name)}, by portion`],
          [articlePath(verdictSlug(a, 'lose')), `Is ${low(a.name)} good for weight loss?`], [articlePath(verdictSlug(b, 'lose')), `Is ${low(b.name)} good for weight loss?`],
        ];
        const more = ds.filter((x) => x !== a && x !== b).slice(0, 4).map((x) => [articlePath(compareSlug(a, x)), `${a.name} vs ${low(x.name)}`] as [string, string]);
        links.push(...more, [articlePath(bestSlug(cat.slug, 'lose')), `Best ${low(cat.name)} for weight loss`]);
        const h1 = `${a.name} vs ${low(b.name)}: calories and protein compared`;
        out.push({
          family: 'compare', slug: compareSlug(a, b), h1,
          title: `${a.name} vs ${low(b.name)}: ${ra.kcal} vs ${rb.kcal} kcal, ${ra.protein} vs ${rb.protein} g protein`,
          description: `${a.name} (${ra.kcal} kcal, ${ra.protein} g protein) against ${low(b.name)} (${rb.kcal} kcal, ${rb.protein} g) per serving, and which one to pick to lose fat or build muscle.`,
          links,
          body: `
<p class="lede">Short answer: for fat loss pick <b>${esc(low(loss.name))}</b>; for muscle gain <b>${esc(low(gain.name))}</b> does more. The numbers are per usual serving, so check the serving sizes in the table.</p>
${table}
<h2>What the numbers say</h2>
<ul class="notes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
<h2>Which to pick</h2>
<ul class="notes">
<li><b>Losing fat:</b> ${esc(loss.name)}, because ${loss === dense ? 'it gives more protein for each calorie, which keeps you full and protects muscle' : 'it is lighter and the protein difference is small'}.</li>
<li><b>Building muscle:</b> ${esc(gain.name)}, because ${gain === protein ? 'it brings more protein a serving' : 'it brings more energy for training with similar protein'}.</li>
<li><b>Either way:</b> the cooking fat moves both numbers most. Halving the oil or ghee is the easiest cut.</li>
</ul>`,
        });
      }
    }
  }
  return out;
}

// ---------- family: meal pairings ----------

interface Base { id: string; servings: number; label: string; slug: string }
const BASES: Base[] = [
  { id: 'roti', servings: 2, label: '2 roti', slug: '2-roti' },
  { id: 'roti', servings: 3, label: '3 roti', slug: '3-roti' },
  { id: 'ghee-roti', servings: 2, label: '2 ghee roti', slug: '2-ghee-roti' },
  { id: 'paratha', servings: 1, label: 'a plain paratha', slug: 'paratha' },
  { id: 'plain-rice', servings: 1, label: '1 katori rice', slug: 'rice' },
  { id: 'jeera-rice', servings: 1, label: 'jeera rice', slug: 'jeera-rice' },
  { id: 'naan', servings: 1, label: 'butter naan', slug: 'naan' },
];
const MAINS = [...CATEGORIES.find((c) => c.slug === 'dals')!.ids, ...CATEGORIES.find((c) => c.slug === 'sabzi')!.ids];
export const mealSlug = (main: Dish, b: Base) => `${slugOf(main)}-with-${b.slug}-calories`;
const ADD_ON: Record<Diet, string[]> = { vegan: ['sprouts', 'chana-chaat'], veg: ['raita', 'curd-bowl', 'paneer-bhurji'], egg: ['boiled-eggs', 'raita', 'egg-bhurji'], nonveg: ['chicken-tikka', 'boiled-eggs', 'raita'] };

function mealArticles(): Article[] {
  const out: Article[] = [];
  for (const id of MAINS) {
    const main = dish(id);
    const mm = per(main);
    for (const b of BASES) {
      const bd = dish(b.id);
      const bm = per(bd, b.servings);
      const t = rounded(add(mm, bm));
      const r1 = rounded(mm); const r2 = rounded(bm);
      const others = BASES.filter((x) => x !== b).map((x) => ({ x, k: Math.round(add(mm, per(dish(x.id), x.servings)).kcal) })).sort((p, q) => p.k - q.k);
      const lightest = others[0];
      const diet = dishDiet(main);
      const addOn = ADD_ON[diet].map(dish).find((d) => d.id !== main.id)!;
      const withAdd = rounded(add(add(mm, bm), per(addOn)));
      const proteinLine = t.protein >= 25
        ? `At ${t.protein} g protein this is already a full protein meal.`
        : `At ${t.protein} g protein this is short of a 25 g protein meal. Adding ${low(addOn.name)} (${addOn.serving}) takes it to ${withAdd.protein} g protein and ${fmt(withAdd.kcal)} kcal.`;
      const links: [string, string][] = BASES.filter((x) => x !== b).slice(0, 4).map((x) => [articlePath(mealSlug(main, x)), `${main.name} with ${x.label}`]);
      const sameBase = MAINS.filter((m) => m !== id).map(dish).sort((p, q) => per(q).protein - per(p).protein).slice(0, 3);
      links.push(...sameBase.map((d) => [articlePath(mealSlug(d, b)), `${d.name} with ${b.label}`] as [string, string]));
      links.push([caloriePath(main), `Calories in ${low(main.name)}, by portion`]);
      const h1 = `${main.name} with ${b.label}: calories and protein`;
      out.push({
        family: 'meals', slug: mealSlug(main, b), h1,
        title: `${main.name} with ${b.label}: ${t.kcal} kcal and ${t.protein} g protein`,
        description: `One ${main.serving} of ${low(main.name)} with ${b.label} is about ${t.kcal} kcal, ${t.protein} g protein, ${t.carbs} g carbs and ${t.fat} g fat. How it fits your day and how to make it lighter or higher in protein.`,
        links,
        body: `
<p class="lede">One serving of ${esc(low(main.name))} (${esc(main.serving)}) with ${esc(b.label)} comes to about <b>${t.kcal} kcal</b> and ${t.protein} g protein.</p>
${stats(t, 'kcal')}
<h2>The plate</h2>
<div class="scroll"><table><thead><tr><th scope="col">Item</th><th scope="col" class="l">Portion</th><th scope="col">kcal</th><th scope="col">Protein</th><th scope="col">Carbs</th><th scope="col">Fat</th></tr></thead><tbody>
<tr><th scope="row"><a href="${caloriePath(main)}">${esc(main.name)}</a></th><td class="l">${esc(main.serving)}</td><td>${r1.kcal}</td><td>${r1.protein} g</td><td>${r1.carbs} g</td><td>${r1.fat} g</td></tr>
<tr><th scope="row"><a href="${caloriePath(bd)}">${esc(bd.name)}</a></th><td class="l">${esc(portionText(bd, b.servings))}</td><td>${r2.kcal}</td><td>${r2.protein} g</td><td>${r2.carbs} g</td><td>${r2.fat} g</td></tr>
</tbody></table></div>
<h2>How it fits your day</h2>
<ul class="notes">
<li>On a 1,800 kcal fat-loss day it is ${pct(t.kcal, 1800)}% of your calories; on 2,200 kcal ${pct(t.kcal, 2200)}%; on a 2,600 kcal bulk ${pct(t.kcal, 2600)}%.</li>
<li>${esc(proteinLine)}</li>
<li>${lightest.k < t.kcal ? `For a lighter plate, have it with ${esc(lightest.x.label)} instead: ${lightest.k} kcal, ${t.kcal - lightest.k} kcal less.` : `This is already the lightest base for ${esc(low(main.name))} in this guide.`}</li>
</ul>
<h2>Other bases with ${esc(low(main.name))}</h2>
<div class="scroll"><table><thead><tr><th scope="col">With</th><th scope="col">kcal</th><th scope="col">Protein</th></tr></thead><tbody>${BASES.map((x) => {
          const m = rounded(add(mm, per(dish(x.id), x.servings)));
          return `<tr><th scope="row">${x === b ? esc(x.label) : `<a href="${articlePath(mealSlug(main, x))}">${esc(x.label)}</a>`}</th><td>${m.kcal}</td><td>${m.protein} g</td></tr>`;
        }).join('')}</tbody></table></div>`,
      });
    }
  }
  return out;
}

// ---------- family: verdicts ----------

type VerdictGoal = 'lose' | 'gain';
export const verdictSlug = (d: Dish, g: VerdictGoal) => `is-${slugOf(d)}-good-for-${g === 'lose' ? 'weight-loss' : 'muscle-gain'}`;
const DAY: Record<VerdictGoal, { kcal: number; protein: number; word: string }> = { lose: { kcal: 1800, protein: 120, word: 'weight loss' }, gain: { kcal: 2800, protein: 140, word: 'muscle gain' } };

export function verdictFor(d: Dish, g: VerdictGoal): string {
  const m = per(d); const dn = density(m); const fs = fatShare(m);
  if (g === 'lose') {
    if (dn >= 8) return 'Yes. It is one of the better picks';
    if (m.kcal <= 150 && fs < 0.5) return 'Yes. It is light enough to fit most days';
    if (fs >= 0.5 || m.kcal >= 450) return 'Only now and then, in a small portion';
    if (dn >= 5) return 'Yes, in a normal portion';
    return 'In moderation, paired with protein';
  }
  if (m.protein >= 25) return 'Yes. One serving is a full protein meal';
  if (m.protein >= 12) return 'Yes, as part of a protein-rich meal';
  if (dn >= 5) return 'It helps, but you will need more protein alongside';
  return 'Not for protein. It is fuel for training';
}

function verdictArticles(): Article[] {
  const out: Article[] = [];
  for (const d of DISHES) {
    const m = per(d); const r = rounded(m); const dn = density(m); const fs = fatShare(m);
    const diet = dishDiet(d);
    for (const g of ['lose', 'gain'] as VerdictGoal[]) {
      const day = DAY[g];
      const verdict = verdictFor(d, g);
      const portions = d.portions.map((p) => ({ label: p.label, m: rounded(scale(m, p.grams / 100)) }));
      const best = g === 'lose'
        ? [...portions].filter((p) => p.m.kcal <= 400).pop() ?? portions[0]
        : portions.find((p) => p.m.protein >= 25) ?? portions[portions.length - 1];
      const reasons: string[] = [
        `${one(dn)} g protein per 100 kcal (${dn >= 8 ? 'high' : dn >= 4 ? 'moderate' : 'low'}; chicken breast is about 22, plain rice about 2).`,
        `${r.kcal} kcal a serving is ${pct(r.kcal, day.kcal)}% of a ${fmt(day.kcal)} kcal ${g === 'lose' ? 'fat-loss' : 'bulking'} day, and ${r.protein} g is ${pct(r.protein, day.protein)}% of ${day.protein} g protein.`,
      ];
      if (fs >= 0.4) reasons.push(`Fat gives ${pct(fs * 100, 100)}% of its calories, mostly from the cooking fat, so the recipe matters more than the dish.`);
      if (g === 'gain' && m.carbs >= 40) reasons.push(`With ${r.carbs} g carbs it is good fuel before or after training.`);
      if (g === 'lose' && m.carbs >= 40 && dn < 4) reasons.push(`It is mostly carbs (${r.carbs} g), which is fine in a planned portion but easy to overeat.`);
      const better = g === 'lose'
        ? swapsFor(d, DISHES)
        : categoryOf(d).ids.map(dish).filter((x) => x.id !== d.id && CAN_EAT[diet].includes(dishDiet(x)) && per(x).protein > m.protein + 2).sort((p, q) => per(q).protein - per(p).protein).slice(0, 3);
      const pair = DISHES.filter((x) => !categoryOf(d).ids.includes(x.id) && CAN_EAT[diet].includes(dishDiet(x)))
        .sort((p, q) => density(per(q)) - density(per(p))).slice(0, 3);
      const li = (x: Dish) => { const xr = rounded(per(x)); return `<li><a href="${caloriePath(x)}">${esc(x.name)}</a><span>${xr.kcal} kcal · ${xr.protein} g protein · ${esc(x.serving)}</span></li>`; };
      const links: [string, string][] = [
        [articlePath(verdictSlug(d, g === 'lose' ? 'gain' : 'lose')), `Is ${low(d.name)} good for ${DAY[g === 'lose' ? 'gain' : 'lose'].word}?`],
        [caloriePath(d), `Calories in ${low(d.name)}, by portion`],
        [articlePath(bestSlug(categoryOf(d).slug, g)), `Best ${low(categoryOf(d).name)} for ${day.word}`],
        ...categoryOf(d).ids.filter((id) => id !== d.id).slice(0, 3).map((id) => [articlePath(compareSlug(d, dish(id))), `${d.name} vs ${low(dish(id).name)}`] as [string, string]),
      ];
      const h1 = `Is ${low(d.name)} good for ${day.word}?`;
      out.push({
        family: 'verdicts', slug: verdictSlug(d, g), h1,
        title: `Is ${low(d.name)} good for ${day.word}? ${verdict.split('.')[0]} (${r.kcal} kcal, ${r.protein} g protein)`,
        description: `${d.name} for ${day.word}: ${r.kcal} kcal and ${r.protein} g protein per ${d.serving}. The verdict, the best portion, and better swaps, worked out from the numbers.`,
        links,
        body: `
<p class="lede"><b>${esc(verdict)}.</b> One serving (${esc(d.serving)}) has ${r.kcal} kcal and ${r.protein} g protein.</p>
${stats(r, 'kcal')}
<h2>Why</h2>
<ul class="notes">${reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>The portion to aim for</h2>
<p>${g === 'lose' ? `${esc(best.label)} keeps it to ${best.m.kcal} kcal with ${best.m.protein} g protein.` : best.m.protein >= 25 ? `${esc(best.label)} gives ${best.m.protein} g protein in ${best.m.kcal} kcal.` : `Even ${esc(best.label)} gives ${best.m.protein} g protein (${best.m.kcal} kcal), so build the meal around another protein food.`}</p>
<div class="scroll"><table><thead><tr><th scope="col">Portion</th><th scope="col">kcal</th><th scope="col">Protein</th></tr></thead><tbody>${portions.map((p) => `<tr><th scope="row">${esc(p.label)}</th><td>${p.m.kcal}</td><td>${p.m.protein} g</td></tr>`).join('')}</tbody></table></div>
${better.length ? `<h2>${g === 'lose' ? 'More protein per calorie' : 'More protein a serving'} in ${esc(low(categoryOf(d).name))}</h2><ul class="list">${better.map(li).join('')}</ul>` : ''}
<h2>Pair it with</h2>
<ul class="list">${pair.map(li).join('')}</ul>`,
      });
    }
  }
  return out;
}

// ---------- family: best foods ----------

export const bestSlug = (cat: string, g: VerdictGoal) => `best-${cat}-for-${g === 'lose' ? 'weight-loss' : 'muscle-gain'}`;
export const bestDietSlug = (diet: Diet) => `high-protein-${DIET_SLUG[diet]}-indian-foods`;

function rankList(ds: Dish[], extra: (d: Dish) => string): string {
  return `<ol class="list">${ds.map((d) => { const r = rounded(per(d)); return `<li><a href="${caloriePath(d)}">${esc(d.name)}</a><span>${r.kcal} kcal · ${r.protein} g protein · ${esc(d.serving)} · ${esc(extra(d))}</span></li>`; }).join('')}</ol>`;
}

function bestArticles(): Article[] {
  const out: Article[] = [];
  for (const cat of CATEGORIES) {
    const ds = cat.ids.map(dish);
    for (const g of ['lose', 'gain'] as VerdictGoal[]) {
      const ranked = g === 'lose'
        ? [...ds].sort((a, b) => density(per(b)) - density(per(a)) || per(a).kcal - per(b).kcal)
        : [...ds].sort((a, b) => per(b).protein - per(a).protein || per(b).kcal - per(a).kcal);
      const topD = ranked[0]; const last = ranked[ranked.length - 1];
      const word = DAY[g].word;
      const h1 = `Best ${low(cat.name)} for ${word}`;
      out.push({
        family: 'best', slug: bestSlug(cat.slug, g), h1,
        title: `${h1}: ${ds.length} Indian dishes ranked by ${g === 'lose' ? 'protein per calorie' : 'protein a serving'}`,
        description: `${ds.length} ${low(cat.name)} ranked for ${word}. ${topD.name} comes first with ${rounded(per(topD)).protein} g protein in ${rounded(per(topD)).kcal} kcal.`,
        links: [
          [articlePath(bestSlug(cat.slug, g === 'lose' ? 'gain' : 'lose')), `Best ${low(cat.name)} for ${DAY[g === 'lose' ? 'gain' : 'lose'].word}`],
          ...ranked.slice(0, 4).map((d) => [articlePath(verdictSlug(d, g)), `Is ${low(d.name)} good for ${word}?`] as [string, string]),
          [articlePath(compareSlug(topD, last)), `${topD.name} vs ${low(last.name)}`],
          ['/calories/', 'Calorie guide: every dish by portion'],
        ],
        body: `
<p class="lede">Ranked by ${g === 'lose' ? 'protein for each 100 kcal, the number that keeps you full and protects muscle on a deficit' : 'protein in one serving, with calories as the tie-break'}. ${esc(topD.name)} comes first; ${esc(low(last.name))} comes last.</p>
${rankList(ranked, (d) => (g === 'lose' ? `${one(density(per(d)))} g per 100 kcal` : verdictFor(d, 'gain').split('.')[0]))}
<h2>How to use the list</h2>
<ul class="notes">
<li>${g === 'lose' ? 'Build meals from the top half. The bottom half still fits, in a measured portion.' : 'Lean on the top half for protein; use the rest for energy around training.'}</li>
<li>Numbers assume home recipes with 5–8 g of oil or ghee a serving. Restaurant versions often carry double.</li>
</ul>`,
      });
    }
  }
  for (const diet of DIETS) {
    const ds = DISHES.filter((d) => canEat(diet, d) && per(d).protein >= 5).sort((a, b) => density(per(b)) - density(per(a))).slice(0, 15);
    const h1 = `High-protein ${DIET_NAME[diet]} Indian foods`;
    out.push({
      family: 'best', slug: bestDietSlug(diet), h1,
      title: `${h1}: ${ds.length} dishes ranked by protein per calorie`,
      description: `The ${ds.length} ${DIET_NAME[diet]} Indian dishes with the most protein per calorie, with calories and protein for each serving.`,
      links: [
        ...(diet !== 'vegan' ? [100, 120, 150].map((g) => [articlePath(proteinSlug(g, diet)), `${g} g protein a day on a ${DIET_NAME[diet]} diet`] as [string, string]) : []),
        [articlePath(dietPlanSlug(1800, diet)), `1,800 calorie ${DIET_NAME[diet]} Indian diet plan`],
        ...DIETS.filter((x) => x !== diet).map((x) => [articlePath(bestDietSlug(x)), `High-protein ${DIET_NAME[x]} Indian foods`] as [string, string]),
      ],
      body: `
<p class="lede">Every dish here gives at least 5 g protein a serving, ranked by protein for each 100 kcal.</p>
${rankList(ds, (d) => `${one(density(per(d)))} g per 100 kcal`)}`,
    });
  }
  return out;
}

// ---------- family: steps ----------

const STEP_COUNTS = Array.from({ length: 19 }, (_, i) => 2000 + i * 1000);
const STEP_WEIGHTS = [50, 60, 70, 80, 90, 100, 110];
export const stepsSlug = (steps: number, kg: number) => `calories-burned-walking-${steps}-steps-${kg}kg`;
/** Net walking energy: about 0.5 kcal per kg per km on flat ground; 76 cm stride. */
export const walkKcal = (steps: number, kg: number) => Math.round(0.5 * kg * ((steps * 0.762) / 1000));

function stepsArticles(): Article[] {
  const out: Article[] = [];
  const roti = per(dish('roti')).kcal; const chai = per(dish('chai')).kcal; const samosa = per(dish('samosa')).kcal;
  for (const steps of STEP_COUNTS) {
    for (const kg of STEP_WEIGHTS) {
      const kcal = walkKcal(steps, kg);
      const km = (steps * 0.762) / 1000;
      const mins = Math.round(steps / 100);
      const weekKg = (kcal * 7) / 7700;
      const byWeight = STEP_WEIGHTS.map((w) => `<tr><th scope="row">${w === kg ? `${w} kg` : `<a href="${articlePath(stepsSlug(steps, w))}">${w} kg</a>`}</th><td>${walkKcal(steps, w)}</td></tr>`).join('');
      const bySteps = [5000, 8000, 10000, 12000, 15000, 20000].map((s) => `<tr><th scope="row">${s === steps ? fmt(s) : `<a href="${articlePath(stepsSlug(s, kg))}">${fmt(s)}</a>`}</th><td>${one((s * 0.762) / 1000)} km</td><td>${walkKcal(s, kg)}</td></tr>`).join('');
      const links: [string, string][] = [];
      for (const s of [steps - 1000, steps + 1000]) if (STEP_COUNTS.includes(s)) links.push([articlePath(stepsSlug(s, kg)), `${fmt(s)} steps at ${kg} kg`]);
      const lose = targetSlug('lose', kg, 'male');
      links.push([articlePath(lose), `Calories to lose weight at ${kg} kg (man)`]);
      if (kg <= 110) links.push([articlePath(targetSlug('lose', kg, 'female')), `Calories to lose weight at ${kg} kg (woman)`]);
      const h1 = `Calories burned walking ${fmt(steps)} steps at ${kg} kg`;
      out.push({
        family: 'steps', slug: stepsSlug(steps, kg), h1,
        title: `${fmt(steps)} steps at ${kg} kg: about ${kcal} kcal burned (${one(km)} km)`,
        description: `Walking ${fmt(steps)} steps burns about ${kcal} kcal for a ${kg} kg person: ${one(km)} km in roughly ${mins} minutes. In rotis, chai and samosas, with tables by weight and step count.`,
        links,
        body: `
<p class="lede">About <b>${kcal} kcal</b> on top of what your body burns at rest, over ${one(km)} km and roughly ${mins} minutes of walking.</p>
<div class="stats">
  <div class="stat hero"><b>${kcal}</b><span>kcal</span></div>
  <div class="stat"><b>${one(km)}</b><span>km</span></div>
  <div class="stat"><b>${mins}</b><span>minutes</span></div>
  <div class="stat"><b>${one(kcal / roti)}</b><span>roti</span></div>
</div>
<h2>What that is in food</h2>
<ul class="notes">
<li>${one(kcal / roti)} medium roti (${Math.round(roti)} kcal each).</li>
<li>${one(kcal / chai)} cups of masala chai with sugar (${Math.round(chai)} kcal each).</li>
<li>${one(kcal / samosa)} samosas (${Math.round(samosa)} kcal each).</li>
<li>Every day for a week, that is ${fmt(kcal * 7)} kcal, about ${one(weekKg)} kg of body fat, if you eat the same as before.</li>
</ul>
<h2>${fmt(steps)} steps by body weight</h2>
<div class="scroll"><table><thead><tr><th scope="col">Weight</th><th scope="col">kcal</th></tr></thead><tbody>${byWeight}</tbody></table></div>
<h2>At ${kg} kg, by step count</h2>
<div class="scroll"><table><thead><tr><th scope="col">Steps</th><th scope="col">Distance</th><th scope="col">kcal</th></tr></thead><tbody>${bySteps}</tbody></table></div>
<ul class="notes">
<li>Speed changes the number less than you would think: per km, brisk walking burns only a little more than strolling. Hills and stairs add more.</li>
<li>Fitness bands often show a bigger number because they include the calories you would burn sitting still. For a diet, use the net number.</li>
</ul>`,
      });
    }
  }
  return out;
}

// ---------- assembling ----------

/** All articles. Links to blog pages that were not built (a protein level a diet cannot reach) are dropped. */
export function blogArticles(): Article[] {
  const all = [...targetArticles(), ...dietPlanArticles(), ...proteinArticles(), ...compareArticles(), ...mealArticles(), ...verdictArticles(), ...bestArticles(), ...stepsArticles()];
  const known = new Set(all.map((a) => articlePath(a.slug)));
  for (const a of all) a.links = a.links.filter(([p]) => !p.startsWith('/blog/') || known.has(p));
  return all;
}

function topicHtml(site: string, f: Family, list: Article[]): string {
  const fam = FAMILY[f];
  const path = topicPath(f);
  const items = list.map((a) => `<li><a href="${articlePath(a.slug)}">${esc(a.h1)}</a><span>${esc(a.description)}</span></li>`).join('');
  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${APP}">PeakX</a> › <a href="/blog/">Blog</a> › <span>${esc(fam.name)}</span></nav>
<h1>${esc(fam.name)}</h1>
<p class="lede">${esc(fam.blurb)} ${list.length} articles.</p>
<ul class="list">${items}</ul>`;
  const ld = jsonLd({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [['PeakX', APP], ['Blog', '/blog/'], [fam.name, path]].map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${site}${p}` })),
  });
  return layout(site, path, `${fam.name}: ${list.length} articles`, fam.blurb, body, ld, REF, NUTRITION_FINE, BLOG_UPDATED).replace('</style>', `${BLOG_CSS}</style>`);
}

const FEATURED = [
  targetSlug('lose', 70, 'male'), targetSlug('lose', 60, 'female'), dietPlanSlug(1800, 'veg'), proteinSlug(120, 'veg'),
  compareSlug(dish('paratha'), dish('roti')), mealSlug(dish('dal-tadka'), BASES[0]), 'is-poha-good-for-weight-loss', stepsSlug(10000, 70),
];

function blogHomeHtml(site: string, groups: [Family, Article[]][], total: number): string {
  const all = new Map(groups.flatMap(([, l]) => l).map((a) => [a.slug, a]));
  const featured = FEATURED.map((s) => all.get(s)).filter((a): a is Article => !!a);
  const sections = groups.map(([f, l]) => `<h2><a href="${topicPath(f)}">${esc(FAMILY[f].name)}</a></h2><p class="lede">${esc(FAMILY[f].blurb)}</p><ul class="list">${l.slice(0, 5).map((a) => `<li><a href="${articlePath(a.slug)}">${esc(a.h1)}</a></li>`).join('')}<li><a href="${topicPath(f)}">All ${l.length} ${esc(low(FAMILY[f].name))} →</a></li></ul>`).join('');
  const body = `
<nav class="crumbs" aria-label="Breadcrumb"><a href="${APP}">PeakX</a> › <span>Blog</span></nav>
<h1>The PeakX blog</h1>
<p class="lede">${fmt(total)} articles on eating and training in India, each worked out from the same food table and formulas the PeakX app uses: calorie targets, diet plans, protein, comparisons and walking.</p>
<h2>Start here</h2>
<ul class="list">${featured.map((a) => `<li><a href="${articlePath(a.slug)}">${esc(a.h1)}</a><span>${esc(a.description)}</span></li>`).join('')}</ul>
${sections}`;
  const ld = jsonLd({ '@context': 'https://schema.org', '@type': 'Blog', name: 'The PeakX blog', url: `${site}/blog/`, inLanguage: 'en-IN', publisher: { '@type': 'Organization', name: 'PeakX', url: `${site}/` } });
  return layout(site, '/blog/', `The PeakX blog: ${fmt(total)} articles on Indian food, calories and training`, 'Calorie targets, Indian diet plans, protein plans, food comparisons and walking calories, worked out from the PeakX food table.', body, ld, REF, NUTRITION_FINE, BLOG_UPDATED).replace('</style>', `${BLOG_CSS}</style>`);
}

/** Every blog page: the blog home, one hub per family, then every article. */
export function blogPages(site: string): Page[] {
  const articles = blogArticles();
  const groups = FAMILY_ORDER.map((f) => [f, articles.filter((a) => a.family === f)] as [Family, Article[]]);
  return [
    { path: '/blog/', file: 'blog/index.html', html: blogHomeHtml(site, groups, articles.length) },
    ...groups.map(([f, l]) => ({ path: topicPath(f), file: `blog/topic/${f}/index.html`, html: topicHtml(site, f, l) })),
    ...articles.map((a) => ({ path: articlePath(a.slug), file: `blog/${a.slug}/index.html`, html: articleHtml(site, a) })),
  ];
}

export const blogSitemap = (pages: Page[]): SitemapEntry[] => pages.map((p) => ({ path: p.path, lastmod: BLOG_UPDATED }));

const BLOG_CSS = `
.meta{font-size:13px;color:var(--text-3);margin:0 0 16px}
td.l,th.l{text-align:left;white-space:normal}
tr.slot th,tr.slot td{background:rgba(14,15,12,.03);font-weight:600}
ol.notes li b,ul.notes li b,.lede b{color:var(--text)}
h2 a{text-decoration:none}
`;
