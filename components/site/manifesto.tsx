"use client";

import { useEffect, useRef } from "react";

const TEXT =
  "Most diets ask you to give up your life. Bhavika's clients keep theirs: the 9 a.m. stand-up, the second cup of chai, the Sunday biryani. They just stop guessing.";
const HIGHLIGHT = new Set(["keep", "theirs:", "guessing."]);

/** Words light up as the paragraph scrolls through the viewport. */
export default function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const words = Array.from(el.querySelectorAll<HTMLSpanElement>(".lit-word"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      words.forEach((w) => w.classList.add("on"));
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
      const lit = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("on", i < lit));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section aria-label="Why PeakX" className="relative overflow-hidden bg-black py-28 sm:py-40">
      <div aria-hidden className="pointer-events-none absolute -right-24 top-0 h-[140%] w-px origin-top -rotate-[38deg] bg-green/60" />
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
        <p ref={ref} className="t-display max-w-[22ch] text-[clamp(1.9rem,4.6vw,4.2rem)] !font-extrabold !leading-[1.05]">
          {TEXT.split(" ").map((w, i) => (
            <span key={i} className={`lit-word ${HIGHLIGHT.has(w) ? "hl" : ""}`}>{w} </span>
          ))}
        </p>
        <dl className="mt-16 grid max-w-3xl grid-cols-3 gap-4 border-t border-white/15 pt-6 sm:gap-8">
          {[
            ["114K", "follow her on Instagram"],
            ["Weekly", "check-ins and form reviews"],
            ["2–3 days", "until your plan arrives"],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="t-display whitespace-nowrap text-[clamp(1.05rem,4.2vw,2.4rem)] text-white">{k}</dt>
              <dd className="mt-1 text-xs text-white/55 sm:text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs text-white/40">Typical result: 5–8 kg in 12 weeks for clients who complete every weekly check-in. Individual results vary.</p>
      </div>
    </section>
  );
}
