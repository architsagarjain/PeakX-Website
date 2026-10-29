"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Phone-only sticky "Apply" button. Hidden while a section that already has a call to action is on screen. */
export default function MobileCta({ href = "#apply", label = "Apply for coaching" }: { href?: string; label?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const zones = document.querySelectorAll("[data-cta-zone], #apply, footer");
    const seen = new Set<Element>();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
      setOn(seen.size === 0 && window.scrollY > 200);
    }, { threshold: 0 });
    zones.forEach((z) => io.observe(z));
    const onScroll = () => setOn(seen.size === 0 && window.scrollY > 200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, []);
  return (
    <div className={cn("fixed inset-x-3 bottom-3 z-40 transition-transform duration-300 md:hidden", on ? "translate-y-0" : "translate-y-[140%]")}>
      <Link href={href} className="btn btn-green w-full shadow-[0_16px_40px_-12px_rgb(0_0_0/.8)]">{label}</Link>
    </div>
  );
}
