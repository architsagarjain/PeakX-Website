import type { Diet, ISODate, LabReport, Sex } from './types.js';
import { markerDef, statusOf } from './labs.js';

/**
 * Supplement protocol (S18.3). A 10-question assessment, then a rules engine that turns the answers,
 * confirmed blood-work values, current supplements and safety flags into a protocol.
 *
 * Guardrails (from the spec, "PeakX Supplement Protocol Questionnaire v1.0"):
 * - Never diagnose a deficiency from diet, sunlight or training alone. Without a lab value, wording is "may"
 *   and the item is Conditional or Optional, never Core.
 * - Lab values are used only after the member confirmed them, and only when the report is recent.
 * - Existing supplements are checked for overlap before anything is added.
 * - Medical flags withhold the dose and ask for a doctor or pharmacist instead of dosing automatically.
 * - Every item names the rule that produced it and the answers it used.
 *
 * Doses and brands are a DRAFT for coach and doctor review, like the rest of the nutrition content.
 */

export const RULES_VERSION = '2026.10-r1';
export const QUESTIONNAIRE_VERSION = 'q1.0';
/** Reports older than this are shown as historical and not used for dosing. */
export const RECENT_DAYS = 183;

// ---------- answers ----------

export type Freq = 'never' | 'lt1' | '1_3' | '4_6' | 'daily';
export type FoodKey = 'dairy' | 'eggs' | 'fish' | 'meat' | 'legumes';
export type SunBand = 'lt10' | '10_20' | '20_30' | 'gt30';
export type ExFreq = '0' | '1_2' | '3_4' | '5_7';
export type ExType = 'strength' | 'cardio' | 'mixed' | 'sport';
export type SafetyFlag = 'pregnancy' | 'kidney' | 'liver' | 'thyroid' | 'diabetes' | 'bp' | 'bleeding' | 'surgery' | 'other' | 'none';
export type SuppId = 'protein' | 'creatine' | 'multi' | 'vitD' | 'b12' | 'iron' | 'omega3' | 'magnesium' | 'calcium' | 'zinc' | 'probiotic' | 'electrolytes' | 'other';

export interface CurrentSupp { id: SuppId; product: string; dose: string; freq: string }

export interface SuppAnswers {
  age: number | null;
  sex: Sex | 'na' | null;
  heightCm: number | null;
  weightKg: number | null;
  diet: Diet | null;
  food: Partial<Record<FoodKey, Freq>>;
  sun: SunBand | null;
  exercise: ExFreq | null;
  exerciseType: ExType | null;
  flags: SafetyFlag[];
  otherCondition: string;
  meds: boolean | null;
  medNames: string;
  takesSupps: boolean | null;
  current: CurrentSupp[];
  bloodwork: 'report' | 'none' | 'skip' | null;
  labId: string | null;
}

/** Saved as the member answers, so a closed tab resumes where it stopped. */
export interface SupplementState {
  answers: SuppAnswers;
  step: number;                       // 0–9 = question, 10 = result
  completedOn?: ISODate;
  consentAt?: string;                 // ISO time the member accepted "not medical advice"
  rulesVersion?: string;
  questionnaireVersion?: string;
}

export const emptyAnswers = (): SuppAnswers => ({
  age: null, sex: null, heightCm: null, weightKg: null, diet: null, food: {}, sun: null, exercise: null, exerciseType: null,
  flags: [], otherCondition: '', meds: null, medNames: '', takesSupps: null, current: [], bloodwork: null, labId: null,
});
export const emptySupplements = (): SupplementState => ({ answers: emptyAnswers(), step: 0 });

// ---------- questions ----------

export type StepId = 'age' | 'sex' | 'body' | 'diet' | 'foods' | 'sun' | 'exercise' | 'safety' | 'meds' | 'labs';
export const SUPP_STEPS: { id: StepId; nav: string; title: string; help: string }[] = [
  { id: 'age', nav: 'Age', title: 'What is your age?', help: 'Protocols are for adults 18 and over.' },
  { id: 'sex', nav: 'Sex', title: 'What is your sex?', help: 'Only used where it changes lab reference ranges.' },
  { id: 'body', nav: 'Height and weight', title: 'Your current height and weight', help: 'Used for protein and creatine amounts.' },
  { id: 'diet', nav: 'Diet', title: 'What is your dietary pattern?', help: 'Decides which food sources and capsule types fit you.' },
  { id: 'foods', nav: 'Foods', title: 'How often do you eat these?', help: 'A typical week, not your best one.' },
  { id: 'sun', nav: 'Sunlight', title: 'How much direct sunlight do you get?', help: 'Time outdoors with arms or face in the sun, on a typical day.' },
  { id: 'exercise', nav: 'Exercise', title: 'How often do you exercise?', help: 'Count the days you train on purpose.' },
  { id: 'safety', nav: 'Health check', title: 'Do any of these apply to you?', help: 'These can change or stop a recommendation. Pick all that apply.' },
  { id: 'meds', nav: 'Medicines', title: 'Medicines and supplements you take now', help: 'So we never double up on something you already take.' },
  { id: 'labs', nav: 'Blood work', title: 'Add your recent blood work', help: 'Optional. Lab values make the protocol specific; you confirm every number first.' },
];
export const RESULT_STEP = SUPP_STEPS.length;

