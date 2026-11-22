import type { AppData, ISODate } from './types.js';
import { addDays } from './clock.js';
import { planDay } from './training.js';
import { SPORTS } from './sport.js';

/**
 * Reminders (S22.1): a 9 PM log nudge, the Sunday report email, re-test reminders, and a private
 * calendar feed (sessions, matches, wind-down, report and re-test) that Google Calendar subscribes to.
 * Email preferences live in users/{uid}/private/email so unsubscribe links work without the app.
 */

export interface EmailPrefs { logNudge: boolean; reportEmail: boolean; retest: boolean; unsubscribedAt: string | null }
export const DEFAULT_PREFS: EmailPrefs = { logNudge: false, reportEmail: true, retest: true, unsubscribedAt: null };

export type EmailKind = 'nudge' | 'retest';
/** Which emails are due tonight for this user. */
export function emailsDue(d: AppData, date: ISODate, prefs: EmailPrefs): EmailKind[] {
  if (prefs.unsubscribedAt) return [];
  const out: EmailKind[] = [];
  if (prefs.logNudge && !d.meals.some((m) => m.date === date && m.items.length)) out.push('nudge');
  if (prefs.retest && d.reminders.retest === date) out.push('retest');
  return out;
}

export interface CalEvent { uid: string; title: string; description: string; start: Date; end: Date; allDay?: boolean }

const IST = 330 * 60_000;
/** A local IST date + HH:MM → the instant. */
export function istInstant(date: ISODate, hhmm: string): Date { return new Date(new Date(`${date}T${hhmm}:00Z`).getTime() - IST); }

/** Calendar events from `from` for `weeks` weeks. */
export function calendarEvents(d: AppData, from: ISODate, weeks = 4): CalEvent[] {
  const out: CalEvent[] = [];
  const matches = new Set(d.sport?.matches.map((m) => m.date) ?? []);
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(from, i);
    const day = planDay(d.profile, date);
    if (day.training && !matches.has(date)) {
      const start = istInstant(date, d.profile.gymTime);
      out.push({ uid: `session-${date}@peakx.live`, title: `PeakX · ${day.label === 'Full body' ? 'Full body' : `${day.label} session`}`, description: 'Today’s exercises and target weights are in PeakX → Log → Workout.', start, end: new Date(start.getTime() + 75 * 60_000) });
      if (d.reminders.windDown) {
        const s = istInstant(addDays(date, -1), d.reminders.windDown);
        out.push({ uid: `winddown-${date}@peakx.live`, title: 'Wind down · training tomorrow', description: 'Screens off and lights low, so you get 7 hours before tomorrow’s session.', start: s, end: new Date(s.getTime() + 15 * 60_000) });
      }
    }
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0 && (d.plan !== 'free' || !d.firstReportUsed)) {
      const s = istInstant(date, '19:00');
      out.push({ uid: `report-${date}@peakx.live`, title: 'Your PeakX weekly report is ready', description: 'Open Reviews to see what to change next week.', start: s, end: new Date(s.getTime() + 15 * 60_000) });
    }
    if (d.reminders.retest === date) out.push({ uid: `retest-${date}@peakx.live`, title: 'Blood test re-check', description: 'Re-test the markers your coach flagged, then upload the report in PeakX → Blood work.', start: istInstant(date, '00:00'), end: istInstant(addDays(date, 1), '00:00'), allDay: true });
  }
  d.sport?.matches.filter((m) => m.date >= from && m.date < addDays(from, weeks * 7)).forEach((m) => {
    const s = istInstant(m.date, m.time);
    out.push({ uid: `match-${m.id}@peakx.live`, title: `${SPORTS[d.sport!.sport].matchWord}: ${m.label}`, description: 'Match-day meals are in PeakX → Plan → Sport.', start: s, end: new Date(s.getTime() + 90 * 60_000) });
  });
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

const stamp = (t: Date) => t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Fold to 75 octets per RFC 5545. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 75) { out.push(cur); cur = ` ${ch}`; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}

export function toICS(events: CalEvent[], name: string, now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PeakX//Training calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Asia/Kolkata', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp(now)}`);
    if (e.allDay) {
      const d = new Date(e.start.getTime() + IST).toISOString().slice(0, 10).replace(/-/g, '');
      const n = new Date(e.end.getTime() + IST).toISOString().slice(0, 10).replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${n}`);
    } else lines.push(`DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`);
    lines.push(`SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.description)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
