import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { trackAction } from './telemetry';
import type { AppData, ChangeStatus, ISODate, MealItem, MealPlan, MealSlot, Plan, RunLog, SetEntry, WeeklyReport, WorkoutSession, CoachMessage, Billing, FormCheck, FixPlan, LabReport, WearableDay } from '../domain/types';
import { mergeWearable } from '../domain/wearables';
import { planFrom } from '../domain/billing';
import { mergeResults, type QueueItem } from '../domain/queue';
import { applyChange } from '../domain/report';
import { LocalRepository, type Repository } from './repository';
import { canUse, type Feature } from './entitlements';
import { PLATEAU_QUESTIONS, isComplete } from '../domain/plateau';
import { applyPlateau, firstInvalidStep, profileFromDraft, type OnboardingDraft, type OnboardingStep } from '../domain/onboarding';
import { emptyPlateau } from '../domain/seed';
import { targetsFor } from '../domain/nutrition';
import type { Match, SportId } from '../domain/sport';
import { emptySupplements, firstInvalidSuppStep, QUESTIONNAIRE_VERSION, RESULT_STEP, RULES_VERSION, type SuppAnswers } from '../domain/supplements';

export type Action =
  | { type: 'logItems'; date: ISODate; slot: MealSlot; time: string; items: MealItem[] }
  | { type: 'removeItem'; mealId: string; itemId: string }
  | { type: 'editItem'; mealId: string; itemId: string; item: MealItem; slot: MealSlot }
  | { type: 'logWeight'; date: ISODate; kg: number }
  | { type: 'logSet'; sessionId: string; exercise: number; set: SetEntry }
  | { type: 'startSession'; session: WorkoutSession }
  | { type: 'removeSet'; sessionId: string; exercise: number; index: number }
  | { type: 'finishSession'; sessionId: string }
  | { type: 'setChange'; reportId: string; changeId: string; status: ChangeStatus }
  | { type: 'toggleSaved'; recipeId: string }
  | { type: 'setPlan'; plan: Plan }
  | { type: 'plateauAnswer'; question: string; option: string }
  | { type: 'plateauGo'; step: number }
  | { type: 'plateauComplete'; date: ISODate }
  | { type: 'plateauEmail'; email: string }
  | { type: 'plateauReset' }
  | { type: 'onboardingSet'; patch: Partial<OnboardingDraft> }
  | { type: 'onboardingStep'; step: OnboardingStep }
  | { type: 'onboardingFinish'; date: ISODate }
  | { type: 'setSport'; sport: SportId; start: ISODate }
  | { type: 'addMatch'; match: Match }
  | { type: 'removeMatch'; id: string }
  | { type: 'noteUnmatched'; names: string[]; date: ISODate }
  | { type: 'setMealPlan'; plan: MealPlan | null }
  | { type: 'setVegDays'; days: number[]; plan?: MealPlan | null }
  | { type: 'logRun'; run: RunLog }
  | { type: 'removeRun'; id: string }
  | { type: 'upsertReport'; report: WeeklyReport }
  | { type: 'coachSend'; message: CoachMessage; date: ISODate }
  | { type: 'coachReply'; message: CoachMessage }
  | { type: 'coachClear' }
  | { type: 'useFreeReport' }
  | { type: 'markPlannedLogged'; date: ISODate; slot: MealSlot }
  | { type: 'setBilling'; billing: Billing | null; nowMs: number }
  | { type: 'mergeQueue'; items: QueueItem[] }
  | { type: 'addFormCheck'; check: FormCheck }
  | { type: 'updateFormCheck'; id: string; patch: Partial<FormCheck> }
  | { type: 'removeFormCheck'; id: string }
  | { type: 'addFixPlan'; plan: FixPlan }
  | { type: 'removeFixPlan'; id: string }
  | { type: 'saveLab'; lab: LabReport }
  | { type: 'removeLab'; id: string }
  | { type: 'setRetest'; date: ISODate | null }
  | { type: 'requestCoach'; at: string }
  | { type: 'setWearable'; days: WearableDay[]; devices: { google: boolean; strava: boolean } }
  | { type: 'suppSet'; patch: Partial<SuppAnswers> }
  | { type: 'suppGo'; step: number }
  | { type: 'suppComplete'; date: ISODate; consentAt: string }
  | { type: 'suppReset' }
  | { type: 'replace'; data: AppData };

