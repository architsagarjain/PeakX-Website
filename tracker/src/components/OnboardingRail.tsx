import { useNavigate } from 'react-router-dom';
import { StepRail } from './Wizard';
import { useStore } from '../state/store';
import { ONBOARDING_STEPS, firstInvalidStep, stepIndex, type OnboardingStep } from '../domain/onboarding';
import { today } from '../domain/clock';

/** Hook + rail shared by the onboarding steps (W04) and Plan ready (W05). */
export function useOnboardingNav() {
  const { data, dispatch } = useStore();
  const navigate = useNavigate();
  const go = (step: OnboardingStep) => {
    if (step === 'plan') {
      const bad = firstInvalidStep(data.onboarding.draft);
      if (bad) { go(bad); return; }
      dispatch({ type: 'onboardingFinish', date: today() });
    }
    dispatch({ type: 'onboardingStep', step });
    navigate(`/app/start/${step}`);
  };
  return go;
}

export function OnboardingRail({ current }: { current: OnboardingStep }) {
  const { data } = useStore();
  const go = useOnboardingNav();
  const bad = firstInvalidStep(data.onboarding.draft);
  const ci = stepIndex(current);
  // You can jump back to anything, and forward up to the first step that still needs answers.
  const reached = Math.max(ci, bad ? stepIndex(bad) : ONBOARDING_STEPS.length - 1);
  return (
    <StepRail tag={`Step ${ci + 1} of ${ONBOARDING_STEPS.length}`} steps={ONBOARDING_STEPS.map((s) => s.label)} current={ci}
      reached={reached} done={ONBOARDING_STEPS.map((_, i) => i < ci || (data.onboarding.done && i < ONBOARDING_STEPS.length - 1))}
      onJump={(i) => go(ONBOARDING_STEPS[i].id)} note="Saved as you go. Close the tab and come back any time." />
  );
}
