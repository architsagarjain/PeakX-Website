import type { AppData } from '../domain/types';

/** Every paid capability, in one list. Screens ask canUse() instead of checking the plan themselves. */
export type Feature =
  | 'weeklyReport' | 'analytics' | 'mealPlan' | 'messMode' | 'eatingOut' | 'sportProgram'
  | 'formCheck' | 'bloodWork' | 'supplements' | 'aiCoach' | 'humanCoach';

export const FEATURE_COPY: Record<Feature, { title: string; pitch: string }> = {
  weeklyReport: { title: 'Find out why your bench stalled', pitch: 'Your first report was free. Pro sends one every Sunday, with changes you accept in one click.' },
  analytics: { title: 'See why progress stalled', pitch: 'Detailed analytics put your sleep, food and training side by side.' },
  mealPlan: { title: 'A week of recipes built for your targets', pitch: 'Pro scales library recipes to your calories and protein, with a grocery list.' },
  messMode: { title: 'Eat well from the mess menu', pitch: 'Upload tonight’s menu and get what to eat and how much.' },
  eatingOut: { title: 'Stay on plan when eating out', pitch: 'What to order at the places you actually go.' },
  sportProgram: { title: 'Train for your sport', pitch: '8-week strength and conditioning blocks with match-day meals.' },
  formCheck: { title: 'Get your form checked by a coach', pitch: 'Upload one set; a coach replies within 24 hours with a fix plan.' },
  bloodWork: { title: 'Turn your lab report into food changes', pitch: 'Upload a PDF; markers are read and checked by a coach.' },
  supplements: { title: 'Unlock your personal supplement protocol', pitch: 'What to take, how much, when, for how long, and which brand to buy, from your answers and blood work.' },
  aiCoach: { title: 'Ask the Coach anything', pitch: 'Answers based on your log, plan and wearable data.' },
  humanCoach: { title: 'Work with a named coach', pitch: 'Weekly call and WhatsApp access with Coached.' },
};

export function canUse(d: Pick<AppData, 'plan' | 'firstReportUsed'>, f: Feature): boolean {
  if (f === 'humanCoach') return d.plan === 'coached';
  if (d.plan === 'pro' || d.plan === 'coached') return true;
  if (f === 'weeklyReport') return !d.firstReportUsed;
  return false;
}
