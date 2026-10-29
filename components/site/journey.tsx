"use client";

import { useEffect, useRef, useState } from "react";

const STAGES = [
  { week: 1, img: "w01", alt: "A woman ties her running shoes on a Bangalore balcony at sunrise, a cup of chai beside her.",
    title: "You start where you are.", body: "No detox, no 1,200-calorie app. Your training, cardio and diet plans arrive in 2–3 days, built around your routine and what's already in your kitchen." },
  { week: 3, img: "w03", alt: "She eats a home-cooked plate of dal, rice and roti at her laptop after a late call.",
    title: "Dinner at your desk still counts.", body: "Dal, rice, roti. Your plan uses the food you already eat, with a substitution guide for the late nights and the Swiggy nights." },
  { week: 6, img: "w06", alt: "She does a goblet squat with a dumbbell at home while her phone films her form.",
    title: "Your form gets checked every week.", body: "Film a set, send it over, get corrections. Strength training at home or in the gym, without guessing." },
  { week: 9, img: "w09", alt: "She laughs over masala dosa and filter coffee at a café on a Sunday.",
    title: "Sunday dosa stays.", body: "Weekly check-ins adjust your plan around birthdays, weddings and work trips, so you never have to start again on Monday." },
  { week: 12, img: "w12", alt: "She walks to her office in a tailored blazer, coffee in hand, smiling.",
    title: "The blazer fits differently.", body: "Clients who complete every check-in typically lose 5–8 kg in 12 weeks, and leave knowing how to keep it off on their own." },
];

/** Art-directed photo: the browser downloads only the cut that fits the screen's orientation. */
function Photo({ img, alt, eager, className }: { img: string; alt: string; eager?: boolean; className?: string }) {
  const b = `/media/journey/${img}`;
  return (
    <picture>
      <source media="(orientation: portrait)" srcSet={`${b}-tall-720.webp 720w, ${b}-tall.webp 1080w`} sizes="100vw" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${b}-wide.webp`} srcSet={`${b}-wide-1280.webp 1280w, ${b}-wide.webp 1920w`} sizes="100vw" alt={alt}
        loading={eager ? "eager" : "lazy"} decoding="async" className={className} />
    </picture>
  );
}

/**
 * Pinned scroll story: the week counter runs 01 → 12 across five moments.
 * Landscape screens: photo full-bleed, text on the calm left side of the frame.
 * Portrait screens: photo on top, text underneath on black, so copy never sits on a face.
 */
export default function Journey() {
  const track = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);
  const [week, setWeek] = useState(1);
  const [still, setStill] = useState(false);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "250% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); return; }
    const el = track.current!;
    const n = STAGES.length;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / total));
      const s = Math.min(n - 1, Math.floor(p * n));
      const local = p * n - s;
      let w = STAGES[s].week;
      if (s < n - 1 && local > 0.6) w = Math.round(STAGES[s].week + ((local - 0.6) / 0.4) * (STAGES[s + 1].week - STAGES[s].week));
      setStage(s); setWeek(w);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  if (still) {
    return (
      <section id="journey" aria-labelledby="journey-title" className="bg-black py-24">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
          <h2 id="journey-title" className="t-display t-h2 mb-14">Your 12 weeks.</h2>
          <ol className="grid gap-12 md:grid-cols-2">
            {STAGES.map((s) => (
              <li key={s.week}>
                <div className="relative aspect-[16/10] max-w-full overflow-hidden rounded-2xl">
                  <Photo img={s.img} alt={s.alt} className="absolute inset-0 h-full w-full object-cover object-[70%_30%] portrait:object-[50%_6%]" />
                </div>
                <p className="t-display mt-5 text-green">Week {s.week}</p>
                <h3 className="t-display t-h3 mt-2">{s.title}</h3>
                <p className="mt-3 max-w-[50ch] text-white/70">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    );
  }

  return (
    <section id="journey" aria-labelledby="journey-title" className="relative bg-black">
      <h2 id="journey-title" className="sr-only">Your 12 weeks with PeakX</h2>
      <div ref={track} style={{ height: "520vh" }}>
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          {/* Photo layer: full-bleed in landscape, top 58% in portrait */}
          <div className="absolute inset-x-0 top-0 h-full overflow-hidden portrait:top-[64px] portrait:h-[calc(56%-64px)] md:portrait:top-[72px] md:portrait:h-[calc(64%-72px)]">
            {STAGES.map((s, i) => (
              <div key={s.img} className={`j-frame ${i === stage ? "on" : ""}`} aria-hidden={i !== stage}>
                {near && <Photo img={s.img} alt={s.alt} eager className="absolute inset-0 h-full w-full object-cover object-[70%_30%] portrait:object-[50%_6%]" />}
              </div>
            ))}
            <div aria-hidden className="absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgb(0_0_0/.9)_0%,rgb(0_0_0/.65)_32%,rgb(0_0_0/0)_58%),linear-gradient(0deg,rgb(0_0_0/.5)_0%,rgb(0_0_0/0)_25%)] portrait:bg-[linear-gradient(0deg,#000_0%,rgb(0_0_0/0)_32%)]" />
          </div>

          {/* Text layer */}
          <div className="absolute inset-0 z-[2] mx-auto flex max-w-[1320px] flex-col px-4 sm:px-8 landscape:justify-center portrait:justify-end portrait:pb-[calc(88px+env(safe-area-inset-bottom,0px))] md:portrait:pb-12">
            <div className="max-w-[min(34rem,42vw)] portrait:max-w-[36rem]">
              <p aria-hidden className="t-display text-base text-white/60 sm:text-lg">Week</p>
              <p aria-hidden className="flex items-baseline gap-3 leading-none">
                <span className="t-display j-num text-[clamp(5.5rem,min(17vw,24svh),15rem)] text-green">{String(week).padStart(2, "0")}</span>
                <span className="t-display text-lg text-white/45 sm:text-2xl">of 12</span>
              </p>
              <div className="relative mt-4 grid">
                {STAGES.map((s, i) => (
                  <div key={s.title} className={`j-cap col-start-1 row-start-1 ${i === stage ? "on" : ""}`} aria-hidden={i !== stage}>
                    <h3 className="t-display text-[clamp(1.5rem,2.8vw,2.6rem)] leading-[0.98]">{s.title}</h3>
                    <p className="mt-3 text-[0.98rem] text-white/75 sm:text-base">{s.body}</p>
                  </div>
                ))}
              </div>
              <div aria-hidden className="mt-6 flex gap-1.5">
                {Array.from({ length: 12 }, (_, i) => (
                  <i key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < week ? "bg-green" : "bg-white/15"}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
