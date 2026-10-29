import Header from "@/components/site/header";
import HeroPortal from "@/components/site/hero-portal";
import Manifesto from "@/components/site/manifesto";
import Journey from "@/components/site/journey";
import Marquee from "@/components/site/marquee";
import Food from "@/components/site/food";
import Offer from "@/components/site/offer";
import Stories from "@/components/site/stories";
import ApplySection from "@/components/site/apply-section";
import MobileCta from "@/components/site/mobile-cta";
import { About, Faq, Fit, Footer, Guarantee, Steps } from "@/components/site/sections";
import { displayFamily } from "@/lib/fonts";
import { faqs } from "@/lib/config";

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Header />
      <main id="main">
        <div data-cta-zone>
          <HeroPortal fontFamily={displayFamily} />
        </div>
        <Manifesto />
        <Fit />
        <Journey />
        <Marquee />
        <Food />
        <Offer />
        <Stories />
        <About />
        <Steps />
        <Guarantee />
        <Faq />
        <ApplySection />
      </main>
      <Footer />
      <MobileCta />
    </>
  );
}
