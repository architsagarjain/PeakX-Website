"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import GlyphPortal, { type GlyphPortalStyle } from "@/components/ui/glyph-portal";
import { track } from "@/lib/track";

type Media = { mp4: string; webm: string; poster: string; position: string };

/**
 * Opening frame: "PEAKX" with the hero film playing inside the letters.
 * Scrolling flies the camera through the X; the film fills the screen and the pitch appears.
 * Glyph Portal measures the face once per mount, so it re-mounts when the display font has loaded.
 */
export default function HeroPortal({ fontFamily }: { fontFamily: string }) {
  const [fontReady, setFontReady] = useState(false);
  const [media, setMedia] = useState<Media | null>(null);
  // Phones get the logo's X on its own: big enough to see the film through it.
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    let done = false;
    const ready = () => { if (!done) { done = true; setFontReady(true); } };
    document.fonts.load(`900 100px ${fontFamily}`, "PEAKX").then(ready, ready);
    const t = window.setTimeout(ready, 2500);

    const mq = window.matchMedia("(max-width: 639px), (orientation: portrait) and (max-width: 1100px)");
    setNarrow(mq.matches);
    const onMq = () => setNarrow(mq.matches);
    mq.addEventListener("change", onMq);
    // Portrait screens (phones, upright tablets) get the vertical cut of the film
    const mobile = window.matchMedia("(orientation: portrait)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const still = conn?.saveData || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const base = mobile ? "/media/hero-m" : "/media/hero-1080";
    setMedia({
      mp4: still ? "" : `${base}.mp4`,
      webm: still ? "" : `${base}.webm`,
      poster: mobile ? "/media/hero-poster-m.webp" : "/media/hero-poster.webp",
      // Always anchor the top of the frame: her head comes within ~2% of the film's top edge
      position: mobile ? "50% 0%" : "64% 0%",
    });
    return () => { window.clearTimeout(t); mq.removeEventListener("change", onMq); };
  }, [fontFamily]);

  const style: GlyphPortalStyle = {
    "--gp-paper": "#000",
    "--gp-ink": "#f6f8f4",
    "--gp-field": "#000",
    "--gp-foreground": "#f6f8f4",
    ["--slash-x" as string]: narrow ? "50%" : "84.5%",
  } as GlyphPortalStyle;

  return (
    <GlyphPortal
      key={`${fontReady ? "ready" : "wait"}-${narrow ? "x" : "peakx"}`}
      word={narrow ? "X" : "PEAKX"}
      focusChar="X"
      interactive={false}
      scrollLength={2.2}
      fontFamily={fontFamily}
      fontWeight={900}
      enterLabel="Scroll to step inside"
      className="peakx-portal"
      style={style}
      background={
        <div className="absolute inset-0" style={{ transform: "scale(var(--gp-field-scale,1))", transformOrigin: "50% 0%" }}>
          {media && (
            <video
              className="hero-film absolute inset-x-0 bottom-0 w-full object-cover"
              style={{ objectPosition: media.position }}
              autoPlay muted loop playsInline preload="auto" poster={media.poster}
            >
              {media.webm && <source src={media.webm} type="video/webm" />}
              {media.mp4 && <source src={media.mp4} type="video/mp4" />}
            </video>
          )}
          {/* Darkens the film as the pitch fades in, so the type stays readable */}
          <div className="portal-shade absolute inset-0" style={{ opacity: "var(--gp-reveal, 0)" }} />
        </div>
      }
      front={
        <>
          <span aria-hidden className="portal-slash portal-ready-only" />
          <p className="portal-eyebrow portal-ready-only">1-on-1 online coaching by Bhavika Agarwal</p>
          <div className="portal-support portal-ready-only">
            <h1>Lose <span className="whitespace-nowrap">5–8 kg</span> in 12 weeks. <span className="sm:block">Keep your chai.</span></h1>
            <div className="ctas">
              <Link href="#apply" className="btn btn-green" onClick={() => track("ViewContent", { content_name: "hero_cta" })}>
                Apply for coaching <ArrowRight className="arrow h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </>
      }
    >
      {/* After the dive: one short pitch, centred in the frame, nothing pinned to the edges */}
      <div className="relative flex min-h-[var(--gp-height,100svh)] items-center portrait:items-end">
        <div className="mx-auto w-full max-w-[1320px] px-4 py-24 sm:px-8 portrait:pb-14 portrait:pt-0">
          <h2 className="t-display max-w-[12ch] text-[clamp(1.9rem,6.2vw,5.8rem)]">Built around your life. Not a 1,200-calorie app.</h2>
          <p className="mt-6 max-w-[42ch] text-base text-white/80 sm:text-lg md:text-xl">
            Your training, cardio and diet plan, written around your calendar and your kitchen, with a check-in every single week.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#apply" className="btn btn-green" onClick={() => track("ViewContent", { content_name: "portal_cta" })}>
              Apply for coaching <ArrowRight className="arrow h-4 w-4" aria-hidden />
            </Link>
            <Link href="#journey" className="btn btn-line">See the 12 weeks</Link>
          </div>
        </div>
      </div>
    </GlyphPortal>
  );
}