export const SEX_OPTIONS: { id: SuppAnswers['sex'] & string; t: string }[] = [
  { id: 'female', t: 'Female' }, { id: 'male', t: 'Male' }, { id: 'na', t: 'Prefer not to say' },
];
export const DIET_OPTIONS: { id: Diet; t: string; m: string }[] = [
  { id: 'vegan', t: 'Vegan', m: 'No animal foods, including dairy' },
  { id: 'veg', t: 'Vegetarian', m: 'Dairy, no eggs, meat or fish' },
  { id: 'egg', t: 'Eggetarian', m: 'Vegetarian plus eggs' },
  { id: 'nonveg', t: 'Non-vegetarian', m: 'Eggs, chicken, fish or meat' },
];
export const FREQ_OPTIONS: { id: Freq; t: string }[] = [
  { id: 'never', t: 'Never' }, { id: 'lt1', t: '<1× week' }, { id: '1_3', t: '1–3× week' }, { id: '4_6', t: '4–6× week' }, { id: 'daily', t: 'Daily' },
];
export const FOOD_ROWS: { id: FoodKey; t: string }[] = [
  { id: 'dairy', t: 'Dairy or fortified dairy alternatives' },
  { id: 'eggs', t: 'Eggs' },
  { id: 'fish', t: 'Fish or seafood' },
  { id: 'meat', t: 'Meat or poultry' },
  { id: 'legumes', t: 'Legumes, dals or beans' },
];
export const SUN_OPTIONS: { id: SunBand; t: string }[] = [
  { id: 'lt10', t: 'Under 10 min a day' }, { id: '10_20', t: '10–20 min a day' }, { id: '20_30', t: '20–30 min a day' }, { id: 'gt30', t: 'Over 30 min a day' },
];
export const EX_OPTIONS: { id: ExFreq; t: string }[] = [
  { id: '0', t: '0 days a week' }, { id: '1_2', t: '1–2 days a week' }, { id: '3_4', t: '3–4 days a week' }, { id: '5_7', t: '5–7 days a week' },
];
export const EX_TYPES: { id: ExType; t: string }[] = [
  { id: 'strength', t: 'Strength training' }, { id: 'cardio', t: 'Cardio or endurance' }, { id: 'mixed', t: 'Mixed' }, { id: 'sport', t: 'Sport' },
];
export const FLAG_OPTIONS: { id: SafetyFlag; t: string }[] = [
  { id: 'pregnancy', t: 'Pregnant, breastfeeding or trying to conceive' },
  { id: 'kidney', t: 'Kidney disease or reduced kidney function' },
  { id: 'liver', t: 'Liver disease' },
  { id: 'thyroid', t: 'Thyroid condition' },
  { id: 'diabetes', t: 'Diabetes or a blood sugar condition' },
  { id: 'bp', t: 'Blood pressure condition' },
  { id: 'bleeding', t: 'Bleeding or clotting disorder, or blood thinners' },
  { id: 'surgery', t: 'Surgery coming up' },
  { id: 'other', t: 'Other diagnosed medical condition' },
  { id: 'none', t: 'None of these' },
];
export const SUPP_OPTIONS: { id: SuppId; t: string }[] = [
  { id: 'protein', t: 'Protein powder' }, { id: 'creatine', t: 'Creatine' }, { id: 'multi', t: 'Multivitamin' }, { id: 'vitD', t: 'Vitamin D' },
  { id: 'b12', t: 'Vitamin B12' }, { id: 'iron', t: 'Iron' }, { id: 'omega3', t: 'Omega-3' }, { id: 'magnesium', t: 'Magnesium' },
  { id: 'calcium', t: 'Calcium' }, { id: 'zinc', t: 'Zinc' }, { id: 'probiotic', t: 'Probiotic' }, { id: 'electrolytes', t: 'Electrolytes' }, { id: 'other', t: 'Other' },
];
export const suppName = (id: SuppId) => SUPP_OPTIONS.find((o) => o.id === id)?.t ?? id;

/** Food rows that fit the diet (Q5 hides animal foods the member doesn't eat). */
export function foodRowsFor(diet: Diet | null): FoodKey[] {
  if (diet === 'vegan' || diet === 'veg') return ['dairy', 'legumes'];
  if (diet === 'egg') return ['dairy', 'eggs', 'legumes'];
  return ['dairy', 'eggs', 'fish', 'meat', 'legumes'];
}

/** "None" is mutually exclusive with every other flag. */
export function toggleFlag(flags: SafetyFlag[], f: SafetyFlag): SafetyFlag[] {
  if (f === 'none') return flags.includes('none') ? [] : ['none'];
  const rest = flags.filter((x) => x !== 'none');
  return rest.includes(f) ? rest.filter((x) => x !== f) : [...rest, f];
}

/** The first problem with a step's answers, or '' when the member can move on. */
export function validateSuppStep(id: StepId, a: SuppAnswers): string {
  switch (id) {
    case 'age':
      if (a.age == null || !Number.isInteger(a.age)) return 'Enter your age in whole years.';
      if (a.age < 18) return 'Supplement protocols are for adults 18 and over, so we can’t make one for you. Please talk to a doctor.';
      return a.age > 100 ? 'Check your age.' : '';
    case 'sex': return a.sex ? '' : 'Pick one to continue.';
    case 'body':
      if (!a.heightCm || a.heightCm < 120 || a.heightCm > 230) return 'Enter your height in cm (120–230).';
      return !a.weightKg || a.weightKg < 30 || a.weightKg > 250 ? 'Enter your weight in kg (30–250).' : '';
    case 'diet': return a.diet ? '' : 'Pick your dietary pattern.';
    case 'foods': return foodRowsFor(a.diet).every((k) => a.food[k]) ? '' : 'Answer every row.';
    case 'sun': return a.sun ? '' : 'Pick one to continue.';
    case 'exercise':
      if (!a.exercise) return 'Pick how often you exercise.';
      return a.exercise !== '0' && !a.exerciseType ? 'Pick the kind of training you do most.' : '';
    case 'safety':
      if (!a.flags.length) return 'Pick at least one, or “None of these”.';
      return a.flags.includes('other') && !a.otherCondition.trim() ? 'Name the condition in a few words.' : '';
    case 'meds':
      if (a.meds == null) return 'Tell us whether you take regular medicines.';
      if (a.takesSupps == null) return 'Tell us whether you take supplements.';
      return a.takesSupps && !a.current.length ? 'Pick the supplements you take.' : '';
    case 'labs':
      if (!a.bloodwork) return 'Add a report, or pick one of the other options.';
      return a.bloodwork === 'report' && !a.labId ? 'Confirm the values from your report first.' : '';
  }
}

