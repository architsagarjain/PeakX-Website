import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { Chips } from './Wizard';
import { QtyStepper, useCatalogue } from './FoodLog';
import { useToast } from './Toast';
import { useStore, SLOT_TIME } from '../state/store';
import { SLOT_LABEL, SLOTS, slotFor } from '../state/selectors';
import { AiError, callAi, toBase64, useAiStatus } from '../state/ai';
import { listen, record, recordingSupported, speechRecognitionSupported } from './voice';
import { parseMeal, resolveItems, type ParsedItem } from '../domain/mealParser';
import { customItem, itemFrom, type Loggable } from '../domain/foodSearch';
import { fmt, rounded } from '../domain/nutrition';
import { today } from '../domain/clock';
import type { ISODate, MealItem, MealSlot } from '../domain/types';
import { Badge, Chip, PillButton } from './ui/blocks';

/**
 * S9.2 · Log by voice. Speak (or type) a meal in English, Hindi or both; items come back matched to the
 * food table with calories, and any item without an amount must be answered before the meal can be logged.
 * Voice path: AI transcription when /api is configured, otherwise the browser's own speech recognition.
 *
 * useVoiceLog holds the state so the Log screen can show the pending meal elsewhere (the "After this meal" band);
 * VoiceCapture is the mic and transcript, ParsedItems the review list with the missing-amount chips.
 */

type Row = ParsedItem & { key: string; touched: boolean; kcal: string; protein: string };
type Phase = 'idle' | 'listening' | 'thinking' | 'review';
const LABELS = SLOTS.map((s) => SLOT_LABEL[s]);

export function useVoiceLog(date: ISODate = today()) {
  const { dispatch, newId } = useStore();
  const toast = useToast();
  const cat = useCatalogue();
  const ai = useAiStatus();
  const [slot, setSlot] = useState<MealSlot>(date === today() ? slotFor(new Date().getHours()) : 'dinner');
  const [lang, setLang] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [secs, setSecs] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);
  const mode: 'ai' | 'browser' | 'none' = ai?.ai && recordingSupported() ? 'ai' : speechRecognitionSupported() ? 'browser' : 'none';

  useEffect(() => { if (phase !== 'listening') return; setSecs(0); const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [phase]);
  useEffect(() => () => stopRef.current?.(), []);
  useEffect(() => { setSlot(date === today() ? slotFor(new Date().getHours()) : 'dinner'); }, [date]);

  const review = (items: ParsedItem[], text: string) => {
    setTranscript(text);
    if (!items.length) { toast('No food heard. Try again, or type it below.'); setPhase('idle'); return; }
    setRows(items.map((i, k) => ({ ...i, key: `${k}-${i.query}`, touched: false, kcal: '', protein: '' })));
    setPhase('review');
  };

  const start = async () => {
    if (phase === 'listening') { stopRef.current?.(); return; }
    if (mode === 'none') { toast('Voice isn’t supported in this browser. Type the meal below instead.'); return; }
    setTranscript('');
    if (mode === 'ai') {
      try {
        const rec = await record();
        setPhase('listening');
        stopRef.current = async () => {
          stopRef.current = null;
          setPhase('thinking');
          try {
            const wav = await rec.stop();
            const out = await callAi<{ transcript: string; items: { name: string; quantity: number | null; unit: string | null; vague: boolean }[] }>('meal', { audio: await toBase64(wav), lang: lang === 'hi-IN' ? 'hi' : 'en' });
            review(resolveItems(out.items.map((i) => ({ query: i.name, qty: i.quantity, unit: i.unit, vague: i.vague, text: i.name })), cat), out.transcript);
          } catch (e) {
            toast(`${e instanceof AiError ? e.message : 'Couldn’t read the recording'}. Type it below instead.`);
            setPhase('idle');
          }
        };
      } catch (e) {
        toast((e as Error).name === 'NotAllowedError' ? 'Microphone is blocked. Allow it in your browser’s site settings, or type instead.' : 'Couldn’t start the microphone. Type the meal instead.');
      }
      return;
    }
    setPhase('listening');
    stopRef.current = listen(lang, (text, final) => {
      setTranscript(text);
      if (final) { stopRef.current = null; review(parseMeal(text, cat), text); }
    }, (err) => {
      if (err === 'not-allowed' || err === 'service-not-allowed') toast('Microphone is blocked. Allow it in your browser’s site settings, or type instead.');
      else if (err && err !== 'no-speech' && err !== 'aborted') toast('Voice stopped. Try again, or type it.');
      setPhase((p) => (p === 'listening' ? 'idle' : p));
    });
  };

  const readTyped = () => { if (typed.trim()) review(parseMeal(typed, cat), typed.trim()); };
  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows((rs) => rs.filter((x) => x.key !== key));
  const swapMatch = (r: Row, l: Loggable) => update(r.key, { match: l, alternatives: [r.match!, ...r.alternatives.filter((a) => a !== l)], portionIndex: l.defaultPortion, amount: 1, needsAmount: true, touched: false });
  const missing = (r: Row) => (r.match ? r.needsAmount && !r.touched : !(Number(r.kcal) > 0));
  const blocked = rows.filter(missing).length;
  const itemsFor = (): MealItem[] => rows.map((r) => r.match
    ? itemFrom(r.match, r.portionIndex, r.amount, newId('it'), typed && transcript === typed.trim() ? 'typed' : 'voice')
    : customItem(r.query, Number(r.kcal), Number(r.protein || 0), newId('it')));
  const total = rows.reduce((s, r) => {
    if (r.match) { const m = rounded(r.match.macros(r.match.portions[r.portionIndex], r.amount)); return { kcal: s.kcal + m.kcal, protein: s.protein + m.protein }; }
    return { kcal: s.kcal + (Number(r.kcal) || 0), protein: s.protein + (Number(r.protein) || 0) };
  }, { kcal: 0, protein: 0 });
  const reset = () => { setRows([]); setPhase('idle'); setTranscript(''); setTyped(''); };

  const log = () => {
    if (blocked) { toast(`Add the amount for ${blocked} item${blocked > 1 ? 's' : ''} first.`); return; }
    const items = itemsFor();
    dispatch({ type: 'logItems', date, slot, time: SLOT_TIME[slot], items });
    const unknown = rows.filter((r) => !r.match).map((r) => r.query);
    if (unknown.length) dispatch({ type: 'noteUnmatched', names: unknown, date });
    toast(`${SLOT_LABEL[slot]} logged · ${fmt(total.kcal)} kcal`, 'good');
    reset();
  };

  return {
    date, slot, setSlot, lang, setLang, phase, transcript, typed, setTyped, rows, secs, mode,
    start, readTyped, update, remove, swapMatch, missing, blocked, total, reset, log,
    pending: phase === 'review' && rows.length > 0,
  };
}
export type VoiceLog = ReturnType<typeof useVoiceLog>;

