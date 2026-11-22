import { searchFoods, type Loggable } from './foodSearch';
import type { Portion } from './foods';

/**
 * Meal parser (S9.2). Turns "do roti, ek katori dal makhani aur thoda paneer bhurji" (English, Hindi,
 * Hinglish or Devanagari) into items matched against the food table. Calories always come from the
 * table, never from speech or an AI model. Items without a clear amount are flagged and must be answered.
 */

export interface Extracted { query: string; qty: number | null; unit: string | null; vague: boolean; text: string }
export interface ParsedItem extends Extracted {
  match: Loggable | null;
  alternatives: Loggable[];
  portionIndex: number;
  amount: number;              // multiplier for the chosen portion
  needsAmount: boolean;
}

// Devanagari → Hinglish for the words people say most at meals (recogniser output in hi-IN).
const DEVANAGARI: [RegExp, string][] = [
  [/आधा|आधी/g, 'aadha'], [/डेढ़|डेढ/g, 'dedh'], [/ढाई/g, 'dhai'], [/एक/g, 'ek'], [/दो/g, 'do'], [/तीन/g, 'teen'], [/चार/g, 'char'], [/पांच|पाँच/g, 'paanch'], [/छह|छः/g, 'chhe'],
  [/थोड़ा|थोड़ी|थोडा|थोडी/g, 'thoda'], [/कुछ/g, 'kuch'], [/और/g, ' aur '], [/के साथ/g, ' with '],
  [/कटोरी/g, 'katori'], [/प्लेट/g, 'plate'], [/कप/g, 'cup'], [/गिलास/g, 'glass'], [/चम्मच/g, 'spoon'], [/पीस/g, 'piece'], [/ग्राम/g, 'g'], [/स्कूप/g, 'scoop'],
  [/रोटियां|रोटियाँ|रोटी/g, 'roti'], [/पराठा|पराठे|परांठा/g, 'paratha'], [/दाल/g, 'dal'], [/मखनी|मक्खनी/g, 'makhani'], [/चावल/g, 'chawal'], [/पनीर/g, 'paneer'], [/भुर्जी/g, 'bhurji'],
  [/दही/g, 'dahi'], [/अंडे|अंडा|अण्डा/g, 'anda'], [/चिकन/g, 'chicken'], [/करी/g, 'curry'], [/सब्ज़ी|सब्जी/g, 'sabzi'], [/आलू/g, 'aloo'], [/गोभी/g, 'gobi'], [/राजमा/g, 'rajma'],
  [/छोले/g, 'chole'], [/पोहा/g, 'poha'], [/उपमा/g, 'upma'], [/इडली/g, 'idli'], [/डोसा/g, 'dosa'], [/चाय/g, 'chai'], [/दूध/g, 'doodh'], [/केला|केले/g, 'kela'],
  [/सेब/g, 'seb'], [/खिचड़ी|खिचडी/g, 'khichdi'], [/भिंडी/g, 'bhindi'], [/पालक/g, 'palak'], [/बिरयानी/g, 'biryani'], [/लस्सी/g, 'lassi'], [/सलाद/g, 'salad'],
  [/आमलेट|ऑमलेट/g, 'omelette'], [/मूंग/g, 'moong'], [/चना/g, 'chana'], [/मटर/g, 'matar'], [/समोसा|समोसे/g, 'samosa'], [/रायता/g, 'raita'], [/मछली/g, 'machli'],
];

const NUM_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, couple: 2,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, aadha: 0.5, adha: 0.5, aadhi: 0.5, adhi: 0.5, dedh: 1.5, dhai: 2.5, '½': 0.5,
};
const VAGUE = new Set(['thoda', 'thodi', 'thora', 'thori', 'kuch', 'little', 'some', 'bit', 'few', 'zara']);
const UNITS: Record<string, string> = {
  katori: 'katori', katoris: 'katori', bowl: 'katori', bowls: 'katori', vati: 'katori',
  plate: 'plate', plates: 'plate', cup: 'cup', cups: 'cup', glass: 'glass', glasses: 'glass',
  spoon: 'spoon', spoons: 'spoon', tbsp: 'tbsp', tsp: 'tsp', chammach: 'spoon', piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece',
  slice: 'slice', slices: 'slice', scoop: 'scoop', scoops: 'scoop', g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', ml: 'ml',
};
const FILLER = new Set(['of', 'aur', 'and', 'with', 'ka', 'ki', 'ke', 'wala', 'wali', 'khaya', 'khayi', 'khaaya', 'i', 'had', 'ate', 'have', 'maine', 'mein', 'me', 'for', 'lunch', 'dinner', 'breakfast', 'nashta', 'snack', 'snacks', 'bhi', 'tha', 'thi', 'the', 'just', 'only', 'plus', 'about', 'around', 'approx', 'roughly']);
const SPLIT = /\s*(?:,|;|\+|&|\band\b|\baur\b|\bwith\b|\bplus\b|\bthen\b|\bphir\b)\s*/i;

