const FOODS = ["Chai", "Rice", "Biryani", "Masala dosa", "Pizza Friday", "Diwali mithai", "Rajma chawal", "Late-night Maggi"];

/** The foods clients keep, rolling past in the logo's outlined style. */
export default function Marquee() {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden} className="flex shrink-0 items-center">
      {FOODS.map((f) => (
        <li key={f} className="flex items-center">
          <span className="t-display t-outline whitespace-nowrap px-6 text-[clamp(2.6rem,7vw,6rem)] text-white/90">{f}</span>
          <span aria-hidden className="h-[0.9em] w-[2px] -rotate-[24deg] bg-green text-[clamp(2.6rem,7vw,6rem)]" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Foods our clients keep eating" className="marquee-wrap overflow-hidden border-y border-white/10 bg-black py-8 sm:py-10">
      <div className="marquee">{row(false)}{row(true)}</div>
    </section>
  );
}
