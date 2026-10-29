# PeakX — peakx.in

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn project structure (`components/ui`, `lib/utils.ts`, `components.json`) · lucide-react icons.

```
app/
  page.tsx            Home: Glyph Portal hero → manifesto → fit → 12-week journey → foods → offer → stories → about → steps → guarantee → FAQ → application form
  apply/page.tsx      Landing page for ads and "COACH" DMs — form above the fold
  privacy/page.tsx    Privacy policy (needed for Meta ads; review before launch)
  api/apply/route.ts  Receives applications and forwards them to WEBHOOK_URL
  sitemap.ts, robots.ts
components/
  ui/glyph-portal.tsx   The Glyph Portal component, unchanged (MIT, © Christian Katzmann — keep the notice)
  site/hero-portal.tsx  PeakX wrapper: hero film inside the letters, dive through the X
  site/*                All other sections
lib/
  config.ts   Links, FAQs and env-driven settings
  stories.ts  Client testimonials (videos, photos, quotes)
  fonts.ts    Self-hosted Archivo (125% width = the logo's typeface)
public/
  brand/peakx-logo.svg  Vector redraw of the logo
  media/                Higgsfield hero film + journey stills
```

Why `components/ui`: shadcn's CLI and every shadcn-style component (like Glyph Portal) import from `@/components/ui/...`. Keeping that folder means you can paste future components straight in, or run `npx shadcn@latest add <component>` and it lands in the right place.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production check
```

## Before going live

Set these in Vercel → Project → Settings → Environment Variables:

| Variable | What it does |
|---|---|
| `WEBHOOK_URL` | Where applications go (Make.com / Zapier webhook, or a Google Apps Script URL that writes to a Sheet). Until set, leads are written to the Vercel function logs. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Turns on the Meta Pixel |
| `NEXT_PUBLIC_BOOKING_URL` | Calendly / Cal.com link for qualified applicants |
| `NEXT_PUBLIC_LEAD_MAGNET_URL` | Free guide for people not ready yet |
| `NEXT_PUBLIC_WHATSAPP` | WhatsApp number (digits with country code) shown if the form fails |

Then:
1. **Bhavika's photo** — add `public/media/bhavika.webp` (4:5) and uncomment the `<Image>` in `components/site/sections.tsx` → `About`.
2. **Client stories** — edit `lib/stories.ts` (instructions at the top), media in `public/clients/`.
3. **Logo** — `public/brand/peakx-logo.svg` is a close redraw. If the designer has the master SVG, replace it.
4. Point the SuperReply "COACH" bot to `https://peakx.in/coach` (redirects to `/apply?src=coach`, so DM leads are tagged).

## Deploy (Vercel)

Push this folder to GitHub → vercel.com → Add New → Project → import the repo (framework auto-detected as Next.js) → add the env vars → Deploy. Then Settings → Domains → add `peakx.in` and `www.peakx.in` and set the DNS records Vercel shows. Submit `https://peakx.in/sitemap.xml` in Google Search Console.

## Tracking (when the Pixel ID is set)

`PageView` · `ViewContent` on Apply buttons · `InitiateCheckout` when the form is started · `Lead` on submit (`qualified` / `nurture`) · `Schedule` on "Book my discovery call". UTM parameters and `fbclid` are saved with every application.

A lead is **qualified** (shown the booking link) when they're ready to invest (or want instalments) and want to start within 3 months. Change it in `components/site/apply-form.tsx` → `submit`.

## Performance notes

- Fonts self-hosted and preloaded; the display face is a static 125%-width cut so the portal measures it exactly.
- Hero film: 0.35 MB (desktop WebM) / 0.15 MB (phone), MP4 fallback for Safari. Skipped on Data Saver and reduced-motion.
- Journey frames load only as the reader approaches; Vercel serves them as AVIF/WebP at the right size.
- Reduced-motion users get a static hero and a stacked journey.

## Copy to confirm with Bhavika

- "5–8 kg in 12 weeks" headline and the "typical result" footnote.
- The results guarantee (free coaching until the agreed target) — still the proposed version.
- "Limited number of new clients each month" and "Bhavika takes every discovery call herself".

All imagery is AI-generated with Higgsfield and shows a fictional woman, not a client. Never present it as a client result.
