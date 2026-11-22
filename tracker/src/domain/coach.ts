import type { AppData, CoachOption, ISODate } from './types';
import { searchFoods, itemFrom, type Loggable } from './foodSearch';
import { rounded } from './nutrition';
import { dayTotals, kcalTarget, mealsOn, remaining, wearableOn, SLOT_LABEL } from '../state/selectors';
import { periodSummary, liftSummary, MAIN_LIFTS } from '../state/insights';
import { findings } from '../state/analytics';
import { planDay, sessionFor, targetSets } from './training';
import { fmtPace, paceSec, runsOn, weekRuns } from './runs';
import { PLACES, orderMacros } from './eatingOut';
import { resolveItems } from './mealParser';

/**
 * AI Coach (S19.1, Pro). The context the Coach sees, a daily message limit, and a rule-based coach that
 * answers the common questions when the AI service isn't configured. Option cards always carry numbers
 * from the food table, never from the model.
 */

export const DAILY_LIMIT = 40;

export function usageLeft(d: Pick<AppData, 'coach'>, date: ISODate): number {
  return d.coach.usage.date === date ? Math.max(0, DAILY_LIMIT - d.coach.usage.count) : DAILY_LIMIT;
}

/** Compact, numbers-first context for the model: targets, today's log, plan, wearable, recent trends. */
export function coachContext(d: AppData, date: ISODate) {
  const left = remaining(d, date);
  const plan = sessionFor(d.workouts, d.profile, date, undefined, d.trainingOverrides, d.fixPlans);
  const w = wearableOn(d, date);
  const week = periodSummary(d, date, 7);
  const lifts = MAIN_LIFTS.map((n) => liftSummary(d.workouts, n, date, 28)).filter(Boolean).map((l) => ({ lift: l!.name, e1rmKg: l!.best, stalled: l!.stalled, weeksFlat: l!.flatWeeks }));
  const report = [...d.reports].filter((r) => r.status === 'published').sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
  const todayPlan = d.mealPlan?.days.find((x) => x.date === date);
  return {
    user: { name: d.profile.name, goal: d.profile.goal, stuck: d.profile.stuckLift ?? null, diet: d.profile.diet, vegOnlyWeekdays: (d.profile.diet === 'nonveg' || d.profile.diet === 'egg') && d.profile.vegDays?.length ? d.profile.vegDays.map((i) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]) : null, trains: d.profile.trainingStyle ?? 'gym', trainingDaysPerWeek: d.profile.trainingDays, gymTime: d.profile.gymTime },
    targets: { kcalToday: left.target.total, protein: d.targets.protein, carbs: d.targets.carbs, fat: d.targets.fat, steps: d.targets.steps, sleepHours: d.targets.sleepHours },
    today: { eaten: left.eaten, kcalLeft: left.left, proteinLeft: Math.max(0, d.targets.protein - left.eaten.protein), meals: mealsOn(d, date).map((m) => ({ meal: SLOT_LABEL[m.slot], items: m.items.map((i) => `${i.name} (${i.amount}, ${i.macros.kcal} kcal)`) })) },
    training: plan ? { session: plan.session.name, done: plan.session.done, exercises: plan.session.exercises.map((e) => `${e.name} ${targetSets(e)} sets × ${e.target.split('×')[1]?.trim()} at ${e.targetKg ?? '?'} kg`) } : { session: planDay(d.profile, date).run ? planDay(d.profile, date).label : 'Rest day' },
    runs: (d.runs ?? []).length ? { today: runsOn(d.runs, date).map((r) => `${r.kind} ${r.km} km at ${fmtPace(paceSec(r.km, r.seconds))}`), thisWeekKm: weekRuns(d.runs, date).km } : null,
    wearable: w ? { steps: w.steps, sleepLastNight: w.sleepHours, restingHr: w.restingHr } : null,
    last7Days: { avgKcal: Math.round(week.kcalIn.now ?? 0), avgProtein: Math.round(week.protein.now ?? 0), avgSleep: week.sleep.now ? Math.round(week.sleep.now * 10) / 10 : null, avgSteps: week.steps.now ? Math.round(week.steps.now) : null },
    lifts,
    findings: findings(d, date, 14).map((f) => `${f.title}. ${f.detail}`),
    lastReport: report ? report.headline : null,
    mealPlanToday: todayPlan ? todayPlan.meals.map((m) => `${SLOT_LABEL[m.slot]}: ${m.name}`) : null,
  };
}

