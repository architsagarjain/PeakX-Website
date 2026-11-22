import { useState } from 'react';
import { useStore } from '../state/store';
import { useToast } from './Toast';
import { today } from '../domain/clock';
import { latestWeight } from '../state/selectors';

/** "Log weight": one number, validated, saved for today. */
export function WeightDialog({ onClose }: { onClose: () => void }) {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const [value, setValue] = useState(String(latestWeight(data)?.kg ?? (data.onboarding.draft.weightKg || '')));
  const kg = parseFloat(value);
  const valid = kg >= 30 && kg <= 250;
  const save = () => {
    if (!valid) return;
    dispatch({ type: 'logWeight', date: today(), kg: Math.round(kg * 10) / 10 });
    toast(`Weight saved: ${Math.round(kg * 10) / 10} kg`, 'good');
    onClose();
  };
  return (
    <div className="app-modal-scrim" onClick={onClose}>
      <form className="app-modal" role="dialog" aria-label="Log weight" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}>
        <span className="px-card-title" style={{ fontSize: '24px', lineHeight: '28px' }}>Log today’s weight</span>
        <label className="px-field" htmlFor="weight-kg">
          <span className="l">Weight in kg</span>
          <input id="weight-kg" autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
            style={{ border: 0, background: 'transparent', padding: 0, font: '700 28px/32px var(--font-display)', color: 'var(--text)', outline: 'none' }} />
        </label>
        {!valid && value !== '' ? <span className="px-status over">Enter a weight between 30 and 250 kg</span> : <span className="px-meta">Weigh in the morning, before food, for a fair trend.</span>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="px-cta glass" style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', padding: '0 20px' }} onClick={onClose}>Cancel</button>
          <button type="submit" className="px-cta" disabled={!valid} style={{ flex: '0 0 auto', height: '44px', fontSize: '16px', padding: '0 28px', opacity: valid ? 1 : 0.4 }}>Save</button>
        </div>
      </form>
    </div>
  );
}
