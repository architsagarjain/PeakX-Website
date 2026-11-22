import type { Diet, ISODate, Macros, Targets } from './types.js';
import { addDays, parse, weekStart } from './clock.js';
import { DISHES, dishMacros, ingredient } from './foods.js';
import { add, rounded, scale, ZERO } from './nutrition.js';

/**
 * Sport programs (S15.2, Pro): 8-week strength and conditioning blocks for badminton, football
 * and running, with match days that move the week and match-day meal rules.
 * DRAFT for coach review: phase names, weekly templates and meal choices.
 */

export type SportId = 'badminton' | 'football' | 'running';
export interface Match { id: string; date: ISODate; time: string; label: string }
export interface SportState { sport: SportId; start: ISODate; matches: Match[] }

type Week = [string, string, string, string, string, string, string]; // Mon … Sun
interface Phase { weeks: [number, number]; name: string; focus: string; template: Week }

const R = 'Rest';
export const SPORTS: Record<SportId, { name: string; matchWord: string; phases: Phase[] }> = {
  badminton: { name: 'Badminton', matchWord: 'Match', phases: [
    { weeks: [1, 2], name: 'Base strength', focus: 'Squat, hinge, pull', template: ['Lower', 'Court', R, 'Upper', 'Agility', 'Court', R] },
    { weeks: [3, 4], name: 'Base + footwork', focus: 'Split steps, lunges, core', template: ['Lower', 'Court', R, 'Upper', 'Footwork', 'Court', R] },
    { weeks: [5, 6], name: 'Power + court speed', focus: 'Jumps, med-ball throws, shuttle runs', template: ['Power', 'Court', R, 'Upper', 'Court speed', 'Court', R] },
    { weeks: [7, 8], name: 'Peak, then taper', focus: 'Sharp and fresh for match days', template: ['Power', 'Court', R, 'Light strength', 'Court speed', R, R] },
  ] },
  football: { name: 'Football', matchWord: 'Match', phases: [
    { weeks: [1, 2], name: 'Base strength', focus: 'Squat, hinge, hamstrings', template: ['Lower', 'Team training', R, 'Upper', 'Conditioning', R, 'Team training'] },
    { weeks: [3, 4], name: 'Strength + repeat sprints', focus: 'Nordic curls, 30 m repeats', template: ['Lower', 'Team training', R, 'Upper', 'Repeat sprints', R, 'Team training'] },
    { weeks: [5, 6], name: 'Power + change of direction', focus: 'Bounds, cuts, deceleration', template: ['Power', 'Team training', R, 'Upper', 'Change of direction', R, 'Team training'] },
    { weeks: [7, 8], name: 'In-season maintain', focus: 'Two lifts, keep legs fresh', template: ['Power', 'Team training', R, 'Light strength', 'Team training', R, R] },
  ] },
  running: { name: 'Running', matchWord: 'Race', phases: [
    { weeks: [1, 2], name: 'Base miles + strength', focus: 'Easy runs, single-leg strength', template: ['Easy run', 'Lower', 'Easy run', R, 'Tempo', 'Upper', 'Long run'] },
    { weeks: [3, 4], name: 'Build', focus: 'Tempo and hills', template: ['Easy run', 'Lower', 'Hills', R, 'Tempo', 'Upper', 'Long run'] },
    { weeks: [5, 6], name: 'Speed', focus: 'Intervals, plyometrics', template: ['Easy run', 'Power', 'Intervals', R, 'Tempo', 'Light strength', 'Long run'] },
    { weeks: [7, 8], name: 'Taper', focus: 'Less volume, same intensity', template: ['Easy run', 'Light strength', 'Intervals', R, 'Easy run', R, 'Long run'] },
  ] },
};

/** Sessions that tire the legs; they never sit on the day before a match. */
const HEAVY = new Set(['Lower', 'Power', 'Long run', 'Intervals', 'Hills', 'Repeat sprints', 'Conditioning']);

export function programWeekNo(start: ISODate, date: ISODate): number {
  const days = Math.round((parse(weekStart(date)).getTime() - parse(weekStart(start)).getTime()) / 864e5);
  return Math.floor(days / 7) + 1;
}
export function phaseFor(sport: SportId, week: number): Phase {
  const w = Math.min(8, Math.max(1, week));
  return SPORTS[sport].phases.find((p) => w >= p.weeks[0] && w <= p.weeks[1])!;
}

export interface ProgramDay { date: ISODate; label: string; kind: 'match' | 'light' | 'recovery' | 'rest' | 'session'; note?: string; match?: Match }

/**
 * The program week containing `date`, with match days applied:
 * match day → Match; the day before → Activation (light); the day after → Recovery.
 * A heavy session pushed off those days moves to the earliest rest day at least 2 days before the match.
 */
