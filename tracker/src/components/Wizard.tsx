import type { ReactNode } from 'react';

const TICK = <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" /></svg>;

/**
 * Left rail for step-by-step flows (plateau check, onboarding).
 * Steps up to `reached` are buttons, so people can go back and edit; later steps are greyed.
 * `done[i]` decides the tick; a reachable step that isn't done shows its number.
 * Under 1100 px the rail hides and a thin progress bar shows instead (see .px-progress).
 */
export function StepRail({ tag, steps, current, reached, done, onJump, note }: {
  tag: string;
  steps: string[];
  current: number;
  reached: number;
  done: boolean[];
  onJump: (i: number) => void;
  note?: ReactNode;
}) {
  return (
    <nav className="px-card px-rail" aria-label="Steps">
      <span className="px-tag" style={{ marginBottom: '6px' }}>{tag}</span>
      <ol>
        {steps.map((label, i) => {
          const state = i === current ? 'now' : i > reached ? 'todo' : done[i] ? 'done' : 'open';
          return (
            <li key={label}>
              <button type="button" className={`px-rail-step ${state}`} disabled={state === 'todo'} aria-current={state === 'now' ? 'step' : undefined} onClick={() => onJump(i)}>
                <span className="dot">{state === 'done' ? TICK : i + 1}</span>{label}
              </button>
            </li>
          );
        })}
      </ol>
      {note ? <span className="px-meta" style={{ marginTop: '10px' }}>{note}</span> : null}
    </nav>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <span style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

/** Back / Next row. Enter triggers Next from anywhere in the step (wired by the screen). */
export function WizardNav({ onBack, onNext, nextLabel, backLabel = 'Back', nextDisabled }: {
  onBack?: () => void; onNext: () => void; nextLabel: string; backLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div className="px-wiz-actions">
      {onBack ? <button className="px-cta glass" type="button" onClick={onBack}>{backLabel}</button> : <span />}
      <button className="px-cta" type="button" aria-disabled={nextDisabled || undefined} onClick={onNext}>
        {nextLabel} <span className="wb-kbd" aria-hidden="true">↵</span>
      </button>
    </div>
  );
}

/** Multiple-choice chips (pick one or many). */
export function Chips({ label, options, value, onChange, multi }: {
  label: string; options: string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean;
}) {
  return (
    <div className="px-chips" role={multi ? 'group' : 'radiogroup'} aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" className={`px-pill${on ? ' on' : ''}`} role={multi ? 'checkbox' : 'radio'} aria-checked={on}
            onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : [o])}>{o}</button>
        );
      })}
    </div>
  );
}

/** Labelled input in the glass field style, with an inline error. */
export function Field({ label, error, suffix, children }: { label: string; error?: string; suffix?: string; children: ReactNode }) {
  return (
    <label className={`px-field${error ? ' err' : ''}`}>
      <span className="l">{label}</span>
      <span className="px-field-row">{children}{suffix ? <span className="sfx">{suffix}</span> : null}</span>
      {error ? <span className="px-err" role="alert">{error}</span> : null}
    </label>
  );
}
