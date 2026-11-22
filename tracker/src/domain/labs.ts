import type { Diet, LabMarker, LabReport, Recipe, Sex } from './types.js';

/**
 * Blood work (S18.2). Common markers with adult reference ranges, unit conversion, a status per value,
 * and food changes for out-of-range markers. Ranges, thresholds and food advice are a DRAFT for coach
 * and doctor review; the app never diagnoses or doses, and sends anything far out of range to a doctor.
 */

export interface MarkerDef {
  id: string; name: string; unit: string; aliases: string[];
  low?: number; high?: number;                     // normal range (either end may be open)
  lowFor?: Partial<Record<Sex, number>>; highFor?: Partial<Record<Sex, number>>;
  doctorBelow?: number; doctorAbove?: number;      // see a doctor soon
  convert?: { unit: RegExp; factor: (v: number) => number }[];
  icon: string;
}

export const MARKERS: MarkerDef[] = [
  { id: 'vitD', name: 'Vitamin D', unit: 'ng/mL', aliases: ['vitamin d', '25-oh', '25 oh', '25-hydroxy', 'vit d', 'calcidiol'], low: 30, high: 100, doctorBelow: 12, doctorAbove: 150, convert: [{ unit: /nmol/i, factor: (v) => v / 2.496 }], icon: 'sun' },
  { id: 'b12', name: 'Vitamin B12', unit: 'pg/mL', aliases: ['b12', 'b 12', 'cobalamin', 'cyanocobalamin'], low: 200, high: 900, doctorBelow: 150, convert: [{ unit: /pmol/i, factor: (v) => v * 1.355 }], icon: 'drop' },
  { id: 'ferritin', name: 'Ferritin', unit: 'ng/mL', aliases: ['ferritin', 's. ferritin'], low: 30, high: 300, doctorBelow: 15, doctorAbove: 500, convert: [{ unit: /µg\/l|ug\/l|mcg\/l/i, factor: (v) => v }], icon: 'hex' },
  { id: 'hb', name: 'Haemoglobin', unit: 'g/dL', aliases: ['haemoglobin', 'hemoglobin', 'hb', 'hgb'], lowFor: { male: 13, female: 12 }, highFor: { male: 17, female: 15.5 }, doctorBelow: 10, convert: [{ unit: /^g\/l/i, factor: (v) => v / 10 }], icon: 'drop' },
  { id: 'hba1c', name: 'HbA1c', unit: '%', aliases: ['hba1c', 'glycated', 'glycosylated', 'a1c'], high: 5.6, doctorAbove: 6.4, convert: [{ unit: /mmol\/mol/i, factor: (v) => v / 10.929 + 2.15 }], icon: 'pulse' },
  { id: 'glucose', name: 'Fasting glucose', unit: 'mg/dL', aliases: ['fasting glucose', 'fasting blood sugar', 'fbs', 'glucose fasting', 'fasting plasma glucose'], low: 70, high: 99, doctorBelow: 55, doctorAbove: 125, convert: [{ unit: /mmol/i, factor: (v) => v * 18 }], icon: 'pulse' },
  { id: 'ldl', name: 'LDL cholesterol', unit: 'mg/dL', aliases: ['ldl', 'ldl cholesterol', 'ldl-c'], high: 129, doctorAbove: 189, convert: [{ unit: /mmol/i, factor: (v) => v * 38.67 }], icon: 'hex' },
  { id: 'hdl', name: 'HDL cholesterol', unit: 'mg/dL', aliases: ['hdl', 'hdl cholesterol', 'hdl-c'], lowFor: { male: 40, female: 50 }, convert: [{ unit: /mmol/i, factor: (v) => v * 38.67 }], icon: 'hex' },
  { id: 'tg', name: 'Triglycerides', unit: 'mg/dL', aliases: ['triglycerides', 'tg', 'triglyceride'], high: 149, doctorAbove: 499, convert: [{ unit: /mmol/i, factor: (v) => v * 88.57 }], icon: 'drop' },
  { id: 'chol', name: 'Total cholesterol', unit: 'mg/dL', aliases: ['total cholesterol', 'cholesterol total', 's. cholesterol', 'cholesterol'], high: 199, doctorAbove: 239, convert: [{ unit: /mmol/i, factor: (v) => v * 38.67 }], icon: 'hex' },
  { id: 'tsh', name: 'TSH', unit: 'mIU/L', aliases: ['tsh', 'thyroid stimulating'], low: 0.4, high: 4.5, doctorBelow: 0.1, doctorAbove: 10, convert: [{ unit: /µiu\/ml|uiu\/ml|miu\/l/i, factor: (v) => v }], icon: 'pulse' },
  { id: 'uric', name: 'Uric acid', unit: 'mg/dL', aliases: ['uric acid', 's. uric acid'], low: 3.4, highFor: { male: 7, female: 6 }, doctorAbove: 9, convert: [{ unit: /µmol|umol/i, factor: (v) => v / 59.48 }], icon: 'drop' },
];
export const markerDef = (id: string) => MARKERS.find((m) => m.id === id);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%. -]/g, ' ').replace(/\s+/g, ' ').trim();
/** Match a lab's printed name to a marker (longest alias wins, so "HDL cholesterol" isn't "cholesterol"). */
export function matchMarker(name: string): MarkerDef | null {
  const n = norm(name);
  let best: { m: MarkerDef; len: number } | null = null;
  for (const m of MARKERS) for (const a of m.aliases) {
    const re = new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`);
    if (re.test(n) && (!best || a.length > best.len)) best = { m, len: a.length };
  }
  return best?.m ?? null;
}

/** Convert a printed value + unit to the marker's unit. Unknown units pass through unchanged. */
export function toStandard(def: MarkerDef, value: number, unit: string): number {
  const u = (unit ?? '').trim();
  if (!u || norm(u) === norm(def.unit)) return value;
  const c = def.convert?.find((x) => x.unit.test(u));
  return Math.round((c ? c.factor(value) : value) * 100) / 100;
}

export type MarkerStatus = 'low' | 'normal' | 'high';
export function rangeOf(def: MarkerDef, sex: Sex): { low?: number; high?: number } {
  return { low: def.lowFor?.[sex] ?? def.low, high: def.highFor?.[sex] ?? def.high };
}
export function statusOf(def: MarkerDef, value: number, sex: Sex): MarkerStatus {
  const r = rangeOf(def, sex);
  return r.low !== undefined && value < r.low ? 'low' : r.high !== undefined && value > r.high ? 'high' : 'normal';
}
export const needsDoctor = (def: MarkerDef, v: number) => (def.doctorBelow !== undefined && v < def.doctorBelow) || (def.doctorAbove !== undefined && v > def.doctorAbove);
export function rangeText(def: MarkerDef, sex: Sex): string {
  const r = rangeOf(def, sex);
  return r.low !== undefined && r.high !== undefined ? `Range ${r.low}–${r.high} ${def.unit}` : r.high !== undefined ? `Normal up to ${r.high}${def.unit === '%' ? '%' : ` ${def.unit}`}` : `Normal from ${r.low} ${def.unit}`;
}

/** "A, b and c" from parts (first word capitalised, the rest lower case unless a name). */
function sentence(parts: (string | null | false)[]): string {
  const xs = parts.filter(Boolean) as string[];
  const fixed = xs.map((x, i) => (i === 0 ? x.charAt(0).toUpperCase() + x.slice(1) : /^[A-Z][a-z]/.test(x) && !/^(B12|HbA1c)/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x));
  return fixed.length > 1 ? `${fixed.slice(0, -1).join(', ')} and ${fixed[fixed.length - 1]}` : fixed[0] ?? '';
}

export interface FoodChange { marker: string; title: string; detail: string; often: string; recipeWords: RegExp | null }

/** Food changes for out-of-range markers, fitted to the diet. */
export function foodChanges(markers: LabMarker[], sex: Sex, diet: Diet): FoodChange[] {
  const veg = diet === 'veg' || diet === 'vegan', egg = diet !== 'veg' && diet !== 'vegan', nonveg = diet === 'nonveg', vegan = diet === 'vegan';
  const out: FoodChange[] = [];
  for (const m of markers) {
    const def = markerDef(m.id); if (!def) continue;
    const st = statusOf(def, m.value, sex);
    if (st === 'normal') continue;
    const k = `${m.id}:${st}`;
    const add = (detail: string, often: string, words: RegExp | null) => out.push({ marker: m.id, title: def.name, detail, often, recipeWords: words });
    if (k === 'vitD:low') add(sentence([egg ? 'egg yolks 3× a week' : null, vegan ? 'fortified plant milk' : 'fortified milk or curd', 'mushrooms', '15–20 min of midday sun on your arms']), 'Daily', egg ? /egg|milk|mushroom|paneer|curd/i : /milk|mushroom|curd|paneer/i);
    else if (k === 'b12:low') add(vegan ? 'Fortified plant milk or nutritional yeast daily; B12 is hard to get from plants alone' : sentence(['curd or buttermilk daily', 'paneer', egg ? 'eggs' : null, nonveg ? 'chicken or fish 2–3× a week' : null]), 'Daily', vegan ? null : /curd|dahi|paneer|milk|egg|chicken|fish|whey/i);
    else if ((k === 'ferritin:low' || k === 'hb:low')) { if (!out.some((c) => c.marker === 'ferritin' || c.marker === 'hb')) add(`${sentence(['rajma, chana, moong or soya most days', 'palak or methi', nonveg ? 'chicken or mutton 2× a week' : null])}, with lemon or amla for vitamin C; keep tea and coffee an hour away from meals`, 'Most days', /rajma|chana|moong|soya|palak|spinach|methi|chicken|mutton|dal/i); }
    else if (k === 'hba1c:high' || k === 'glucose:high') { if (!out.some((c) => c.marker === 'hba1c' || c.marker === 'glucose')) add('Half the rice or roti at dinner, swap in dal, chana or salad; whole fruit instead of juice; a 10-minute walk after meals', 'Every meal', /dal|chana|rajma|moong|soya|salad|oats/i); }
    else if (k === 'ldl:high' || k === 'chol:high' || k === 'tg:high') { if (!out.some((c) => ['ldl', 'chol', 'tg'].includes(c.marker))) add(sentence(['oats or besan chilla for breakfast', 'a handful of nuts', nonveg ? 'fish twice a week' : 'flax or walnuts', 'fried snacks and sweets down to twice a week', m.id === 'tg' ? 'less sugar and alcohol' : null]), '3× a week', /oats|besan|chilla|dal|fish|almond|walnut|chana/i); }
    else if (k === 'hdl:low') add('Daily movement (8,000+ steps), nuts or seeds, and fewer refined carbs', 'Daily', /almond|walnut|peanut|seed|fish/i);
    else if (k === 'uric:high') add(`${sentence(['3 litres of water a day', nonveg ? 'less red meat and organ meat' : null, 'fewer sugary drinks and less alcohol'])}; curd and low-fat milk are fine`, 'Daily', /curd|milk|paneer|egg/i);
    else if (m.id === 'tsh') add('Thyroid levels need a doctor; keep iodised salt and regular meals', 'Doctor', null);
    void veg;
  }
  return out;
}

/** Library recipes that help with a report's food changes (most matches first). */
export function recipesFor(changes: FoodChange[], recipes: Recipe[], diet: Diet, n = 4): { recipe: Recipe; markers: string[] }[] {
  const fits = (r: Recipe) => diet === 'nonveg' || (diet === 'egg' ? r.diet !== 'nonveg' : diet === 'veg' ? r.diet === 'veg' || r.diet === 'vegan' : r.diet === 'vegan');
  return recipes.filter(fits).map((recipe) => {
    const text = `${recipe.name} ${recipe.ingredients.map((i) => i.name).join(' ')}`;
    return { recipe, markers: changes.filter((c) => c.recipeWords?.test(text)).map((c) => c.title) };
  }).filter((x) => x.markers.length).sort((a, b) => b.markers.length - a.markers.length).slice(0, n);
}

/** A plain-text note to take to a doctor. */
export function doctorNote(r: LabReport, sex: Sex, name: string): string {
  const lines = r.markers.map((m) => { const d = markerDef(m.id)!; const st = statusOf(d, m.value, sex); return `• ${d.name}: ${m.value} ${d.unit} (${st}; ${rangeText(d, sex).toLowerCase()})${needsDoctor(d, m.value) ? ' — please review soon' : ''}`; });
  return [`Lab report of ${name || 'PeakX member'}, ${r.date}`, ...lines, '', 'Food changes I’m making with my PeakX coach are listed in the app. I’d like your advice on whether I need supplements or further tests, and at what dose.', '(Summary from PeakX; not a diagnosis.)'].join('\n');
}

/** Google Calendar link for the re-test reminder (no integration needed). */
export function calendarLink(date: string): string {
  const d = date.replace(/-/g, '');
  const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Blood test re-check (PeakX)')}&dates=${d}/${next.toISOString().slice(0, 10).replace(/-/g, '')}&details=${encodeURIComponent('Re-test the markers your PeakX coach flagged, then upload the report in PeakX → Reviews → Blood work.')}`;
}
