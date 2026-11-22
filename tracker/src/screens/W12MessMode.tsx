import { useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Tabs } from '../components/ui';
import { AppShell } from '../components/Shell';
import { Chips } from '../components/Wizard';
import { QtyStepper, useCatalogue } from '../components/FoodLog';
import { compressImage } from '../components/image';
import { useStore, SLOT_TIME } from '../state/store';
import { dayTotals, remaining, SLOT_LABEL, SLOTS, slotFor } from '../state/selectors';
import { AiError, callAi, useAiStatus } from '../state/ai';
import { fitMenu, menuFromText, type MenuLine, type Pick } from '../domain/mess';
import { amountLabel, itemFrom } from '../domain/foodSearch';
import { fmt, rounded } from '../domain/nutrition';
import { today } from '../domain/clock';
import type { MealSlot } from '../domain/types';

const EXAMPLE = 'Dal makhani\nAloo gobi\nJeera rice\nRoti\nBoondi raita\nKheer';

/** W12 · Mess mode (S14.2, Pro): read tonight's menu, get what to eat and how much, log it. */
export default function W12MessMode() {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const cat = useCatalogue();
  const ai = useAiStatus();
  const t = today();
  const [mode, setMode] = useState<'Paste menu' | 'Upload photo'>('Paste menu');
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<(MenuLine & { on: boolean })[]>([]);
  const [slot, setSlot] = useState<MealSlot>(slotFor(new Date().getHours()) === 'breakfast' ? 'lunch' : slotFor(new Date().getHours()));
  const [edits, setEdits] = useState<Record<string, number>>({});
  const left = remaining(data, t).left;
  const proteinLeft = Math.max(0, data.targets.protein - dayTotals(data, t).protein);

  const read = (src: string) => {
    const l = menuFromText(src, cat).map((x) => ({ ...x, on: !!x.match }));
    if (!l.length) { toast('No dishes found. Put one dish per line.'); return; }
    setLines(l); setEdits({});
  };
  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      const img = await compressImage(f);
      setPhoto(img.url);
      if (!ai?.ai) { toast('Reading photos needs AI switched on for this site. Paste the menu text instead.'); setMode('Paste menu'); return; }
      setBusy(true);
      const out = await callAi<{ dishes: string[] }>('menu', { image: img.data, mime: img.mime });
      if (!out.dishes.length) { toast('Couldn’t find a menu in that photo. Try a closer, straighter shot, or paste the text.'); return; }
      setText(out.dishes.join('\n')); read(out.dishes.join('\n'));
      toast(`${out.dishes.length} dishes read from the photo`, 'good');
    } catch (e) { toast(e instanceof AiError ? `${e.message}. Paste the menu text instead.` : (e as Error).message); }
    finally { setBusy(false); }
  };

  const available = lines.filter((l) => l.on && l.match).map((l) => l.match!);
  const fit = useMemo(() => fitMenu(available, Math.max(0, left), proteinLeft), [available.map((a) => a.id).join(), left, proteinLeft]); // eslint-disable-line react-hooks/exhaustive-deps
  const picks: Pick[] = fit.picks.map((p) => ({ ...p, amount: edits[p.item.id] ?? p.amount })).filter((p) => p.amount > 0);
  const totals = picks.reduce((s, p) => { const m = rounded(p.item.macros(p.item.portions[p.portionIndex], p.amount)); return { kcal: s.kcal + m.kcal, protein: s.protein + m.protein }; }, { kcal: 0, protein: 0 });
  const short = Math.max(0, Math.round(Math.min(proteinLeft, data.targets.protein * 0.35) - totals.protein));

  const log = () => {
    if (!picks.length) return;
    const items = picks.map((p) => itemFrom(p.item, p.portionIndex, p.amount, newId('it')));
    dispatch({ type: 'logItems', date: t, slot, time: SLOT_TIME[slot], items });
    const unknown = lines.filter((l) => !l.match).map((l) => l.text);
    if (unknown.length) dispatch({ type: 'noteUnmatched', names: unknown, date: t });
    toast(`${SLOT_LABEL[slot]} logged from the mess menu · ${fmt(totals.kcal)} kcal`, 'good');
  };

  return (
    <AppShell active="plan" title="Plan" crumb={<>Mess mode <span className="px-pro" style={{ marginLeft: '6px' }}>Pro</span></>} cols="repeat(12, minmax(0, 1fr))" feature="messMode">
      <div className="wb-col" style={{ gridColumn: 'span 6' }}>
        <div className="px-card" style={{ gap: '12px', padding: '16px' }}>
          <div className="px-card-head">
            <span className="px-card-title">Tonight’s menu</span>
            <Tabs items={['Paste menu', 'Upload photo']} initial={mode} onChange={(v) => setMode(v as typeof mode)} />
          </div>
          {mode === 'Paste menu' ? (
            <form className="px-stack" style={{ gap: '10px' }} onSubmit={(e) => { e.preventDefault(); read(text); }}>
              <label className="px-field"><span className="l">One dish per line, or separated by commas</span>
                <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} aria-label="Menu text" className="px-textarea" />
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="px-cta" type="submit" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', padding: '0 26px' }}>Read menu</button>
                {!text ? <button className="px-pill" type="button" onClick={() => { setText(EXAMPLE); read(EXAMPLE); }}>Try an example</button> : null}
              </div>
            </form>
          ) : (
            <div className="px-stack" style={{ gap: '10px' }}>
              {photo ? <img src={photo} alt="Menu photo" className="px-menu-photo" /> : <div className="px-chart-empty" style={{ minHeight: '180px' }}>Take a clear photo of the menu board or sheet.</div>}
              <label className="px-cta" style={{ flex: '0 0 auto', alignSelf: 'flex-start', height: '46px', fontSize: '17px', padding: '0 24px', cursor: busy ? 'progress' : 'pointer' }}>
                <Icon name="camera" /> {busy ? 'Reading…' : photo ? 'Replace photo' : 'Take or choose photo'}
                <input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
              <span className="px-meta">{ai?.ai ? 'The photo is read by AI to list dishes; portions and calories come from our food table.' : 'Photo reading switches on when AI is configured for this site. Pasting the text works now.'}</span>
            </div>
          )}
          {lines.length ? (
            <div className="px-sub" style={{ padding: '2px 16px' }}>
              <span className="px-subhead" style={{ display: 'block' }}>{lines.length} dishes · untick anything you won’t have</span>
              <ul className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {lines.map((l, i) => (
                  <li key={l.text} className="px-row">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', flexGrow: 1, cursor: l.match ? 'pointer' : 'default' }}>
                      <input type="checkbox" checked={l.on} disabled={!l.match} onChange={() => setLines((ls) => ls.map((x, k) => (k === i ? { ...x, on: !x.on } : x)))} />
                      <span className="px-row-main"><span className="px-row-title">{l.text}</span><span className="px-row-sub">{l.match ? `Matched: ${l.match.name}` : 'Not in our food table yet · left out of the count'}</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      <div className="wb-col" style={{ gridColumn: 'span 6' }}>
        <div style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="wb-hero">
            <span className="px-hero-label">{SLOT_LABEL[slot]} · {fmt(Math.max(0, left))} kcal left today</span>
            <div className="fig"><span className="px-num xl">{fmt(totals.kcal)}</span><span className="px-suffix">/ {fmt(Math.max(0, left))} kcal</span></div>
            {picks.length ? <span style={{ marginTop: '6px', display: 'inline-flex', gap: '10px', flexWrap: 'wrap' }}>
              <span className={`px-status${totals.kcal <= left * 1.03 ? ' good' : ' over'}`}>{totals.kcal <= left * 1.03 ? 'Fits today' : `${fmt(totals.kcal - left)} over`}</span>
              <span className={`px-status${short ? ' over' : ' good'}`}>{short ? `Protein ${short} g short` : `Protein ${totals.protein} g`}</span>
            </span> : null}
          </div>
          <Chips label="Meal" options={SLOTS.map((s) => SLOT_LABEL[s])} value={[SLOT_LABEL[slot]]} onChange={([v]) => setSlot(SLOTS.find((s) => SLOT_LABEL[s] === v) ?? 'dinner')} />
        </div>
        <div className="px-card" style={{ gap: '0' }}>
          <div className="px-card-head"><span className="px-card-title">What to eat and how much</span>{picks.length ? <button className="px-pill sm" type="button" onClick={() => setEdits({})}>Reset</button> : null}</div>
          {picks.length ? (
            <ul className="px-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {fit.picks.map((p0) => {
                const amount = edits[p0.item.id] ?? p0.amount;
                const m = rounded(p0.item.macros(p0.item.portions[p0.portionIndex], amount));
                return (
                  <li key={p0.item.id} className="px-row" style={{ flexWrap: 'wrap', rowGap: '8px' }}>
                    <span className="px-row-icon"><Icon name="bowl" /></span>
                    <span className="px-row-main" style={{ flexBasis: 0 }}><span className="px-row-title">{p0.item.name}</span><span className="px-row-sub">{amount ? amountLabel(p0.item.portions[p0.portionIndex], amount) : 'Skip'} · P {m.protein} g</span></span>
                    <span className="px-row-end"><span className="px-row-value">{fmt(m.kcal)} kcal</span></span>
                    <QtyStepper value={Math.max(0.5, amount)} onChange={(n) => setEdits({ ...edits, [p0.item.id]: n })} label={`Amount of ${p0.item.name}`} />
                  </li>
                );
              })}
            </ul>
          ) : <div className="px-chart-empty" style={{ marginTop: '10px' }}>{lines.length ? 'Nothing fits what’s left today. A salad or a glass of buttermilk is the lightest choice.' : 'Paste or photograph the menu to see your plate.'}</div>}
          {short >= 10 && picks.length ? <div className="px-row" style={{ borderBottom: 0 }}><span className="px-row-icon"><Icon name="swap" /></span><span className="px-row-main"><span className="px-row-title">Short on protein?</span><span className="px-row-sub">Ask for curd or 2 boiled eggs if the mess has them, or have a whey shake later.</span></span></div> : null}
          {picks.length ? (
            <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', marginTop: '10px' }} onClick={log}>Log as {SLOT_LABEL[slot].toLowerCase()}</button>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
