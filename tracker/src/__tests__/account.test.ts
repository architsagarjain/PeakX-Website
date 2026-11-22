import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { csvField, exportFiles, exportZip, foodCsv, toCsv, workoutsCsv } from '../domain/export';
import { diffForSave, joinData, splitData } from '../state/cloud';
import { makeSeed } from '../domain/seed';
import { recent, track, reportError, trackAction } from '../state/telemetry';

describe('CSV export (S8.2)', () => {
  it('escapes commas, quotes and newlines, and neutralises formulas', () => {
    expect(csvField('Roti, 2')).toBe('"Roti, 2"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('a\nb')).toBe('"a\nb"');
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField(-5)).toBe('-5');
    expect(csvField(null)).toBe('');
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n');
  });
  it('writes one food row per item and one workout row per set', () => {
    const d = makeSeed();
    const food = foodCsv(d).trim().split('\r\n');
    expect(food[0]).toBe('date,meal,time,item,amount,kcal,protein_g,carbs_g,fat_g,source,estimated');
    expect(food.length - 1).toBe(d.meals.reduce((s, m) => s + m.items.length, 0));
    const sets = workoutsCsv(d).trim().split('\r\n').length - 1;
    expect(sets).toBe(d.workouts.reduce((s, w) => s + w.exercises.reduce((t, e) => t + e.sets.length, 0), 0));
  });
  it('zips all files and they read back unchanged', () => {
    const d = makeSeed();
    const files = unzipSync(exportZip(d));
    expect(Object.keys(files).sort()).toEqual(['README.txt', 'food.csv', 'wearable.csv', 'weight.csv', 'workouts.csv']);
    expect(strFromU8(files['food.csv'])).toBe(exportFiles(d)['food.csv']);
  });
});

describe('cloud data mapping (S8.1)', () => {
  it('splits by day and joins back to the same data', () => {
    const d = makeSeed();
    const parts = splitData(d);
    expect(Object.keys(parts.days).length).toBeGreaterThanOrEqual(28);
    expect(JSON.stringify(parts)).not.toContain('undefined');
    const back = joinData(parts.root, parts.days);
    expect(back.meals.length).toBe(d.meals.length);
    expect(back.workouts.length).toBe(d.workouts.length);
    expect(back.weights).toEqual([...d.weights].sort((a, b) => a.date.localeCompare(b.date)));
    expect(back.profile).toEqual(JSON.parse(JSON.stringify(d.profile)));
  });
  it('saves only what changed and deletes emptied days', () => {
    const d = makeSeed();
    const first = diffForSave(splitData(d), null);
    expect(first.rootChanged).toBe(true);
    expect(first.write.length).toBe(Object.keys(splitData(d).days).length);
    const same = diffForSave(splitData(d), first.snapshot);
    expect(same).toMatchObject({ rootChanged: false, write: [], remove: [] });
    const day = d.weights[0].date;
    const edited = { ...d, weights: d.weights.map((w) => (w.date === day ? { ...w, kg: w.kg + 1 } : w)) };
    expect(diffForSave(splitData(edited), first.snapshot).write).toEqual([day]);
    const emptied = { ...d, meals: d.meals.filter((m) => m.date !== day), weights: d.weights.filter((w) => w.date !== day), wearable: d.wearable.filter((w) => w.date !== day), workouts: d.workouts.filter((w) => w.date !== day) };
    expect(diffForSave(splitData(emptied), first.snapshot).remove).toEqual([day]);
  });
});

describe('telemetry (S4.2)', () => {
  it('records events, product actions and errors with the last action', () => {
    track('upgrade_viewed');
    trackAction('logItems');
    trackAction('replace');
    reportError(new Error('boom'), 'test');
    const r = recent();
    expect(r.some((e) => e.name === 'upgrade_viewed')).toBe(true);
    expect(r.some((e) => e.name === 'meal_logged')).toBe(true);
    expect(r.some((e) => e.name === 'replace')).toBe(false);
    const err = r.find((e) => e.kind === 'error')!;
    expect(err.props).toMatchObject({ message: 'boom', where: 'test', lastAction: 'replace' });
  });
});
