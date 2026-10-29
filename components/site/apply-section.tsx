import { Check } from "lucide-react";
import ApplyForm from "./apply-form";

export default function ApplySection() {
  return (
    <section id="apply" aria-labelledby="apply-title" className="relative overflow-hidden bg-black py-24 sm:py-36">
      <p aria-hidden className="t-display pointer-events-none absolute -right-[8vw] top-1/2 -translate-y-1/2 text-[58vw] leading-none text-green/[0.06]">X</p>
      <div className="relative mx-auto grid max-w-[1320px] gap-12 px-4 sm:px-8 lg:grid-cols-[1fr_520px] lg:gap-20">
        <div className="lg:pt-6">
          <h2 id="apply-title" className="t-display t-mega max-w-[11ch]">Week one starts here.</h2>
          <p className="mt-8 max-w-[44ch] text-lg text-white/70">
            Bhavika writes every plan herself, so she takes on a limited number of new clients each month. Tell her about you, and if it's a fit you'll book a free call straight away.
          </p>
          <ul className="mt-10 grid gap-4">
            {[
              "3-minute application, no payment",
              "Free 20-minute discovery call with Bhavika",
              "Plans in 2–3 days if you join",
              "Part-payment available",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-white/85"><span className="grid h-7 w-7 place-items-center rounded-full bg-green text-ink"><Check className="h-4 w-4" aria-hidden /></span>{t}</li>
            ))}
          </ul>
        </div>
        <ApplyForm id="home-apply" />
      </div>
    </section>
  );
}