export function firstInvalidSuppStep(a: SuppAnswers): number {
  const i = SUPP_STEPS.findIndex((s) => validateSuppStep(s.id, a));
  return i < 0 ? RESULT_STEP : i;
}

/** Fill empty answers from the plan the member already set up. Never overwrites an answer. */
export function prefillAnswers(a: SuppAnswers, p: { age: number; sex: Sex; heightCm: number; diet: Diet; trainingDays: number }, weightKg: number | null): SuppAnswers {
  const ex: ExFreq | null = p.trainingDays >= 5 ? '5_7' : p.trainingDays >= 3 ? '3_4' : p.trainingDays >= 1 ? '1_2' : null;
  return {
    ...a,
    age: a.age ?? (p.age >= 18 ? p.age : null),
    sex: a.sex ?? (p.age ? p.sex : null),
    heightCm: a.heightCm ?? (p.heightCm || null),
    weightKg: a.weightKg ?? (weightKg || null),
    diet: a.diet ?? (p.age ? p.diet : null),
    exercise: a.exercise ?? (p.age ? ex : null),
  };
}

// ---------- products ----------

export interface Product {
  brand: string;
  name: string;
  strength: string;
  /** Diets this format suits (gelatin softgels and fish oil don't suit vegetarians). */
  suits: Diet[];
  note: string;
}
const ALL: Diet[] = ['vegan', 'veg', 'egg', 'nonveg'];
const VEG: Diet[] = ['veg', 'egg', 'nonveg'];
const EGG: Diet[] = ['egg', 'nonveg'];

/**
 * Brands sold in India, two or three per item, chosen for a clear label and the right strength.
 * Draft list for team review; PeakX has no affiliate deal with any of them.
 */
export const PRODUCTS: Record<string, Product[]> = {
  vitD1000: [
    { brand: 'NOW Foods', name: 'Vitamin D-3 1,000 IU', strength: '1,000 IU a softgel', suits: EGG, note: 'Softgel contains gelatin.' },
    { brand: 'Wellbeing Nutrition', name: 'Melts Plant-based D3 + K2', strength: 'Check IU per strip', suits: ALL, note: 'Vegan D3 from lichen; dissolves on the tongue.' },
  ],
  vitD2000: [
    { brand: 'HealthKart HK Vitals', name: 'Vitamin D3 2000 IU', strength: '2,000 IU a softgel', suits: EGG, note: 'Softgel contains gelatin.' },
    { brand: 'NOW Foods', name: 'Vitamin D-3 2,000 IU', strength: '2,000 IU a softgel', suits: EGG, note: 'Softgel contains gelatin.' },
    { brand: 'Wellbeing Nutrition', name: 'Melts Plant-based D3 + K2', strength: 'Check IU per strip', suits: ALL, note: 'Vegan D3 from lichen; dissolves on the tongue.' },
  ],
  b12: [
    { brand: 'NOW Foods', name: 'Methyl B-12 1,000 mcg lozenges', strength: '1,000 mcg a lozenge', suits: ALL, note: 'Vegan; let it dissolve under the tongue.' },
    { brand: 'Carbamide Forte', name: 'Methylcobalamin Vitamin B12 1500 mcg', strength: '1,500 mcg a tablet', suits: ALL, note: 'Vegetarian tablet.' },
  ],
  fishOil: [
    { brand: 'MuscleBlaze', name: 'Omega 3 Fish Oil 1000 mg', strength: '180 mg EPA + 120 mg DHA a softgel', suits: ['nonveg'], note: 'Fish oil.' },
    { brand: 'HealthKart HK Vitals', name: 'Fish Oil 1000 mg', strength: 'Check EPA + DHA on the label', suits: ['nonveg'], note: 'Fish oil.' },
  ],
  algalOil: [
    { brand: 'Fast&Up', name: 'Vegan Omega (marine algae)', strength: '250 mg DHA a capsule', suits: ALL, note: 'Vegan, from algae; no fishy aftertaste.' },
    { brand: 'INLIFE', name: 'Plant Based Vegan Omega 3 DHA (algal oil)', strength: '400 mg algal oil a capsule', suits: ALL, note: 'Vegan, from algae.' },
  ],
  creatine: [
    { brand: 'Optimum Nutrition', name: 'Micronised Creatine Powder (unflavoured)', strength: '3 g a scoop', suits: ALL, note: 'Plain creatine monohydrate.' },
    { brand: 'MuscleBlaze', name: 'Creatine Monohydrate (unflavoured)', strength: '3 g a scoop', suits: ALL, note: 'Plain creatine monohydrate.' },
    { brand: 'AS-IT-IS Nutrition', name: 'Creatine Monohydrate', strength: 'Check scoop size', suits: ALL, note: 'Plain creatine monohydrate, no flavour.' },
  ],
  whey: [
    { brand: 'Optimum Nutrition', name: 'Gold Standard 100% Whey', strength: 'About 24 g protein a scoop', suits: VEG, note: 'Whey is a dairy protein.' },
    { brand: 'MuscleBlaze', name: 'Biozyme Performance Whey', strength: 'About 25 g protein a scoop', suits: VEG, note: 'Whey is a dairy protein.' },
  ],
  plantProtein: [
    { brand: 'MuscleBlaze', name: 'BGreen Plant Protein', strength: 'Check protein a scoop', suits: ALL, note: 'Vegan pea and brown-rice blend.' },
    { brand: 'OZiva', name: 'Organic Plant Protein', strength: 'Check protein a scoop', suits: ALL, note: 'Vegan pea and brown-rice blend.' },
  ],
  electrolytes: [
    { brand: 'Fast&Up', name: 'Reload electrolyte effervescent tablets', strength: '1 tablet in 500 ml water', suits: ALL, note: 'Pick a low-sugar flavour.' },
  ],
};

