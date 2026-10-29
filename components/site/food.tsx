"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const ANSWERS: [string, string][] = [
  ["Chai with sugar", "Chai with sugar fits into your daily numbers. Most clients keep two cups a day and still lose fat."],
  ["Rice", "Rice isn't the problem; the portion is. Your plan tells you how much, with dal and sabzi on the same plate."],
  ["Biryani", "Plan for it. A Sunday biryani fits when the rest of the week is built around it, and your check-in shows it didn't undo anything."],
  ["Pizza on Friday", "Friday pizza is in plenty of client plans. You'll learn which order works and how to balance the day around it."],
  ["Diwali mithai", "Festivals and weddings are part of life, so they're part of your plan. You get a festive-week strategy, not a guilt trip."],
  ["A drink at a party", "In moderation, yes. Your plan shows how a drink fits so a party night doesn't turn into a lost week."],
  ["Late-night Maggi", "Instant noodles on a late night are fine. Your substitution guide shows how to add protein so it keeps you full."],
];

export default function Food() {
  const [i, setI] = useState(0);
  return (
    <section id="food" aria-labelledby="food-title" className="bg-paper py-24 text-ink sm:py-36">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-4 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-20">
        <div>
          <h2 id="food-title" className="t-display t-h2">“Can I still eat…?”</h2>
          <p className="mt-6 max-w-[40ch] text-lg text-ink/65">The question every client asks in week one. Tap one.</p>
          <div role="group" aria-label="Foods" className="mt-8 flex flex-wrap gap-2.5">
            {ANSWERS.map(([label], n) => (
              <button
                key={label}
                type="button"
                aria-pressed={n === i}
                onClick={() => setI(n)}
                className={cn(
                  "min-h-12 cursor-pointer rounded-full border-[1.5px] px-5 font-semibold transition-colors",
                  n === i ? "border-ink bg-ink text-white" : "border-ink/20 bg-white hover:border-ink"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div aria-live="polite" className="relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-[28px] bg-ink p-8 text-white sm:p-12">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-[160%] w-[2px] -rotate-[38deg] bg-green/70" />
          <p className="t-display text-[clamp(5rem,13vw,10rem)] leading-[0.8] text-green">Yes.</p>
          <p key={i} className="rise mt-8 max-w-[34ch] text-xl leading-relaxed">{ANSWERS[i][1]}</p>
        </div>
      </div>
    </section>
  );
}
