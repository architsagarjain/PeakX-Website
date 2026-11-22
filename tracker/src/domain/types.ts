/** PeakX domain model. Every screen reads these shapes from the store (src/state/store.tsx). */

export type Plan = 'free' | 'pro' | 'coached';
export type Goal = 'lose' | 'gain' | 'recomp' | 'plateau';
export type Diet = 'veg' | 'egg' | 'nonveg' | 'vegan';
export type Sex = 'male' | 'female';
export type MealSlot = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
export type ISODate = string; // 'YYYY-MM-DD'
/** How someone trains: lifting in a gym, running only, or both. */
export type TrainingStyle = 'gym' | 'run' | 'both';

export interface Macros { kcal: number; protein: number; carbs: number; fat: number }

export interface Profile {
  name: string;
  city: string;
  age: number;
  sex: Sex;
  heightCm: number;
  goal: Goal;
  stuckLift?: string;
  stuckWeeks?: number;
  diet: Diet;
  mealSources: string[];
  voiceLanguages: string[];
  trainingDays: number;     // sessions per week
  gymTime: string;          // '19:00'
  activity: 'sedentary' | 'light' | 'moderate' | 'active';
  /** Missing on older profiles: treat as 'gym'. */
  trainingStyle?: TrainingStyle;
  /** Weekdays (0 = Monday … 6 = Sunday) when a non-veg or egg eater keeps to vegetarian food. */
  vegDays?: number[];
}

export interface Targets { kcalTraining: number; kcalRest: number; protein: number; carbs: number; fat: number; steps: number; sleepHours: number }

export interface Food { id: string; name: string; aliases: string[]; per100g: Macros; portions: { label: string; grams: number }[] }

export interface Ingredient { name: string; grams: number; macros: Macros }
export interface Recipe {
  id: string;
  name: string;
  diet: Diet;
  minutes: number;
  servings: number;
  tags: string[];          // 'high-protein' | 'under-500' | 'under-20-min' | 'mess-friendly'
  ingredients: Ingredient[];
  steps: string[];
}

export interface MealItem {
  id: string;
  name: string;
  amount: string;          // '2 medium', '1 katori · 150 g'
  macros: Macros;
  source: 'voice' | 'typed' | 'recipe' | 'photo';
  recipeId?: string;
  estimated?: boolean;
  /** Where the item came from in the food table, so it can be edited by portion later. */
  ref?: { kind: 'ingredient' | 'dish' | 'recipe'; id: string; portion: string; qty: number };
}
export interface Meal { id: string; date: ISODate; slot: MealSlot; time: string; items: MealItem[] }

export interface SetEntry { reps: number; kg: number }
export interface ExerciseLog { name: string; target: string; restSec: number; sets: SetEntry[]; targetKg?: number; note?: string }
export interface WorkoutSession { id: string; date: ISODate; name: string; time: string; exercises: ExerciseLog[]; done: boolean; startedAt?: string }

/** A run logged by hand (S11.3). Duration in seconds. */
export type RunKind = 'easy' | 'tempo' | 'long' | 'intervals' | 'race';
export interface RunLog { id: string; date: ISODate; km: number; seconds: number; kind: RunKind; avgHr?: number; note?: string }

export interface WeightEntry { date: ISODate; kg: number }

export interface WearableActivity { id: string; name: string; type: string; minutes: number; km: number | null; avgHr: number | null; kcal: number | null; source: 'fitbit' | 'strava' }
export interface WearableDay { date: ISODate; steps: number; sleepHours: number; restingHr: number; activeMinutes: number; kcalBurned: number; source: 'fitbit' | 'strava' | 'demo'; activities?: WearableActivity[] }

export type ChangeStatus = 'pending' | 'accepted' | 'skipped';
/** What accepting a change does (S17.1). */
export type ChangeAction =
  | { kind: 'kcal'; delta: number }                 // training-day calories
  | { kind: 'protein'; delta: number }
  | { kind: 'sets'; exercise: string; delta: number }
  | { kind: 'windDown'; time: string }              // reminder the night before training
  | { kind: 'steps'; target: number };
export interface PlanChange { id: string; title: string; detail: string; status: ChangeStatus; action?: ChangeAction }
export type ReportStatus = 'draft' | 'approved' | 'published';
export interface WeeklyReport {
  id: string; weekStart: ISODate; headline: string; causes: { title: string; detail: string; tag: string }[]; changes: PlanChange[]; free: boolean;
  status?: ReportStatus; builtAt?: string; approvedBy?: string; publishedAt?: string; stats?: Record<string, number>;
}

/** Meal plan (S14.1): servings of library recipes or food-table dishes per slot. */
export interface PlannedItem { kind: 'recipe' | 'dish' | 'ingredient'; id: string; servings: number; addOn?: boolean }
export interface PlannedMeal { slot: MealSlot; name: string; items: PlannedItem[]; logged?: boolean }
export interface MealPlanDay { date: ISODate; meals: PlannedMeal[] }
export interface MealPlan { weekStart: ISODate; days: MealPlanDay[]; createdAt: string; /** Diet and veg days the plan was built for; a change rebuilds it. */ dietKey?: string }

