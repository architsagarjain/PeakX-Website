import { handle, json, rateLimit, readJson, HttpError } from '../http.js';
import { generateJson } from '../gemini.js';
import { admin, userFrom } from '../admin.js';
import { planFrom } from '../../../src/domain/billing.js';
import type { Billing } from '../../../src/domain/types.js';

/**
 * POST /api/coach { messages: [{ role, text }], context } → { reply, options: [{ name, quantity, unit }] }
 * The app builds `context` from the user's data (targets, today's log, plan, wearable, trends) and turns
 * options into food-table items, so calories never come from the model. 40 messages a day per user is
 * enforced in the app; this per-IP limit is a backstop.
 */
const SYSTEM = `You are the PeakX Coach: a friendly, practical strength and nutrition coach for urban Indian gym-goers.
Answer using the user's data in CONTEXT (targets, what they ate today, calories and protein left, today's training,
wearable data, recent trends and findings). Be specific with their numbers; never invent numbers that aren't in CONTEXT.
Keep replies under 120 words, plain sentences, Indian foods and units (katori, roti). If they ask for food ideas, add up to
3 options: common Indian dishes or foods with a quantity and unit (katori, plate, piece, g, cup, glass, scoop, slice) that fit
what's left today. Don't give medical advice; for pain, injury or illness, suggest a doctor or physiotherapist.`;

const UNITS = ['katori', 'plate', 'cup', 'glass', 'spoon', 'tbsp', 'tsp', 'piece', 'slice', 'scoop', 'g', 'ml'];

export const POST = handle(async (req) => {
  rateLimit(req, 'coach', 60, 24 * 60 * 60_000);
  if (process.env.ENFORCE_PLANS === 'true') {
    const u = await userFrom(req);
    const b = (await admin().db.doc(`users/${u.uid}/private/billing`).get()).data() as Billing | undefined;
    if (planFrom(b ?? null, Date.now()) === 'free') throw new HttpError(402, 'The AI Coach is part of Pro');
  }
  const { messages, context } = await readJson<{ messages: { role: 'user' | 'coach'; text: string }[]; context: unknown }>(req, 60_000);
  if (!Array.isArray(messages) || !messages.length || messages[messages.length - 1].role !== 'user') throw new HttpError(400, 'Send the conversation ending with a user message');
  const recent = messages.slice(-10).map((m) => ({ role: m.role === 'coach' ? 'model' as const : 'user' as const, text: String(m.text).slice(0, 1500) }));
  const last = recent.pop()!;
  const out = await generateJson<{ reply: string; options: { name: string; quantity: number | null; unit: string | null }[] }>({
    system: SYSTEM,
    history: recent,
    parts: [{ text: `CONTEXT: ${JSON.stringify(context).slice(0, 12000)}\n\nUSER: ${last.text}` }],
    schema: { type: 'OBJECT', properties: {
      reply: { type: 'STRING' },
      options: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, quantity: { type: 'NUMBER', nullable: true }, unit: { type: 'STRING', nullable: true, enum: UNITS } }, required: ['name', 'quantity', 'unit'] } },
    }, required: ['reply', 'options'] },
    temperature: 0.5,
  });
  return json({ reply: String(out.reply ?? '').slice(0, 1500), options: (out.options ?? []).slice(0, 3) });
});
