import type { ISODate } from './types.js';

/** Local calendar date as YYYY-MM-DD (never UTC, so it doesn't jump a day in IST evenings). */
export function iso(d: Date): ISODate {
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function today(): ISODate { return iso(new Date()); }
export function parse(d: ISODate): Date { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); }
export function addDays(d: ISODate, n: number): ISODate { const x = parse(d); x.setDate(x.getDate() + n); return iso(x); }
/** Monday of the week containing d. */
export function weekStart(d: ISODate): ISODate { const x = parse(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return iso(x); }
export function longDate(d: ISODate): string { return parse(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
export function shortDay(d: ISODate): string { return parse(d).toLocaleDateString('en-GB', { weekday: 'short' }); }
export function dayNum(d: ISODate): number { return parse(d).getDate(); }