/** Search links on two big Indian stores. Search, not product pages, so a link never goes stale when a listing changes. */
export function buyLinks(p: Product): { store: string; url: string }[] {
  const q = encodeURIComponent(`${p.brand} ${p.name}`);
  return [
    { store: 'Amazon.in', url: `https://www.amazon.in/s?k=${q}` },
    { store: 'Tata 1mg', url: `https://www.1mg.com/search/all?name=${q}` },
  ];
}

/** Products that suit the member's diet; vegetarians never see gelatin softgels or fish oil. */
export function productsFor(key: string, diet: Diet | null): Product[] {
  const list = PRODUCTS[key] ?? [];
  return diet ? list.filter((p) => p.suits.includes(diet)) : list;
}

// ---------- protocol ----------

export type Priority = 'core' | 'conditional' | 'optional' | 'not_recommended';
export type Category = 'Nutrient support' | 'Performance support' | 'Blood-work follow-up';
export const PRIORITY_LABEL: Record<Priority, string> = { core: 'Core', conditional: 'Conditional', optional: 'Optional', not_recommended: 'Not recommended' };

export interface ProtocolItem {
  id: string;
  supp: SuppId;
  name: string;
  priority: Priority;
  category: Category;
  why: string;
  dose: string;
  timing: string;
  frequency: string;
  review: string;
  howTo: string;
  safety: string[];
  /** A doctor or pharmacist must confirm before starting. */
  needsReview: boolean;
  /** What the member already takes that overlaps, if anything. */
  overlap: string | null;
  rule: string;
  basis: string[];
  products: Product[];
}
export interface Alert { level: 'stop' | 'review' | 'info'; title: string; detail: string }
export interface Protocol {
  items: ProtocolItem[];
  alerts: Alert[];
  /** Why no protocol was generated (age, pregnancy). */
  blocked: string | null;
  biomarkers: { read: number; used: number; date: ISODate | null; historical: boolean };
  rulesVersion: string;
  questionnaireVersion: string;
}

const ORDER: Priority[] = ['core', 'conditional', 'optional', 'not_recommended'];
const LOW: Freq[] = ['never', 'lt1'];
const SOME: Freq[] = ['never', 'lt1', '1_3'];
const daysBetween = (a: ISODate, b: ISODate) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
const label = <T extends string>(opts: { id: T; t: string }[], id: T | null | undefined) => opts.find((o) => o.id === id)?.t ?? '';