const PROTEIN_WORDS = ['paneer', 'soya', 'egg', 'anda', 'chicken', 'fish', 'dal', 'curd', 'dahi', 'chana', 'rajma', 'moong', 'tofu', 'whey', 'mutton'];

/** Shakes and drinks are snacks, never a meal suggestion. */
const DRINKS = /shake|lassi|chaas|buttermilk|tea|coffee|juice|milk$/i;

function optionFrom(l: Loggable, portionIndex = l.defaultPortion, qty = 1): CoachOption {
  const it = itemFrom(l, portionIndex, qty, 'opt');
  return { name: l.name, amount: it.amount, macros: rounded(it.macros), ref: it.ref };
}

/** Food-table options fitting a calorie cap, optionally containing a protein word, best protein per calorie first. */
export function suggestOptions(cat: (Loggable & { keys: string[] })[], opts: { maxKcal: number; minKcal?: number; minCarbs?: number; meal?: boolean; word?: string; diet: AppData['profile']['diet'] }, n = 3): CoachOption[] {
  const fits = (l: Loggable) => opts.diet === 'nonveg' || !l.diet || (opts.diet === 'egg' ? l.diet !== 'nonveg' : opts.diet === 'veg' ? l.diet === 'veg' || l.diet === 'vegan' : l.diet === 'vegan');
  const pool = (opts.word ? searchFoods(opts.word, cat, 30, true) : cat).filter((l) => l.kind !== 'ingredient' && fits(l) && !(opts.meal && DRINKS.test(l.name)));
  const scored = pool.map((l) => {
    const m = l.macros(l.portions[l.defaultPortion], 1);
    return { l, m, score: m.protein / Math.max(1, m.kcal) };
  }).filter((x) => x.m.kcal <= opts.maxKcal && x.m.kcal >= (opts.minKcal ?? 120) && x.m.carbs >= (opts.minCarbs ?? 0));
  const seen = new Set<string>();
  return scored.sort((a, b) => b.score - a.score).filter((x) => !seen.has(x.l.name) && seen.add(x.l.name)).slice(0, n).map((x) => optionFrom(x.l));
}

export interface CoachAnswer { text: string; options: CoachOption[] }