/** AI Coach (S19.1). */
export interface CoachOption { name: string; amount: string; macros: Macros; ref?: MealItem['ref'] }
export interface CoachMessage { id: string; role: 'user' | 'coach'; text: string; at: string; options?: CoachOption[]; source?: 'ai' | 'rules' }

/** Plateau check progress. Saved as the user answers, so a closed tab resumes where it stopped. */
export interface PlateauState {
  answers: Record<string, string>;   // question id → option id (see domain/plateau.ts)
  step: number;                      // 0–7 = question, 8 = result
  completedOn?: ISODate;
  email?: string;                    // "Email it to me" capture; sending starts in R2
}

/** Onboarding progress. `draft` uses the OnboardingDraft shape from domain/onboarding.ts. */
export interface OnboardingState {
  step: string;                      // last step the user was on
  done: boolean;
  draft: import('./onboarding.js').OnboardingDraft;
}

export interface AppData {
  version: number;
  plateau: PlateauState;
  onboarding: OnboardingState;
  plan: Plan;
  foundingMember: boolean;
  firstReportUsed: boolean;
  profile: Profile;
  targets: Targets;
  meals: Meal[];
  workouts: WorkoutSession[];
  weights: WeightEntry[];
  wearable: WearableDay[];
  reports: WeeklyReport[];
  savedRecipes: string[];
  devices: { google: boolean; strava: boolean };
  /** Pro sport program (S15.2); null when the user hasn't started one. */
  sport: import('./sport.js').SportState | null;
  /** v4 (R3) */
  mealPlan: MealPlan | null;
  coach: { messages: CoachMessage[]; usage: { date: ISODate; count: number } };
  unmatchedFoods: { name: string; count: number; last: ISODate }[];
  trainingOverrides: Record<string, number>;   // extra sets per exercise, from accepted report changes
  reminders: { windDown: string | null; retest?: ISODate | null };
  /** v5 (R4–R5) */
  billing: Billing | null;
  formChecks: FormCheck[];
  fixPlans: FixPlan[];
  labs: LabReport[];
  coachRequest: { at: string; status: 'requested' | 'assigned' } | null;
  /** v6: supplement assessment and protocol (S18.3). */
  supplements: import('./supplements.js').SupplementState;
  /** v7: runs logged by hand (S11.3). */
  runs: RunLog[];
  /** True for the Arjun demo account. Demo data is never uploaded to a real account. */
  demo?: boolean;
}

/** What PeakX reads from wearables (S21.1). */
export interface DeviceRead { steps: boolean; sleep: boolean; heartRate: boolean; workouts: boolean }

// ---------- R4 payments ----------
export type BillingKind = 'founding' | 'monthly' | 'yearly' | 'coached';
export type BillingStatus = 'active' | 'cancelling' | 'ended' | 'refunded' | 'halted';
export interface Payment { id: string; at: string; amount: number; kind: BillingKind; status: 'paid' | 'refunded' }
export interface AssignedCoach { uid: string; name: string; whatsapp: string | null; bookingUrl: string | null; since: string }
/** Written only by the server (users/{uid}/private/billing); the app reads it. Amounts in rupees. */
export interface Billing {
  plan: Exclude<Plan, 'free'>;
  kind: BillingKind;
  status: BillingStatus;
  subscriptionId: string | null;
  startedAt: string;          // first payment
  accessFrom: string;         // when the first paid period counts from
  paidThrough: string;        // access runs until here
  paidThroughMs: number;      // same, for security rules
  renewsAt: string | null;    // next charge; null once cancelled
  payments: Payment[];
  refund: { at: string; reason: string; amount: number; status: 'processed' | 'failed' } | null;
  coach: AssignedCoach | null;
  manual?: boolean;           // activated by a coach (paid outside the app)
}

// ---------- R5 Form Check ----------
export interface FormFinding { title: string; detail: string; value: string; ok: boolean }
export interface Drill { name: string; sets: number; reps: string; note: string }
export interface FormReview {
  coach: string; at: string; score: number; summary: string;
  findings: FormFinding[];
  cue: { text: string; detail: string } | null;
  drills: Drill[];
  loadChangeKg: number;       // e.g. −5 until the re-check
  recheckWeeks: number;
}
export interface FormCheck {
  id: string; exercise: string; kg: number; reps: number; note: string;
  submittedAt: string; fileName: string; sizeMB: number; durationSec: number | null; videoPath?: string;
  status: 'uploading' | 'queued' | 'in_review' | 'reviewed' | 'failed';
  review: FormReview | null;
}
/** Drills and a load change added to training from a Form Check, until the re-check date. */
export interface FixPlan { id: string; lift: string; drills: Drill[]; loadChangeKg: number; from: ISODate; until: ISODate; source: string }

// ---------- R5 blood work ----------
export interface LabMarker { id: string; value: number; unit: string }
export interface LabReport {
  id: string; date: ISODate; fileName: string | null; source: 'ai' | 'manual';
  markers: LabMarker[];
  coachCheck: { by: string; at: string; note: string } | null;
  sentForCheck: boolean;
  retestOn: ISODate;
}
