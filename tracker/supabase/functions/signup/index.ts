// PeakX sign-up (Supabase Edge Function, Deno). The app calls POST {SUPABASE_URL}/functions/v1/signup
// with { email, password, name } and signs in straight after, so the account is created already
// confirmed ("No email to confirm" on the sign-up screen). Answers 409 when the email is taken.
//
// Deploy without JWT checks, because the app calls it before anyone is signed in:
//   supabase functions deploy signup --no-verify-jwt
// Optional secret ALLOWED_ORIGINS (comma-separated) adds origins beyond the built-in list.

import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGINS = [
  "https://www.peakx.in",
  "https://peakx.in",
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
];

function cors(origin: string | null): Record<string, string> {
  const ok = origin && (ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin : ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Vary": "Origin",
  };
}

const reply = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "Use POST" }, 405, headers);

  let body: { email?: unknown; password?: unknown; name?: unknown };
  try { body = await req.json(); } catch { return reply({ error: "Invalid request" }, 400, headers); }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return reply({ error: "Enter a valid email address." }, 400, headers);
  if (password.length < 8 || password.length > 72) return reply({ error: "Use a password of at least 8 characters." }, 400, headers);

  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!url || !key) return reply({ error: "Sign-up isn’t set up yet." }, 503, headers);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { name } : {},
  });
  if (error) {
    const taken = /already (been )?registered|already exists|email_exists/i.test(`${error.code ?? ""} ${error.message}`);
    if (taken) return reply({ error: "There’s already an account with this email. Sign in instead." }, 409, headers);
    console.error("signup", error.status, error.message);
    return reply({ error: "Couldn’t create the account. Try again." }, 500, headers);
  }
  return reply({ ok: true }, 200, headers);
});