/** The rule-based coach: handles the common questions from the user's own numbers. */
export function ruleReply(q: string, d: AppData, date: ISODate, cat: (Loggable & { keys: string[] })[]): CoachAnswer {
  const t = q.toLowerCase();
  const left = remaining(d, date).left;
  const cap = Number(t.match(/(?:under|below|less than|within)\s*(\d{3,4})/)?.[1] ?? 0) || Math.max(250, Math.min(700, left));
  const word = PROTEIN_WORDS.find((w) => t.includes(w));
  const proteinLeft = Math.max(0, d.targets.protein - dayTotals(d, date).protein);

  if (/stall|plateau|stuck|not (going|moving)|progress|why.*(bench|squat|deadlift|lift)/.test(t)) {
    const f = findings(d, date, 14);
    const stalled = MAIN_LIFTS.map((n) => liftSummary(d.workouts, n, date, 28)).find((l) => l?.stalled);
    const lines = [
      stalled ? `${stalled.name} has been at ${stalled.top.kg} kg × ${stalled.top.reps} for ${stalled.flatWeeks} weeks.` : 'None of your main lifts has stalled in the last 4 weeks.',
      ...f.slice(0, 3).map((x) => `• ${x.title}. ${x.detail}`),
      stalled ? 'Start with one change: add a working set and protect sleep the night before. Your weekly report can apply it for you.' : 'Keep logging; the weekly report will flag anything that starts to slip.',
    ];
    return { text: lines.join('\n'), options: [] };
  }
  if (/pre[- ]?workout|before (the )?gym|before training/.test(t)) {
    const opts = suggestOptions(cat, { maxKcal: 320, minKcal: 120, minCarbs: 15, diet: d.profile.diet }, 3);
    return { text: `About 60–90 minutes before your ${d.profile.gymTime} session, have 150–300 kcal with some carbs and protein. These fit:`, options: opts };
  }
  if (/eat(ing)? out|restaurant|order|outside|dhaba|biryani|pizza|momos|swiggy|zomato/.test(t)) {
    const place = PLACES.find((p) => t.includes(p.id) || p.name.toLowerCase().split(/[ /]+/).some((w) => w.length > 3 && t.includes(w))) ?? PLACES[0];
    const best = place.orders.map((o) => ({ o, m: orderMacros(o) })).filter((x) => x.m.kcal <= Math.max(400, left)).sort((a, b) => b.m.protein / b.m.kcal - a.m.protein / a.m.kcal).slice(0, 2);
    return {
      text: `You have ${Math.max(0, left)} kcal left today. At a ${place.name.toLowerCase()} place, these work best:\n${best.map((x) => `• ${x.o.name}: ${x.m.kcal} kcal, ${x.m.protein} g protein`).join('\n')}\nMore options are in Plan › Eating out.`,
      options: [],
    };
  }
  if (/sleep|tired|recover/.test(t)) {
    const s = periodSummary(d, date, 7).sleep.now;
    return { text: s ? `You averaged ${s.toFixed(1)} h of sleep this week against a ${d.targets.sleepHours} h goal. ${s < 7 ? 'Aim for lights out 8 hours before your alarm on nights before training; caffeine after 3 PM makes it harder.' : 'That’s enough for recovery; keep the timing consistent.'}` : 'Connect a wearable and I can look at your sleep.', options: [] };
  }
  if (/protein/.test(t) && !/dinner|lunch|breakfast|snack/.test(t)) {
    return { text: `You have ${proteinLeft} g of protein left today. These are the most protein for the calories:`, options: suggestOptions(cat, { maxKcal: Math.max(250, Math.min(600, left)), word, diet: d.profile.diet }, 3) };
  }
  if (/dinner|lunch|breakfast|snack|meal|eat|khana|recipe|cook|what (should|can) i/.test(t) || word) {
    const meal = /breakfast|nashta/.test(t) ? 'breakfast' : /lunch/.test(t) ? 'lunch' : /snack/.test(t) ? 'snack' : 'dinner';
    const isMeal = meal !== 'snack';
    const opts = suggestOptions(cat, { maxKcal: cap, minKcal: isMeal ? Math.round(cap * 0.45) : 100, meal: isMeal, word, diet: d.profile.diet }, 3);
    if (!opts.length) return { text: `I couldn’t find a ${word ?? ''} ${meal} under ${cap} kcal in our food table. Try a higher limit or another ingredient.`, options: [] };
    return { text: `For ${meal}${word ? ` with ${word}` : ''} under ${cap} kcal (you have ${Math.max(0, left)} kcal and ${proteinLeft} g protein left today):`, options: opts };
  }
  return {
    text: `I can help with meals that fit what’s left today (${Math.max(0, left)} kcal, ${proteinLeft} g protein), pre-workout snacks, why a lift has stalled, sleep, and what to order when eating out. What would you like?`,
    options: [],
  };
}

/** Match AI-suggested options (names and amounts only) to the food table. */
export function optionsFromAi(items: { name: string; quantity: number | null; unit: string | null }[], cat: (Loggable & { keys: string[] })[]): CoachOption[] {
  return resolveItems(items.map((i) => ({ query: i.name, qty: i.quantity, unit: i.unit, vague: false, text: i.name })), cat)
    .filter((p) => p.match)
    .slice(0, 3)
    .map((p) => optionFrom(p.match!, p.portionIndex, p.amount));
}

export function kcalTodayTarget(d: AppData, date: ISODate) { return kcalTarget(d, date).total; }