export function programWeek(s: SportState, date: ISODate): ProgramDay[] {
  const start = weekStart(date);
  const phase = phaseFor(s.sport, programWeekNo(s.start, date));
  const days: ProgramDay[] = phase.template.map((label, i) => ({ date: addDays(start, i), label, kind: label === R ? 'rest' : 'session' }));
  const inWeek = (d: ISODate) => days.findIndex((x) => x.date === d);
  const displaced: { label: string; matchIdx: number }[] = [];
  for (const m of s.matches.filter((x) => x.date >= addDays(start, -1) && x.date <= addDays(start, 7)).sort((a, b) => a.date.localeCompare(b.date))) {
    const mi = inWeek(m.date);
    const before = inWeek(addDays(m.date, -1));
    const after = inWeek(addDays(m.date, 1));
    if (mi >= 0) {
      if (HEAVY.has(days[mi].label)) displaced.push({ label: days[mi].label, matchIdx: mi });
      days[mi] = { ...days[mi], label: SPORTS[s.sport].matchWord, kind: 'match', match: m, note: `${m.label} · ${m.time}` };
    }
    if (before >= 0 && days[before].kind !== 'match') {
      if (HEAVY.has(days[before].label)) displaced.push({ label: days[before].label, matchIdx: mi >= 0 ? mi : before + 1 });
      if (days[before].kind !== 'rest') days[before] = { ...days[before], label: 'Activation', kind: 'light', note: 'Light: 20 min, mobility and a few sharp efforts' };
    }
    if (after >= 0 && days[after].kind !== 'match') days[after] = { ...days[after], label: 'Recovery', kind: 'recovery', note: 'Walk, mobility, sleep' };
  }
  for (const d of displaced) {
    const slot = days.findIndex((x, i) => x.kind === 'rest' && i <= d.matchIdx - 2 && !days.slice(Math.max(0, i - 1), i).some((y) => y.kind === 'match'));
    if (slot >= 0) days[slot] = { ...days[slot], label: d.label, kind: 'session', note: 'Moved here for the match' };
  }
  return days;
}

export function nextMatch(s: SportState, from: ISODate): Match | null {
  return [...s.matches].filter((m) => m.date >= from).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

export interface MatchMeal { when: string; time: string; name: string; macros: Macros; tag: 'Pre' | 'Top-up' | 'During' | 'Post' }

const dishBy = (id: string) => dishMacros(DISHES.find((d) => d.id === id)!);
const ingBy = (id: string, g: number) => scale(ingredient(id).per100g, g / 100);
const sum = (...xs: Macros[]) => rounded(xs.reduce((a, b) => add(a, b), ZERO));
const shift = (time: string, mins: number) => { const [h, m] = time.split(':').map(Number); const t = h * 60 + m + mins; return `${String(Math.floor(((t + 1440) % 1440) / 60)).padStart(2, '0')}:${String(((t % 60) + 60) % 60).padStart(2, '0')}`; };

/** Match-day meals: carb-rich meal 3 h before, a banana top-up, fluids during, protein + carbs within an hour after. */
export function matchDayMeals(diet: Diet, matchTime: string): MatchMeal[] {
  const post = diet === 'nonveg'
    ? { name: 'Chicken curry, rice + lassi', macros: sum(dishBy('chicken-curry'), scale(dishBy('plain-rice'), 1.5), dishBy('lassi')) }
    : diet === 'egg'
      ? { name: 'Egg curry, rice + lassi', macros: sum(dishBy('egg-curry'), scale(dishBy('plain-rice'), 1.5), dishBy('lassi')) }
      : diet === 'vegan'
        ? { name: 'Rajma chawal + banana', macros: sum(dishBy('rajma'), scale(dishBy('plain-rice'), 1.5), ingBy('banana', 100)) }
        : { name: 'Paneer bhurji, rice + lassi', macros: sum(dishBy('paneer-bhurji'), scale(dishBy('plain-rice'), 1.5), dishBy('lassi')) };
  const pre = diet === 'vegan'
    ? { name: 'Poha + banana', macros: sum(dishBy('poha-dish'), ingBy('banana', 100)) }
    : { name: 'Poha + banana + curd', macros: sum(dishBy('poha-dish'), ingBy('banana', 100), scale(dishBy('curd-bowl'), 0.5)) };
  return [
    { when: '3 h before', time: shift(matchTime, -180), tag: 'Pre', ...pre },
    { when: '30 min before', time: shift(matchTime, -30), tag: 'Top-up', name: 'Banana, 300 ml water', macros: sum(ingBy('banana', 100)) },
    { when: 'Between games', time: matchTime, tag: 'During', name: 'Electrolyte water, small sips', macros: ZERO },
    { when: 'Within an hour after', time: shift(matchTime, 120), tag: 'Post', ...post },
  ];
}

/** Match-day target: +80 g carbs (+320 kcal); protein unchanged. */
export function matchDayTargets(t: Targets): Pick<Targets, 'kcalTraining' | 'carbs' | 'protein'> {
  return { kcalTraining: t.kcalTraining + 320, carbs: t.carbs + 80, protein: t.protein };
}

export function phaseDates(s: SportState, p: Phase): [ISODate, ISODate] {
  const first = weekStart(s.start);
  return [addDays(first, (p.weeks[0] - 1) * 7), addDays(first, p.weeks[1] * 7 - 1)];
}
