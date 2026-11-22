import { handle, json, rateLimit, readJson, HttpError } from '../http.js';
import { generateJson } from '../gemini.js';
import { numbersOnlyFrom } from '../../../src/state/analytics.js';

/**
 * POST /api/findings { findings: [{ id, title, detail, numbers }] } → { findings: [{ id, title, detail }] }
 * Rewords computed findings in a coach's voice. Any rewrite that introduces a number not in `numbers`
 * is dropped and the original is returned for that finding.
 */
const SYSTEM = `You are a strength and nutrition coach for Indian gym-goers. Rewrite each finding so it is clear and
encouraging, in plain English, at most 14 words for the title and 28 for the detail. Use only the numbers given;
never add, round differently or invent numbers, units or causes.`;

export const POST = handle(async (req) => {
  rateLimit(req, 'findings', 20, 60_000);
  const { findings } = await readJson<{ findings: { id: string; title: string; detail: string; numbers: number[] }[] }>(req, 50_000);
  if (!Array.isArray(findings) || !findings.length) throw new HttpError(400, 'No findings');
  const input = findings.slice(0, 3);
  const out = await generateJson<{ findings: { id: string; title: string; detail: string }[] }>({
    system: SYSTEM,
    parts: [{ text: JSON.stringify(input) }],
    schema: { type: 'OBJECT', properties: { findings: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, title: { type: 'STRING' }, detail: { type: 'STRING' } }, required: ['id', 'title', 'detail'] } } }, required: ['findings'] },
    temperature: 0.3,
  });
  const safe = input.map((f) => {
    const r = out.findings?.find((x) => x.id === f.id);
    return r && numbersOnlyFrom(`${r.title} ${r.detail}`, f.numbers) ? { id: f.id, title: r.title, detail: r.detail } : { id: f.id, title: f.title, detail: f.detail };
  });
  return json({ findings: safe });
});
