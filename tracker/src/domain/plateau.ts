/**
 * Plateau check: 8 questions, each answer adds weight to one or more likely causes.
 * DRAFT for team review (question wording, options and weights). Change them here only;
 * the screen and the result page read everything from this file.
 */

export type CauseId = 'sleep' | 'volume' | 'program' | 'drift' | 'underfuel' | 'protein' | 'recovery' | 'patience';
export type Level = 'High' | 'Medium' | 'Low';

export interface PlateauOption {
  id: string;
  t: string;              // option title
  m: string;              // one-line hint under it
  scores?: Partial<Record<CauseId, number>>;
  why?: string;           // evidence line shown under a cause this answer points to
}
export interface PlateauQuestion { id: string; nav: string; title: string; help: string; options: PlateauOption[] }

export const PLATEAU_QUESTIONS: PlateauQuestion[] = [
  { id: 'goal', nav: 'Your goal', title: 'What are you training for?', help: 'We tune the result and your starting plan to this.', options: [
    { id: 'lose', t: 'Lose fat', m: 'A lower number and a leaner look', scores: { drift: 0.5 } },
    { id: 'muscle', t: 'Build muscle', m: 'Bigger arms, chest and back', scores: { underfuel: 0.5, protein: 0.5 } },
    { id: 'recomp', t: 'Both at once', m: 'Lose fat, keep or add muscle', scores: { protein: 0.5 } },
    { id: 'strength', t: 'Get stronger', m: 'More weight on the big lifts', scores: { volume: 0.5 } },
  ] },
  { id: 'stuck', nav: 'What’s stuck', title: 'What has stopped moving?', help: 'Pick the one that bothers you most.', options: [
    { id: 'scale', t: 'The scale', m: 'Weight hasn’t changed', scores: { drift: 1.5, patience: 0.5 }, why: 'Scale weight not moving' },
    { id: 'lift', t: 'A lift', m: 'Bench, squat or deadlift stalled', scores: { volume: 1, program: 1, sleep: 0.5 }, why: 'A main lift has stalled' },
    { id: 'size', t: 'Size', m: 'Arms and chest look the same', scores: { protein: 1, underfuel: 1 }, why: 'No visible size gain' },
    { id: 'all', t: 'All of it', m: 'Nothing seems to change', scores: { program: 1, sleep: 0.5, drift: 0.5 }, why: 'Nothing is moving' },
  ] },
  { id: 'weeks', nav: 'How long', title: 'How long has it been stuck?', help: 'Weight and strength wobble week to week, so time matters.', options: [
    { id: '3', t: '2 to 3 weeks', m: 'Could still be normal noise', scores: { patience: 2.5 }, why: 'Only 2–3 weeks; this can be normal week-to-week noise' },
    { id: '6', t: '1 to 2 months', m: 'Long enough to look at', scores: {} },
    { id: '12', t: '3 months or more', m: 'Something needs to change', scores: { program: 1.5 }, why: 'Stuck 3+ months on the same approach' },
    { id: '26', t: 'Longer than I remember', m: 'It has been a while', scores: { program: 2 }, why: 'Stuck for many months' },
  ] },
  { id: 'days', nav: 'Training days', title: 'How many days a week do you train?', help: 'Count gym sessions and sport, not walks.', options: [
    { id: '2', t: '2 or fewer', m: 'Busy weeks', scores: { volume: 2 }, why: 'Training 2 days a week or fewer' },
    { id: '4', t: '3 to 4', m: 'Most weeks', scores: {} },
    { id: '5', t: '5', m: 'Five sessions', scores: { recovery: 0.5 } },
    { id: '6', t: '6 or 7', m: 'Almost every day', scores: { recovery: 2 }, why: 'Training 6–7 days with little rest' },
  ] },
  { id: 'sleep', nav: 'Sleep', title: 'How much do you sleep on training nights?', help: 'Most plateaus have two or three causes. Sleep is one of the most common.', options: [
    { id: 'u6', t: 'Under 6 hours', m: 'Late work, late gym, phone in bed', scores: { sleep: 3, recovery: 1 }, why: 'Under 6 h before training' },
    { id: '6-7', t: '6 to 7 hours', m: 'Most nights', scores: { sleep: 1.5 }, why: '6–7 h before training' },
    { id: '7-8', t: '7 to 8 hours', m: 'Usually rested', scores: {} },
    { id: 'unsure', t: 'Not sure', m: 'Connect a wearable later and we’ll check', scores: { sleep: 0.5 }, why: 'Sleep not tracked yet' },
  ] },
  { id: 'food', nav: 'Food', title: 'How do your weekends usually go?', help: 'Two big meals out can cancel a whole week of careful eating.', options: [
    { id: 'same', t: 'Same as weekdays', m: 'Home food, on plan', scores: {} },
    { id: 'one', t: 'One meal out', m: 'Biryani or pizza once', scores: { drift: 1 }, why: 'One meal out each weekend' },
    { id: 'most', t: 'Eating out most of it', m: 'Brunch, dinner, drinks', scores: { drift: 3 }, why: 'Weekend meals out undo the weekday deficit' },
    { id: 'skip', t: 'I often skip meals', m: 'Busy days, small appetite', scores: { underfuel: 2.5 }, why: 'Skipped meals; likely under-eating on training days' },
  ] },
  { id: 'protein', nav: 'Protein', title: 'How many of your meals have a protein source?', help: 'Dal, paneer, curd, eggs, chicken, fish, soya or whey all count.', options: [
    { id: 'all', t: 'Almost every meal', m: '3 or more a day', scores: {} },
    { id: 'half', t: 'About half', m: '1 or 2 a day', scores: { protein: 1.5 }, why: 'Protein in about half your meals' },
    { id: 'rare', t: 'Rarely', m: 'Mostly roti, rice, sabzi', scores: { protein: 3 }, why: 'Few meals with a protein source' },
    { id: 'unsure', t: 'Not sure', m: 'Never counted', scores: { protein: 1 }, why: 'Protein not tracked yet' },
  ] },
  { id: 'program', nav: 'Training', title: 'How has your training changed lately?', help: 'Muscles grow when the work goes up a little, week after week.', options: [
    { id: 'same', t: 'Same routine for months', m: 'Same exercises, sets and weights', scores: { program: 2.5 }, why: 'Same routine for months, no planned progression' },
    { id: 'cut', t: 'Sets get cut on busy days', m: 'Rushed or shorter sessions', scores: { volume: 3 }, why: 'Sets cut on busy days' },
    { id: 'hop', t: 'I keep switching programs', m: 'New plan every few weeks', scores: { program: 1.5, volume: 0.5 }, why: 'Switching programs before they can work' },
    { id: 'plan', t: 'I add weight or reps on a plan', m: 'Logged and progressing', scores: {} },
  ] },
];

