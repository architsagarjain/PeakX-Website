import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Icon';
import { LEGAL } from '../data/legal';
import { FOUNDING, PRO, inr } from '../data/founding';
import { REFUND_DAYS } from '../domain/billing';

/** Privacy, terms, refunds, health disclaimer and contact (S24.2). Public, no sign-in. */
export type LegalPage = 'privacy' | 'terms' | 'refunds' | 'disclaimer' | 'contact';
const TITLES: Record<LegalPage, string> = { privacy: 'Privacy policy', terms: 'Terms of use', refunds: 'Refunds and cancellation', disclaimer: 'Health disclaimer', contact: 'Contact us' };
const updated = new Date(`${LEGAL.updated}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const mail = (e: string) => <a href={`mailto:${e}`}>{e}</a>;

export default function Legal({ page }: { page: LegalPage }) {
  useEffect(() => { document.title = `${TITLES[page]} · PeakX`; return () => { document.title = 'PeakX · Stuck at the gym? Find out why.'; }; }, [page]);
  return (
    <div className="wb-app px-screen pub lp" style={{ flexDirection: 'column' }}>
      <header className="wb-land-nav">
        <Link to="/" aria-label="PeakX home" style={{ textDecoration: 'none' }}><Wordmark style={{ transform: 'scale(1.25)', transformOrigin: 'left center' }} /></Link>
        <span style={{ flexGrow: 1 }} />
        <nav className="lp-links" aria-label="Website"><Link to="/app/upgrade">Pricing</Link><Link to="/" className="keep">Open the app</Link></nav>
      </header>
      <main className="legal">
        <nav className="legal-tabs" aria-label="Legal pages">
          {(Object.keys(TITLES) as LegalPage[]).map((p) => <Link key={p} to={`/${p}`} className={`px-pill sm${p === page ? ' on' : ''}`} aria-current={p === page ? 'page' : undefined}>{TITLES[p]}</Link>)}
        </nav>
        <article className="px-card legal-body">
          <h1 className="lp-h2" style={{ margin: 0 }}>{TITLES[page]}</h1>
          <p className="px-meta">Last updated {updated}</p>
          {BODY[page]}
        </article>
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalFooter() {
  return (
    <footer className="lp-foot">
      <Wordmark />
      <nav aria-label="Legal" className="lp-foot-links">
        <Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/refunds">Refunds</Link><Link to="/disclaimer">Health disclaimer</Link><Link to="/contact">Contact</Link>
      </nav>
      <span className="px-meta">© {new Date().getFullYear()} {LEGAL.entity} · {LEGAL.address.split(',')[0]} · Health data is never sold or shared</span>
    </footer>
  );
}

const H = ({ children }: { children: ReactNode }) => <h2 className="legal-h">{children}</h2>;

const BODY: Record<LegalPage, ReactNode> = {
  privacy: <>
    <p>{LEGAL.entity} (“PeakX”, “we”) runs peakx.live and the PeakX app. This policy explains what we collect, why, who processes it for us and the rights you have under India’s Digital Personal Data Protection Act, 2023. We never sell your data or use it for advertising.</p>
    <H>What we collect</H>
    <ul>
      <li><b>Account:</b> your email and name from Google or an email sign-in link.</li>
      <li><b>Profile and plan:</b> age, sex, height, weight, goal, diet, city, training days and gym time, and the targets we calculate.</li>
      <li><b>Logs:</b> meals, workouts, weigh-ins, plateau-check answers, coach chat messages and weekly reports.</li>
      <li><b>Wearables (only if you connect them):</b> steps, sleep, resting heart rate and workouts from Fitbit or Google-linked devices (Google Health API) and Strava. You choose what is read, and disconnecting deletes that source’s data.</li>
      <li><b>Blood work (only if you add it):</b> the marker values you confirm. Lab report files are read once to pull out the numbers and are not stored.</li>
      <li><b>Form Check videos (only if you send them):</b> stored in your own folder so a coach can review them.</li>
      <li><b>Voice and photos for logging:</b> sent to our AI service to read what you said or what’s on a menu, then discarded.</li>
      <li><b>Payments:</b> plan, amounts, dates and Razorpay payment ids. Card and UPI details go straight to Razorpay; we never see or store them.</li>
      <li><b>Errors and usage (if switched on):</b> which screens are used and error details. These never include food, health values or your email.</li>
      <li><b>How the site is used:</b> Microsoft Clarity records clicks, scrolling and page views as anonymous heatmaps and session replays, so we can see where the site is confusing. Text you type is masked and not recorded.</li>
    </ul>
    <H>Why we use it</H>
    <p>To run the features you use: your plan, logging, charts, weekly reports, AI Coach, coach reviews of Form Checks and lab values, reminders and payments; to keep the service secure; and to meet legal duties such as tax records. We process health data only with your consent, which you give by entering it or connecting a device, and can withdraw at any time.</p>
    <H>Where it is stored and who processes it</H>
    <p>Without an account, data stays in your browser. With an account it is stored with Supabase (servers in Mumbai, India). These companies process data for us under their terms: Supabase (accounts and data), Google (Gemini AI for voice, menus, lab reports and the AI Coach), Microsoft (Clarity usage analytics), Razorpay (payments), Resend (email), Vercel (hosting), and Google Health or Strava if you connect them. PeakX coaches see member data only to do reviews you ask for.</p>
    <H>How long we keep it</H>
    <p>Until you delete your account. Deleting removes your data from our active systems straight away and from any backups within 30 days. Payment records are kept as long as Indian tax law requires.</p>
    <H>Your rights</H>
    <ul>
      <li><b>Access and export:</b> Account › Export my data downloads your food, workouts, weight and wearable data.</li>
      <li><b>Correct:</b> edit your profile, logs and lab values in the app.</li>
      <li><b>Delete:</b> Account › Delete account removes your account and data.</li>
      <li><b>Withdraw consent:</b> disconnect devices, turn off reminders or unsubscribe from any email.</li>
      <li><b>Nominate:</b> you may nominate someone to exercise these rights if you cannot.</li>
      <li><b>Grievances:</b> write to our Grievance Officer at {mail(LEGAL.grievance.email)}. We reply within 30 days. You may also approach the Data Protection Board of India.</li>
    </ul>
    <H>Cookies and storage</H>
    <p>We use your browser’s storage to keep the app working (your data, sign-in and settings). Microsoft Clarity sets first-party cookies to group page views into anonymous sessions for usage analytics. No advertising cookies.</p>
    <H>Children</H>
    <p>PeakX is for people aged 18 and over. We do not knowingly collect data from anyone under 18.</p>
    <H>Security</H>
    <p>Data is encrypted in transit, each account can read only its own data, payment and device tokens stay on our servers, and coach access is logged per review.</p>
    <H>Changes</H>
    <p>We’ll update this page and the date above, and tell you in the app or by email about significant changes.</p>
  </>,
  terms: <>
    <p>These terms are an agreement between you and {LEGAL.entity}. By using PeakX you accept them.</p>
    <H>Who can use PeakX</H>
    <p>You must be 18 or older and able to make a binding contract. Keep your sign-in safe; you’re responsible for activity on your account.</p>
    <H>Not medical advice</H>
    <p>PeakX gives general fitness and nutrition guidance. It is not a medical service. Read the <Link to="/disclaimer">health disclaimer</Link> before you start.</p>
    <H>Plans and payments</H>
    <ul>
      <li><b>Free:</b> the plateau check, logging, the recipe library, basic charts and your first weekly report.</li>
      <li><b>Pro:</b> {inr(PRO.monthly)} a month or {inr(PRO.yearly)} a year, paid in advance. Each payment unlocks Pro for the period paid; if checkout offers automatic renewal and you accept it, it renews until you cancel.</li>
      <li><b>{FOUNDING.name}:</b> {inr(FOUNDING.price)} for your first month of Pro ({FOUNDING.discount}% off), for the first {FOUNDING.places} paying members only and once per account. Pro unlocks when you pay. The offer closes once those {FOUNDING.places} slots are taken.</li>
      <li><b>Coached:</b> priced and agreed with you before it starts.</li>
    </ul>
    <p>Payments are processed by Razorpay. Prices include applicable taxes unless stated. Pro stays on until the end of the period you paid for, and you can cancel any renewal in Account. See <Link to="/refunds">refunds and cancellation</Link>.</p>
    <H>Coach services</H>
    <p>Form Checks aim for a reply within 24 hours and lab checks within 48 hours; times can slip at busy periods. Coaches are fitness coaches, not doctors.</p>
    <H>AI features</H>
    <p>Voice logging, menu reading, lab report reading and the AI Coach use AI and can make mistakes. Check numbers before you rely on them; calorie values come from our food table and are estimates.</p>
    <H>Your content</H>
    <p>Your data stays yours. You let us store and process it to provide the service, as described in the <Link to="/privacy">privacy policy</Link>. Don’t upload anything unlawful or anyone else’s private information.</p>
    <H>Acceptable use</H>
    <p>Don’t misuse the service: no scraping, reverse engineering, attacks, reselling access or harassing coaches. We may suspend accounts that do.</p>
    <H>Liability</H>
    <p>PeakX is provided “as is”. To the extent the law allows, we aren’t liable for indirect losses, and our total liability is limited to what you paid us in the 3 months before the claim. Nothing here limits rights you have under Indian consumer law.</p>
    <H>Ending</H>
    <p>You can delete your account any time. We may end or suspend the service with notice, and refund unused prepaid time if we do.</p>
    <H>Law</H>
    <p>These terms are governed by the laws of India. Courts in Gurugram, Haryana have jurisdiction.</p>
    <H>Contact</H>
    <p>{mail(LEGAL.email)}</p>
  </>,
  refunds: <>
    <p>We want you to pay only if PeakX works for you.</p>
    <H>Our promise</H>
    <p>If your first Pro weekly report doesn’t give you one clear change, you get a full refund of your first payment. Ask within {REFUND_DAYS} days of your first paid period starting, once per account.</p>
    <H>How to ask</H>
    <p>Go to Account › Subscription › Ask for a refund, or email {mail(LEGAL.email)} from your account email. Refunds go back to the card or UPI account you paid with, usually in 5–7 working days. Your plan moves to Free straight away and your data stays.</p>
    <H>Cancelling</H>
    <p>Cancel any time in Account › Subscription › Cancel renewal. You won’t be charged again and Pro stays on until the end of the period you paid for. Renewal payments after your first aren’t refunded, except as below.</p>
    <H>Always refunded</H>
    <p>Duplicate charges, charges after you cancelled, and payments for a service we couldn’t provide. Email us with the Razorpay payment id.</p>
    <H>Coached</H>
    <p>Refunds for Coached are agreed with you and your coach before it starts.</p>
    <p>There are no physical goods, so no shipping or delivery applies.</p>
  </>,
  disclaimer: <>
    <p>PeakX helps you train and eat better. It is not a doctor and doesn’t diagnose or treat any condition.</p>
    <ul>
      <li>Talk to a doctor before starting if you are pregnant, have a heart, kidney, liver or metabolic condition, an eating disorder history, take regular medicines, or are recovering from injury or surgery.</li>
      <li>Stop exercising and get medical help if you feel chest pain, faintness, severe breathlessness or sharp pain. In an emergency call <b>112</b>.</li>
      <li>Calorie and protein values come from Indian food composition tables (IFCT) and are estimates. Portions vary.</li>
      <li>Blood work ranges are general adult ranges. Results far outside them are flagged for a doctor. Supplements and doses are your doctor’s call.</li>
      <li>Form Check and lab checks are done by fitness coaches, not physiotherapists or doctors. For pain or injury, see a professional.</li>
      <li>AI answers can be wrong. Use your judgement, and ask a coach when unsure.</li>
    </ul>
  </>,
  contact: <>
    <p>We’re a small team in {LEGAL.address.split(',')[0]}. Write to us and a person replies, usually within one working day.</p>
    <ul>
      <li><b>Support and billing:</b> {mail(LEGAL.email)}</li>
      {LEGAL.phone ? <li><b>Phone:</b> <a href={`tel:${LEGAL.phone.replace(/\s/g, '')}`}>{LEGAL.phone}</a></li> : null}
      <li><b>Grievance Officer:</b> {LEGAL.grievance.name}, {mail(LEGAL.grievance.email)}</li>
      <li><b>Business:</b> {LEGAL.entity}, {LEGAL.address}</li>
    </ul>
    <p>Members with a coach can also reach them on WhatsApp from the Coach page.</p>
  </>,
};
