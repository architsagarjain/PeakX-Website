import Link from "next/link";
import { ArrowRight, BookOpen, CalendarCheck, Dumbbell, HeartPulse, MessageCircle, Repeat, UtensilsCrossed, Video } from "lucide-react";

const ITEMS = [
  { icon: Dumbbell, title: "Custom training plan", body: "For home or gym, matched to your level and the equipment you have." },
  { icon: HeartPulse, title: "Cardio plan", body: "Walking and steps first. The right amount for fat loss, not punishment." },
  { icon: UtensilsCrossed, title: "Custom diet plan", body: "Veg, non-veg, egg, Jain or vegan. Built from Indian home food you already eat." },
  { icon: Repeat, title: "Food substitution guide", body: "What to order at the office canteen, at a wedding, or when you're travelling." },
  { icon: CalendarCheck, title: "Weekly check-ins", body: "Your numbers, energy and sleep reviewed every week, and your plan adjusted." },
  { icon: Video, title: "Weekly form review", body: "Send a video of your lifts and get corrections, so you train safely." },
  { icon: MessageCircle, title: "WhatsApp and email access", body: "Ask anything, any time. No waiting for your next session." },
  { icon: BookOpen, title: "Guides, and supplements only if you need them", body: "Eating out, plateaus, periods. No supplement upsells." },
];

export default function Offer() {
  return (
    <section id="included" aria-labelledby="inc-title" className="bg-black py-24 sm:py-36">
      <div className="mx-auto grid max-w-[1320px] gap-14 px-4 sm:px-8 lg:grid-cols-[5fr_7fr] lg:gap-24">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 id="inc-title" className="t-display t-h2">Everything written for you. Nothing copy‑paste.</h2>
          <p className="mt-6 max-w-[40ch] text-lg text-white/65">
            Bhavika writes every plan herself. Her assistant coach handles your day-to-day questions and follow-ups.
          </p>
          <Link href="#apply" className="btn btn-green mt-8">Apply for coaching <ArrowRight className="arrow h-4 w-4" aria-hidden /></Link>
        </div>
        <ul className="border-t border-white/12">
          {ITEMS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="group grid grid-cols-[48px_1fr] gap-5 border-b border-white/12 py-7 transition-colors hover:bg-white/[0.03] sm:grid-cols-[56px_1fr] sm:px-4">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-white/15 text-green transition-colors group-hover:border-green group-hover:bg-green group-hover:text-ink">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="t-display t-h3">{title}</h3>
                <p className="mt-2 text-white/60">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
