import { json } from './_lib/http.js';
import { aiConfigured, model } from './_lib/gemini.js';
import { payConfigured } from './_lib/razorpay.js';
import { supaConfigured } from './_lib/supa.js';

/** GET /api/health → which server features are switched on. The app uses this to pick AI or the built-in fallback. */
export function GET() {
  return json({ ok: true, ai: aiConfigured(), model: aiConfigured() ? model() : null, email: !!process.env.RESEND_API_KEY, pay: payConfigured(), server: !!process.env.FIREBASE_SERVICE_ACCOUNT, data: supaConfigured() });
}
