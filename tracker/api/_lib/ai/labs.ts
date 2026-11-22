import { handle, json, rateLimit, readJson, HttpError } from '../http.js';
import { generateJson } from '../gemini.js';

/**
 * POST /api/labs { file: base64, mime } → { date, markers: [{ name, value, unit }] }  (S18.2)
 * Reads the numbers off a lab report PDF or photo. The file isn't stored. The app matches names to its
 * marker list, converts units and asks the member to confirm every value before anything changes.
 */
const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export const POST = handle(async (req) => {
  rateLimit(req, 'labs', 20, 24 * 60 * 60_000);
  const { file, mime } = await readJson<{ file: string; mime: string }>(req, 11_000_000);
  if (!file || !MIMES.includes(mime)) throw new HttpError(400, 'Send a PDF, JPG or PNG');
  const out = await generateJson<{ date: string | null; markers: { name: string; value: number; unit: string }[] }>({
    system: 'You read Indian lab reports (Thyrocare, Dr Lal, SRL, Metropolis, hospital labs). Extract every test result as printed: the test name, the numeric result and its unit. Skip reference ranges, method notes and anything without a number. Use the sample collection date as date (YYYY-MM-DD) if shown. Never guess values.',
    parts: [{ inline_data: { mime_type: mime, data: file } }, { text: 'Extract the results.' }],
    schema: { type: 'OBJECT', properties: {
      date: { type: 'STRING', nullable: true },
      markers: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, value: { type: 'NUMBER' }, unit: { type: 'STRING' } }, required: ['name', 'value', 'unit'] } },
    }, required: ['date', 'markers'] },
  });
  return json({ date: /^\d{4}-\d{2}-\d{2}$/.test(out.date ?? '') ? out.date : null, markers: (out.markers ?? []).slice(0, 80) });
});
