import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import { share } from './geometry';

const fmt = (n: number, dp = 0) => n.toLocaleString('en-IN', { maximumFractionDigits: dp, minimumFractionDigits: 0 }).replace('-', '−');

/**
 * Card surface. `band` is a dark tile for DarkBand rows; `lime` and `coral` add a soft glow for hero and warning cards.
 * Pass `to` to make the whole card open a page: the title becomes the link and stretches over the card,
 * so screen readers hear one link and the card keeps no nested buttons.
 */
export function GlassCard({ variant = 'light', title, aside, className, style, children, as: Tag = 'section', to, linkLabel }: {
  variant?: 'light' | 'band' | 'lime' | 'coral'; title?: ReactNode; aside?: ReactNode; className?: string; style?: CSSProperties;
  children?: ReactNode; as?: 'section' | 'div' | 'article'; to?: string; linkLabel?: string;
}) {
  const head = to
    ? <Link className="ui-card-link" to={to} aria-label={linkLabel}>{title}<Icon name="back" /></Link>
    : title;
  return (
    <Tag className={`ui-card v-${variant}${to ? ' is-link' : ''}${className ? ` ${className}` : ''}`} style={style}>
      {title || aside ? (
        <div className="ui-card-head">
          {title ? <h2 className="ui-card-title">{head}</h2> : null}
          {aside ? <div className="ui-card-aside">{aside}</div> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

/**
 * Big number with its unit. `value` null shows `empty` (one short line saying what fills it) instead of a dash.
 * `delta` is a small chip such as "−0.4 kg this week".
 */
export function Stat({ value, unit, dp = 0, label, delta, caption, empty = 'No data yet', size = 'lg' }: {
  value: number | string | null | undefined; unit?: string; dp?: number; label?: ReactNode;
  delta?: { text: string; tone?: 'good' | 'warn' | 'neutral' }; caption?: ReactNode; empty?: string; size?: 'lg' | 'md';
}) {
  const none = value == null || (typeof value === 'number' && !isFinite(value));
  return (
    <div className={`ui-stat s-${size}`}>
      {label || delta ? (
        <div className="ui-stat-top">
          {label ? <span className="ui-label">{label}</span> : null}
          {delta && !none ? <span className={`ui-chip c-${delta.tone === 'warn' ? 'coral' : delta.tone === 'good' ? 'lime' : 'neutral'}`}>{delta.text}</span> : null}
        </div>
      ) : null}
      {none ? <div className="ui-stat-empty">{empty}</div> : (
        <div className="ui-stat-fig">
          <span className="ui-stat-num">{typeof value === 'number' ? fmt(value, dp) : value}</span>
          {unit ? <span className="ui-stat-unit">{unit}</span> : null}
        </div>
      )}
      {caption ? <div className="ui-stat-cap">{caption}</div> : null}
    </div>
  );
}

/** One macro: label, consumed / target and a bar. No target shows the amount only. */
export function MacroBar({ label, consumed, target, unit = 'g', tone = 'ink' }: {
  label: string; consumed: number | null | undefined; target: number | null | undefined; unit?: string; tone?: 'ink' | 'lime' | 'coral';
}) {
  const p = share(consumed ?? 0, target);
  const over = !!target && (consumed ?? 0) > target;
  return (
    <div className="ui-macro">
      <div className="ui-macro-top">
        <span className="ui-label">{label}</span>
        <span className="ui-macro-val"><b>{fmt(consumed ?? 0)}</b>{target ? <> / {fmt(target)}{unit}</> : unit}</span>
      </div>
      <div className="ui-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target || undefined} aria-valuenow={consumed ?? 0}>
        <span className={`t-${over ? 'coral' : tone}`} style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}

/** Full-width dark section with a title, an optional status chip on the right and a row of cards (a snap carousel on phones). */
export function DarkBand({ eyebrow, title, status, children, className }: {
  eyebrow?: ReactNode; title: ReactNode; status?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`ui-band px-band${className ? ` ${className}` : ''}`}>
      <div className="ui-band-head">
        <div>
          {eyebrow ? <div className="ui-band-eyebrow">{eyebrow}</div> : null}
          <h2 className="ui-band-title">{title}</h2>
        </div>
        {status ? <div className="ui-band-status">{status}</div> : null}
      </div>
      <div className="ui-band-row">{children}</div>
    </section>
  );
}

/** Nothing here yet: an icon, one line and one action. */
export function EmptyState({ icon, text, action }: {
  icon: string; text: ReactNode; action?: { label: string; to?: string; onClick?: () => void };
}) {
  return (
    <div className="ui-empty">
      <span className="ui-empty-icon"><Icon name={icon} /></span>
      <p>{text}</p>
      {action ? <PillButton to={action.to} onClick={action.onClick} size="sm">{action.label}</PillButton> : null}
    </div>
  );
}

/** Small rounded label. Pass `onClick` to make it a button. */
export function Chip({ children, tone = 'neutral', onClick, on, title }: {
  children: ReactNode; tone?: 'neutral' | 'lime' | 'coral' | 'band'; onClick?: () => void; on?: boolean; title?: string;
}) {
  const cls = `ui-chip c-${tone}${on ? ' on' : ''}`;
  return onClick
    ? <button type="button" className={`${cls} btn`} onClick={onClick} aria-pressed={on} title={title}>{children}</button>
    : <span className={cls} title={title}>{children}</span>;
}

/** `pro` is the lime Pro badge; `status` is a quiet state label (Synced, Done, Upcoming). */
export function Badge({ kind = 'status', tone = 'neutral', children }: {
  kind?: 'pro' | 'status'; tone?: 'neutral' | 'good' | 'warn'; children?: ReactNode;
}) {
  if (kind === 'pro') return <span className="px-pro">{children ?? 'Pro'}</span>;
  return <span className={`ui-badge b-${tone}`}>{children}</span>;
}

/** Pill button: `primary` black, `accent` lime (inside the dark band), `ghost` outlined. Pass `to` for a link. */
export function PillButton({ variant = 'primary', size = 'md', icon, to, onClick, type = 'button', disabled, children, className, ...aria }: {
  variant?: 'primary' | 'accent' | 'ghost' | 'band'; size?: 'sm' | 'md'; icon?: string; to?: string; onClick?: () => void;
  type?: 'button' | 'submit'; disabled?: boolean; children: ReactNode; className?: string; 'aria-label'?: string;
}) {
  const cls = `ui-pill p-${variant} z-${size}${className ? ` ${className}` : ''}`;
  const inner = <>{icon ? <Icon name={icon} /> : null}{children}</>;
  if (to && !disabled) return <Link className={cls} to={to} onClick={onClick} {...aria}>{inner}</Link>;
  return <button className={cls} type={type} onClick={onClick} disabled={disabled} {...aria}>{inner}</button>;
}