/** Build the protocol. Pure: same answers, lab and date give the same protocol. */
export function buildProtocol(a: SuppAnswers, lab: LabReport | null, today: ISODate): Protocol {
  const base = { rulesVersion: RULES_VERSION, questionnaireVersion: QUESTIONNAIRE_VERSION };
  const report = lab && a.bloodwork === 'report' ? lab : null;
  const historical = !!report && daysBetween(report.date, today) > RECENT_DAYS;
  const useLab = report && !historical ? report : null;
  const bio = { read: report?.markers.length ?? 0, used: 0, date: report?.date ?? null, historical };
  if (a.age != null && a.age < 18) return { ...base, items: [], alerts: [], blocked: 'Protocols are for adults 18 and over. Please talk to a doctor about supplements.', biomarkers: bio };
  if (a.flags.includes('pregnancy')) {
    return {
      ...base, items: [], biomarkers: bio,
      blocked: 'Pregnancy, breastfeeding and trying to conceive change what you need (folate, iron, iodine, vitamin D) and how much is safe. Your doctor should set these, so we haven’t generated an automated protocol.',
      alerts: [{ level: 'stop', title: 'See your doctor or gynaecologist', detail: 'Take this list of what you eat and any blood work to them. Don’t start new supplements before that.' }],
    };
  }

  const diet = a.diet ?? 'veg';
  const sex: Sex = a.sex === 'female' ? 'female' : 'male';
  const flag = (f: SafetyFlag) => a.flags.includes(f);
  const takes = (id: SuppId) => a.current.find((c) => c.id === id) ?? null;
  const f = (k: FoodKey): Freq => a.food[k] ?? 'never';
  const doctorDose = flag('liver') || flag('other');
  const items: ProtocolItem[] = [];
  const alerts: Alert[] = [];
  const marker = (id: string) => useLab?.markers.find((m) => m.id === id) ?? null;
  const used = new Set<string>();
  const labBasis = (id: string) => { const m = marker(id); const d = markerDef(id)!; used.add(id); return `${d.name} ${m!.value} ${d.unit} on ${useLab!.date}`; };

  const add = (it: Omit<ProtocolItem, 'id' | 'safety' | 'needsReview' | 'overlap'> & Partial<Pick<ProtocolItem, 'safety' | 'needsReview' | 'overlap'>>) => {
    items.push({ id: `${it.supp}-${it.rule}`, safety: [], needsReview: false, overlap: null, ...it });
  };
  const overlapFor = (id: SuppId) => {
    const c = takes(id);
    if (!c) return null;
    const what = [c.product.trim(), c.dose.trim(), c.freq.trim()].filter(Boolean).join(', ');
    return `You already take ${suppName(id).toLowerCase()}${what ? ` (${what})` : ''}. Don’t add a second product; compare your current dose with the one below.`;
  };
  const multiNote = takes('multi') ? 'Your multivitamin may already contain some; count it toward the total on the label.' : null;
  const sunText = `Sunlight: ${label(SUN_OPTIONS, a.sun).toLowerCase() || 'not answered'}`;

  // ---- Vitamin D ----
  const vd = marker('vitD');
  if (vd) {
    const v = vd.value; const b = [labBasis('vitD'), sunText];
    if (v < 20) add({ supp: 'vitD', name: 'Vitamin D3', priority: 'core', category: 'Blood-work follow-up', rule: 'VD-LAB-LOW', basis: b,
      why: `Your report shows 25-OH vitamin D at ${v} ng/mL, below 20. At this level doctors usually prescribe a short, higher-dose course before a daily dose.`,
      dose: 'Your doctor sets the treatment dose', timing: 'With your largest meal', frequency: 'As prescribed', review: 'Re-test after the course, usually 8–12 weeks',
      howTo: 'After the course, a daily maintenance dose (often 1,000–2,000 IU) keeps levels up. Ask your doctor which.', needsReview: true, products: [] });
    else if (v < 30) add({ supp: 'vitD', name: 'Vitamin D3', priority: 'core', category: 'Blood-work follow-up', rule: 'VD-LAB-INSUF', basis: b,
      why: `Your report shows 25-OH vitamin D at ${v} ng/mL, a little under the 30–100 range.`,
      dose: '2,000 IU (50 mcg) of D3', timing: 'With your largest meal (it needs fat to absorb)', frequency: 'Daily', review: 'Re-test 25-OH vitamin D after 12 weeks',
      howTo: 'Take it with lunch or dinner that has some ghee, oil, curd or nuts.', products: productsFor('vitD2000', a.diet) });
    else if (v > 100) {
      add({ supp: 'vitD', name: 'Vitamin D3', priority: 'not_recommended', category: 'Blood-work follow-up', rule: 'VD-LAB-HIGH', basis: b,
        why: `Your report shows 25-OH vitamin D at ${v} ng/mL, above the 30–100 range. Adding more could push it higher.`,
        dose: 'None', timing: '—', frequency: '—', review: 'Ask your doctor when to re-test', howTo: 'Stop any vitamin D product until your doctor says otherwise.', products: [] });
      alerts.push({ level: 'review', title: 'Vitamin D is above range', detail: 'Stop vitamin D supplements and show the report to a doctor.' });
    } else add({ supp: 'vitD', name: 'Vitamin D3', priority: 'not_recommended', category: 'Blood-work follow-up', rule: 'VD-LAB-OK', basis: b,
      why: `Your report shows 25-OH vitamin D at ${v} ng/mL, in range. No extra supplement needed.`,
      dose: takes('vitD') ? 'Keep your current dose' : 'None', timing: '—', frequency: '—', review: 'Re-test in 6–12 months, or sooner if your sun exposure drops',
      howTo: 'Keep your sun time and current routine.', products: [] });
  } else if (a.sun === 'lt10' || a.sun === '10_20') {
    add({ supp: 'vitD', name: 'Vitamin D3', priority: 'conditional', category: 'Nutrient support', rule: 'VD-SUN', basis: [sunText, 'No recent vitamin D test'],
      why: 'With little direct sun, your skin may make little vitamin D, and few Indian foods supply it. This isn’t a diagnosis: a 25-OH vitamin D test tells you for sure.',
      dose: '1,000 IU (25 mcg) of D3', timing: 'With your largest meal', frequency: 'Daily', review: 'Test 25-OH vitamin D within 3 months and redo this check with the result',
      howTo: 'Take it with a meal that has some fat. A low daily dose like this is a common, safe starting point.', products: productsFor('vitD1000', a.diet) });
  }

  // ---- Vitamin B12 ----
  const b12 = marker('b12');
  const b12Diet = diet === 'vegan' || (diet === 'veg' && SOME.includes(f('dairy'))) || (diet === 'egg' && SOME.includes(f('dairy')) && SOME.includes(f('eggs')));
  const dietText = `Diet: ${label(DIET_OPTIONS, a.diet).toLowerCase()}${a.diet !== 'vegan' ? `, dairy ${label(FREQ_OPTIONS, a.food.dairy).toLowerCase()}` : ''}`;
  if (b12) {
    const v = b12.value; const b = [labBasis('b12'), dietText];
    if (v < 150) add({ supp: 'b12', name: 'Vitamin B12', priority: 'core', category: 'Blood-work follow-up', rule: 'B12-LAB-VLOW', basis: b,
      why: `Your report shows B12 at ${v} pg/mL, well under range. This needs a doctor: some people need injections rather than tablets.`,
      dose: 'Your doctor sets the dose', timing: 'As prescribed', frequency: 'As prescribed', review: 'Re-test after 8–12 weeks of treatment', howTo: 'Show your report to a doctor this month.', needsReview: true, products: [] });
    else if (v < 200) add({ supp: 'b12', name: 'Vitamin B12 (methylcobalamin)', priority: 'core', category: 'Blood-work follow-up', rule: 'B12-LAB-LOW', basis: b,
      why: `Your report shows B12 at ${v} pg/mL, just under the 200–900 range.`,
      dose: '1,000–1,500 mcg', timing: 'Morning, on an empty stomach or with breakfast', frequency: 'Daily', review: 'Re-test B12 after 12 weeks',
      howTo: 'Let a lozenge dissolve under the tongue, or swallow the tablet with water.', products: productsFor('b12', a.diet) });
    else if (b12Diet) add({ supp: 'b12', name: 'Vitamin B12 (methylcobalamin)', priority: 'optional', category: 'Nutrient support', rule: 'B12-LAB-OK-DIET', basis: b,
      why: `Your B12 is in range (${v} pg/mL), but your diet has few B12 sources, so a small maintenance dose helps keep it there.`,
      dose: '1,000–1,500 mcg', timing: 'Morning', frequency: '2–3 days a week', review: 'Re-test B12 once a year', howTo: 'Let a lozenge dissolve under the tongue, or swallow the tablet with water.', products: productsFor('b12', a.diet) });
  } else if (b12Diet) {
    add({ supp: 'b12', name: 'Vitamin B12 (methylcobalamin)', priority: 'conditional', category: 'Nutrient support', rule: diet === 'vegan' ? 'B12-DIET-VEGAN' : 'B12-DIET-LOW', basis: [dietText, 'No recent B12 test'],
      why: diet === 'vegan'
        ? 'B12 comes almost only from animal foods, so vegans need a reliable source: fortified foods or a supplement. A blood test confirms your level.'
        : 'Your diet has few B12 sources (dairy and eggs only some days), so your intake may be low. A blood test confirms your level.',
      dose: '1,000–1,500 mcg', timing: 'Morning', frequency: '3 days a week', review: 'Test B12 within 3 months and redo this check with the result',
      howTo: 'Let a lozenge dissolve under the tongue, or swallow the tablet with water.', products: productsFor('b12', a.diet) });
  }

  // ---- Iron (blood work only) ----
  const fer = marker('ferritin'), hb = marker('hb');
  const ferLow = fer && statusOf(markerDef('ferritin')!, fer.value, sex) === 'low';
  const hbLow = hb && statusOf(markerDef('hb')!, hb.value, sex) === 'low';
  if (ferLow || hbLow) {
    const b = [fer ? labBasis('ferritin') : null, hb ? labBasis('hb') : null].filter(Boolean) as string[];
    add({ supp: 'iron', name: 'Iron', priority: 'core', category: 'Blood-work follow-up', rule: 'FE-LAB-LOW', basis: b,
      why: `Your report shows ${[ferLow ? `ferritin at ${fer!.value} ng/mL` : null, hbLow ? `haemoglobin at ${hb!.value} g/dL` : null].filter(Boolean).join(' and ')}, below range. Low iron has several causes, and too much iron is harmful, so a doctor should pick the dose.`,
      dose: 'Your doctor sets the dose', timing: 'Usually morning, away from tea, coffee and calcium', frequency: 'As prescribed', review: 'Re-test ferritin and haemoglobin after 8–12 weeks',
      howTo: 'Take it with lemon water or amla (vitamin C helps absorption). Keep tea and coffee an hour away.', needsReview: true, products: [] });
  } else if (!useLab && (sex === 'female' || ((diet === 'veg' || diet === 'vegan') && LOW.includes(f('legumes'))))) {
    add({ supp: 'iron', name: 'Iron', priority: 'not_recommended', category: 'Blood-work follow-up', rule: 'FE-NO-LAB', basis: [a.sex === 'female' ? 'Sex: female' : dietText, `Legumes: ${label(FREQ_OPTIONS, a.food.legumes).toLowerCase()}`, 'No recent ferritin test'],
      why: 'Iron needs can be higher for you, but iron isn’t safe to take on a guess. Ask for ferritin and haemoglobin in your next blood test.',
      dose: 'None until tested', timing: '—', frequency: '—', review: 'Add ferritin and haemoglobin to your next blood test',
      howTo: 'Meanwhile: rajma, chana, moong, palak or methi most days, with lemon or amla.', products: [] });
  }

  // ---- Omega-3 ----
  const fishLow = diet !== 'nonveg' || SOME.includes(f('fish'));
  if (fishLow) {
    const algae = diet !== 'nonveg';
    add({ supp: 'omega3', name: algae ? 'Omega-3 (algal oil, EPA + DHA)' : 'Omega-3 (fish oil, EPA + DHA)', priority: diet === 'nonveg' && f('fish') === '1_3' ? 'optional' : 'conditional',
      category: 'Nutrient support', rule: algae ? 'O3-NOFISH' : 'O3-LOWFISH', basis: [diet === 'nonveg' ? `Fish: ${label(FREQ_OPTIONS, a.food.fish).toLowerCase()}` : dietText],
      why: algae ? 'You don’t eat fish, the main source of the omega-3s EPA and DHA. Algal oil is the vegetarian source fish get theirs from.' : 'You eat fish less than twice a week, so your EPA and DHA intake may be low.',
      dose: '250–500 mg EPA + DHA combined (usually 1–2 capsules; check the label)', timing: 'With a meal', frequency: 'Daily', review: 'Review in 3 months; stop if you start eating oily fish twice a week',
      howTo: 'Take it with food to avoid burps. Keep the bottle away from heat.', products: productsFor(algae ? 'algalOil' : 'fishOil', a.diet),
      safety: flag('surgery') ? ['Stop 1–2 weeks before your surgery unless your surgeon says otherwise.'] : [] });
  }

  // ---- Creatine ----
  const lifts = (a.exercise === '3_4' || a.exercise === '5_7') && (a.exerciseType === 'strength' || a.exerciseType === 'mixed' || a.exerciseType === 'sport');
  const exText = `Exercise: ${label(EX_OPTIONS, a.exercise).toLowerCase()}${a.exerciseType ? `, ${label(EX_TYPES, a.exerciseType).toLowerCase()}` : ''}`;
  if (lifts) {
    if (flag('kidney')) add({ supp: 'creatine', name: 'Creatine monohydrate', priority: 'not_recommended', category: 'Performance support', rule: 'CR-KIDNEY', basis: [exText, 'Kidney condition'],
      why: 'Creatine helps strength training, but with a kidney condition it isn’t safe to start without your nephrologist.', dose: 'None', timing: '—', frequency: '—', review: 'Ask your doctor', howTo: '—', products: [] });
    else add({ supp: 'creatine', name: 'Creatine monohydrate', priority: 'optional', category: 'Performance support', rule: 'CR-STRENGTH', basis: [exText],
      why: 'You train hard 3+ days a week. Creatine is the best-studied supplement for strength and power gains; it’s optional, not essential.',
      dose: `${(a.weightKg ?? 70) >= 70 ? 5 : 3} g of creatine monohydrate`, timing: 'Any time of day; with a meal is easiest', frequency: 'Daily, including rest days', review: 'Review after 8 weeks against your lift numbers',
      howTo: 'Mix in water, milk or your shake. No loading phase needed. Drink water through the day; a 1–2 kg weight gain in the first weeks is water in muscle, not fat.', products: productsFor('creatine', a.diet) });
  }

  // ---- Protein powder ----
  const trains = a.exercise === '3_4' || a.exercise === '5_7';
  const fewSources = (diet === 'vegan' || diet === 'veg') ? SOME.includes(f('dairy')) || SOME.includes(f('legumes'))
    : SOME.includes(f('dairy')) && SOME.includes(f('eggs')) && (diet === 'egg' || SOME.includes(f('meat')));
  if (trains && fewSources) {
    const target = Math.round((a.weightKg ?? 70) * (lifts ? 1.6 : 1.2));
    if (flag('kidney')) add({ supp: 'protein', name: 'Protein powder', priority: 'not_recommended', category: 'Performance support', rule: 'PRO-KIDNEY', basis: [exText, 'Kidney condition'],
      why: 'With a kidney condition, your protein target should come from your doctor or dietitian.', dose: 'None', timing: '—', frequency: '—', review: 'Ask your doctor', howTo: '—', products: [] });
    else add({ supp: 'protein', name: diet === 'vegan' ? 'Plant protein powder' : 'Whey protein', priority: 'optional', category: 'Performance support', rule: 'PRO-GAP', basis: [exText, dietText],
      why: `For your training, about ${target} g of protein a day helps (${lifts ? 1.6 : 1.2} g per kg). Your food pattern has few protein-dense foods, so a scoop on short days closes the gap. Food first: dal, paneer, curd, soya${diet === 'nonveg' || diet === 'egg' ? ', eggs' : ''}.`,
      dose: '1 scoop (about 25 g protein)', timing: 'After training or with breakfast', frequency: 'Only on days your food log is short of protein', review: 'Check your protein in PeakX Insights after 2 weeks',
      howTo: 'Mix with water or milk. Your PeakX log shows how much protein is left each day.', products: productsFor(diet === 'vegan' ? 'plantProtein' : 'whey', a.diet),
      safety: flag('diabetes') ? ['Pick an unflavoured or unsweetened version; flavoured powders can add sugar.'] : [] });
  }

  // ---- Electrolytes ----
  if (a.exercise === '5_7' && (a.exerciseType === 'cardio' || a.exerciseType === 'sport')) {
    if (flag('kidney')) { /* covered by the kidney alert; no item */ } else add({ supp: 'electrolytes', name: 'Electrolytes', priority: 'optional', category: 'Performance support', rule: 'EL-ENDURANCE', basis: [exText],
      why: 'You train 5+ days a week at endurance or sport. In Indian heat, long sessions lose salt as well as water.',
      dose: '1 tablet in 500 ml water', timing: 'During sessions over 60 minutes, or in heat', frequency: 'Training days only', review: 'Review in summer and winter',
      howTo: 'For shorter sessions, water is enough. Nimbu pani with a pinch of salt works too.', products: productsFor('electrolytes', a.diet),
      needsReview: flag('bp'), safety: flag('bp') ? ['These contain sodium. With a blood pressure condition, check with your doctor first.'] : [] });
  }

  // ---- Calcium (food first) ----
  if (LOW.includes(f('dairy'))) {
    add({ supp: 'calcium', name: 'Calcium', priority: 'optional', category: 'Nutrient support', rule: 'CA-FOOD', basis: [`Dairy: ${label(FREQ_OPTIONS, a.food.dairy).toLowerCase()}`],
      why: 'You rarely have dairy, the easiest calcium source. Food is better than pills for calcium.',
      dose: 'Food first: 2–3 servings a day', timing: 'Spread across meals', frequency: 'Daily', review: 'Ask your doctor before a calcium tablet',
      howTo: `Ragi, til, ${diet === 'vegan' ? 'tofu, calcium-fortified soy milk' : 'curd, paneer'}, rajma and green leafy vegetables.`, products: [] });
  }

  // ---- what they already take, but we don't recommend ----
  if (takes('iron') && !(ferLow || hbLow)) alerts.push({ level: 'review', title: 'You take iron without a low iron result', detail: useLab ? 'Your ferritin and haemoglobin are in range. Ask your doctor whether to continue.' : 'Ask for ferritin and haemoglobin in your next test before continuing.' });
  for (const c of a.current) {
    if (['zinc', 'magnesium', 'probiotic', 'other'].includes(c.id)) alerts.push({ level: 'info', title: `${suppName(c.id)}: not part of this protocol`, detail: 'We don’t have a rule for it yet. Keep taking it only if a doctor or coach suggested it.' });
  }

  // ---- overlap and medical flags on every item ----
  for (const it of items) {
    it.overlap = overlapFor(it.supp);
    if ((it.supp === 'vitD' || it.supp === 'b12') && multiNote) it.safety.push(multiNote);
    if (flag('thyroid') && (it.supp === 'iron' || it.supp === 'calcium' || it.supp === 'protein')) it.safety.push('Keep it 4 hours away from your thyroid medicine.');
    if (flag('diabetes') && it.supp === 'b12') it.safety.push('Metformin can lower B12 over time; ask your doctor to include it in your tests.');
    if (flag('kidney') && (it.supp === 'vitD' || it.supp === 'calcium')) { it.needsReview = true; it.safety.push('With a kidney condition, your doctor should confirm this first.'); }
    if (flag('bleeding') && it.supp === 'omega3') { it.needsReview = true; it.dose = 'Ask your doctor first'; it.safety.push('Omega-3 can add to the effect of blood thinners.'); it.products = []; }
    if (doctorDose && it.priority !== 'not_recommended') { it.needsReview = true; it.dose = 'Ask your doctor for the dose'; }
    if (a.meds && it.priority !== 'not_recommended' && !it.safety.some((s) => /pharmacist/.test(s))) it.safety.push('You take regular medicines: show this to your pharmacist to check interactions before starting.');
  }

  if (flag('kidney')) alerts.push({ level: 'review', title: 'Kidney condition', detail: 'We’ve left out creatine, protein powder and electrolytes. Check any supplement with your nephrologist first.' });
  if (doctorDose) alerts.push({ level: 'review', title: flag('liver') ? 'Liver condition' : 'Other medical condition', detail: 'Doses are withheld. Take this protocol to your doctor; they’ll set what’s safe for you.' });
  if (flag('bleeding')) alerts.push({ level: 'review', title: 'Bleeding disorder or blood thinners', detail: 'Omega-3 and some herbal products affect clotting. Your doctor should approve any supplement.' });
  if (flag('surgery')) alerts.push({ level: 'review', title: 'Surgery coming up', detail: 'Tell your surgeon every supplement you take. Most are paused 1–2 weeks before.' });
  if (a.meds) alerts.push({ level: 'review', title: 'You take regular medicines', detail: `Ask your pharmacist or doctor to check this protocol against ${a.medNames.trim() ? a.medNames.trim() : 'your medicines'} before you start anything new.` });
  if (flag('thyroid')) alerts.push({ level: 'info', title: 'Thyroid medicine', detail: 'Take it on an empty stomach, and keep iron, calcium and protein shakes at least 4 hours away.' });
  if (flag('bp') && !items.some((i) => i.supp === 'electrolytes')) alerts.push({ level: 'info', title: 'Blood pressure', detail: 'Avoid electrolyte and “energy” drinks with added sodium unless your doctor agrees.' });
  if (historical) alerts.push({ level: 'info', title: 'Your blood work is over 6 months old', detail: 'We’ve kept it as history but haven’t used the values. Re-test and add the new report.' });

  items.sort((x, y) => ORDER.indexOf(x.priority) - ORDER.indexOf(y.priority));
  return { ...base, items, alerts, blocked: null, biomarkers: { ...bio, used: used.size } };
}

