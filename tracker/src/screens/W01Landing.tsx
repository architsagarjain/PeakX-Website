import { Link, useNavigate } from 'react-router-dom';
import { Icon, Wordmark } from '../components/Icon';
import { RECIPES, recipeMacros } from '../domain/seed';
import { DIET_LABEL } from '../domain/onboarding';
import { FOUNDING, PRO, inr, placesLeft, placesLine } from '../data/founding';
import { usePayStatus } from '../state/billing';
import { useStore } from '../state/store';

const TEASER = ['soya-chunk-pulao', 'chicken-tikka-bowl', 'paneer-bhurji-wrap', 'egg-bhurji-toast']
  .map((id) => RECIPES.find((r) => r.id === id)!)
  .filter(Boolean);

const STEPS: { n: string; title: string; body: string; icon: string }[] = [
  { n: '1', icon: 'target', title: 'Take the plateau check', body: '8 questions, about 2 minutes, no sign-up. You see your likely causes ranked as you answer.' },
  { n: '2', icon: 'list', title: 'Get your starting plan', body: 'Calories and protein from your answers, starter recipes for your diet, and a weekly training split.' },
  { n: '3', icon: 'mic', title: 'Log by voice, all week', body: 'Say what you ate in English or Hindi. Katori, roti, plate: it knows Indian portions.' },
  { n: '4', icon: 'trend', title: 'Get the Sunday answer', body: 'Why you stalled and two or three changes for next week, accepted in one click.' },
];

