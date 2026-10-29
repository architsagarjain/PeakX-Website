import type { Metadata } from "next";
import Header from "@/components/site/header";
import { Footer } from "@/components/site/sections";
import { site } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How PeakX collects, uses and protects the information you share when you apply for coaching.",
  alternates: { canonical: "/privacy" },
};

const sections: [string, string][] = [
  ["Who we are", `PeakX is an online fitness coaching service run by Bhavika Agarwal, based in Bengaluru, India. Contact: ${site.email}.`],
  ["What we collect", "When you apply for coaching we collect the answers you give: your name, email, WhatsApp number, Instagram handle, age range, country, diet, training preferences, goals and any notes you add. We also record which ad or link brought you to the site."],
  ["How we use it", "Only to review your application, contact you about coaching, and, if you join, to write and adjust your plans. We don't sell your information."],
  ["Cookies and analytics", "This site may use the Meta Pixel to measure which ads lead to applications. You can limit ad tracking in your Facebook and Instagram ad settings and in your browser."],
  ["Who we share it with", "Bhavika and her assistant coach, plus the tools that store applications and book calls (for example, Google Sheets and Calendly). They process data on our behalf."],
  ["Your choices", `Email ${site.email} to see, correct or delete the information we hold about you. We reply within 30 days.`],
  ["Health information", "Coaching is not medical advice. If you tell us about a medical condition, we use it only to decide whether coaching is safe and suitable for you."],
];

export default function Privacy() {
  return (
    <>
      <Header minimal ctaHref="/apply" />
      <main id="main" className="mx-auto max-w-[760px] px-4 pb-24 pt-36 sm:px-8">
        <h1 className="t-display t-h2">Privacy policy</h1>
        <p className="mt-6 text-sm text-white/50">Last updated October 2026. A starting template: review it with a professional before publishing.</p>
        {sections.map(([h, p]) => (
          <div key={h} className="mt-10">
            <h2 className="t-display text-2xl">{h}</h2>
            <p className="mt-3 text-white/70">{p}</p>
          </div>
        ))}
      </main>
      <Footer />
    </>
  );
}
