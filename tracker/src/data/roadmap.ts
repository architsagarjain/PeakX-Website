/** Which release builds a control that isn't live yet. Matched by words in the button label. */
const RULES: [RegExp, string, string][] = [
  [/voice|say it|speak|transcri/i, 'R3', 'voice logging'],
  [/swap|grocery|meal plan|template|mess|menu|eating out|eating-out/i, 'R3', 'the meal plan'],
  [/report|accept|skip|changes|open last|week/i, 'R3', 'weekly reports'],
  [/coach|ask|chat|send|snack|stall|outside/i, 'R3', 'the AI Coach'],
  [/upgrade|founding|trial|pro\b|unlock|subscri|billing|refund|plan\b/i, 'R4', 'payments'],
  [/form check|video|record|analyse|fix plan|drill|share link/i, 'R5', 'Form Check'],
  [/lab|blood|report link|doctor|summary/i, 'R5', 'blood work'],
  [/fitbit|strava|google|garmin|apple|device|sync|connect|manage|notify me|calendar/i, 'R6', 'integrations'],
  [/email|remind|bell|notification/i, 'R6', 'reminders'],
  [/sign in|sign out|google|email me|phone|delete|export|privacy|settings/i, 'R2', 'accounts'],
];

export function releaseFor(label: string): { release: string; area: string } {
  for (const [re, release, area] of RULES) if (re.test(label)) return { release, area };
  return { release: 'R1', area: 'the core app' };
}
