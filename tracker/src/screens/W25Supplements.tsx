import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { ChoiceGroup } from '../components/ui';
import { AppShell } from '../components/Shell';
import { Chips, Field, Progress, StepRail, WizardNav } from '../components/Wizard';
import { useStore } from '../state/store';
import { callAi, toBase64, useAiStatus } from '../state/ai';
import { track } from '../state/telemetry';
import { MARKERS, markerDef, matchMarker, rangeText, statusOf, toStandard } from '../domain/labs';
import { addDays, longDate, today } from '../domain/clock';
import type { LabReport } from '../domain/types';
import {
  DIET_OPTIONS, EX_OPTIONS, EX_TYPES, FLAG_OPTIONS, FOOD_ROWS, FREQ_OPTIONS, PRIORITY_LABEL, RECENT_DAYS, RESULT_STEP, SEX_OPTIONS, SUN_OPTIONS,
  SUPP_OPTIONS, SUPP_STEPS, buildProtocol, buyLinks, emptySupplements, foodRowsFor, prefillAnswers, previewOf, protocolText, suppName, toggleFlag,
  validateSuppStep, type CurrentSupp, type Protocol, type ProtocolItem, type SuppAnswers, type SuppId,
} from '../domain/supplements';

const N = SUPP_STEPS.length;
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const isOld = (d: string) => d < addDays(today(), -RECENT_DAYS);
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/[^\d.]/g, '')));

