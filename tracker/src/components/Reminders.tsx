import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { Toggle } from './ui';
import { useToast } from './Toast';
import { useAuth } from '../state/auth';
import { saveEmailPrefs, watchEmailPrefs } from '../state/cloud';
import { calendarFeedUrl, googleCalendarLink } from '../state/devices';
import { DEFAULT_PREFS, type EmailPrefs } from '../domain/reminders';

/** S22.1 · Email reminders and the Google Calendar feed. Preferences live with the account. */
export function useEmailPrefs(): [EmailPrefs | null, (p: EmailPrefs) => Promise<void>] {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);
  useEffect(() => {
    if (!user) { setPrefs(null); return; }
    let stop: (() => void) | undefined;
    watchEmailPrefs(user.uid, (p) => setPrefs({ ...DEFAULT_PREFS, ...(p ?? {}) })).then((f) => { stop = f; }).catch(() => setPrefs({ ...DEFAULT_PREFS }));
    return () => stop?.();
  }, [user]);
  const save = async (p: EmailPrefs) => { if (user) { setPrefs(p); await saveEmailPrefs(user.uid, p); } };
  return [prefs, save];
}

export function RemindersCard() {
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [prefs, save] = useEmailPrefs();
  const [busy, setBusy] = useState(false);
  const off = !auth.user;
  const set = (patch: Partial<EmailPrefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch, unsubscribedAt: Object.values(patch).some(Boolean) ? null : prefs.unsubscribedAt };
    save(next).then(() => toast('Saved', 'good')).catch(() => toast('Couldn’t save. Check your connection.'));
  };
  const calendar = async () => {
    if (!auth.user) { navigate('/app/sign-up?next=/app/devices'); return; }
    setBusy(true);
    try { const url = await calendarFeedUrl(); window.open(googleCalendarLink(url), '_blank', 'noopener'); toast('Google Calendar opens to add your PeakX calendar. Sessions update by themselves.', 'good'); }
    catch (e) { toast((e as Error).message || 'Calendar feed isn’t available yet'); }
    finally { setBusy(false); }
  };
  const rows: [keyof Omit<EmailPrefs, 'unsubscribedAt'>, string, string][] = [
    ['logNudge', 'Log nudge at 9 PM', 'Only on days you haven’t logged anything'],
    ['reportEmail', 'Sunday report email', 'Your weekly report at 7 PM'],
    ['retest', 'Blood test re-check', 'On the date your lab report suggests'],
  ];
  return (
    <div className="px-card" style={{ gap: '0' }}>
      <div className="px-card-head"><span className="px-card-title">Reminders</span>{off ? <button className="px-pill sm" type="button" onClick={() => navigate('/app/sign-up?next=/app/devices')}>Sign in to turn on</button> : prefs?.unsubscribedAt ? <span className="px-status over">Unsubscribed</span> : null}</div>
      <div className="px-list">
        {rows.map(([k, title, sub]) => (
          <div key={k} className="px-row">
            <span className="px-row-icon"><Icon name="mail" /></span>
            <span className="px-row-main"><span className="px-row-title">{title}</span><span className="px-row-sub">{sub}</span></span>
            <Toggle label={title} value={!!prefs?.[k]} disabled={off || !prefs} onChange={(v) => set({ [k]: v })} />
          </div>
        ))}
        <div className="px-row">
          <span className="px-row-icon"><Icon name="cal" /></span>
          <span className="px-row-main"><span className="px-row-title">Google Calendar</span><span className="px-row-sub">Sessions, matches, wind-down and report times, kept up to date</span></span>
          <button className="px-pill sm" type="button" aria-disabled={busy} onClick={calendar}>{busy ? 'Opening…' : 'Add'}</button>
        </div>
      </div>
    </div>
  );
}
