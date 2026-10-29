"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Play, Quote, Video } from "lucide-react";
import { stories, type Story } from "@/lib/stories";

function Card({ s }: { s: Story }) {
  const [playing, setPlaying] = useState(false);
  const vid = useRef<HTMLVideoElement>(null);

  if (s.type === "placeholder") {
    const Icon = s.kind === "video" ? Video : s.kind === "photo" ? ImageIcon : Quote;
    const label = s.kind === "video" ? "Client video" : s.kind === "photo" ? "Progress photo" : "Client words";
    return (
      <li className="relative flex aspect-[9/16] snap-start flex-col items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-green/40 bg-carbon text-center">
        <div aria-hidden className="absolute -right-6 -top-10 h-[130%] w-px -rotate-[38deg] bg-green/30" />
        <Icon className="h-9 w-9 text-green" aria-hidden />
        <p className="t-display mt-4 text-lg">{label}</p>
        <p className="mt-1 text-sm text-white/50">Slot ready for a client story</p>
      </li>
    );
  }

  const meta = (
    <div className="relative">
      {s.result && <p className="t-display text-3xl text-green">{s.result}</p>}
      <p className="mt-1 font-bold">{s.name}</p>
      {s.meta && <p className="text-sm text-white/60">{s.meta}</p>}
    </div>
  );

  if (s.type === "quote") {
    return (
      <li className="flex aspect-[9/16] snap-start flex-col justify-between rounded-[22px] bg-carbon-2 p-7">
        <Quote className="h-8 w-8 text-green" aria-hidden />
        <blockquote className="text-xl leading-snug">{s.quote}</blockquote>
        {meta}
      </li>
    );
  }

  return (
    <li className="relative flex aspect-[9/16] snap-start flex-col justify-end overflow-hidden rounded-[22px] bg-carbon p-6">
      {s.type === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.src} alt={`${s.name}, PeakX client`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <video ref={vid} poster={s.poster} preload="none" playsInline controls={playing} onPause={() => setPlaying(false)} className="absolute inset-0 h-full w-full object-cover">
          <source src={s.src} type="video/mp4" />
        </video>
      )}
      {!playing && <div aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,rgb(0_0_0/.9),rgb(0_0_0/0)_55%)]" />}
      {s.type === "video" && !playing && (
        <button
          type="button"
          aria-label={`Play ${s.name}'s story`}
          onClick={() => { setPlaying(true); vid.current?.play(); }}
          className="absolute left-1/2 top-1/2 grid h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-green text-ink transition-transform hover:scale-105"
        >
          <Play className="ml-1 h-7 w-7 fill-current" aria-hidden />
        </button>
      )}
      {!playing && meta}
    </li>
  );
}

export default function Stories() {
  const rail = useRef<HTMLUListElement>(null);
  const step = (d: number) => rail.current?.scrollBy({ left: d * ((rail.current.firstElementChild as HTMLElement)?.offsetWidth + 16), behavior: "smooth" });
  return (
    <section id="stories" aria-labelledby="stories-title" className="overflow-hidden bg-black py-24 sm:py-36">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-8">
          <div>
            <h2 id="stories-title" className="t-display t-h2 max-w-[13ch]">Women who did the 12 weeks.</h2>
            <p className="mt-5 text-lg text-white/60">Real clients, in their own words, shared with permission.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => step(-1)} aria-label="Previous stories" className="grid h-12 w-12 cursor-pointer place-items-center rounded-full border border-white/20 hover:border-white"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => step(1)} aria-label="Next stories" className="grid h-12 w-12 cursor-pointer place-items-center rounded-full border border-white/20 hover:border-white"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
        <ul ref={rail} className="-mx-4 grid snap-x snap-mandatory auto-cols-[min(76vw,300px)] grid-flow-col gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:-mx-8 sm:px-8">
          {stories.map((s, i) => <Card key={i} s={s} />)}
        </ul>
        <p className="mt-6 text-sm text-white/45">Results vary between people and depend on following the plan and completing check-ins.</p>
      </div>
    </section>
  );
}
