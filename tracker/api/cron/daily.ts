import { json, HttpError } from '../_lib/http.js';
import { admin, loadUserData, userIds } from '../_lib/admin.js';
import { nudgeEmail, retestEmail, sendEmail } from '../_lib/email.js';
import { feedUrl } from '../_lib/feed.js';
import { syncUser } from '../_lib/wearables.js';
import { DEFAULT_PREFS, emailsDue, type EmailPrefs } from '../../src/domain/reminders.js';
import { kcalTarget } from '../../src/state/selectors.js';
import type { DevicesStatus } from '../../src/domain/wearables.js';

/**
 * Daily job (S21.1, S22.1), Vercel Cron at 21:00 IST (vercel.json): sync connected wearables, then send
 * the log nudge to members who logged nothing today and asked for it, and re-test reminders that are due.
 * Auth: Authorization: Bearer $CRON_SECRET.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) throw new HttpError(401, 'Unauthorised');
    const { db, auth } = admin();
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const site = (process.env.APP_URL ?? process.env.SITE_URL ?? 'https://peakx.live').replace(/\/$/, '');
    const started = Date.now();
    let synced = 0, emailed = 0, users = 0;
    for await (const uid of userIds()) {
      if (Date.now() - started > 50_000) break;   // stay inside the function time limit
      users++;
      const devices = (await db.doc(`users/${uid}/private/devices`).get()).data() as DevicesStatus | undefined;
      if (devices?.google?.connected || devices?.strava?.connected) { await syncUser(uid, today, 2).then(() => synced++).catch(() => undefined); }
      const prefs = { ...DEFAULT_PREFS, ...((await db.doc(`users/${uid}/private/email`).get()).data() as Partial<EmailPrefs> | undefined) };
      if (!process.env.RESEND_API_KEY || (!prefs.logNudge && !prefs.retest) || prefs.unsubscribedAt) continue;
      const data = await loadUserData(uid, today);
      if (!data) continue;
      const due = emailsDue(data, today, prefs);
      if (!due.length) continue;
      const email = (await auth.getUser(uid).catch(() => null))?.email;
      if (!email) continue;
      const unsub = feedUrl(uid, 'unsub');
      const name = data.profile.name || 'there';
      for (const kind of due) {
        const ok = kind === 'nudge'
          ? await sendEmail(email, 'Nothing logged today', nudgeEmail(name, kcalTarget(data, today).total, `${site}/#/app/log`, unsub), unsub)
          : await sendEmail(email, 'Time for your blood test re-check', retestEmail(name, `${site}/#/app/reviews/blood-work`, unsub), unsub);
        if (ok) emailed++;
      }
    }
    return json({ ok: true, today, users, synced, emailed });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Daily job failed' }, 500);
  }
}