/** W01 · Website (peakx.live). No sign-in here: every button opens the app; How it works scrolls on the page. */
export default function W01Landing() {
  const navigate = useNavigate();
  const go = (to: string) => navigate(to);
  const { loadDemo } = useStore();
  const demo = () => { loadDemo(); navigate('/'); };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const soya = recipeMacros(RECIPES.find((r) => r.id === 'soya-chunk-pulao')!);
  usePayStatus();   // live early bird count
  const left = placesLeft();

  return (
    <div className="wb-app px-screen pub lp" style={{ flexDirection: 'column' }}>
      <header className="wb-land-nav">
        <Link to="/" aria-label="PeakX home" style={{ textDecoration: 'none' }}><Wordmark style={{ transform: 'scale(1.25)', transformOrigin: 'left center' }} /></Link>
        <span style={{ flexGrow: 1 }} />
        <nav className="lp-links" aria-label="Website">
          <a href="#how" onClick={(e) => { e.preventDefault(); scrollTo('how'); }}>How it works</a>
          <Link to="/app/plan/recipes">Recipes</Link>
          <Link to="/app/upgrade">Pricing</Link>
          <Link to="/" className="keep">Open the app</Link>
        </nav>
        <button className="px-cta" type="button" style={{ flex: '0 0 auto', height: '40px', fontSize: '16px', padding: '0 20px' }} onClick={() => go('/app/plateau-check')}>Take the plateau check</button>
      </header>

      <main>
        <section className="lp-hero">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start' }}>
            <Link to="/app/upgrade" className="px-pill" style={{ textDecoration: 'none' }}>
              <Icon name="cal" style={{ width: '13px', height: '13px' }} /> {left ? <>{FOUNDING.name}: Pro at {inr(FOUNDING.price)} for the first month · {placesLine().toLowerCase()}</> : <>Pro from {inr(PRO.monthly)} a month</>}
            </Link>
            <h1 className="px-num" style={{ margin: 0, fontSize: '88px', lineHeight: '90px', whiteSpace: 'normal' }}>
              Stuck at the gym?{' '}<span style={{ color: 'var(--text-3)' }}>Find out why.</span>
            </h1>
            <p className="px-body grey" style={{ margin: 0, fontSize: '19px', lineHeight: '27px', maxWidth: '520px' }}>
              Indian recipes that hit your protein, meals logged by voice, and every Sunday an answer to what to change next week.
            </p>
            <div className="lp-ctas">
              <button className="px-cta" type="button" style={{ flex: '0 0 auto', padding: '0 28px' }} onClick={() => go('/app/plateau-check')}>Take the 2-minute plateau check</button>
              <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', padding: '0 24px' }} onClick={() => go('/app/plan/recipes')}>Browse recipes</button>
            </div>
            <span className="px-meta" style={{ fontSize: '12px' }}>Free to start · Pro {inr(PRO.monthly)} a month or {inr(PRO.yearly)} a year{left ? <>, early bird {inr(FOUNDING.price)} for the first month</> : null} · works in any browser</span>
            <button type="button" className="lp-demo" onClick={demo}>Just looking? Open a demo account</button>
          </div>
          <div className="lp-stage" aria-hidden="true">
            <div className="px-card" style={{ position: 'absolute', left: '40px', top: '0', width: '360px', gap: '8px', padding: '20px' }}>
              <div className="px-card-head">
                <span className="px-card-title" style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                  <span className="px-icon sm dark" style={{ background: 'var(--text)' }}><Icon name="mic" /></span>Log lunch
                </span>
                <span className="px-meta">0:05</span>
              </div>
              <span className="px-body" style={{ fontStyle: 'italic' }}>“Do roti, ek katori dal aur paneer sabzi”</span>
              <div className="px-list">
                <div className="px-row"><span className="px-row-icon"><Icon name="roti" /></span><span className="px-row-main"><span className="px-row-title">Roti</span><span className="px-row-sub">2 medium</span></span><span className="px-row-end"><span className="px-row-value">200 kcal</span></span></div>
                <div className="px-row"><span className="px-row-icon"><Icon name="bowl" /></span><span className="px-row-main"><span className="px-row-title">Dal tadka</span><span className="px-row-sub">1 katori</span></span><span className="px-row-end"><span className="px-row-value">150 kcal</span></span></div>
                <div className="px-row"><span className="px-row-icon"><Icon name="bowl" /></span><span className="px-row-main"><span className="px-row-title">Paneer sabzi</span><span className="px-row-sub">How much?</span></span><span className="px-row-end"><span className="px-row-value" /><span className="px-status over">Pick one</span></span></div>
              </div>
            </div>
            <div className="px-card" style={{ position: 'absolute', left: '0', top: '316px', width: '270px', gap: '4px', padding: '18px' }}>
              <div className="px-card-head"><span className="px-tag">Recipe · free</span><span className="px-meta">25 min</span></div>
              <span className="px-card-title">Soya chunk pulao</span>
              <div style={{ display: 'flex', alignItems: 'baseline' }}><span className="px-num md">{Math.round(soya.protein)}</span><span className="px-suffix">g protein · {Math.round(soya.kcal)} kcal</span></div>
            </div>
            <div className="px-card" style={{ position: 'absolute', left: '290px', top: '316px', width: '270px', gap: '4px', padding: '18px' }}>
              <div className="px-card-head"><span className="px-tag">Weekly report</span><span className="px-pro">Pro</span></div>
              <span className="px-card-title">Bench stalled for 3 weeks.{' '}<span style={{ color: 'var(--text-3)' }}>You slept under 6 h before 2 of 3 sessions.</span></span>
              <span className="px-status good" style={{ marginTop: '4px' }}>2 changes ready</span>
            </div>
          </div>
        </section>

        <section id="how" className="lp-sec" aria-labelledby="how-h">
          <div className="lp-head">
            <span className="px-tag">How it works</span>
            <h2 id="how-h" className="lp-h2">From “why am I stuck” to a plan in two minutes.</h2>
          </div>
          <ol className="lp-grid4 lp-steps">
            {STEPS.map((s) => (
              <li key={s.n} className="px-card" style={{ gap: '8px', padding: '20px' }}>
                <div className="px-card-head"><span className="lp-n">{s.n}</span><span className="px-row-icon"><Icon name={s.icon} /></span></div>
                <span className="px-card-title" style={{ fontSize: '20px', lineHeight: '24px' }}>{s.title}</span>
                <span className="px-meta" style={{ fontSize: '12.5px', lineHeight: '18px', color: 'var(--text-2)' }}>{s.body}</span>
              </li>
            ))}
          </ol>
          <div className="lp-grid4" style={{ marginTop: '12px' }}>
            <Feature icon="leaf" title="Indian recipes" body="High-protein recipes free. Pro scales them to your targets and builds the week." />
            <Feature icon="mic" title="Log by voice" body="Calories per meal; it asks if you skip the amount." />
            <Feature icon="pulse" title="Works with your wearable" body="Steps, sleep and heart rate from Fitbit and Google-linked devices, plus Strava." />
            <Feature icon="video" title="Form Check" body="Upload one set; a coach replies within 24 hours with a fix plan." pro />
          </div>
          <div style={{ marginTop: '20px' }}>
            <button className="px-cta" type="button" style={{ flex: '0 0 auto', padding: '0 28px' }} onClick={() => go('/app/plateau-check')}>Start with the plateau check</button>
          </div>
        </section>

        <section id="recipes" className="lp-sec" aria-labelledby="rec-h">
          <div className="lp-head lp-head-row">
            <div>
              <span className="px-tag">Recipe library · free</span>
              <h2 id="rec-h" className="lp-h2">Food you already eat, built to hit your protein.</h2>
            </div>
            <Link to="/app/plan/recipes" className="px-cta glass" style={{ flex: '0 0 auto', padding: '0 24px', textDecoration: 'none' }}>Browse all recipes</Link>
          </div>
          <div className="lp-grid4">
            {TEASER.map((r) => {
              const m = recipeMacros(r);
              return (
                <Link key={r.id} to="/app/plan/recipes" className="px-card lp-recipe">
                  <div className="px-card-head"><span className="px-tag">{DIET_LABEL[r.diet]}</span><span className="px-meta">{r.minutes} min</span></div>
                  <span className="px-card-title" style={{ fontSize: '20px', lineHeight: '24px' }}>{r.name}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 'auto' }}>
                    <span className="px-num md">{Math.round(m.protein)}</span><span className="px-suffix">g protein · {Math.round(m.kcal)} kcal</span>
                  </div>
                  <span className="px-meta">{r.ingredients.slice(0, 3).map((i) => i.name.split(',')[0]).join(' · ')}</span>
                </Link>
              );
            })}
          </div>
          <span className="px-meta" style={{ display: 'block', marginTop: '10px' }}>Nutrition estimated from IFCT values per serving; reviewed by the PeakX team.</span>
        </section>

        <section id="pricing" className="lp-sec" aria-labelledby="price-h">
          <div className="lp-head">
            <span className="px-tag">Pricing</span>
            <h2 id="price-h" className="lp-h2">Start free. Go Pro for the Sunday answer.</h2>
          </div>
          <div className="lp-grid3">
            <div className="px-card wb-plan">
              <div className="px-card-head"><span className="px-card-title" style={{ fontSize: '24px', lineHeight: '28px' }}>Free</span></div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}><span className="px-num lg">₹0</span></div>
              <span className="wb-ft">Plateau check and starting plan</span>
              <span className="wb-ft">Voice meal logging, calories per meal</span>
              <span className="wb-ft">Recipe library and basic charts</span>
              <span className="wb-ft">Your first weekly report</span>
              <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', marginTop: '8px' }} onClick={() => go('/app/plateau-check')}>Start free</button>
            </div>
            <div className="px-card wb-plan on">
              <div className="px-card-head">
                <span className="px-card-title" style={{ fontSize: '24px', lineHeight: '28px' }}>Pro</span>
                {left ? <span className="px-pro" style={{ background: 'var(--lime-glow)', color: 'var(--text)' }}>EARLY BIRD · {left} LEFT</span> : null}
              </div>
              {left
                ? <div style={{ display: 'flex', alignItems: 'baseline' }}><span className="px-num lg">{inr(FOUNDING.price)}</span><span className="px-suffix">first month <s style={{ color: 'var(--text-3)' }}>{inr(PRO.monthly)}</s></span></div>
                : <div style={{ display: 'flex', alignItems: 'baseline' }}><span className="px-num lg">{inr(PRO.monthly)}</span><span className="px-suffix">/month</span></div>}
              <span className="px-meta">{left ? `${FOUNDING.discount}% off for the first ${FOUNDING.places} members, then ${inr(PRO.monthly)} a month.` : `Or ${inr(PRO.yearly)} a year, ${inr(PRO.monthly * 12 - PRO.yearly)} less than paying monthly.`}</span>
              <span className="wb-ft">Weekly report with one-click changes</span>
              <span className="wb-ft">Meal plan from the library, grocery list</span>
              <span className="wb-ft">Detailed analytics, AI Coach, Form Check</span>
              <button className="px-cta orange" type="button" style={{ flex: '0 0 auto', marginTop: '8px' }} onClick={() => go('/app/upgrade')}>{left ? `Get the early bird · ${inr(FOUNDING.price)}` : 'Go Pro'}</button>
            </div>
            <div className="px-card wb-plan">
              <div className="px-card-head"><span className="px-card-title" style={{ fontSize: '24px', lineHeight: '28px' }}>Coached</span><span className="px-status">Human coach</span></div>
              <span className="px-body grey">Everything in Pro, with a named coach.</span>
              <span className="wb-ft">A coach on WhatsApp</span>
              <span className="wb-ft">A weekly call</span>
              <span className="wb-ft">Coach signs off every plan change</span>
              <span className="wb-ft no">Limited slots per coach</span>
              <button className="px-cta glass" type="button" style={{ flex: '0 0 auto', height: '46px', fontSize: '17px', marginTop: '8px' }} onClick={() => go('/app/upgrade')}>Compare plans</button>
            </div>
          </div>
          <span className="px-meta" style={{ display: 'block', marginTop: '14px', color: 'var(--text-2)' }}>Full refund if your first Pro report doesn’t give you one clear change · UPI or card via Razorpay</span>
        </section>

        <section className="lp-sec">
          <div className="px-card lp-band">
            <div>
              <h2 className="lp-h2" style={{ margin: 0 }}>Two minutes to find out why you’re stuck.</h2>
              <span className="px-body grey">No sign-up. Your answers stay in your browser.</span>
            </div>
            <button className="px-cta" type="button" style={{ flex: '0 0 auto', padding: '0 28px' }} onClick={() => go('/app/plateau-check')}>Take the plateau check</button>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <Wordmark />
        <nav aria-label="Footer" className="lp-foot-links">
          <Link to="/app/plateau-check">Plateau check</Link>
          <Link to="/app/plan/recipes">Recipes</Link>
          <a href="/calories/">Calorie guide</a>
          <a href="/blog/">Blog</a>
          <Link to="/app/upgrade">Pricing</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/refunds">Refunds</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <span className="px-meta">© {new Date().getFullYear()} PeakX · Gurugram · Health data is never sold or shared</span>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body, pro }: { icon: string; title: string; body: string; pro?: boolean }) {
  return (
    <div className="px-card" style={{ gap: '6px', padding: '18px' }}>
      <div className="px-card-head"><span className="px-row-icon"><Icon name={icon} /></span>{pro ? <span className="px-pro">Pro</span> : null}</div>
      <span className="px-card-title" style={{ fontSize: '18px', lineHeight: '22px' }}>{title}</span>
      <span className="px-meta" style={{ fontSize: '12px', lineHeight: '17px' }}>{body}</span>
    </div>
  );
}
