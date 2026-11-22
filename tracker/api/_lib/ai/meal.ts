import { handle, json, rateLimit, readJson, HttpError } from '../http.js';
import { generateJson } from '../gemini.js';

/**
 * POST /api/meal  { audio?: base64 WAV, text?: string, lang?: 'en' | 'hi' }
 * → { transcript, items: [{ name, quantity, unit, vague }] }
 * The model only transcribes and extracts; calories come from the app's food table.
 */
const UNITS = ['katori', 'plate', 'cup', 'glass', 'spoon', 'tbsp', 'tsp', 'piece', 'slice', 'scoop', 'g', 'ml'];
const SYSTEM = `You log meals for Indian gym-goers. The user describes what they ate in English, Hindi or Hinglish.
Return the transcript in Latin script (Hinglish as spoken, e.g. "do roti, ek katori dal"), and one item per food:
- name: the dish or food in its common Indian/English name ("roti", "dal makhani", "paneer bhurji", "boiled eggs").
- quantity: the number said (do=2, ek=1, aadha=0.5, dedh=1.5, dhai=2.5), or null if no amount was said.
- unit: one of ${UNITS.join(', ')} when said (katori/bowl → katori), else null.
- vague: true when they said thoda, kuch, a little, some, instead of an amount.
Never estimate calories or add foods that were not said. If nothing about food was said, return no items.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' },
    items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      name: { type: 'STRING' }, quantity: { type: 'NUMBER', nullable: true }, unit: { type: 'STRING', nullable: true, enum: UNITS }, vague: { type: 'BOOLEAN' },
    }, required: ['name', 'quantity', 'unit', 'vague'] } },
  },
  required: ['transcript', 'items'],
};

export const POST = handle(async (req) => {
  rateLimit(req, 'meal', 30, 60_000);
  const body = await readJson<{ audio?: string; text?: string; lang?: string }>(req, 4_000_000);
  if (!body.audio && !body.text?.trim()) throw new HttpError(400, 'Send audio or text');
  const parts = body.audio
    ? [{ inline_data: { mime_type: 'audio/wav', data: body.audio } }, { text: `Language hint: ${body.lang === 'hi' ? 'Hindi or Hinglish' : 'English or Hinglish'}.` }]
    : [{ text: body.text!.slice(0, 1000) }];
  const out = await generateJson<{ transcript: string; items: { name: string; quantity: number | null; unit: string | null; vague: boolean }[] }>({ system: SYSTEM, parts, schema: SCHEMA, temperature: 0 });
  return json({ transcript: String(out.transcript ?? '').slice(0, 500), items: (out.items ?? []).slice(0, 15) });
});