/** Normalise: Devanagari words → Hinglish, digits glued to units split ("150g" → "150 g"), lower case. */
export function normaliseSpeech(text: string): string {
  let t = text;
  for (const [re, rep] of DEVANAGARI) t = t.replace(re, ` ${rep} `);
  return t.toLowerCase().replace(/(\d)\s*(g|gm|gms|ml)\b/g, '$1 $2').replace(/[“”"'.!?।]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Split into items and pull out quantity, unit and vague words. */
export function extractItems(text: string): Extracted[] {
  return normaliseSpeech(text).split(SPLIT).map((seg) => seg.trim()).filter(Boolean).map((seg) => {
    let qty: number | null = null, unit: string | null = null, vague = false;
    const rest: string[] = [];
    for (const w of seg.split(' ')) {
      const n = Number(w.replace(',', '.'));
      if (qty === null && w !== '' && Number.isFinite(n) && /^[\d.,]+$/.test(w)) { qty = n; continue; }
      if (qty === null && w in NUM_WORDS && !(w === 'do' && rest.length > 0)) { qty = NUM_WORDS[w]; continue; }
      if (w === 'x' || w === '×') continue;
      if (VAGUE.has(w)) { vague = true; continue; }
      if (w in UNITS) { unit = UNITS[w]; continue; }
      if (FILLER.has(w)) continue;
      rest.push(w);
    }
    // Trailing number: "roti 2".
    if (qty === null && rest.length > 1 && /^\d+(\.\d+)?$/.test(rest[rest.length - 1])) qty = Number(rest.pop());
    return { query: rest.join(' '), qty, unit, vague, text: seg };
  }).filter((x) => x.query.length > 1);
}

const portionUnit = (p: Portion) => {
  const l = p.label.toLowerCase();
  if (/katori|bowl/.test(l)) return 'katori';
  if (/plate/.test(l)) return 'plate';
  if (/cup/.test(l)) return 'cup';
  if (/glass/.test(l)) return 'glass';
  if (/tbsp/.test(l)) return 'tbsp';
  if (/tsp/.test(l)) return 'tsp';
  if (/scoop/.test(l)) return 'scoop';
  if (/slice/.test(l)) return 'slice';
  if (/^\d+ g$/.test(l)) return 'g';
  return 'piece';
};
const portionCount = (p: Portion) => { const m = p.label.match(/^(½|\d+(?:\.\d+)?|1½)/); return m ? (m[1] === '½' ? 0.5 : m[1] === '1½' ? 1.5 : Number(m[1])) : 1; };

/**
 * Pick a portion and multiplier for a quantity + unit. Prefers the portion whose unit matches and whose
 * count is 1 ("1 katori", "1 roti"), then scales: "2 katori" → 1 katori × 2. Grams use a gram portion.
 */
export function fitPortion(l: Loggable, qty: number | null, unit: string | null): { portionIndex: number; amount: number; known: boolean } {
  const ps = l.portions;
  if (qty === null) return { portionIndex: l.defaultPortion, amount: 1, known: false };
  if (unit === 'g') {
    const gIdx = ps.findIndex((p) => /^\d+ g$/.test(p.label));
    if (gIdx >= 0 && l.kind === 'ingredient') return { portionIndex: gIdx, amount: Math.round((qty / ps[gIdx].grams) * 100) / 100, known: true };
    return { portionIndex: l.defaultPortion, amount: 1, known: false };
  }
  const want = unit ?? 'piece';
  const sameUnit = ps.map((p, i) => ({ p, i })).filter(({ p }) => portionUnit(p) === want || (!unit && portionUnit(p) !== 'g'));
  const one = sameUnit.find(({ p }) => portionCount(p) === 1) ?? sameUnit[0];
  if (!one) return { portionIndex: l.defaultPortion, amount: qty, known: true };
  return { portionIndex: one.i, amount: Math.round((qty / portionCount(one.p)) * 100) / 100, known: true };
}

/** Match extracted items to the food table and decide whether each still needs an amount. */
export function resolveItems(items: Extracted[], cat: (Loggable & { keys: string[] })[]): ParsedItem[] {
  return items.map((x) => {
    const found = searchFoods(x.query, cat, 4, true);
    const match = found[0] ?? null;
    if (!match) return { ...x, match: null, alternatives: [], portionIndex: 0, amount: 1, needsAmount: true };
    const fit = fitPortion(match, x.vague ? null : x.qty, x.unit);
    return { ...x, match, alternatives: found.slice(1), portionIndex: fit.portionIndex, amount: fit.amount, needsAmount: x.vague || !fit.known };
  });
}

export function parseMeal(text: string, cat: (Loggable & { keys: string[] })[]): ParsedItem[] {
  return resolveItems(extractItems(text), cat);
}
