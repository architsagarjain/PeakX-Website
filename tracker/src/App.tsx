import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ReportScheduler } from './components/ReportScheduler';
import { track } from './state/telemetry';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import W06ThisWeek from './screens/W06ThisWeek';
const W01Landing = lazy(() => import('./screens/W01Landing'));
const W02PlateauCheck = lazy(() => import('./screens/W02PlateauCheck'));
const W03SignIn = lazy(() => import('./screens/W03SignIn'));
const W04Onboarding = lazy(() => import('./screens/W04Onboarding'));
const W05PlanReady = lazy(() => import('./screens/W05PlanReady'));
const W07VoiceLog = lazy(() => import('./screens/W07VoiceLog'));
const W08Workout = lazy(() => import('./screens/W08Workout'));
const W09Devices = lazy(() => import('./screens/W09Devices'));
const W10Recipes = lazy(() => import('./screens/W10Recipes'));
const W11MealPlan = lazy(() => import('./screens/W11MealPlan'));
const W12MessMode = lazy(() => import('./screens/W12MessMode'));
const W13SportProgram = lazy(() => import('./screens/W13SportProgram'));
const W14Insights = lazy(() => import('./screens/W14Insights'));
const W15Analytics = lazy(() => import('./screens/W15Analytics'));
const W16WeeklyReport = lazy(() => import('./screens/W16WeeklyReport'));
const W17FormUpload = lazy(() => import('./screens/W17FormUpload'));
const W18FormReport = lazy(() => import('./screens/W18FormReport'));
const W19BloodWork = lazy(() => import('./screens/W19BloodWork'));
const W24CoachDesk = lazy(() => import('./screens/W24CoachDesk'));
const W25Supplements = lazy(() => import('./screens/W25Supplements'));
const Legal = lazy(() => import('./screens/Legal'));
const W20Coach = lazy(() => import('./screens/W20Coach'));
const W21Pricing = lazy(() => import('./screens/W21Pricing'));
const W22Account = lazy(() => import('./screens/W22Account'));
const W23EatingOut = lazy(() => import('./screens/W23EatingOut'));

/** Scroll to the top on every route change. */
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); track('screen_view', { path: pathname.replace(/\/\d{4}-\d{2}-\d{2}/, '/:date') }); }, [pathname]);
  return null;
}

function Screens({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}><Suspense fallback={<div className="px-loading" role="status" aria-label="Loading" />}>{children}</Suspense></ErrorBoundary>;
}

/** Screen map. Each route matches one board (W01–W23) of the PeakX canvas; W24 is the coach desk (R5); W25 is the supplement protocol. */
export default function App() {
  return (
    <HashRouter>
      <ScrollTop />
      <ReportScheduler />
      <Screens>
      <Routes>
        <Route path="/" element={<W06ThisWeek />} />
        <Route path="/welcome" element={<W01Landing />} />
        <Route path="/login" element={<W03SignIn />} />
        <Route path="/privacy" element={<Legal page="privacy" />} />
        <Route path="/terms" element={<Legal page="terms" />} />
        <Route path="/refunds" element={<Legal page="refunds" />} />
        <Route path="/disclaimer" element={<Legal page="disclaimer" />} />
        <Route path="/contact" element={<Legal page="contact" />} />
        <Route path="/app/plateau-check" element={<W02PlateauCheck />} />
        <Route path="/app/sign-up" element={<W03SignIn />} />
        <Route path="/app/start/plan" element={<W05PlanReady />} />
        <Route path="/app/start/:step" element={<W04Onboarding />} />
        <Route path="/app/start" element={<Navigate to="/app/start/goal" replace />} />
        <Route path="/app/week" element={<Navigate to="/" replace />} />
        <Route path="/app/log" element={<W07VoiceLog />} />
        <Route path="/app/log/workout" element={<W08Workout />} />
        <Route path="/app/devices" element={<W09Devices />} />
        <Route path="/app/plan/recipes" element={<W10Recipes />} />
        <Route path="/app/plan/meals" element={<W11MealPlan />} />
        <Route path="/app/plan/mess" element={<W12MessMode />} />
        <Route path="/app/plan/eating-out" element={<W23EatingOut />} />
        <Route path="/app/plan/sport/badminton" element={<W13SportProgram />} />
        <Route path="/app/insights" element={<W14Insights />} />
        <Route path="/app/insights/analytics" element={<W15Analytics />} />
        <Route path="/app/insights/supplements" element={<W25Supplements />} />
        <Route path="/app/reviews/form-check" element={<W17FormUpload />} />
        <Route path="/app/reviews/form-check/:id" element={<W18FormReport />} />
        <Route path="/app/reviews/blood-work" element={<W19BloodWork />} />
        <Route path="/app/coach" element={<W20Coach />} />
        <Route path="/app/coach-desk" element={<W24CoachDesk />} />
        <Route path="/app/upgrade" element={<W21Pricing />} />
        <Route path="/app/account" element={<W22Account />} />
        <Route path="/app/reviews/weekly/:week" element={<W16WeeklyReport />} />
        <Route path="/app/plan" element={<Navigate to="/app/plan/meals" replace />} />
        <Route path="/app/reviews" element={<Navigate to="/app/reviews/weekly/latest" replace />} />
        <Route path="/app" element={<Navigate to="/" replace />} />
        <Route path="/app/*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Screens>
    </HashRouter>
  );
}
