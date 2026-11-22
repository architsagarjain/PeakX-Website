import { json, HttpError } from '../_lib/http.js';
import { admin, loadUserData, userIds } from '../_lib/admin.js';
import { reportEmail, sendEmail } from '../_lib/email.js';
import { feedUrl } from '../_lib/feed.js';
import { buildReport } from '../../src/domain/report.js';
import { addDays, weekStart } from '../../src/domain/clock.js';
import type { Billing, WeeklyReport } from '../../src/domain/types.js';
import { planFrom } from '../../src/domain/billing.js';
import { newQueueItem } from '../../src/domain/queue.js';
import { publishTime } from '../../src/domain/report.js';
import { payConfigured } from '../_lib/razorpay.js';

/**
 * Weekly reports (S17.1). Vercel Cron (vercel.json), Sundays:
 *   ?step=draft    18:00 IST  build a draft for every entitled user (status 'draft', or 'approved' when REPORTS_AUTO_APPROVE=true)
 *   ?step=publish  19:00 IST  publish approved reports and email them
 * Drafts go to the coach desk queue (api/ops). Coached members' reports always wait for their coach.
 * Once payments are on, the plan comes from server billing, not from the app's own copy.
 * Auth: Vercel sends Authorization: Bearer $CRON_SECRET.
 */
export const maxDuration = 60;

/** The Monday of the current week in India (or REPORTS_TZ_OFFSET_MIN). */
function currentWeek(): string {
  const offset = Number(process.env.REPORTS_TZ_OFFSET_MIN ?? 330);
  const local = new Date(Date.now() + offset * 60_000);
  return weekStart(local.toISOString().slice(0, 10));
}

export async function GET(req: Request) {
  try {
    if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) throw new HttpError(401, 'Unauthorised');
    const step = new URL(req.url).searchParams.get('step');
    const week = new URL(req.url).searchParams.get('week') ?? currentWeek();
    const { db, auth } = admin();
    const site = (process.env.APP_URL ?? process.env.SITE_URL ?? 'https://peakx.live').replace(/\/$/, '');
    let done = 0, skipped = 0, emailed = 0;

    for await (const uid of userIds()) {
      const ref = db.doc(`users/${uid}/reports/${week}`);
      if (step === 'draft') {
        if ((await ref.get()).exists) { skipped++; continue; }
        const data = await loadUserData(uid, addDays(week, -21));
        if (!data) { skipped++; continue; }
        const billing = (await db.doc(`users/${uid}/private/billing`).get()).data() as Billing | undefined;
        const plan = payConfigured() || billing ? planFrom(billing ?? null, Date.now()) : data.plan;
        const entitled = plan !== 'free' || !data.firstReportUsed;
        const logged = data.meals.filter((m) => m.date >= week && m.date <= addDays(week, 6)).length;
        if (!entitled || logged < 3) { skipped++; continue; }
        const auto = process.env.REPORTS_AUTO_APPROVE === 'true' && plan !== 'coached';
        const report: WeeklyReport = { ...buildReport(data, week, { free: plan === 'free' }), status: auto ? 'approved' : 'draft', ...(auto ? { approvedBy: 'PeakX checks' } : {}) };
        await ref.create(JSON.parse(JSON.stringify(report)));
        if (!auto) {
          const item = newQueueItem('report', { id: `report-${uid}-${week}`, uid, member: { name: data.profile.name, plan }, title: report.headline, detail: `${report.changes.length} change${report.changes.length === 1 ? '' : 's'} · ${billing?.coach ? `coach: ${billing.coach.name}` : 'any coach'}`, payload: { week }, nowMs: Date.now(), dueAt: publishTime(week).toISOString() });
          await db.doc(`queue/${item.id}`).set(JSON.parse(JSON.stringify(item)));
        }
        done++;
      } else if (step === 'publish') {
        const snap = await ref.get();
        const r = snap.data() as WeeklyReport | undefined;
        if (!r || r.status !== 'approved') { skipped++; continue; }
        await ref.update({ status: 'published', publishedAt: new Date().toISOString() });
        done++;
        const user = await auth.getUser(uid).catch(() => null);
        const root = (await db.doc(`users/${uid}`).get()).data() as { profile?: { name?: string } } | undefined;
        const prefs = (await db.doc(`users/${uid}/private/email`).get()).data() as { reportEmail?: boolean; unsubscribedAt?: string | null } | undefined;
        if (prefs?.reportEmail === false || prefs?.unsubscribedAt) continue;
        const unsub = feedUrl(uid, 'unsub');
        if (user?.email && await sendEmail(user.email, `Your PeakX report: ${r.headline}`.slice(0, 140), reportEmail(root?.profile?.name ?? 'there', r.headline, r.changes, `${site}/#/app/reviews/weekly/${week}`, unsub), unsub)) emailed++;
      } else throw new HttpError(400, 'step must be draft or publish');
    }
    return json({ ok: true, step, week, done, skipped, emailed });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Report job failed' }, 500);
  }
}
