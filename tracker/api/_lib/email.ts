/** Transactional email through Resend (RESEND_API_KEY, REPORTS_FROM such as "PeakX <reports@peakx.live>"). */
export async function sendEmail(to: string, subject: string, html: string, unsubscribeUrl?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.REPORTS_FROM ?? 'PeakX <reports@peakx.live>', to, subject, html, ...(unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}) }),
  });
  if (!r.ok) console.error('Resend error', r.status, (await r.text()).slice(0, 300));
  return r.ok;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const footer = (unsub?: string) => `<p style="font:12px/1.5 Arial,sans-serif;color:#8C8C8C;margin:24px 0 0">You get this because you have a PeakX account. Change email settings in Account › Reminders${unsub ? ` or <a href="${esc(unsub)}" style="color:#8C8C8C">unsubscribe</a>` : ''}.</p>`;
const shell = (inner: string, unsub?: string) => `<!doctype html><html><body style="margin:0;background:#ECECE9;font-family:Georgia,serif;color:#1A1A1A"><div style="max-width:520px;margin:0 auto;padding:28px 20px">${inner}${footer(unsub)}</div></body></html>`;
const button = (url: string, label: string) => `<a href="${esc(url)}" style="display:inline-block;background:#1A1A1A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font:15px Arial,sans-serif">${esc(label)}</a>`;

/** 9 PM nudge when nothing is logged today (S22.1). */
export function nudgeEmail(name: string, kcalTarget: number, url: string, unsub: string): string {
  return shell(`<h1 style="font-weight:400;font-size:26px;line-height:1.25;margin:0 0 12px">Nothing logged today, ${esc(name)}</h1>
    <p style="font:15px/1.5 Arial,sans-serif;margin:0 0 18px">Say what you ate in one line, like “2 roti, dal, paneer sabzi”. It takes 20 seconds and keeps your ${kcalTarget.toLocaleString('en-IN')} kcal target honest.</p>${button(url, 'Log today’s food')}`, unsub);
}
/** Re-test reminder on the date the coach suggested (S18.2, S22.1). */
export function retestEmail(name: string, url: string, unsub: string): string {
  return shell(`<h1 style="font-weight:400;font-size:26px;line-height:1.25;margin:0 0 12px">Time for your blood test re-check</h1>
    <p style="font:15px/1.5 Arial,sans-serif;margin:0 0 18px">Hi ${esc(name)}, it’s been 3 months since your last report. Re-test the markers your coach flagged, then upload the new report to see what changed.</p>${button(url, 'Open blood work')}`, unsub);
}

export function reportEmail(name: string, headline: string, changes: { title: string; detail: string }[], url: string, unsub?: string): string {
  return `<!doctype html><html><body style="margin:0;background:#ECECE9;font-family:Georgia,serif;color:#1A1A1A">
  <div style="max-width:520px;margin:0 auto;padding:28px 20px">
    <p style="font:13px/1.4 Arial,sans-serif;color:#6B6B6B;margin:0 0 6px">Your PeakX weekly report</p>
    <h1 style="font-weight:400;font-size:26px;line-height:1.25;margin:0 0 16px">${esc(headline)}</h1>
    <p style="font:15px/1.5 Arial,sans-serif;margin:0 0 10px">Hi ${esc(name)}, here are the changes your coach suggests for next week:</p>
    <ol style="font:15px/1.5 Arial,sans-serif;padding-left:20px;margin:0 0 18px">${changes.map((c) => `<li><b>${esc(c.title)}</b><br><span style="color:#6B6B6B">${esc(c.detail)}</span></li>`).join('')}</ol>
    <a href="${esc(url)}" style="display:inline-block;background:#1A1A1A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font:15px Arial,sans-serif">Open the report and accept changes</a>
    ${footer(unsub)}
  </div></body></html>`;
}
