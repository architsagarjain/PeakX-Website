import { NextResponse } from "next/server";

// Receives an application and forwards it to your webhook (Make.com, Zapier, Google Apps Script → Sheet…).
// Set WEBHOOK_URL in Vercel → Project → Settings → Environment Variables.

const MAX = 2000;
const FIELDS = ["goal", "tried", "age", "country", "diet", "access", "invest", "start", "name", "email", "phone",
  "instagram", "notes", "qualified", "page", "submitted_at", "utm"] as const;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const lead: Record<string, unknown> = {};
  for (const k of FIELDS) {
    const v = body?.[k];
    if (v === undefined) continue;
    lead[k] = typeof v === "string" ? v.slice(0, MAX) : v;
  }
  const email = String(lead.email ?? "");
  if (!lead.name || !lead.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Name, a valid email and WhatsApp number are required" }, { status: 422 });
  }

  const hook = process.env.WEBHOOK_URL;
  if (!hook) {
    // No destination yet: keep the lead in the function logs so nothing is lost.
    console.log("PEAKX_LEAD", JSON.stringify(lead));
    return NextResponse.json({ ok: true, stored: "log" });
  }
  try {
    const r = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) });
    if (!r.ok) throw new Error(`Webhook responded ${r.status}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PEAKX_LEAD_FAILED", (err as Error).message, JSON.stringify(lead));
    return NextResponse.json({ ok: false, error: "Could not save application" }, { status: 502 });
  }
}
