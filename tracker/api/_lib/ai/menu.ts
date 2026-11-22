import { handle, json, rateLimit, readJson, HttpError } from '../http.js';
import { generateJson } from '../gemini.js';

/**
 * POST /api/menu { image: base64, mime: 'image/jpeg' | 'image/png' | 'image/webp' } → { dishes: string[] }
 * Reads dish names from a photo of a mess or canteen menu. Portions and calories are worked out in the app.
 */
const SYSTEM = `You read photos of Indian mess, hostel, PG and office-canteen menus. List every dish for the meal shown,
one per entry, using the common name ("Dal makhani", "Aloo gobi", "Jeera rice", "Roti", "Boondi raita", "Kheer").
Skip headings, days, prices and timings. If several days are shown, list today's or the first meal only. If it's not a menu, return an empty list.`;

export const POST = handle(async (req) => {
  rateLimit(req, 'menu', 20, 60_000);
  const { image, mime } = await readJson<{ image?: string; mime?: string }>(req, 6_000_000);
  if (!image) throw new HttpError(400, 'Send a photo');
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mime ?? '')) throw new HttpError(415, 'Use a JPEG, PNG or WebP photo');
  const out = await generateJson<{ dishes: string[] }>({
    system: SYSTEM,
    parts: [{ inline_data: { mime_type: mime!, data: image } }, { text: 'List the dishes.' }],
    schema: { type: 'OBJECT', properties: { dishes: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['dishes'] },
  });
  return json({ dishes: (out.dishes ?? []).map((d) => String(d).slice(0, 60)).slice(0, 15) });
});