export const SLOT_TIME: Record<MealSlot, string> = { breakfast: '08:30', lunch: '13:30', snacks: '16:30', dinner: '20:30' };

let n = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${++n}`;

export function reducer(s: AppData, a: Action): AppData {
  switch (a.type) {
    case 'logItems': {
      const existing = s.meals.find((m) => m.date === a.date && m.slot === a.slot);
      if (existing) return { ...s, meals: s.meals.map((m) => (m === existing ? { ...m, items: [...m.items, ...a.items] } : m)) };
      return { ...s, meals: [...s.meals, { id: newId('meal'), date: a.date, slot: a.slot, time: a.time, items: a.items }] };
    }
    case 'removeItem':
      return { ...s, meals: s.meals.map((m) => (m.id === a.mealId ? { ...m, items: m.items.filter((i) => i.id !== a.itemId) } : m)).filter((m) => m.items.length > 0) };
    case 'editItem': {
      const meal = s.meals.find((x) => x.id === a.mealId);
      if (!meal || !meal.items.some((i) => i.id === a.itemId)) return s;
      if (meal.slot === a.slot) {
        return { ...s, meals: s.meals.map((x) => (x !== meal ? x : { ...x, items: x.items.map((i) => (i.id === a.itemId ? { ...a.item, id: a.itemId } : i)) })) };
      }
      const without = reducer(s, { type: 'removeItem', mealId: a.mealId, itemId: a.itemId });
      return reducer(without, { type: 'logItems', date: meal.date, slot: a.slot, time: SLOT_TIME[a.slot], items: [{ ...a.item, id: a.itemId }] });
    }
    case 'logWeight': {
      const rest = s.weights.filter((w) => w.date !== a.date);
      return { ...s, weights: [...rest, { date: a.date, kg: a.kg }].sort((x, y) => x.date.localeCompare(y.date)) };
    }
    case 'logSet':
      return { ...s, workouts: s.workouts.map((w) => (w.id !== a.sessionId ? w : { ...w, exercises: w.exercises.map((e, i) => (i === a.exercise ? { ...e, sets: [...e.sets, a.set] } : e)) })) };
    case 'startSession':
      if (s.workouts.some((w) => w.date === a.session.date)) return s;
      return { ...s, workouts: [...s.workouts, a.session].sort((x, y) => x.date.localeCompare(y.date)) };
    case 'removeSet':
      return { ...s, workouts: s.workouts.map((w) => (w.id !== a.sessionId ? w : { ...w, exercises: w.exercises.map((e, i) => (i === a.exercise ? { ...e, sets: e.sets.filter((_, k) => k !== a.index) } : e)) })) };
    case 'finishSession':
      return { ...s, workouts: s.workouts.map((w) => (w.id === a.sessionId ? { ...w, done: true } : w)) };
    case 'setChange': {
      const rep = s.reports.find((r) => r.id === a.reportId);
      const ch = rep?.changes.find((c) => c.id === a.changeId);
      if (!rep || !ch || ch.status === a.status) return s;
      // Accepting applies the change; leaving 'accepted' undoes it.
      let next = s;
      if (a.status === 'accepted') next = applyChange(next, ch.action, 1);
      else if (ch.status === 'accepted') next = applyChange(next, ch.action, -1);
      return { ...next, reports: next.reports.map((r) => (r.id !== a.reportId ? r : { ...r, changes: r.changes.map((c) => (c.id === a.changeId ? { ...c, status: a.status } : c)) })) };
    }
    case 'upsertReport': {
      const others = s.reports.filter((r) => r.weekStart !== a.report.weekStart);
      return { ...s, reports: [...others, a.report].sort((x, y) => y.weekStart.localeCompare(x.weekStart)) };
    }
    case 'coachSend': {
      const usage = s.coach.usage.date === a.date ? { date: a.date, count: s.coach.usage.count + 1 } : { date: a.date, count: 1 };
      return { ...s, coach: { messages: [...s.coach.messages, a.message].slice(-100), usage } };
    }
    case 'coachReply':
      return { ...s, coach: { ...s.coach, messages: [...s.coach.messages, a.message].slice(-100) } };
    case 'coachClear':
      return { ...s, coach: { ...s.coach, messages: [] } };
    case 'useFreeReport':
      return s.firstReportUsed ? s : { ...s, firstReportUsed: true };
    case 'toggleSaved':
      return { ...s, savedRecipes: s.savedRecipes.includes(a.recipeId) ? s.savedRecipes.filter((x) => x !== a.recipeId) : [...s.savedRecipes, a.recipeId] };
    case 'setPlan':
      return { ...s, plan: a.plan };
    case 'setBilling':
      // Server billing decides the plan once it exists; no billing keeps the current plan.
      return a.billing ? { ...s, billing: a.billing, plan: planFrom(a.billing, a.nowMs), foundingMember: s.foundingMember || a.billing.payments.some((p) => p.kind === 'founding') } : { ...s, billing: null };
    case 'mergeQueue':
      return mergeResults(s, a.items);
    case 'addFormCheck':
      return { ...s, formChecks: [a.check, ...s.formChecks.filter((f) => f.id !== a.check.id)] };
    case 'updateFormCheck':
      return { ...s, formChecks: s.formChecks.map((f) => (f.id === a.id ? { ...f, ...a.patch } : f)) };
    case 'removeFormCheck':
      return { ...s, formChecks: s.formChecks.filter((f) => f.id !== a.id) };
    case 'addFixPlan':
      return { ...s, fixPlans: [...s.fixPlans.filter((f) => f.lift !== a.plan.lift), a.plan] };
    case 'removeFixPlan':
      return { ...s, fixPlans: s.fixPlans.filter((f) => f.id !== a.id) };
    case 'saveLab':
      return { ...s, labs: [a.lab, ...s.labs.filter((l) => l.id !== a.lab.id)].sort((x, y) => y.date.localeCompare(x.date)), reminders: { ...s.reminders, retest: a.lab.retestOn } };
    case 'removeLab':
      return { ...s, labs: s.labs.filter((l) => l.id !== a.id) };
    case 'setRetest':
      return { ...s, reminders: { ...s.reminders, retest: a.date } };
    case 'setWearable':
      // Real synced days replace demo data; with nothing connected, synced data is cleared.
      return { ...s, devices: a.devices, wearable: a.devices.google || a.devices.strava ? mergeWearable([], a.days) : s.wearable.filter((w) => w.source === 'demo') };
    case 'suppSet': {
      const cur = s.supplements ?? emptySupplements();
      // Any change after the result is shown sends the member back through the result step, so the protocol is rebuilt.
      return { ...s, supplements: { ...cur, answers: { ...cur.answers, ...a.patch } } };
    }
    case 'suppGo': {
      const cur = s.supplements ?? emptySupplements();
      return { ...s, supplements: { ...cur, step: Math.max(0, Math.min(RESULT_STEP - 1, a.step)) } };
    }
    case 'suppComplete': {
      const cur = s.supplements ?? emptySupplements();
      if (firstInvalidSuppStep(cur.answers) < RESULT_STEP) return s;
      return { ...s, supplements: { ...cur, step: RESULT_STEP, completedOn: a.date, consentAt: a.consentAt, rulesVersion: RULES_VERSION, questionnaireVersion: QUESTIONNAIRE_VERSION } };
    }
    case 'suppReset':
      return { ...s, supplements: { ...emptySupplements(), answers: { ...(s.supplements ?? emptySupplements()).answers, bloodwork: null, labId: null } } };
    case 'requestCoach':
      return { ...s, coachRequest: { at: a.at, status: 'requested' } };
    case 'plateauAnswer':
      return { ...s, plateau: { ...s.plateau, answers: { ...s.plateau.answers, [a.question]: a.option } } };
    case 'plateauGo':
      return { ...s, plateau: { ...s.plateau, step: Math.max(0, Math.min(PLATEAU_QUESTIONS.length, a.step)) } };
    case 'plateauComplete':
      if (!isComplete(s.plateau.answers)) return s;
      return {
        ...s,
        plateau: { ...s.plateau, step: PLATEAU_QUESTIONS.length, completedOn: a.date },
        onboarding: { ...s.onboarding, draft: applyPlateau(s.onboarding.draft, s.plateau.answers) },
      };
    case 'plateauEmail':
      return { ...s, plateau: { ...s.plateau, email: a.email.trim().toLowerCase() } };
    case 'plateauReset':
      return { ...s, plateau: { ...emptyPlateau(), email: s.plateau.email } };
    case 'onboardingSet':
      return { ...s, onboarding: { ...s.onboarding, draft: { ...s.onboarding.draft, ...a.patch } } };
    case 'onboardingStep':
      return { ...s, onboarding: { ...s.onboarding, step: a.step } };
    case 'onboardingFinish': {
      const d = s.onboarding.draft;
      if (firstInvalidStep(d)) return s;
      const profile = profileFromDraft(d, s.profile);
      const t = targetsFor(profile, d.weightKg);
      const rest = s.weights.filter((w) => w.date !== a.date);
      return {
        ...s,
        profile,
        targets: { ...t, steps: s.targets.steps, sleepHours: s.targets.sleepHours },
        weights: [...rest, { date: a.date, kg: d.weightKg }].sort((x, y) => x.date.localeCompare(y.date)),
        onboarding: { ...s.onboarding, step: 'plan', done: true },
      };
    }
    case 'setSport':
      return { ...s, sport: { sport: a.sport, start: a.start, matches: s.sport?.matches ?? [] } };
    case 'addMatch':
      if (!s.sport) return s;
      return { ...s, sport: { ...s.sport, matches: [...s.sport.matches.filter((m) => m.date !== a.match.date), a.match].sort((x, y) => x.date.localeCompare(y.date)) } };
    case 'removeMatch':
      if (!s.sport) return s;
      return { ...s, sport: { ...s.sport, matches: s.sport.matches.filter((m) => m.id !== a.id) } };
    case 'setMealPlan':
      return { ...s, mealPlan: a.plan };
    case 'setVegDays': {
      const days = [...new Set(a.days.filter((x) => x >= 0 && x <= 6))].sort((x, y) => x - y);
      return { ...s, profile: { ...s.profile, vegDays: days }, onboarding: { ...s.onboarding, draft: { ...s.onboarding.draft, vegDays: days } }, ...(a.plan !== undefined ? { mealPlan: a.plan } : {}) };
    }
    case 'logRun':
      return { ...s, runs: [...(s.runs ?? []).filter((r) => r.id !== a.run.id), a.run].sort((x, y) => x.date.localeCompare(y.date)) };
    case 'removeRun':
      return { ...s, runs: (s.runs ?? []).filter((r) => r.id !== a.id) };
    case 'markPlannedLogged':
      if (!s.mealPlan) return s;
      return { ...s, mealPlan: { ...s.mealPlan, days: s.mealPlan.days.map((d) => (d.date !== a.date ? d : { ...d, meals: d.meals.map((m) => (m.slot === a.slot ? { ...m, logged: true } : m)) })) } };
    case 'noteUnmatched': {
      const list = [...s.unmatchedFoods];
      for (const raw of a.names) {
        const name = raw.trim().toLowerCase().slice(0, 60);
        if (!name) continue;
        const i = list.findIndex((u) => u.name === name);
        if (i >= 0) list[i] = { ...list[i], count: list[i].count + 1, last: a.date }; else list.push({ name, count: 1, last: a.date });
      }
      return { ...s, unmatchedFoods: list.sort((x, y) => y.count - x.count).slice(0, 200) };
    }
    case 'replace':
      return a.data;
  }
}

type Store = {
  data: AppData;
  dispatch: (a: Action) => void;
  can: (f: Feature) => boolean;
  /** Wipe this device to a fresh account (sign-out, delete, "start my own"). Keeps plateau answers when asked. */
  reset: (keepPlateau?: boolean) => void;
  /** Switch this device to the Arjun demo account. */
  loadDemo: () => void;
  newId: (p: string) => string;
};
const Ctx = createContext<Store | null>(null);

export function AppProvider({ children, repo = new LocalRepository() }: { children: ReactNode; repo?: Repository }) {
  const [data, dispatch] = useReducer(reducer, undefined, () => repo.load());
  useEffect(() => { repo.save(data); }, [data, repo]);
  const tracked = useCallback((a: Action) => { trackAction(a.type); dispatch(a); }, []);
  const value = useMemo<Store>(() => ({
    data, dispatch: tracked,
    can: (f) => canUse(data, f),
    reset: (keepPlateau = false) => {
      const fresh = repo.reset();
      const next = keepPlateau && !data.demo ? { ...fresh, plateau: data.plateau, onboarding: { ...fresh.onboarding, draft: applyPlateau(fresh.onboarding.draft, data.plateau.answers) } } : fresh;
      dispatch({ type: 'replace', data: next });
    },
    loadDemo: () => { trackAction('demo_load'); dispatch({ type: 'replace', data: repo.loadDemo() }); },
    newId,
  }), [data, repo, tracked]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside <AppProvider>');
  return s;
}
