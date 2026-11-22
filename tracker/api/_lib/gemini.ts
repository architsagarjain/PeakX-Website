import { HttpError } from './http.js';

/**
 * Minimal Gemini client (REST generateContent) with JSON-schema output.
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL (default gemini-2.5-flash).
 */

export const aiConfigured = () => !!process.env.GEMINI_API_KEY;
export const model = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function generateJson<T>(opts: { system: string; parts: Part[]; schema: object; temperature?: number; history?: { role: 'user' | 'model'; text: string }[] }): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(503, 'AI is not configured');
  const contents = [
    ...(opts.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: 'user', parts: opts.parts },
  ];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model()}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents,
      generationConfig: { responseMimeType: 'application/json', responseSchema: opts.schema, temperature: opts.temperature ?? 0.2 },
    }),
  });
  if (!res.ok) {
    console.error('Gemini error', res.status, (await res.text()).slice(0, 500));
    throw new HttpError(502, 'The AI service did not answer');
  }
  const body = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try { return JSON.parse(text) as T; } catch { throw new HttpError(502, 'The AI answer was not readable'); }
}
