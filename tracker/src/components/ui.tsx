import { useState, type CSSProperties } from 'react';

export function Tabs({ items, initial, style, onChange }: { items: string[]; initial?: string; style?: CSSProperties; onChange?: (v: string) => void }) {
  const [on, setOn] = useState(initial ?? items[0]);
  return (
    <div className="wb-tabs" role="tablist" style={style}>
      {items.map((t) => (
        <span key={t} role="tab" aria-selected={t === on} tabIndex={0} className={t === on ? 'on' : undefined}
          onClick={() => { setOn(t); onChange?.(t); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { setOn(t); onChange?.(t); } }}>{t}</span>
      ))}
    </div>
  );
}

export function Segmented({ items, initial, style, value, onChange, label }: { items: string[]; initial?: string; style?: CSSProperties; value?: string; onChange?: (v: string) => void; label?: string }) {
  const [own, setOwn] = useState(initial ?? items[0]);
  const on = value ?? own;
  const setOn = (t: string) => { setOwn(t); onChange?.(t); };
  return (
    <div className="px-seg" role="radiogroup" aria-label={label} style={style}>
      {items.map((t) => (
        <span key={t} role="radio" aria-checked={t === on} tabIndex={0} className={t === on ? 'on' : undefined} onClick={() => setOn(t)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOn(t); } }}>{t}</span>
      ))}
    </div>
  );
}

/** Radio cards. Pass `value` + `onChange` to control it from the store; otherwise it keeps its own state. */
export function ChoiceGroup({ label, options, initial = 0, style, className, value, onChange }: {
  label: string; options: { t: string; m: string }[]; initial?: number; style?: CSSProperties; className?: string;
  value?: number; onChange?: (i: number) => void;
}) {
  const [own, setOwn] = useState(initial);
  const sel = value ?? own;
  const pick = (i: number) => { setOwn(i); onChange?.(i); };
  return (
    <div role="radiogroup" aria-label={label} style={style} className={className}>
      {options.map((o, i) => (
        <button key={o.t} className={`px-choice${i === sel ? ' on' : ''}`} type="button" role="radio" aria-checked={i === sel} onClick={() => pick(i)}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}><span className="t">{o.t}</span><span className="m">{o.m}</span></span>
          <span className="r" />
        </button>
      ))}
    </div>
  );
}

/** Switch. Pass `value` + `onChange` to control it; `disabled` greys it out. */
export function Toggle({ label, initial = false, value, onChange, disabled }: { label: string; initial?: boolean; value?: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  const [own, setOwn] = useState(initial);
  const on = value ?? own;
  const flip = () => { if (disabled) return; setOwn(!on); onChange?.(!on); };
  return (
    <span role="switch" aria-checked={on} aria-label={label} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : 0} onClick={flip} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } }}
      style={{ width: '40px', height: '24px', borderRadius: '999px', background: on ? 'var(--text)' : 'var(--track)', position: 'relative', flexShrink: 0, cursor: disabled ? 'default' : 'pointer', transition: 'background .15s', opacity: disabled ? 0.45 : 1 }}>
      <span style={{ position: 'absolute', top: '3px', left: on ? '19px' : '3px', width: '18px', height: '18px', borderRadius: '999px', background: '#FFFFFF', transition: 'left .15s' }} />
    </span>
  );
}
