"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "./logo";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";

const links = [
  { href: "/#journey", label: "The 12 weeks" },
  { href: "/#included", label: "What you get" },
  { href: "/#stories", label: "Stories" },
  { href: "/#bhavika", label: "Bhavika" },
  { href: "/#faq", label: "FAQ" },
];

export default function Header({ minimal = false, ctaHref = "/#apply" }: { minimal?: boolean; ctaHref?: string }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,box-shadow] duration-300",
        solid && "bg-black/75 shadow-[0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl"
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" aria-label="PeakX home" className="shrink-0">
          <Logo className="h-7 sm:h-8" />
        </Link>
        {!minimal && (
          <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-[0.9375rem] text-white/75 transition-colors hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        )}
        <Link href={ctaHref} onClick={() => track("ViewContent", { content_name: "header_cta" })} className="btn btn-green !hidden !min-h-[44px] !px-5 text-[0.9375rem] md:!inline-flex">
          Apply now
        </Link>
      </div>
    </header>
  );
}