/** What the free preview may show: counts and categories, never names, doses or timing. */
export function previewOf(p: Protocol): { count: number; categories: { name: Category; count: number }[]; alerts: Alert[] } {
  const live = p.items.filter((i) => i.priority !== 'not_recommended');
  const cats: Category[] = ['Nutrient support', 'Performance support', 'Blood-work follow-up'];
  return {
    count: live.length,
    categories: cats.map((name) => ({ name, count: live.filter((i) => i.category === name).length })).filter((c) => c.count),
    alerts: p.alerts.filter((x) => x.level !== 'info'),
  };
}

/** Plain-text protocol to share with a doctor or pharmacist. */
export function protocolText(p: Protocol, name: string, date: ISODate): string {
  const lines = [`Supplement protocol for ${name || 'PeakX member'}, ${date}`, `Rules ${p.rulesVersion} · questionnaire ${p.questionnaireVersion}`, ''];
  for (const i of p.items) {
    lines.push(`• ${i.name} — ${PRIORITY_LABEL[i.priority]}`);
    if (i.priority !== 'not_recommended') lines.push(`  Dose: ${i.dose}; ${i.frequency.toLowerCase()}; ${i.timing.toLowerCase()}`);
    lines.push(`  Why: ${i.why}`);
    if (i.needsReview) lines.push('  Needs doctor or pharmacist review before starting.');
    lines.push(`  Rule ${i.rule}, from: ${i.basis.join('; ')}`);
  }
  if (p.alerts.length) { lines.push('', 'Safety notes:'); p.alerts.forEach((x) => lines.push(`• ${x.title}: ${x.detail}`)); }
  lines.push('', 'General guidance from PeakX, not a diagnosis or prescription. Please confirm with your doctor.');
  return lines.join('\n');
}