/** Mic, live status and transcript, plus the typed fallback. */
export function VoiceCapture({ v }: { v: VoiceLog }) {
  const live = v.phase === 'listening';
  const status = live ? 'Listening… say what you ate, with amounts'
    : v.phase === 'thinking' ? 'Reading your meal…'
    : v.pending ? 'Got it. Check the items below.'
    : 'Tap the mic and say what you ate';
  return (
    <section className={`ui-card lg-capture${live ? ' live' : ''}`} aria-label="Log by voice">
      <div className="lg-capture-top">
        <span className="lg-status"><i className={live ? 'on' : undefined} />{status}</span>
        <div className="lg-capture-opts">
          {live ? <Badge>0:{String(v.secs).padStart(2, '0')}</Badge> : null}
          <Chips label="Language" options={['English', 'Hindi']} value={[v.lang === 'en-IN' ? 'English' : 'Hindi']} onChange={([x]) => v.setLang(x === 'Hindi' ? 'hi-IN' : 'en-IN')} />
        </div>
      </div>
      <div className="lg-mic-row">
        <button className={`lg-mic${live ? ' live' : ''}`} type="button" aria-label={live ? 'Stop and read the meal' : 'Start speaking'} aria-pressed={live} onClick={v.start} disabled={v.phase === 'thinking'}>
          <Icon name={live ? 'pause' : 'mic'} />
        </button>
        <div className="lg-wave" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ animationDelay: `${(i % 7) * 0.09}s` }} />)}</div>
        <span className="lg-mode">{v.mode === 'none' ? 'Voice isn’t available in this browser; typing works the same' : v.mode === 'ai' ? 'English, Hindi or both' : 'Uses your browser’s speech recognition'}</span>
      </div>
      <div className="lg-transcript">
        <span className="ui-label">{v.transcript ? 'What we heard' : 'Try saying'}</span>
        <p aria-live="polite">{v.transcript ? `“${v.transcript}”` : '“do roti, ek katori dal aur thoda chawal”'}</p>
      </div>
      <form className="lg-type" onSubmit={(e) => { e.preventDefault(); v.readTyped(); }}>
        <input type="text" value={v.typed} onChange={(e) => v.setTyped(e.target.value)} placeholder="Or type it: 2 roti, 1 katori dal makhani" aria-label="Type what you ate" />
        <PillButton type="submit" size="sm" variant="ghost">Read it</PillButton>
      </form>
    </section>
  );
}