/** W25 · Supplement protocol (S18.3). 10 questions → confirm blood work → free preview → full protocol with brands (Pro). */
export default function W25Supplements() {
  const { data, dispatch } = useStore();
  const toast = useToast();
  const st = data.supplements ?? emptySupplements();
  const a = st.answers;
  const done = st.step >= RESULT_STEP && !!st.completedOn;
  const qi = Math.min(st.step, N - 1);
  const q = SUPP_STEPS[qi];
  const [err, setErr] = useState('');
  const [consent, setConsent] = useState(!!st.consentAt);
  const set = (patch: Partial<SuppAnswers>) => { setErr(''); dispatch({ type: 'suppSet', patch }); };
  const go = (s: number) => { setErr(''); dispatch({ type: 'suppGo', step: s }); };

  // Fill what the plan setup already knows, once, without overwriting answers.
  const lastKg = data.weights[data.weights.length - 1]?.kg ?? null;
  useEffect(() => {
    if (a.age != null || !data.profile.age) return;
    const next = prefillAnswers(a, data.profile, lastKg);
    if (JSON.stringify(next) !== JSON.stringify(a)) dispatch({ type: 'suppSet', patch: next });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reached = useMemo(() => {
    let i = 0;
    while (i < N && !validateSuppStep(SUPP_STEPS[i].id, a)) i++;
    return done ? N : Math.min(N - 1, Math.max(st.step, i));
  }, [a, st.step, done]);

  const next = () => {
    const e = validateSuppStep(q.id, a);
    if (e) { setErr(e); return; }
    if (qi === 0 && !st.completedOn) track('supplement_check_started');
    if (qi < N - 1) { go(qi + 1); return; }
    if (!consent) { setErr('Tick the box to confirm you’ve read this.'); return; }
    dispatch({ type: 'suppComplete', date: today(), consentAt: new Date().toISOString() });
    track('supplement_check_completed', { bloodwork: a.bloodwork ?? 'none' });
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== 'Enter' || t.closest('input, textarea, select, button, a, [role="dialog"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault(); next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const rail = (
    <StepRail tag={done ? 'Your protocol' : `Question ${qi + 1} of ${N}`} steps={[...SUPP_STEPS.map((s) => s.nav), 'Your protocol']}
      current={done ? N : qi} reached={reached} onJump={(i) => (i >= N ? null : go(i))}
      done={[...SUPP_STEPS.map((s) => !validateSuppStep(s.id, a)), done]}
      note={done ? 'Change any answer and press Next to rebuild the protocol.' : 'About 3 minutes. Saved as you go, so you can leave and come back.'} />
  );

  return (
    <AppShell active="supps" title="Supplement protocol" cols="minmax(0, 1fr)"
      crumb={done ? <>Built {st.completedOn ? longDate(st.completedOn) : 'today'} from your answers{a.bloodwork === 'report' ? ' and blood work' : ''}</> : <>Question {qi + 1} of {N} · what to take, how much and which brand</>}>
      <div className="px-wizard">
        {rail}
        {done ? <ProtocolView onEdit={(s) => { dispatch({ type: 'suppGo', step: s }); if (s === 0) toast('Your answers are kept. Change what’s different.'); }} /> : (
          <>
            <section className="px-card sp-q" aria-labelledby="sq">
              <Progress value={qi / N} label="Supplement check progress" />
              <div>
                <span className="px-tag">{qi + 1} of {N}</span>
                <h2 id="sq" className="px-q" style={{ marginTop: '8px' }}>{q.title}</h2>
                <p className="px-body grey" style={{ margin: '6px 0 0' }}>{q.help}</p>
              </div>
              <StepBody id={q.id} a={a} set={set} />
              {qi === N - 1 ? (
                <label className="sp-consent">
                  <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(''); }} />
                  <span>I understand this is general guidance, not a diagnosis or prescription, and I’ll check with a doctor or pharmacist before starting anything new.</span>
                </label>
              ) : null}
              {err ? <span className="px-err" role="alert">{err}</span> : null}
              <WizardNav onBack={qi > 0 ? () => go(qi - 1) : undefined} onNext={next} nextDisabled={!!validateSuppStep(q.id, a) || (qi === N - 1 && !consent)}
                nextLabel={qi === N - 1 ? 'Build my protocol' : 'Next'} />
            </section>
            <aside className="px-card sp-aside">
              <span className="px-card-title">What you’ll get</span>
              <ul className="sp-list">
                <li><Icon name="check" />Each supplement with dose, timing, frequency and how long</li>
                <li><Icon name="check" />Which brand to buy, with links, filtered for your diet</li>
                <li><Icon name="check" />Safety checks for your conditions and medicines</li>
                <li><Icon name="check" />Lab values used only after you confirm them</li>
              </ul>
              <span className="px-meta">We never call something a deficiency without a blood test. Not medical advice.</span>
            </aside>
          </>
        )}
      </div>
    </AppShell>
  );

}

/** The input for one question. */
function StepBody({ id, a, set }: { id: (typeof SUPP_STEPS)[number]['id']; a: SuppAnswers; set: (p: Partial<SuppAnswers>) => void }) {
  switch (id) {
    case 'age':
      return (
        <div className="px-fields" style={{ gridTemplateColumns: 'minmax(0, 220px)' }}>
          <Field label="Age" suffix="years">
            <input inputMode="numeric" autoFocus value={a.age ?? ''} onChange={(e) => set({ age: num(e.target.value) })} aria-label="Age in years" placeholder="26" />
          </Field>
        </div>
      );
    case 'sex':
      return <Pick label="Sex" options={SEX_OPTIONS} value={a.sex} onChange={(v) => set({ sex: v })} />;
    case 'body':
      return (
        <div className="px-fields">
          <Field label="Height" suffix="cm"><input inputMode="decimal" value={a.heightCm ?? ''} onChange={(e) => set({ heightCm: num(e.target.value) })} aria-label="Height in cm" placeholder="175" /></Field>
          <Field label="Weight" suffix="kg"><input inputMode="decimal" value={a.weightKg ?? ''} onChange={(e) => set({ weightKg: num(e.target.value) })} aria-label="Weight in kg" placeholder="72" /></Field>
        </div>
      );
    case 'diet': {
      const i = DIET_OPTIONS.findIndex((o) => o.id === a.diet);
      return <ChoiceGroup key="diet" label="Dietary pattern" className="px-choices" options={DIET_OPTIONS.map((o) => ({ t: o.t, m: o.m }))} value={i} onChange={(k) => set({ diet: DIET_OPTIONS[k].id })} />;
    }
    case 'foods':
      return (
        <div className="sp-matrix">
          {FOOD_ROWS.filter((r) => foodRowsFor(a.diet).includes(r.id)).map((r) => (
            <div key={r.id} className="sp-matrix-row">
              <span className="sp-matrix-label">{r.id === 'dairy' && a.diet === 'vegan' ? 'Fortified plant milk, curd or tofu' : r.t}</span>
              <Pick label={r.t} small options={FREQ_OPTIONS} value={a.food[r.id] ?? null} onChange={(v) => set({ food: { ...a.food, [r.id]: v } })} />
            </div>
          ))}
        </div>
      );
    case 'sun':
      return <Pick label="Direct sunlight" options={SUN_OPTIONS} value={a.sun} onChange={(v) => set({ sun: v })} />;
    case 'exercise':
      return (
        <div className="px-stack" style={{ gap: '14px' }}>
          <Pick label="Exercise days" options={EX_OPTIONS} value={a.exercise} onChange={(v) => set({ exercise: v, exerciseType: v === '0' ? null : a.exerciseType })} />
          {a.exercise && a.exercise !== '0' ? (
            <div className="sp-sub">
              <span className="px-subhead">Mostly</span>
              <Pick label="Kind of training" small options={EX_TYPES} value={a.exerciseType} onChange={(v) => set({ exerciseType: v })} />
            </div>
          ) : null}
        </div>
      );
    case 'safety':
      return (
        <div className="px-stack" style={{ gap: '12px' }}>
          <div className="px-chips" role="group" aria-label="Health conditions">
            {FLAG_OPTIONS.map((o) => {
              const on = a.flags.includes(o.id);
              return <button key={o.id} type="button" role="checkbox" aria-checked={on} className={`px-pill sp-pill${on ? ' on' : ''}`} onClick={() => set({ flags: toggleFlag(a.flags, o.id) })}>{o.t}</button>;
            })}
          </div>
          {a.flags.includes('other') ? (
            <Field label="Which condition?"><input value={a.otherCondition} maxLength={120} onChange={(e) => set({ otherCondition: e.target.value })} aria-label="Other condition" placeholder="e.g. PCOS, IBS" /></Field>
          ) : null}
          {a.flags.includes('pregnancy') ? <span className="sp-note warn"><Icon name="shield" />We won’t build an automated protocol for this. You’ll get a note to take to your doctor.</span> : null}
        </div>
      );
    case 'meds':
      return <MedsStep a={a} set={set} />;
    case 'labs':
      return <LabsStep a={a} set={set} />;
  }
}

/** Single-select pills. */
function Pick<T extends string>({ label, options, value, onChange, small }: { label: string; options: { id: T; t: string }[]; value: T | null; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className="px-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={`px-pill sp-pill${small ? ' sm' : ''}${value === o.id ? ' on' : ''}`} onClick={() => onChange(o.id)}>{o.t}</button>
      ))}
    </div>
  );
}

