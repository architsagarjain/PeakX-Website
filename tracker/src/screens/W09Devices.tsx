import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Toggle } from '../components/ui';
import { AppShell } from '../components/Shell';
import { RemindersCard } from '../components/Reminders';
import { useStore } from '../state/store';
import { useAuth } from '../state/auth';
import { connectDevice, disconnectDevice, saveDeviceRead, syncDevices, useDeviceAvailability, useDevicesStatus } from '../state/devices';
import { wearableOn } from '../state/selectors';
import { ALL_READ, PROVIDER_LABEL, type Provider } from '../domain/wearables';
import { addDays, today } from '../domain/clock';
import { fmt } from '../domain/nutrition';
import type { DeviceRead } from '../domain/types';

const READS: [keyof DeviceRead, string, string][] = [
  ['steps', 'Steps', 'Adds up to 200 kcal to your target on active days'],
  ['sleep', 'Sleep', 'Used in Insights and the weekly report'],
  ['heartRate', 'Heart rate', 'Resting heart rate trend'],
  ['workouts', 'Workouts', 'Fitbit and Strava sessions count toward active minutes'],
];
const ago = (iso: string | null) => {
  if (!iso) return 'not synced yet';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 2 ? 'synced just now' : m < 60 ? `synced ${m} min ago` : m < 1440 ? `synced ${Math.round(m / 60)} h ago` : `synced ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
};

/** W09 · Devices (S21.1): connect Fitbit (Google Health API) and Strava, choose what's read, sync, disconnect. */
export default function W09Devices() {
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const { data } = useStore();
  const avail = useDeviceAvailability();
  const status = useDevicesStatus(auth.user?.uid);
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Provider | null>(null);
  const read = status?.read ?? ALL_READ;
  const live = !!auth.user && !!status;
  const connected = live ? (['google', 'strava'] as Provider[]).filter((p) => status![p]?.connected) : (['google', 'strava'] as Provider[]).filter((p) => data.devices[p]);
  const lastSync = live ? [status!.google?.lastSync, status!.strava?.lastSync].filter(Boolean).sort().pop() ?? null : null;

  useEffect(() => {
    const c = params.get('connected'), e = params.get('device_error');
    if (!c && !e) return;
    if (c === 'google' || c === 'strava') toast(`${PROVIDER_LABEL[c]} connected. Your last 30 days are in.`, 'good');
    if (e) toast(e === 'denied' ? 'Connection cancelled. Nothing was shared.' : e === 'expired' ? 'That took too long. Try connecting again.' : 'Couldn’t connect. Try again in a minute.');
    setParams({}, { replace: true });
  }, [params, setParams, toast]);

  const connect = async (p: Provider) => {
    if (!auth.configured) { toast('Device sync needs accounts switched on for this site.'); return; }
    if (!auth.user) { navigate('/app/sign-up?next=/app/devices'); return; }
    if (avail && !avail[p]) { toast(`${PROVIDER_LABEL[p]} sync isn’t switched on for this site yet.`); return; }
    setBusy(p);
    try { await connectDevice(p, read); } catch (e) { toast((e as Error).message); setBusy(null); }
  };
  const sync = async () => {
    setBusy('sync');
    try { const days = await syncDevices(7); toast(`Synced ${days.length} day${days.length === 1 ? '' : 's'}`, 'good'); }
    catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  };
  const setRead = async (k: keyof DeviceRead, v: boolean) => {
    if (!live) return;
    try { await saveDeviceRead({ ...read, [k]: v }); toast(v ? `${k === 'heartRate' ? 'Heart rate' : k[0].toUpperCase() + k.slice(1)} on` : 'Turned off; that data is removed from PeakX', v ? 'good' : 'info'); }
    catch (e) { toast((e as Error).message); }
  };
  const disconnect = async (p: Provider) => {
    setBusy(p); setConfirm(null);
    try { await disconnectDevice(p); toast(`${PROVIDER_LABEL[p]} disconnected and its data deleted`, 'good'); }
    catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  };

  const t = today();
  const w = wearableOn(data, t), wy = wearableOn(data, addDays(t, -1));
  const sleep = w?.sleepHours || wy?.sleepHours || 0;
  const activities = useMemo(() => data.wearable.filter((x) => x.date >= addDays(t, -14)).flatMap((x) => (x.activities ?? []).map((a) => ({ ...a, date: x.date }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6), [data.wearable, t]);

  const sourceRow = (p: Provider, icon: string, sub: string) => {
    const st = live ? status![p] : null;
    const on = live ? !!st?.connected : data.devices[p];
    return (
      <div className="px-row" style={{ flexWrap: 'wrap', rowGap: '6px' }}>
        <span className="px-row-icon"><Icon name={icon} /></span>
        <span className="px-row-main" style={{ flexBasis: 0 }}>
          <span className="px-row-title">{PROVIDER_LABEL[p]}</span>
          <span className="px-row-sub">{on ? [st?.account, live ? ago(st?.lastSync ?? null) : 'Demo data', st?.error ? `last try failed: ${st.error}` : null].filter(Boolean).join(' · ') : sub}</span>
        </span>
        {on ? <span className={`px-status${st?.error ? ' over' : ' good'}`}>{st?.error ? 'Needs attention' : 'Connected'}</span> : avail && !avail[p] ? <span className="px-status">Not switched on</span> : null}
        {on && live ? (confirm === p
          ? <span style={{ display: 'flex', gap: '6px' }}><button className="px-pill sm" type="button" onClick={() => setConfirm(null)}>Keep</button><button className="px-pill sm on" type="button" onClick={() => disconnect(p)}>Disconnect and delete</button></span>
          : <button className="px-pill sm" type="button" style={{ marginLeft: '10px' }} onClick={() => setConfirm(p)}>Disconnect</button>)
          : !on ? <button className="px-pill sm" type="button" style={{ marginLeft: '10px' }} aria-disabled={busy === p} onClick={() => connect(p)}>{busy === p ? 'Opening…' : 'Connect'}</button> : null}
      </div>
    );
  };

  return (
    <AppShell active="devices" title="Devices" crumb={<>Wearables, reminders and calendar</>} cols="repeat(12, minmax(0, 1fr))">
      <div className="wb-col" style={{ gridColumn: 'span 7' }}>
        <div style={{ padding: '0 6px' }}>
          <div className="wb-hero">
            <span className="px-hero-label">Connected</span>
            <div className="fig"><span className="px-num xl">{connected.length}</span><span className="px-suffix">/ 2 sources</span></div>
            <span className="px-meta" style={{ marginTop: '6px' }}>Read-only. Nothing is written back to your devices.</span>
            <span style={{ marginTop: '6px' }}>{live && lastSync ? <span className="px-status good">Last sync {new Date(lastSync).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}</span> : !auth.user ? <span className="px-status">Showing demo data · sign in to connect yours</span> : null}</span>
          </div>
        </div>
        <div className="px-card" style={{ gap: '0' }}>
          <div className="px-card-head">
            <span className="px-card-title">Sources</span>
            {live && connected.length ? <button className="px-pill sm" type="button" aria-disabled={busy === 'sync'} onClick={sync}>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</button> : null}
          </div>
          <div className="px-list">
            {sourceRow('google', 'pulse', 'Fitbit and Google-linked watches: steps, sleep, heart rate, workouts')}
            {sourceRow('strava', 'path', 'Runs, rides and sport sessions')}
          </div>
        </div>
        <div className="px-card" style={{ gap: '0' }}>
          <div className="px-card-head"><span className="px-card-title">What PeakX reads</span>{!live ? <span className="px-meta">Saved with your account</span> : null}</div>
          <div className="px-list">
            {READS.map(([k, title, sub]) => (
              <div key={k} className="px-row">
                <span className="px-row-main"><span className="px-row-title">{title}</span><span className="px-row-sub">{sub}</span></span>
                <Toggle label={title} value={read[k]} disabled={!live} onChange={(v) => setRead(k, v)} />
              </div>
            ))}
          </div>
        </div>
        {activities.length ? (
          <div className="px-card" style={{ gap: '0' }}>
            <div className="px-card-head"><span className="px-card-title">Recent workouts</span><span className="px-meta">Last 14 days</span></div>
            <div className="px-list">
              {activities.map((a) => (
                <div key={a.id} className="px-row">
                  <span className="px-row-icon"><Icon name={a.source === 'strava' ? 'path' : 'pulse'} /></span>
                  <span className="px-row-main"><span className="px-row-title">{a.name}</span><span className="px-row-sub">{new Date(`${a.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {a.source === 'strava' ? 'Strava' : 'Fitbit'}{a.km ? ` · ${a.km} km` : ''}{a.avgHr ? ` · ${a.avgHr} bpm` : ''}</span></span>
                  <span className="px-row-end"><span className="px-row-value">{a.minutes} min</span>{a.kcal ? <span className="px-meta">{fmt(a.kcal)} kcal</span> : null}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 5' }}>
        <div className="px-stat-grid">
          <Stat label="Today" value={w ? fmt(w.steps) : '–'} sfx="steps" status={w ? `${Math.round((w.steps / data.targets.steps) * 100)}% of ${fmt(data.targets.steps)}` : 'No data yet'} good={!!w && w.steps >= data.targets.steps * 0.8} />
          <Stat label="Sleep last night" value={sleep ? String(sleep) : '–'} sfx="h" status={sleep ? (sleep < data.targets.sleepHours ? `Under your ${data.targets.sleepHours} h` : 'On target') : 'No data yet'} good={sleep >= data.targets.sleepHours} over={!!sleep && sleep < data.targets.sleepHours} />
          <Stat label="Resting heart rate" value={w?.restingHr || wy?.restingHr ? String(w?.restingHr || wy?.restingHr) : '–'} sfx="bpm" status={w?.restingHr || wy?.restingHr ? 'From your watch' : 'No data yet'} good={!!(w?.restingHr || wy?.restingHr)} />
          <Stat label="Active minutes" value={w ? String(w.activeMinutes) : '–'} sfx="min" status={w ? (w.activeMinutes >= 30 ? 'On track' : 'Below 30 min') : 'No data yet'} good={!!w && w.activeMinutes >= 30} />
        </div>
        <RemindersCard />
        <div className="px-card" style={{ gap: '8px' }}>
          <div className="px-card-head"><span className="px-card-title">How this is used</span></div>
          {[['bowl', 'Calorie target', 'Moves with your steps each day', 'Free'], ['trend', 'Basic charts', 'Steps and sleep next to weight', 'Free'], ['spark', 'Detailed analytics', 'Sleep against lifts, recovery trends', 'Pro'], ['doc', 'Weekly report', 'Sleep and activity as possible causes', 'Pro']].map(([icon, t1, sub, tier]) => (
            <div key={t1} className="px-row"><span className="px-row-icon"><Icon name={icon} /></span><span className="px-row-main"><span className="px-row-title">{t1}</span><span className="px-row-sub">{sub}</span></span><span className="px-row-end"><span className="px-row-value">{tier}</span></span></div>
          ))}
        </div>
        <div className="px-card" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', padding: '14px 18px' }}>
          <span className="px-row-icon"><Icon name="shield" /></span>
          <span className="px-row-main"><span className="px-row-title">Disconnect any time</span><span className="px-row-sub">Disconnecting deletes that source’s synced data straight away</span></span>
          <Link className="px-pill sm" to="/privacy">Privacy</Link>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sfx, status, good, over }: { label: string; value: string; sfx: string; status: string; good?: boolean; over?: boolean }) {
  return (
    <div className="px-card" style={{ gap: '2px' }}>
      <span className="px-meta">{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline' }}><span className="px-num md">{value}</span><span className="px-suffix">{sfx}</span></div>
      <span className={`px-status${over ? ' over' : good ? ' good' : ''}`}>{status}</span>
    </div>
  );
}
