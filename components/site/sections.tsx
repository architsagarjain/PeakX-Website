import Link from "next/link";
import { ArrowRight, Check, Plus, ShieldCheck, X as XIcon } from "lucide-react";
import { faqs, site } from "@/lib/config";

export function Fit() {
  const yes = [
    "You want to lose fat without giving up rice, rotis or weekend plans.",
    "You can give 30–45 minutes a day, 4–5 days a week.",
    "You'd rather understand why a plan works than follow it blindly.",
    "You'll check in every week, even the weeks that go badly.",
  ];
  const no = ["You want to drop 10 kg before a wedding next month.", "You're looking for a pill, a powder or a juice cleanse.", "You want a generic PDF you'll open once."];
  return (
    <section aria-labelledby="fit-title" className="bg-black pb-24 sm:pb-36">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
        <div className="mb-12 grid gap-6 lg:grid-cols-2 lg:items-end">
          <h2 id="fit-title" className="t-display t-h2 max-w-[12ch]">Built for women who run on calendars.</h2>
          <p className="max-w-[46ch] text-lg text-white/60">Most of Bhavika's clients are 28 to 40, work in tech or corporate jobs, and have tried dieting before.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-[28px] bg-green p-8 text-ink sm:p-10">
            <h3 className="t-display t-h3">This is for you if</h3>
            <ul className="mt-6 grid gap-4">
              {yes.map((t) => (
                <li key={t} className="grid grid-cols-[28px_1fr] gap-3 text-[1.0625rem] font-medium">
                  <Check className="mt-0.5 h-6 w-6" aria-hidden />{t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[28px] border border-white/15 p-8 sm:p-10">
            <h3 className="t-display t-h3">It's not for you if</h3>
            <ul className="mt-6 grid gap-4">
              {no.map((t) => (
                <li key={t} className="grid grid-cols-[28px_1fr] gap-3 text-white/70">
                  <XIcon className="mt-0.5 h-6 w-6 text-white/40" aria-hidden />{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function About() {
  return (
    <section id="bhavika" aria-labelledby="about-title" className="relative overflow-hidden bg-carbon py-24 sm:py-36">
      <p aria-hidden style={{ ["--stroke" as string]: "rgb(246 248 244 / .07)" }} className="t-display t-outline pointer-events-none absolute -bottom-6 left-0 whitespace-nowrap text-[18vw] leading-none">COURT TO COACH</p>
      <div className="relative mx-auto grid max-w-[1320px] gap-12 px-4 sm:px-8 lg:grid-cols-[5fr_6fr] lg:items-center lg:gap-24">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-[radial-gradient(120%_90%_at_30%_15%,#1d2a1e,#000)]">
          {/* Replace with Bhavika's photo:
              <Image src="/media/bhavika.webp" alt="Bhavika Agarwal, founder of PeakX" fill sizes="(min-width:1024px) 40vw, 100vw" className="object-cover" /> */}
          <div className="absolute inset-0 grid place-items-center p-8 text-center text-white/45">
            <span>Bhavika's portrait goes here<br /><span className="text-sm">4:5, at least 960 × 1200</span></span>
          </div>
          <span className="absolute bottom-5 left-5 rounded-full bg-green px-4 py-2 text-sm font-bold text-ink">Former national-level badminton player</span>
        </div>
        <div>
          <h2 id="about-title" className="t-display text-[clamp(2.1rem,4.4vw,4rem)]">She trained for a living. Now she trains you.</h2>
          <p className="mt-8 max-w-[52ch] text-lg text-white/70">
            Bhavika Agarwal spent years competing in badminton at the national level, where training and food were her job. Today she coaches women whose job is something else entirely, and builds plans that fit around it.
          </p>
          <ul className="mt-8 grid gap-3">
            {["No unnecessary supplements, and no expensive superfoods.", "You keep the foods you enjoy. Sustainable beats strict.", "She explains the why behind every change, so you can do it alone after."].map((t) => (
              <li key={t} className="grid grid-cols-[22px_1fr] gap-3"><span aria-hidden className="mt-[0.7em] h-[2px] w-4 -rotate-[38deg] bg-green" />{t}</li>
            ))}
          </ul>
          <ul aria-label="Certifications" className="mt-8 flex flex-wrap gap-2">
            {["ISSA certified", "NASM / AFAA nutrition", "Nordic Fitness Education", "114K on Instagram"].map((c) => (
              <li key={c} className="rounded-full border border-white/20 px-4 py-2 text-sm">{c}</li>
            ))}
          </ul>
          <a href={site.instagram} target="_blank" rel="noopener" className="mt-8 inline-block text-green underline-offset-4 hover:underline">Follow @fitwithbhavika on Instagram</a>
        </div>
      </div>
    </section>
  );
}

export function Steps() {
  const steps = [
    ["3 minutes", "Apply", "Tell us your goal, your routine and what you've tried."],
    ["20 minutes", "Discovery call", "Talk to Bhavika. If it's not a fit, she'll tell you."],
    ["Same day", "Questionnaire", "Your food, schedule, injuries and preferences in detail."],
    ["2–3 days", "Plans delivered", "Training, cardio and diet plans written for you."],
    ["Week 1", "Kickoff call", "Walk through everything and start with confidence."],
  ];
  return (
    <section aria-labelledby="start-title" className="bg-black py-24 sm:py-36">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
        <div className="mb-14 grid gap-6 lg:grid-cols-2 lg:items-end">
          <h2 id="start-title" className="t-display t-h2 max-w-[13ch]">From application to first workout.</h2>
          <p className="max-w-[44ch] text-lg text-white/60">About a week, start to finish. Bhavika takes every discovery call herself.</p>
        </div>
        <ol className="grid gap-0 lg:grid-cols-5 lg:gap-5">
          {steps.map(([when, title, body], i) => (
            <li key={title} className="grid grid-cols-[64px_1fr] gap-4 border-t border-white/15 py-6 lg:grid-cols-1 lg:border-t-2 lg:border-green lg:pt-6">
              <span className="t-display text-5xl leading-none text-green lg:text-6xl">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-white/50">{when}</p>
                <h3 className="t-display t-h3 mt-1">{title}</h3>
                <p className="mt-2 text-white/60">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Guarantee() {
  return (
    <section aria-labelledby="g-title" className="relative overflow-hidden bg-green py-24 text-ink sm:py-36">
      <div aria-hidden className="absolute -right-20 -top-20 h-[160%] w-[3px] -rotate-[38deg] bg-ink/80" />
      <div className="relative mx-auto grid max-w-[1320px] gap-10 px-4 sm:px-8 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-20">
        <h2 id="g-title" className="t-display t-h2 max-w-[13ch]">Do the work. Miss your target, and she keeps coaching you, free.</h2>
        <div>
          <p className="text-lg font-medium">On your call you agree a realistic 12-week target together. Follow the plan and miss it, and coaching continues at no cost until you get there.</p>
          <ul className="mt-6 grid gap-3">
            {["Complete every weekly check-in", "Follow your training and diet plan", "Send your form-review videos"].map((t) => (
              <li key={t} className="flex items-center gap-3 font-semibold"><ShieldCheck className="h-5 w-5" aria-hidden />{t}</li>
            ))}
          </ul>
          <Link href="#apply" className="btn btn-ink mt-8">Start my application <ArrowRight className="arrow h-4 w-4" aria-hidden /></Link>
        </div>
      </div>
    </section>
  );
}

export function Faq({ items = faqs, title = "Questions, answered." }: { items?: typeof faqs; title?: string }) {
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-black py-24 sm:py-36">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-4 sm:px-8 lg:grid-cols-[5fr_7fr] lg:gap-24">
        <h2 id="faq-title" className="t-display t-h2 lg:sticky lg:top-28 lg:self-start">{title}</h2>
        <div>
          {items.map((f) => (
            <details key={f.q} className="group border-b border-white/15">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <Plus className="h-5 w-5 shrink-0 text-green transition-transform group-open:rotate-45" aria-hidden />
              </summary>
              <p className="max-w-[60ch] pb-6 text-white/65">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black pb-28 pt-16 text-white/60 md:pb-12">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 sm:px-8 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/peakx-logo.svg" alt="PeakX" width={744} height={214} className="h-10 w-auto" />
          <p className="mt-5 max-w-[40ch]">1-on-1 online fat loss coaching for working women. Based in Bengaluru, coaching clients worldwide.</p>
        </div>
        <ul className="grid content-start gap-3">
          <li><Link href="/apply" className="hover:text-white">Apply for coaching</Link></li>
          <li><Link href="/#journey" className="hover:text-white">The 12 weeks</Link></li>
          <li><Link href="/#faq" className="hover:text-white">FAQ</Link></li>
        </ul>
        <ul className="grid content-start gap-3">
          <li><a href={site.instagram} target="_blank" rel="noopener" className="hover:text-white">@fitwithbhavika</a></li>
          <li><a href={site.instagramBrand} target="_blank" rel="noopener" className="hover:text-white">@peakx_fit</a></li>
          <li><Link href="/privacy" className="hover:text-white">Privacy policy</Link></li>
        </ul>
        <p className="border-t border-white/10 pt-6 text-xs md:col-span-3">
          © {new Date().getFullYear()} PeakX. Coaching is not medical advice. Results vary between individuals and depend on following the plan. This site is not part of the Facebook or Instagram websites or Meta Platforms, Inc.
        </p>
      </div>
    </footer>
  );
}
