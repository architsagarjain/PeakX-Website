import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon, Wordmark, Avatar } from './Icon';
import { NAV, SHORTCUTS as BASE_SHORTCUTS, DESK, DOCK, type NavKey } from '../data/nav';
import { useIsCoach } from '../state/ops';
import { isInstalled, promptInstall } from '../state/install';
import { useToast } from './Toast';
import { useStore } from '../state/store';
import { useAuth } from '../state/auth';
import { FEATURE_COPY, type Feature } from '../state/entitlements';
import { PlanNav } from './PlanNav';

type Props = {
  active: NavKey;
  title: string;
  crumb?: ReactNode;
  /** Right side of the page heading (Home's week strip). */
  headAside?: ReactNode;
  cols?: string;
  overlay?: ReactNode;
  /** Pro feature this page belongs to. Free users see the page blurred with an upgrade card. */
  feature?: Feature;
  children: ReactNode;
};

/** Signed-in layout: glass top bar with a centred pill nav and Tools menu, the Log a meal button and the avatar menu; 12-column body; floating bottom dock under 768px. */
export function AppShell({ active, title, crumb, headAside, cols = 'repeat(12, minmax(0, 1fr))', overlay, feature, children }: Props) {
  const navigate = useNavigate();
  const { data, can } = useStore();
  const coach = useIsCoach();
  const tools = coach ? [...BASE_SHORTCUTS, DESK] : BASE_SHORTCUTS;
  const locked = feature ? !can(feature) : false;
  const body = locked
    ? <div className="px-blurred" aria-hidden="true" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: cols, gap: 'var(--gutter)' }}>{children}</div>
    : children;
  const veil = locked && feature ? (
    <div className="ax-lock" role="dialog" aria-labelledby="ax-lock-title">
      <span className="px-pro">Pro</span>
      <div id="ax-lock-title" className="ax-lock-title">{FEATURE_COPY[feature].title}</div>
      <button className="ax-btn" type="button" onClick={() => navigate('/app/upgrade')}>Upgrade</button>
    </div>
  ) : null;
  return (
    <div className="wb-app px-screen ax">
      <a className="ax-skip" href="#ax-main" onClick={(e) => { e.preventDefault(); document.getElementById('ax-main')?.focus(); }}>Skip to content</a>
      <header className="ax-top">
        <div className="ax-top-in">
          <Link to="/" aria-label="PeakX home" className="ax-brand"><Wordmark /></Link>
          <nav className="ax-nav" aria-label="Main navigation">
            {NAV.map((n) => (
              <Link key={n.key} to={n.to} className={n.key === active ? 'on' : undefined} aria-current={n.key === active ? 'page' : undefined}>
                {n.label}
                {n.key === 'coach' && !can('aiCoach') ? <span className="px-pro">Pro</span> : null}
              </Link>
            ))}
            <ToolsMenu items={tools} active={active} />
          </nav>
          <div className="ax-right">
            <Link className="ax-mic" to="/app/log"><Icon name="mic" /><span>Log a meal</span></Link>
            <AvatarMenu active={active} tools={tools} />
          </div>
        </div>
      </header>
      <main className="wb-main ax-main" id="ax-main" tabIndex={-1}>
        <div className={`ax-head${headAside ? ' with-aside' : ''}`}>
          <div className="ax-head-text">
            <h1 className="ax-title">{title}</h1>
            {crumb ? <span className="ax-crumb">{crumb}</span> : null}
          </div>
          {headAside}
        </div>
        {data.demo ? <DemoNote /> : null}
        {active === 'plan' || active === 'recipes' ? <div className="wb-subnav"><PlanNav /></div> : null}
        <div className="wb-body" style={{ gridTemplateColumns: cols }}>{body}</div>
      </main>
      {overlay}
      {veil}
      <nav className="ax-dock" aria-label="Main navigation">
        {DOCK.map((n) => n.key === 'log' ? (
          <Link key={n.key} to={n.to} className={`ax-dock-mic${active === 'log' ? ' on' : ''}`} aria-label="Log a meal" aria-current={active === 'log' ? 'page' : undefined}><Icon name="mic" /></Link>
        ) : (
          <Link key={n.key} to={n.to} className={n.key === active ? 'on' : undefined} aria-label={n.label} aria-current={n.key === active ? 'page' : undefined}>
            <Icon name={n.icon} /><span>{n.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function DemoNote() {
  const { reset } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <div className="wb-demo" role="note">
      <span><b>Demo account.</b> <span className="wb-demo-long">You’re looking around as Arjun, a sample Pro member. Nothing here is yours.</span><span className="wb-demo-short">Sample data, not yours.</span></span>
      <button className="ax-btn sm" type="button" onClick={() => { reset(); navigate('/app/plateau-check'); toast('Fresh start. Take the plateau check to build your plan.', 'good'); }}>Start my own plan</button>
    </div>
  );
}

type Item = { key: NavKey; label: string; icon: string; to: string };

/** Close on outside click, Escape (focus back to the trigger) and route change. Arrow keys move between items. */
function useMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  const items = () => Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []).filter((x) => x.offsetParent !== null);
  const focusAt = (i: number) => { const xs = items(); xs[(i + xs.length) % xs.length]?.focus(); };
  const onTriggerKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const last = e.key === 'ArrowUp';
      requestAnimationFrame(() => focusAt(last ? -1 : 0));
    }
  };
  const onMenuKey = (e: KeyboardEvent) => {
    const xs = items();
    const i = xs.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
    else if (e.key === 'End') { e.preventDefault(); focusAt(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trigger.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };
  return { open, setOpen, wrap, trigger, onTriggerKey, onMenuKey };
}

function ToolsMenu({ items, active }: { items: Item[]; active: NavKey }) {
  const m = useMenu();
  const on = items.some((n) => n.key === active);
  return (
    <div className="ax-menu-wrap" ref={m.wrap}>
      <button
        ref={m.trigger} type="button" className={`ax-tools${on ? ' on' : ''}`} aria-haspopup="menu" aria-expanded={m.open}
        aria-current={on ? 'page' : undefined} onClick={() => m.setOpen(!m.open)} onKeyDown={m.onTriggerKey}
      >
        Tools<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2.5 4l2.5 2.5L7.5 4" /></svg>
      </button>
      {m.open ? (
        <div className="ax-menu ax-menu-tools" role="menu" aria-label="Tools" onKeyDown={m.onMenuKey}>
          {items.map((n) => (
            <Link key={n.key} role="menuitem" to={n.to} className={n.key === active ? 'on' : undefined} aria-current={n.key === active ? 'page' : undefined} onClick={() => m.setOpen(false)}>
              <Icon name={n.icon} />{n.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AvatarMenu({ active, tools }: { active: NavKey; tools: Item[] }) {
  const m = useMenu();
  const navigate = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { data } = useStore();
  const auth = useAuth();
  const who = auth.user ? (data.profile.name || auth.user.name || (auth.user.email ?? 'You').split('@')[0]) : data.profile.name;
  const tier = data.plan === 'free' ? 'Free' : data.plan === 'coached' ? 'Coached' : 'Pro';
  const reviews = NAV.find((n) => n.key === 'reviews')!;
  const install = () => promptInstall().then((r) => { if (r === 'installed') toast('PeakX is on your home screen', 'good'); else if (r !== 'dismissed') toast(r); });
  const close = () => m.setOpen(false);
  const loginTo = `/login${loc.pathname !== '/' && loc.pathname !== '/login' ? `?next=${encodeURIComponent(loc.pathname)}` : ''}`;
  return (
    <div className="ax-menu-wrap" ref={m.wrap}>
      <button ref={m.trigger} type="button" className="ax-avatar" aria-haspopup="menu" aria-expanded={m.open} aria-label="Account menu" onClick={() => m.setOpen(!m.open)} onKeyDown={m.onTriggerKey}>
        <Avatar name={who} demo={data.demo} />
      </button>
      {m.open ? (
        <div className="ax-menu ax-menu-me" role="menu" aria-label="Account" onKeyDown={m.onMenuKey}>
          <div className="ax-menu-head">
            <b>{who || 'Your profile'}</b>
            <span>{auth.user?.email ?? (data.onboarding.done ? data.profile.city || 'Not signed in' : 'Plan not set up')}</span>
          </div>
          <Link role="menuitem" to="/app/account" className={active === 'account' ? 'on' : undefined} onClick={close}><Icon name="user" />Profile and settings</Link>
          <Link role="menuitem" to="/app/upgrade" className={active === 'upgrade' ? 'on' : undefined} onClick={close}>
            <Icon name="card" />Plan<span className={tier === 'Free' ? 'ax-tier' : 'px-pro'}>{tier}</span>
          </Link>
          {isInstalled() ? null : <button type="button" role="menuitem" onClick={() => { close(); install(); }}><Icon name="phone" />Add to home screen</button>}
          <div className="ax-menu-mobile">
            <div className="ax-menu-sep" />
            <Link role="menuitem" to={reviews.to} className={active === 'reviews' ? 'on' : undefined} onClick={close}><Icon name={reviews.icon} />{reviews.label}</Link>
            <div className="ax-menu-label">Tools</div>
            {tools.map((n) => (
              <Link key={n.key} role="menuitem" to={n.to} className={n.key === active ? 'on' : undefined} onClick={close}><Icon name={n.icon} />{n.label}</Link>
            ))}
          </div>
          <div className="ax-menu-sep" />
          {auth.user ? (
            <button type="button" role="menuitem" className="danger" onClick={() => { close(); auth.signOut().then(() => navigate('/')).catch(() => toast('Couldn’t sign out. Check your connection.')); }}><Icon name="back" />Log out</button>
          ) : loc.pathname === '/login' || loc.pathname === '/app/sign-up' ? null : (
            <Link role="menuitem" to={loginTo} onClick={close}><Icon name="user" />Log in</Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
