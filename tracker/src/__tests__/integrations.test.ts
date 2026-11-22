import { describe, expect, it } from 'vitest';
import { ALL_READ, combine, durSec, googleScopes, localDate, mergeWearable, parseGoogle, parseStrava, syncRange } from '../domain/wearables';
import { calendarEvents, emailsDue, istInstant, toICS, DEFAULT_PREFS } from '../domain/reminders';
import { makeSeed } from '../domain/seed';
import { reducer } from '../state/store';
import { addDays, today } from '../domain/clock';

describe('wearables (S21.1)', () => {
  it('asks Google only for the scopes the toggles need', () => {
    expect(googleScopes(ALL_READ)).toHaveLength(3);
    expect(googleScopes({ steps: false, sleep: true, heartRate: false, workouts: false })).toEqual(['https://www.googleapis.com/auth/googlehealth.sleep.readonly']);
  });
  it('parses Google Health API steps, sleep, resting heart rate and exercise', () => {
    const parts = parseGoogle({
      steps: { rollupDataPoints: [{ civilStartTime: { date: { year: 2026, month: 10, day: 14 } }, steps: { countSum: '8421' } }] },
      sleep: { dataPoints: [{ sleep: { interval: { endTime: '2026-10-14T01:30:00Z', endUtcOffset: '19800s' }, summary: { minutesAsleep: '402' } } }] },
      restingHr: { dataPoints: [{ dailyRestingHeartRate: { date: { year: 2026, month: 10, day: 14 }, beatsPerMinute: '61' } }] },
      exercise: { dataPoints: [{ name: 'users/me/dataTypes/exercise/dataPoints/1', exercise: { interval: { startTime: '2026-10-14T13:00:00Z', startUtcOffset: '19800s' }, exerciseType: 'WEIGHTLIFTING', activeDuration: '3600s', metricsSummary: { caloriesKcal: 310, averageHeartRateBeatsPerMinute: '118' } } }] },
    });
    expect(parts['2026-10-14']).toMatchObject({ steps: 8421, sleepHours: 6.7, restingHr: 61, activeMinutes: 60, kcalBurned: 310 });
    expect(parts['2026-10-14'].activities![0]).toMatchObject({ type: 'Weightlifting', minutes: 60, avgHr: 118, source: 'fitbit' });
    expect(durSec('19800s')).toBe(19800);
    expect(localDate('2026-10-13T20:00:00Z', '19800s')).toBe('2026-10-14');
  });
  it('parses Strava and drops duplicates of watch-recorded workouts', () => {
    const s = parseStrava([{ id: 9, name: 'Evening run', sport_type: 'Run', start_date_local: '2026-10-14T19:05:00Z', moving_time: 1800, distance: 5230, average_heartrate: 151.4 }, { id: 10, name: 'Badminton', sport_type: 'Badminton', start_date_local: '2026-10-14T07:00:00Z', moving_time: 3600 }]);
    expect(s['2026-10-14'].activities.map((a) => [a.name, a.km, a.minutes])).toEqual([['Evening run', 5.23, 30], ['Badminton', null, 60]]);
    const day = combine({ date: '2026-10-14', fitbit: { steps: 9000, activities: [{ id: 'g', name: 'Run', type: 'Run', minutes: 31, km: 5.2, avgHr: 150, kcal: 300, source: 'fitbit' }], activeMinutes: 31, kcalBurned: 300 }, strava: s['2026-10-14'] }, ALL_READ)!;
    expect(day.activities!.map((a) => a.name)).toEqual(['Run', 'Badminton']);
    expect(day.activeMinutes).toBe(91);
  });
  it('honours the read toggles and clears days with nothing left', () => {
    const doc = { date: '2026-10-14', fitbit: { steps: 9000, sleepHours: 7, restingHr: 60 } };
    expect(combine(doc, { ...ALL_READ, sleep: false })).toMatchObject({ steps: 9000, sleepHours: 0, restingHr: 60 });
    expect(combine(doc, { steps: false, sleep: false, heartRate: false, workouts: true })).toBeNull();
  });
  it('real days replace demo data; disconnecting everything clears synced data', () => {
    const d = makeSeed();
    const synced = [{ date: today(), steps: 1, sleepHours: 7, restingHr: 60, activeMinutes: 0, kcalBurned: 0, source: 'fitbit' as const }];
    const merged = mergeWearable(d.wearable, synced);
    expect(merged).toHaveLength(d.wearable.length);
    expect(merged.find((w) => w.date === today())!.steps).toBe(1);
    const s = reducer(d, { type: 'setWearable', days: synced, devices: { google: true, strava: false } });
    expect(s.wearable).toEqual(synced);
    expect(reducer(s, { type: 'setWearable', days: [], devices: { google: false, strava: false } }).wearable).toEqual([]);
    expect(syncRange('2026-10-15', 3)).toEqual({ from: '2026-10-13', to: '2026-10-15' });
  });
});

describe('reminders and calendar (S22.1)', () => {
  const d = makeSeed();
  it('nudges only when nothing is logged and the member asked for it', () => {
    const t = today();
    expect(emailsDue(d, t, { ...DEFAULT_PREFS, logNudge: true })).toEqual(d.meals.some((m) => m.date === t) ? [] : ['nudge']);
    const empty = { ...d, meals: d.meals.filter((m) => m.date !== t) };
    expect(emailsDue(empty, t, { ...DEFAULT_PREFS, logNudge: true })).toEqual(['nudge']);
    expect(emailsDue(empty, t, DEFAULT_PREFS)).toEqual([]);
    expect(emailsDue(empty, t, { ...DEFAULT_PREFS, logNudge: true, unsubscribedAt: 'x' })).toEqual([]);
    expect(emailsDue({ ...empty, reminders: { ...empty.reminders, retest: t } }, t, DEFAULT_PREFS)).toEqual(['retest']);
  });
  it('builds sessions, report and re-test events in IST', () => {
    const ev = calendarEvents({ ...d, reminders: { windDown: '23:00', retest: addDays(today(), 3) } }, today(), 1);
    const session = ev.find((e) => e.uid.startsWith('session-'))!;
    expect(session.start.toISOString().slice(11, 16)).toBe(istInstant('2026-01-01', d.profile.gymTime).toISOString().slice(11, 16));
    expect(ev.some((e) => e.uid.startsWith('winddown-'))).toBe(true);
    expect(ev.some((e) => e.uid.startsWith('retest-') && e.allDay)).toBe(true);
    expect(istInstant('2026-10-15', '19:00').toISOString()).toBe('2026-10-15T13:30:00.000Z');
  });
  it('writes valid iCalendar text', () => {
    const ics = toICS([{ uid: 'a@peakx.in', title: 'Upper, heavy; day', description: 'Line one\nline two', start: new Date('2026-10-15T13:30:00Z'), end: new Date('2026-10-15T14:45:00Z') }], 'PeakX training', new Date('2026-10-15T00:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261015T133000Z');
    expect(ics).toContain('SUMMARY:Upper\\, heavy\; day');
    expect(ics).toContain('DESCRIPTION:Line one\\nline two');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});