/** The parsed items. An item with no amount shows "Portion needed" and portion chips; logging waits until each is answered. */
export function ParsedItems({ v, left }: { v: VoiceLog; left: number }) {
  if (!v.pending) return null;
  const after = left - v.total.kcal;
  return (
    <section className="ui-card lg-parsed" aria-label="Check the items">
      <div className="ui-card-head">
        <div>
          <h2 className="ui-card-title">We heard {v.rows.length} item{v.rows.length > 1 ? 's' : ''}</h2>
          <span className="ui-label">{v.blocked ? `${v.blocked} need${v.blocked > 1 ? '' : 's'} an amount` : 'Tap a portion to change it'}</span>
        </div>
        <Chips label="Meal" options={LABELS} value={[SLOT_LABEL[v.slot]]} onChange={([x]) => v.setSlot(SLOTS[LABELS.indexOf(x)] ?? 'dinner')} />
      </div>
      <ul className="lg-items">
        {v.rows.map((r) => {
          const m = r.match ? rounded(r.match.macros(r.match.portions[r.portionIndex], r.amount)) : null;
          const need = v.missing(r);
          const name = r.match?.name ?? r.query;
          const said = r.vague ? r.text.match(/thoda|thodi|kuch|little|some|bit/i)?.[0] ?? 'a little' : null;
          return (
            <li key={r.key} className={`lg-item${need ? ' need' : ''}`}>
              <div className="lg-item-top">
                <span className="lg-item-icon"><Icon name={r.match?.kind === 'ingredient' ? 'leaf' : r.match?.kind === 'recipe' ? 'doc' : 'bowl'} /></span>
                <div className="lg-item-main">
                  <span className="lg-item-name">
                    {name}
                    {r.match && !need ? <Chip>{r.match.portions[r.portionIndex].label}{r.amount !== 1 ? ` × ${r.amount}` : ''}</Chip> : null}
                    {need ? <Chip tone="coral">{r.match ? 'Portion needed' : 'Not in our food table'}</Chip> : null}
                  </span>
                  <span className="lg-item-sub">
                    {m ? <>{need ? 'Estimated ' : ''}<b>{fmt(m.kcal)} kcal</b> · Protein {m.protein} g · Carbs {m.carbs} g · Fat {m.fat} g</> : 'Add calories, or remove it'}
                  </span>
                </div>
                <button className="lg-x" type="button" aria-label={`Remove ${name}`} onClick={() => v.remove(r.key)}><Icon name="close" /></button>
              </div>
              {r.match ? (
                <div className="lg-item-fix">
                  {need ? <span className="lg-q">{said ? `You said “${said}”. How much ${r.match.name.toLowerCase()}?` : `How much ${r.match.name.toLowerCase()}?`}</span> : null}
                  <div className="lg-fix-row">
                    <Chips label={`Portion for ${r.match.name}`} options={r.match.portions.map((p) => p.label)} value={need ? [] : [r.match.portions[r.portionIndex].label]}
                      onChange={([x]) => v.update(r.key, { portionIndex: r.match!.portions.findIndex((p) => p.label === x), touched: true })} />
                    {need ? null : <QtyStepper value={r.amount} onChange={(n) => v.update(r.key, { amount: n, touched: true })} label={`Quantity of ${r.match.name}`} />}
                  </div>
                  {r.alternatives.length ? <span className="ui-label">Not it? {r.alternatives.slice(0, 3).map((a, i) => <button key={a.id} type="button" className="px-link" onClick={() => v.swapMatch(r, a)}>{i ? ', ' : ''}{a.name}</button>)}</span> : null}
                </div>
              ) : (
                <div className="px-fields lg-item-fix">
                  <label className="px-field"><span className="l">Calories</span><span className="px-field-row"><input inputMode="numeric" value={r.kcal} onChange={(e) => v.update(r.key, { kcal: e.target.value.replace(/[^0-9]/g, '') })} aria-label={`Calories for ${r.query}`} /><span className="sfx">kcal</span></span></label>
                  <label className="px-field"><span className="l">Protein (optional)</span><span className="px-field-row"><input inputMode="numeric" value={r.protein} onChange={(e) => v.update(r.key, { protein: e.target.value.replace(/[^0-9]/g, '') })} aria-label={`Protein for ${r.query}`} /><span className="sfx">g</span></span></label>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="lg-total">
        <div>
          <span className="ui-label">{SLOT_LABEL[v.slot]} total{v.blocked ? ' so far' : ''}</span>
          <div className="ui-stat-fig"><span className="ui-stat-num lg-total-num">{fmt(v.total.kcal)}</span><span className="ui-stat-unit">kcal · {fmt(v.total.protein)} g protein · {after >= 0 ? `${fmt(after)} left today` : `${fmt(-after)} over`}</span></div>
        </div>
        <div className="lg-total-actions">
          <PillButton variant="ghost" onClick={v.reset}>Start over</PillButton>
          <PillButton onClick={v.log} icon={v.blocked ? undefined : 'check'} aria-label={v.blocked ? `Add the amount for ${v.blocked} item${v.blocked > 1 ? 's' : ''} first` : undefined}>
            {v.blocked ? `${v.blocked} amount${v.blocked > 1 ? 's' : ''} to add` : `Save to ${SLOT_LABEL[v.slot].toLowerCase()}`}
          </PillButton>
        </div>
      </div>
    </section>
  );
}
