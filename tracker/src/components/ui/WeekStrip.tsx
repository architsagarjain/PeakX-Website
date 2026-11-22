import { addDays, dayNum, parse, weekStart } from '../../domain/clock';
import type { ISODate } from '../../domain/types';

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Mon–Sun capsules for the week containing `date`. Today is marked, the selected day is black,
 * and a lime dot shows days with something logged. Pass `onSelect` to make the days buttons; days after `max` are disabled.
 */
export function WeekStrip({ date, today, logged, selected, onSelect, max, label = 'This week' }: {
  date: ISODate; today: ISODate; logged?: (d: ISODate) => boolean; selected?: ISODate; onSelect?: (d: ISODate) => void; max?: ISODate; label?: string;
}) {
  const start = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const sel = selected ?? today;
  return (
    <div className="ui-week" role={onSelect ? 'group' : 'list'} aria-label={label}>
      {days.map((d) => {
        const dt = parse(d);
        const name = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
        const has = logged?.(d) ?? false;
        const cls = `ui-day${d === sel ? ' on' : ''}${d === today ? ' today' : ''}${d > today ? ' future' : ''}`;
        const body = <><small aria-hidden="true">{LETTER[dt.getDay()]}</small><b aria-hidden="true">{dayNum(d)}</b>{has ? <i aria-hidden="true" /> : null}</>;
        const a11y = `${name}${d === today ? ', today' : ''}${has ? ', logged' : ''}`;
        return onSelect
          ? <button key={d} type="button" className={cls} aria-label={a11y} aria-pressed={d === sel} disabled={!!max && d > max} onClick={() => onSelect(d)}>{body}</button>
          : <span key={d} role="listitem" className={cls} aria-label={a11y}>{body}</span>;
      })}
    </div>
  );
}
