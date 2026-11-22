import { strToU8, zipSync } from 'fflate';
import type { AppData } from './types';
import { e1rm } from './nutrition';

/** Data export (S8.2): one CSV per log, zipped. Opens in Excel, Google Sheets or Numbers. */

/** RFC 4180 field: quote when it contains a comma, quote or newline; double inner quotes. Guards against spreadsheet formula injection. */
export function csvField(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(head: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return [head, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export function foodCsv(d: AppData): string {
  const rows = [...d.meals].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .flatMap((m) => m.items.map((i) => [m.date, m.slot, m.time, i.name, i.amount, i.macros.kcal, i.macros.protein, i.macros.carbs, i.macros.fat, i.source, i.estimated ? 'yes' : 'no']));
  return toCsv(['date', 'meal', 'time', 'item', 'amount', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'source', 'estimated'], rows);
}
export function workoutsCsv(d: AppData): string {
  const rows = [...d.workouts].sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((w) => w.exercises.flatMap((e) => e.sets.map((s, k) => [w.date, w.name, e.name, k + 1, s.reps, s.kg, e1rm(s.kg, s.reps), w.done ? 'yes' : 'no'])));
  return toCsv(['date', 'session', 'exercise', 'set', 'reps', 'kg', 'est_1rm_kg', 'session_finished'], rows);
}
export function weightCsv(d: AppData): string {
  return toCsv(['date', 'kg'], [...d.weights].sort((a, b) => a.date.localeCompare(b.date)).map((w) => [w.date, w.kg]));
}
export function wearableCsv(d: AppData): string {
  return toCsv(['date', 'steps', 'sleep_hours', 'resting_hr_bpm', 'active_minutes', 'kcal_burned', 'source'],
    [...d.wearable].sort((a, b) => a.date.localeCompare(b.date)).map((w) => [w.date, w.steps, w.sleepHours, w.restingHr, w.activeMinutes, w.kcalBurned, w.source]));
}

export function exportFiles(d: AppData): Record<string, string> {
  const readme = [
    'PeakX data export',
    `Exported: ${new Date().toISOString()}`,
    '',
    'food.csv      every logged item with calories and macros (estimated = from the food table, pending review)',
    'workouts.csv  every logged set, with estimated 1-rep max (Epley)',
    'weight.csv    weigh-ins',
    'wearable.csv  steps, sleep, resting heart rate and calories burned from connected devices',
    '',
  ].join('\r\n');
  return { 'README.txt': readme, 'food.csv': foodCsv(d), 'workouts.csv': workoutsCsv(d), 'weight.csv': weightCsv(d), 'wearable.csv': wearableCsv(d) };
}

export function exportZip(d: AppData): Uint8Array {
  const files = exportFiles(d);
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level: 6 });
}
