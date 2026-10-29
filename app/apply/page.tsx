import type { Metadata } from "next";
import Image from "next/image";
import { Check } from "lucide-react";
import Header from "@/components/site/header";
import ApplyForm from "@/components/site/apply-form";
import Stories from "@/components/site/stories";
import MobileCta from "@/components/site/mobile-cta";
import { Faq, Footer, Guarantee } from "@/components/site/sections";
import { faqs } from "@/lib/config";

export const metadata: Metadata = {
  title: "Apply for 1-on-1 Coaching with Bhavika Agarwal",
  description: "Apply for 1-on-1 online fat loss coaching with Bhavika Agarwal. A 3-minute application, then a free discovery call to see if coaching is right for you.",
  alternates: { canonical: "/apply" },
  openGraph: { url: "/apply", title: "Apply for 1-on-1 coaching with Bhavika | PeakX" },
};

const lpFaqs = [
  faqs[0],
  { q: "What happens after I apply?", a: "If coaching looks like a fit, you book a free 20-minute call with Bhavika. If you join, you fill in a detailed questionnaire and your plans arrive in 2–3 days." },
  { q: "Is the call a sales pitch?", a: "It's a conversation about your goal and routine. If coaching isn't right for you, Bhavika will say so and point you to free resources instead." },
  faqs[5],
];

export default function ApplyPage() {
  return (
    <>
      <Header minimal ctaHref="#apply" />
      <main id="main">
        <section id="apply" data-cta-zone aria-labelledby="lp-title" className="relative isolate overflow-hidden bg-black pb-20 pt-24 sm:pt-32">
          <div aria-hidden className="absolute inset-0 -z-10 opacity-45">
            <Image src="/media/journey/w12-wide.webp" alt="" fill priority sizes="100vw" className="object-cover object-[70%_25%]" />
          </div>
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(0_0_0/.55),#000_70%)] lg:bg-[linear-gradient(90deg,#000_25%,rgb(0_0_0/.55))]" />
          <div className="mx-auto grid max-w-[1320px] gap-10 px-4 sm:px-8 lg:grid-cols-[1fr_520px] lg:gap-20">
            <div className="lg:pt-10">
              <h1 id="lp-title" className="t-display max-w-[13ch] text-[clamp(2rem,4.8vw,4.4rem)]">Lose <span className="whitespace-nowrap">5–8 kg</span> in 12 weeks. Keep your chai.</h1>
              <p className="mt-5 max-w-[46ch] text-white/75 sm:mt-6 sm:text-lg">Apply for 1-on-1 online coaching with Bhavika Agarwal, former national-level badminton player and certified nutrition coach.</p>
              <ul className="mt-8 hidden gap-3 lg:grid">
                {[
                  "Diet built from the Indian home food you already eat",
                  "Training for home or gym, with weekly form reviews",
                  "Weekly check-ins and WhatsApp access to your coach",
                  "Miss your agreed target after doing the work? Coaching continues free",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green text-ink"><Check className="h-3.5 w-3.5" aria-hidden /></span>{t}</li>
                ))}
              </ul>
              <p className="mt-8 hidden text-xs text-white/45 lg:block">Typical result for clients who complete every weekly check-in. Individual results vary.</p>
            </div>
            <div><ApplyForm id="lp-apply" /><p className="mt-4 text-xs text-white/45 lg:hidden">Typical result for clients who complete every weekly check-in. Individual results vary.</p></div>
          </div>
        </section>

        <section aria-labelledby="why-title" className="bg-paper py-24 text-ink sm:py-32">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
            <h2 id="why-title" className="t-display t-h2 max-w-[14ch]">Why this works when diets didn't.</h2>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                ["Your food stays", "Chai, rice, roti and the Sunday biryani. You learn portions and balance, not a banned-foods list."],
                ["A coach every week", "Check-ins, form reviews and plan changes every week, so a bad week never becomes a lost month."],
                ["Written for you", "Bhavika writes every plan herself around your schedule, your kitchen and your body."],
              ].map(([t, b]) => (
                <div key={t} className="rounded-[24px] bg-white p-8">
                  <h3 className="t-display t-h3">{t}</h3>
                  <p className="mt-3 text-ink/65">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <Stories />
        <div data-cta-zone><Guarantee /></div>
        <Faq items={lpFaqs} title="Before you apply." />
      </main>
      <Footer />
      <MobileCta label="Start my application" />
    </>
  );
}
