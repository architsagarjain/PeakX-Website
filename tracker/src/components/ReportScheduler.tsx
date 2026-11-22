import { useEffect } from 'react';
import { useStore } from '../state/store';
import { useAuth } from '../state/auth';
import { advance, buildReport, reportWeekFor } from '../domain/report';
import { addDays } from '../domain/clock';

/**
 * Keeps this device's weekly report on schedule (S17.1): from Sunday 6 PM a draft for the week exists;
 * from 7 PM it is published. When signed in, the server job builds, approves and emails reports and the
 * app shows those (merged on sign-in), so local drafts wait for approval instead of auto-publishing.
 */
export function ReportScheduler() {
  const { data, dispatch } = useStore();
  const auth = useAuth();
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const week = reportWeekFor(now);
      if (!week) return;
      const existing = data.reports.find((r) => r.weekStart === week);
      const logged = data.meals.filter((m) => m.date >= week && m.date <= addDays(week, 6)).length;
      if (!existing && logged >= 3) dispatch({ type: 'upsertReport', report: buildReport(data, week, { now, free: data.plan === 'free' && !data.firstReportUsed }) });
      for (const r of data.reports) {
        const next = advance(r, now, !auth.user);
        if (next !== r) dispatch({ type: 'upsertReport', report: next });
      }
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [data, dispatch, auth.user]);
  return null;
}