export const CAUSES: Record<CauseId, { title: string; fix: string }> = {
  sleep: { title: 'Not enough sleep', fix: 'Get 7 hours before training days. A wind-down reminder at 11 PM helps.' },
  volume: { title: 'Training volume dropped', fix: 'Keep every planned set, even on busy days; shorten rest instead.' },
  program: { title: 'No planned progression', fix: 'Follow one plan that adds a little weight or a rep each week.' },
  drift: { title: 'Weekend calories', fix: 'Log weekend meals too, and keep it to one meal out.' },
  underfuel: { title: 'Eating too little', fix: 'Hit your training-day calories, especially the meal before the gym.' },
  protein: { title: 'Protein too low', fix: 'Add a protein source to every meal, about 2 g per kg of body weight.' },
  recovery: { title: 'Not enough recovery', fix: 'Take at least one full rest day and keep sleep steady.' },
  patience: { title: 'Too early to call', fix: 'Log for two more weeks before changing the plan.' },
};

export type PlateauAnswers = Record<string, string>;

export interface RankedCause { id: CauseId; title: string; score: number; level: Level; evidence: string; fix: string }

export function levelFor(score: number): Level { return score >= 3 ? 'High' : score >= 1.5 ? 'Medium' : 'Low'; }

/** Every cause with a score above zero, highest first. Ties keep the CAUSES order. */
export function rankCauses(answers: PlateauAnswers): RankedCause[] {
  const totals = new Map<CauseId, { score: number; best: number; why: string }>();
  for (const q of PLATEAU_QUESTIONS) {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    if (!opt?.scores) continue;
    for (const [c, s] of Object.entries(opt.scores) as [CauseId, number][]) {
      if (!s) continue;
      const cur = totals.get(c) ?? { score: 0, best: 0, why: '' };
      cur.score += s;
      if (s > cur.best && opt.why) { cur.best = s; cur.why = opt.why; }
      totals.set(c, cur);
    }
  }
  const order = Object.keys(CAUSES) as CauseId[];
  return [...totals.entries()]
    .map(([id, v]) => ({ id, title: CAUSES[id].title, score: v.score, level: levelFor(v.score), evidence: v.why || 'From your answers', fix: CAUSES[id].fix }))
    .sort((a, b) => b.score - a.score || order.indexOf(a.id) - order.indexOf(b.id));
}

export function answeredCount(answers: PlateauAnswers): number {
  return PLATEAU_QUESTIONS.filter((q) => q.options.some((o) => o.id === answers[q.id])).length;
}
export function isComplete(answers: PlateauAnswers): boolean { return answeredCount(answers) === PLATEAU_QUESTIONS.length; }

const lower = (t: string) => `${t.charAt(0).toLowerCase()}${t.slice(1)}`;

/** One line for summaries: "Not enough sleep, then training volume dropped". */
export function headline(answers: PlateauAnswers): string {
  const top = rankCauses(answers).slice(0, 2);
  if (top.length === 0) return 'No clear cause yet';
  if (top.length === 1) return top[0].title;
  // "Too early to call" is a caveat, not a second cause, so it reads as one.
  if (top[0].id === 'patience') return `Too early to call, but watch: ${lower(top[1].title)}`;
  if (top[1].id === 'patience') return `${top[0].title}, though it may be too early to call`;
  return `${top[0].title}, then ${lower(top[1].title)}`;
}

/** WhatsApp link that shares the headline and sends friends straight to the check, tagged ?ref=share. */
export function shareResultLink(answers: PlateauAnswers, site: string): string {
  const url = `${site.replace(/\/+$/, '')}/?ref=share#/app/plateau-check`;
  const text = `My PeakX plateau check: ${headline(answers)}. Free, 2 minutes, no sign-up. Find out why you're stuck: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