const YES_NO: { id: 'yes' | 'no'; t: string }[] = [{ id: 'yes', t: 'Yes' }, { id: 'no', t: 'No' }];
const yn = (v: boolean | null) => (v == null ? null : v ? 'yes' : 'no');

function MedsStep({ a, set }: { a: SuppAnswers; set: (p: Partial<SuppAnswers>) => void }) {
  const picked = a.current.map((c) => c.id);
  const toggle = (id: SuppId) => set({ current: picked.includes(id) ? a.current.filter((c) => c.id !== id) : [...a.current, { id, product: '', dose: '', freq: '' }] });
  const edit = (id: SuppId, patch: Partial<CurrentSupp>) => set({ current: a.current.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  return (
    <div className="px-stack" style={{ gap: '16px' }}>
      <div className="sp-sub">
        <span className="px-subhead">Prescription or regular medicines</span>
        <Pick label="Regular medicines" options={YES_NO} value={yn(a.meds)} onChange={(v) => set({ meds: v === 'yes' })} />
        {a.meds ? <Field label="Which ones? (optional)"><input value={a.medNames} maxLength={160} onChange={(e) => set({ medNames: e.target.value })} aria-label="Medicine names" placeholder="e.g. thyroxine 50 mcg, metformin" /></Field> : null}
      </div>
      <div className="sp-sub">
        <span className="px-subhead">Supplements</span>
        <Pick label="Supplements" options={YES_NO} value={yn(a.takesSupps)} onChange={(v) => set({ takesSupps: v === 'yes', current: v === 'yes' ? a.current : [] })} />
        {a.takesSupps ? (
          <>
            <div className="px-chips" role="group" aria-label="Supplements you take">
              {SUPP_OPTIONS.map((o) => <button key={o.id} type="button" role="checkbox" aria-checked={picked.includes(o.id)} className={`px-pill sm sp-pill${picked.includes(o.id) ? ' on' : ''}`} onClick={() => toggle(o.id)}>{o.t}</button>)}
            </div>
            {a.current.length ? (
              <div className="sp-current">
                <span className="px-meta">Optional: brand, dose and how often. Helps us check you don’t double up.</span>
                {a.current.map((c) => (
                  <div key={c.id} className="sp-current-row">
                    <b>{suppName(c.id)}</b>
                    <input value={c.product} maxLength={60} placeholder="Brand or product" aria-label={`${suppName(c.id)} brand`} onChange={(e) => edit(c.id, { product: e.target.value })} />
                    <input value={c.dose} maxLength={30} placeholder="Dose, e.g. 1,000 IU" aria-label={`${suppName(c.id)} dose`} onChange={(e) => edit(c.id, { dose: e.target.value })} />
                    <input value={c.freq} maxLength={30} placeholder="How often" aria-label={`${suppName(c.id)} frequency`} onChange={(e) => edit(c.id, { freq: e.target.value })} />
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

interface Row { id: string; value: string }
interface Draft { date: string; fileName: string | null; source: 'ai' | 'manual'; rows: Row[]; unmatched: string[] }

/** Q10: pick a saved report, upload a new one (read, then confirmed by the member), or skip. */
function LabsStep({ a, set }: { a: SuppAnswers; set: (p: Partial<SuppAnswers>) => void }) {
  const { data, dispatch, newId } = useStore();
  const toast = useToast();
  const ai = useAiStatus();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sex = a.sex === 'female' ? 'female' : 'male';
  const manual = (fileName: string | null = null): Draft => ({ date: today(), fileName, source: 'manual', rows: MARKERS.map((m) => ({ id: m.id, value: '' })), unmatched: [] });

  const read = async (f: File | undefined) => {
    setErr('');
    if (!f) return;
    if (!/pdf|image\//.test(f.type)) { setErr('Use a PDF or a photo of the report.'); return; }
    if (f.size > 8 * 1024 * 1024) { setErr('That file is over 8 MB. Export a smaller PDF or photograph one page at a time.'); return; }
    if (!ai?.ai) { setDraft(manual(f.name)); toast('Type the numbers from your report; automatic reading isn’t switched on here.'); return; }
    setBusy(true);
    try {
      const out = await callAi<{ date: string | null; markers: { name: string; value: number; unit: string }[] }>('labs', { file: await toBase64(f), mime: f.type === 'image/jpg' ? 'image/jpeg' : f.type }, 90000);
      const rows: Row[] = [], unmatched: string[] = [];
      for (const m of out.markers) {
        const def = matchMarker(m.name);
        if (!def) { unmatched.push(m.name); continue; }
        if (!rows.some((r) => r.id === def.id)) rows.push({ id: def.id, value: String(toStandard(def, m.value, m.unit)) });
      }
      if (!rows.length) { setDraft(manual(f.name)); toast('Couldn’t find the markers we use in that file. Type them in instead.'); return; }
      setDraft({ date: out.date ?? today(), fileName: f.name, source: 'ai', rows, unmatched: unmatched.slice(0, 20) });
    } catch { setDraft(manual(f.name)); toast('Couldn’t read that file. Type the numbers from your report instead.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };

  const save = () => {
    if (!draft) return;
    const markers = draft.rows.filter((r) => r.value.trim() && Number(r.value) > 0).map((r) => ({ id: r.id, value: Math.round(Number(r.value) * 100) / 100, unit: markerDef(r.id)!.unit }));
    if (!markers.length) { setErr('Add at least one value, or pick another option below.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || draft.date > today()) { setErr('Check the report date.'); return; }
    const report: LabReport = { id: newId('lab'), date: draft.date, fileName: draft.fileName, source: draft.source, markers, coachCheck: null, sentForCheck: false, retestOn: addDays(draft.date, 90) };
    dispatch({ type: 'saveLab', lab: report });
    track('labs_saved', { markers: markers.length, from: 'supplements' });
    set({ bloodwork: 'report', labId: report.id });
    setDraft(null); setErr('');
    toast(`${markers.length} value${markers.length === 1 ? '' : 's'} confirmed.`, 'good');
  };

  if (draft) {
    return (
      <div className="sp-labs">
        <div className="px-card-head"><span className="px-card-title">{draft.source === 'ai' ? 'Check the numbers we read' : 'Type the numbers from your report'}</span><span className="px-meta">{draft.fileName ?? 'No file'}</span></div>
        <span className="px-body grey">{draft.source === 'ai' ? 'Compare each value with your report and fix anything that’s off. Nothing is used until you confirm.' : 'Fill in what your report has and leave the rest empty. Use the units shown.'}</span>
        <label className="px-field" style={{ maxWidth: '260px' }}><span className="l">Report date</span><span className="px-field-row"><input type="date" value={draft.date} max={today()} onChange={(e) => setDraft({ ...draft, date: e.target.value })} aria-label="Report date" /></span></label>
        {isOld(draft.date) ? <span className="sp-note"><Icon name="clock" />Over 6 months old: we’ll keep it as history but won’t use the values for doses.</span> : null}
        <div className="px-list">
          {draft.rows.map((r, i) => {
            const def = markerDef(r.id)!; const v = Number(r.value);
            const s = r.value && v > 0 ? statusOf(def, v, sex) : null;
            return (
              <div key={r.id} className="px-row px-lab-row">
                <span className="px-row-main"><span className="px-row-title">{def.name}</span><span className="px-row-sub">{rangeText(def, sex)}</span></span>
                <span className="px-field-row px-lab-input"><input inputMode="decimal" value={r.value} placeholder="–" aria-label={`${def.name} in ${def.unit}`} onChange={(e) => setDraft({ ...draft, rows: draft.rows.map((x, j) => (j === i ? { ...x, value: e.target.value.replace(/[^\d.]/g, '') } : x)) })} /><span className="sfx">{def.unit}</span></span>
                <span className="px-row-end" style={{ minWidth: '64px' }}>{s ? <span className={`px-status ${s === 'normal' ? 'good' : 'over'}`}>{s === 'normal' ? 'Normal' : s === 'low' ? 'Low' : 'High'}</span> : null}</span>
              </div>
            );
          })}
        </div>
        {draft.source === 'ai' ? <button className="px-pill sm" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => setDraft({ ...draft, rows: [...draft.rows, ...MARKERS.filter((m) => !draft.rows.some((r) => r.id === m.id)).map((m) => ({ id: m.id, value: '' }))] })}>Add a marker we missed</button> : null}
        {draft.unmatched.length ? <span className="px-meta">Also on the report, not used: {draft.unmatched.join(', ')}</span> : null}
        {err ? <span className="px-err" role="alert">{err}</span> : null}
        <div className="sp-row-actions">
          <button className="px-pill" type="button" onClick={() => { setDraft(null); setErr(''); }}>Cancel</button>
          <button className="px-pill on" type="button" onClick={save}>Confirm these values</button>
        </div>
      </div>
    );
  }

  const chosen = a.bloodwork === 'report' ? data.labs.find((l) => l.id === a.labId) : null;
  return (
    <div className="px-stack" style={{ gap: '12px' }}>
      <input ref={input} type="file" accept="application/pdf,image/*" hidden onChange={(e) => read(e.target.files?.[0])} />
      {data.labs.length ? (
        <div className="sp-sub">
          <span className="px-subhead">Use a report you added before</span>
          <div className="px-chips">
            {data.labs.slice(0, 4).map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={a.labId === l.id} className={`px-pill sp-pill${a.labId === l.id && a.bloodwork === 'report' ? ' on' : ''}`} onClick={() => set({ bloodwork: 'report', labId: l.id })}>
                {fmtDate(l.date)} · {l.markers.length} values{isOld(l.date) ? ' · old' : ''}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="sp-upload">
        <button className="px-pill sp-pill" type="button" onClick={() => input.current?.click()} disabled={busy}><Icon name="upload" />{busy ? 'Reading your report…' : 'Upload PDF or photo'}</button>
        <button className="px-pill sp-pill" type="button" onClick={() => setDraft(manual())}><Icon name="edit" />Type the numbers</button>
      </div>
      <span className="px-meta">We read vitamin D, B12, ferritin, haemoglobin, sugar, cholesterol, thyroid and uric acid. You check every value before we use it.</span>
      <div className="px-chips" role="radiogroup" aria-label="No report">
        <button type="button" role="radio" aria-checked={a.bloodwork === 'none'} className={`px-pill sp-pill${a.bloodwork === 'none' ? ' on' : ''}`} onClick={() => set({ bloodwork: 'none', labId: null })}>I don’t have recent blood work</button>
        <button type="button" role="radio" aria-checked={a.bloodwork === 'skip'} className={`px-pill sp-pill${a.bloodwork === 'skip' ? ' on' : ''}`} onClick={() => set({ bloodwork: 'skip', labId: null })}>Skip for now</button>
      </div>
      {chosen ? <span className="sp-note good"><Icon name="check" />Using {chosen.markers.length} confirmed value{chosen.markers.length === 1 ? '' : 's'} from {fmtDate(chosen.date)}{isOld(chosen.date) ? ' (over 6 months old: kept as history only)' : ''}.</span> : null}
      {err ? <span className="px-err" role="alert">{err}</span> : null}
    </div>
  );
}

/** Result: free preview with safety alerts, then the full protocol for Pro. */
function ProtocolView({ onEdit }: { onEdit: (step: number) => void }) {
  const onRetake = () => onEdit(0);
  const { data, can } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const st = data.supplements ?? emptySupplements();
  const a = st.answers;
  const lab = a.bloodwork === 'report' ? data.labs.find((l) => l.id === a.labId) ?? null : null;
  const p: Protocol = useMemo(() => buildProtocol(a, lab, st.completedOn ?? today()), [a, lab, st.completedOn]);
  const pv = previewOf(p);
  const paid = can('supplements');
  const text = () => protocolText(p, data.profile.name, st.completedOn ?? today());
  const copy = async () => { try { await navigator.clipboard.writeText(text()); toast('Copied. Paste it in WhatsApp or email to your doctor.', 'good'); } catch { toast('Couldn’t copy. Use Download instead.'); } };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text()], { type: 'text/plain' }));
    const el = document.createElement('a'); el.href = url; el.download = `peakx-supplement-protocol-${st.completedOn ?? today()}.txt`; document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  if (p.blocked) {
    return (
      <section className="px-card sp-q" aria-labelledby="sr">
        <span className="px-tag">Your assessment is complete</span>
        <h2 id="sr" className="px-q">We need your doctor for this one</h2>
        <p className="px-body">{p.blocked}</p>
        {p.alerts.map((x) => <AlertRow key={x.title} x={x} />)}
        <div className="px-wiz-actions"><button className="px-cta glass" type="button" onClick={onRetake}>Change my answers</button><span /></div>
      </section>
    );
  }

  const live = p.items.filter((i) => i.priority !== 'not_recommended');
  const skipped = p.items.filter((i) => i.priority === 'not_recommended');
  return (
    <>
      <div className="sp-result">
        <section className="px-card sp-q sp-summary" aria-labelledby="sr">
          <span className="px-tag">Your assessment is complete</span>
          <h2 id="sr" className="px-q">{pv.count ? <>{pv.count} recommendation{pv.count === 1 ? '' : 's'} for you</> : 'Nothing to add right now'}</h2>
          <p className="px-body grey" style={{ margin: 0 }}>
            {pv.count ? 'Built from your answers' : 'From your answers, there’s no supplement worth adding. Food covers it'}{p.biomarkers.used ? ` and ${p.biomarkers.used} blood marker${p.biomarkers.used === 1 ? '' : 's'} you confirmed` : ''}.
          </p>
          {pv.categories.length ? <div className="px-chips">{pv.categories.map((c) => <span key={c.name} className="sp-cat">{c.name} · {c.count}</span>)}</div> : null}
          {p.biomarkers.read ? (
            <span className="sp-note good"><Icon name="drop" />{p.biomarkers.read} value{p.biomarkers.read === 1 ? '' : 's'} read and confirmed from your report of {fmtDate(p.biomarkers.date!)}{p.biomarkers.historical ? ', kept as history (over 6 months old)' : `; ${p.biomarkers.used} used`}.</span>
          ) : <span className="sp-note"><Icon name="drop" />No blood work used. Adding a recent report makes vitamin D, B12 and iron specific.</span>}
          {pv.alerts.map((x) => <AlertRow key={x.title} x={x} />)}
          {!paid && pv.count ? (
            <div className="sp-locked" aria-label="Locked protocol">
              {live.map((it, i) => (
                <div key={it.id} className="sp-locked-row"><span className="px-row-icon"><Icon name="lock" /></span><span className="px-row-main"><span className="px-row-title">Recommendation {i + 1}</span><span className="px-row-sub">{it.category} · supplement, dose, timing and brand inside</span></span></div>
              ))}
              <button className="px-cta" type="button" onClick={() => { track('supplement_unlock_clicked'); navigate('/app/upgrade'); }}>Unlock My Personal Supplement Protocol</button>
              <span className="px-meta">Included with PeakX Pro.</span>
            </div>
          ) : null}
        </section>
        <aside className="px-card sp-aside">
          <span className="px-card-title">Keep it</span>
          {paid ? (
            <>
              <button className="px-pill" type="button" onClick={copy}><Icon name="share" />Copy for my doctor</button>
              <button className="px-pill" type="button" onClick={download}><Icon name="download" />Download</button>
            </>
          ) : null}
          <button className="px-pill" type="button" onClick={onRetake}><Icon name="edit" />Change my answers</button>
          {!lab ? <button className="px-pill" type="button" onClick={() => onEdit(SUPP_STEPS.length - 1)}><Icon name="upload" />Add blood work</button> : null}
          <span className="px-meta">Rules {p.rulesVersion} · questions {p.questionnaireVersion}{st.consentAt ? ` · consent ${fmtDate(st.consentAt.slice(0, 10))}` : ''}</span>
          <span className="px-meta">General guidance, reviewed by the PeakX coaching team. Not a diagnosis or prescription.</span>
        </aside>
      </div>

      {paid ? (
        <div className="sp-items">
          {live.map((it) => <ItemCard key={it.id} it={it} />)}
          {skipped.length ? (
            <section className="px-card sp-skipped">
              <span className="px-card-title">Not recommended for you</span>
              {skipped.map((it) => (
                <div key={it.id} className="px-row" style={{ alignItems: 'flex-start' }}>
                  <span className="px-row-icon"><Icon name="close" /></span>
                  <span className="px-row-main"><span className="px-row-title">{it.name}</span><span className="sp-why">{it.why}</span>{it.howTo !== '—' ? <span className="px-row-sub">{it.howTo}</span> : null}<span className="sp-trace">Rule {it.rule} · from {it.basis.join('; ')}</span></span>
                </div>
              ))}
            </section>
          ) : null}
          {p.alerts.filter((x) => x.level === 'info').length ? (
            <section className="px-card sp-skipped">
              <span className="px-card-title">Good to know</span>
              {p.alerts.filter((x) => x.level === 'info').map((x) => <AlertRow key={x.title} x={x} />)}
            </section>
          ) : null}
          {a.current.length ? (
            <section className="px-card sp-skipped">
              <span className="px-card-title">What you already take</span>
              {a.current.map((c) => (
                <div key={c.id} className="px-row"><span className="px-row-main"><span className="px-row-title">{suppName(c.id)}</span><span className="px-row-sub">{[c.product, c.dose, c.freq].filter((x) => x.trim()).join(' · ') || 'No details given'}</span></span></div>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function AlertRow({ x }: { x: { level: 'stop' | 'review' | 'info'; title: string; detail: string } }) {
  return (
    <div className={`sp-alert l-${x.level}`} role={x.level === 'stop' ? 'alert' : undefined}>
      <Icon name={x.level === 'info' ? 'spark' : 'shield'} />
      <div><b>{x.title}</b><span>{x.detail}</span></div>
    </div>
  );
}

function ItemCard({ it }: { it: ProtocolItem }) {
  return (
    <article className={`px-card sp-item p-${it.priority}`} aria-labelledby={`si-${it.id}`}>
      <div className="sp-item-head">
        <div>
          <span className="px-meta">{it.category}</span>
          <h3 id={`si-${it.id}`} className="sp-item-title">{it.name}</h3>
        </div>
        <span className={`sp-prio p-${it.priority}`}>{PRIORITY_LABEL[it.priority]}</span>
      </div>
      <p className="sp-why">{it.why}</p>
      {it.overlap ? <span className="sp-note warn"><Icon name="swap" />{it.overlap}</span> : null}
      {it.needsReview ? <span className="sp-note warn"><Icon name="shield" />Check with your doctor or pharmacist before starting.</span> : null}
      <dl className="sp-facts">
        <div><dt>Dose</dt><dd>{it.dose}</dd></div>
        <div><dt>When</dt><dd>{it.timing}</dd></div>
        <div><dt>How often</dt><dd>{it.frequency}</dd></div>
        <div><dt>How long</dt><dd>{it.review}</dd></div>
      </dl>
      <div className="sp-how"><b>How to take it</b><span>{it.howTo}</span></div>
      {it.safety.length ? <ul className="sp-safety">{it.safety.map((s) => <li key={s}>{s}</li>)}</ul> : null}
      {it.products.length ? (
        <div className="sp-products">
          <b>Which brand to buy</b>
          {it.products.map((pr) => (
            <div key={pr.brand + pr.name} className="sp-product">
              <div className="sp-product-main"><span className="sp-product-name">{pr.brand} · {pr.name}</span><span className="px-row-sub">{pr.strength} · {pr.note}</span></div>
              <div className="sp-product-links">
                {buyLinks(pr).map((l) => <a key={l.store} className="px-pill sm" href={l.url} target="_blank" rel="noopener noreferrer" onClick={() => track('supplement_buy_clicked', { item: it.supp, store: l.store })}>{l.store}<Icon name="link" /></a>)}
              </div>
            </div>
          ))}
          <span className="px-meta">Links open a store search. PeakX earns nothing from these. Any brand with the same form and strength works.</span>
        </div>
      ) : null}
      <span className="sp-trace">Rule {it.rule} · from {it.basis.join('; ')}</span>
    </article>
  );
}
