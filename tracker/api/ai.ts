import { json } from './_lib/http.js';
import * as meal from './_lib/ai/meal.js';
import * as menu from './_lib/ai/menu.js';
import * as findings from './_lib/ai/findings.js';
import * as coach from './_lib/ai/coach.js';
import * as labs from './_lib/ai/labs.js';

/**
 * All AI features in one function (Vercel Hobby allows 12). vercel.json rewrites /api/meal, /api/menu,
 * /api/findings, /api/coach and /api/labs here with ?task=…, so the app's URLs don't change.
 */
export const maxDuration = 60;
const TASKS: Record<string, { POST: (req: Request) => Promise<Response> }> = { meal, menu, findings, coach, labs };

export async function POST(req: Request) {
  const task = new URL(req.url).searchParams.get('task') ?? '';
  const t = TASKS[task];
  return t ? t.POST(req) : json({ error: 'Unknown AI task' }, 404);
}
