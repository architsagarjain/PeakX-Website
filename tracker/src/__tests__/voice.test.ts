import { describe, expect, it } from 'vitest';
import { extractItems, fitPortion, normaliseSpeech, parseMeal } from '../domain/mealParser';
import { catalogue } from '../domain/foodSearch';
import { RECIPES, recipeMacros } from '../domain/seed';

const CAT = catalogue(RECIPES, recipeMacros);

describe('meal parser (S9.2)', () => {
  it('splits Hinglish into items with quantities, units and vague words', () => {
    const x = extractItems('Do roti, ek katori dal makhani aur thoda paneer bhurji');
    expect(x.map((i) => [i.query, i.qty, i.unit, i.vague])).toEqual([
      ['roti', 2, null, false], ['dal makhani', 1, 'katori', false], ['paneer bhurji', null, null, true],
    ]);
  });
  it('reads Devanagari from the Hindi recogniser', () => {
    expect(normaliseSpeech('दो रोटी और एक कटोरी दाल')).toBe('do roti aur ek katori dal');
    const p = parseMeal('दो रोटी और एक कटोरी दाल', CAT);
    expect(p.map((i) => i.match?.id)).toEqual(['roti', 'dal-tadka']);
  });
  it('reads English amounts, grams and trailing numbers', () => {
    const x = extractItems('I had 2 eggs, half plate poha and 150g paneer; roti 3');
    expect(x.map((i) => [i.query, i.qty, i.unit])).toEqual([['eggs', 2, null], ['poha', 0.5, 'plate'], ['paneer', 150, 'g'], ['roti', 3, null]]);
  });
  it('matches the food table and fits portions', () => {
    const p = parseMeal('2 roti, 1 katori dal makhani, thoda paneer bhurji', CAT);
    expect(p[0]).toMatchObject({ needsAmount: false, amount: 2 });
    expect(p[0].match?.portions[p[0].portionIndex].label).toBe('1 roti');
    expect(p[1]).toMatchObject({ needsAmount: false, amount: 1 });
    expect(p[1].match?.id).toBe('dal-makhani');
    expect(p[2]).toMatchObject({ needsAmount: true, vague: true });
  });
  it('asks for an amount when none is said, and flags unknown foods', () => {
    const p = parseMeal('dal, xyzzy blorps', CAT);
    expect(p[0]).toMatchObject({ needsAmount: true });
    expect(p[0].match?.id).toBe('dal-tadka');
    expect(p[1].match).toBeNull();
  });
  it('turns grams into the gram portion for ingredients', () => {
    const paneer = CAT.find((c) => c.id === 'paneer')!;
    const f = fitPortion(paneer, 150, 'g');
    expect(f.known).toBe(true);
    expect(paneer.portions[f.portionIndex].grams * f.amount).toBeCloseTo(150);
  });
});
