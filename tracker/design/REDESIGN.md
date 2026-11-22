# PeakX redesign: implementation brief for Claude Code

Put this file at `design/REDESIGN.md` in the PeakX-v1 repo. Put the Stitch export next to it at `design/stitch/` (one folder per screen, each with `screen.png`, `code.html`, plus `luma_wellness/DESIGN.md`).

The Stitch screens are a **visual reference, not code to paste in**. Rebuild the look inside the existing React app, using its existing state and selectors.

---

## 1. Ground rules

- **Stack stays the same.** React 18 + Vite + TypeScript, plain CSS in `src/styles/peakx.css`.
  - Do not add Tailwind, the Tailwind CDN script, or Material Symbols from the Stitch HTML.
  - Translate Stitch's Tailwind classes into CSS variables and plain classes.
- **Logic stays the same.** Keep the logic layers as they are:
  - `src/domain`, `src/state` (`store.tsx`, `selectors.ts`, `repository.ts`) and `entitlements.ts`.
  - Screens read numbers only from selectors. Never hard-code Stitch's demo numbers in a screen.
- **Gating stays the same.** Pro and Coached gating goes through `canUse()` and AppShell's `feature` lock. The redesign only changes how the lock looks.
- **Images.** The Stitch HTML loads photos from `lh3.googleusercontent.com`, and those links can expire.
  - Download the ones you keep into `public/img/`, or replace them with your own.
  - Compress them to WebP, under 200 KB each.
- **The design rules in `.claude` skills or docs that say "ZIXO-style" (Newsreader, orange `#E4572E`) are replaced by this brief.**

## 2. Design tokens (replace the old ones in `peakx.css`)

```css
:root {
  /* surfaces */
  --canvas: #F5F5F2;
  --surface: #FFFFFF;
  --glass: rgba(255, 255, 255, 0.72);
  --glass-border: rgba(255, 255, 255, 0.85);
  --band: #0E0F0C;          /* dark bottom band */
  --band-card: #1A1B17;
  --band-border: rgba(255, 255, 255, 0.08);

  /* text */
  --text: #0E0F0C;
  --text-2: #55564F;        /* darker than Stitch's #6A6B66, for readable small text */
  --text-3: #7A7B73;        /* minimum for 12px labels on --canvas */
  --text-on-band: #F2F1EB;
  --text-on-band-2: rgba(242, 241, 235, 0.64);

  /* accents */
  --lime: #C6F432;
  --lime-ink: #3B4D00;      /* text on lime or lime-tinted chips */
  --lime-glow: rgba(198, 244, 50, 0.16);
  --coral-a: #FF6B9A;
  --coral-b: #FFB3C7;
  --danger: #BA1A1A;

  /* type */
  --font-display: "Manrope", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;

  /* shape */
  --r-card: 24px;
  --r-inner: 16px;
  --r-pill: 9999px;
  --shadow-card: 0 8px 32px -4px rgba(14, 15, 12, 0.06);
  --shadow-lime: 0 16px 36px -8px rgba(198, 244, 50, 0.28);

  /* spacing */
  --gutter: 24px;           /* 16px under 768px */
  --page-x: 40px;           /* 16px under 768px */
}
```

**Type scale**

| Role | Font | Size and weight |
|---|---|---|
| Big stat number | Manrope | 56px, 300, letter-spacing −0.04em (40px on mobile) |
| Stat unit next to number | Inter | 12–14px, 500, `--text-3` |
| Page title | Manrope | 40px, 400, −0.03em (30px on mobile) |
| Card title | Manrope | 20px, 500 |
| Body | Inter | 14px, 400 |
| Label | Inter | 12px, 500, sentence case (avoid tracked ALL CAPS except for one tiny eyebrow per page) |

Load Manrope (300, 400, 500, 600) and Inter (400, 500, 600) from Google Fonts with `display=swap`.

**Accent rules**
- Lime goes only on a few hero cards per screen, the primary action inside the dark band, progress fills, and the "Pro" badge.
- Coral goes only on the plateau-risk card and warnings (form deviation, missing quantity).
- Primary buttons on light surfaces are black pills (`--text` fill, white text).

## 3. App shell changes (`AppShell`)

| Today | Redesign |
|---|---|
| Left sidebar with nav and shortcuts | Centered floating pill nav: Home, Plan, Log, Insights, Reviews, Coach. The active item is a black pill with white text. |
| Shortcuts list in the sidebar | "Tools" dropdown in the top bar, built from the shortcuts in `src/data/nav.ts` (Plateau check, Form check, Blood work, Devices; Recipes lives in the Plan tabs). When the current route is a tool, the Tools pill shows as active. |
| Top bar | Left: PeakX wordmark (once). Right: lime "Log a meal" mic button and avatar menu (includes plan tier and "Add to home screen"). Recipe search lives on the Recipes page; there is no top-bar search or notifications bell. |
| Mobile dock | Below 768px, the nav becomes a floating bottom pill with 5 icons (Home, Plan, Log, Insights, Coach) and the mic button raised in the middle. Tools and Reviews move into the avatar menu. |
| Pro lock | Blurred content plus a centered glass card with a lime "Pro" badge, one line of value, and an "Upgrade" black pill. |

- Keep `nav.ts` as the single source of nav items, and keep routes in `App.tsx` unchanged.
- The app has no footer. Do not port the Stitch footer.

## 4. Shared components to build first

Put these in `src/components/ui/`:

- `GlassCard` (variants: `light`, `band` for dark tiles, `lime` glow, `coral` glow)
- `Stat` (value, unit, optional delta chip and caption)
- `MacroBar` (label, consumed/target, colour)
- `Sparkline`, `BarSpark`, `Ring`, `HalfGauge`, `Heatmap` (inline SVG, 1.5px strokes, no chart library unless one already exists)
- `WeekStrip` (Mon–Sun capsules, today highlighted, dot for logged days)
- `Chip`, `Badge` (`pro`, `status`), `PillButton` (`primary` black, `accent` lime, `ghost`)
- `DarkBand` (full-width `--band` section with title, optional right-side status chip, and a card row)
- `EmptyState` (icon, one line, one action)

Each component should handle the no-data case. Real users start with zero data, and the current live app shows "–" and "0.0 t".

## 5. Screen map

Before building a screen, open its `screen.png`. Use `code.html` only to read exact spacing.

| Stitch folder | Route (as in `App.tsx`) | Data source |
|---|---|---|
| `peakx_home_dashboard` | Home | today's totals, targets, week volume, weight trend, steps/sleep, plateau risk, today's plan |
| `peakx_voice_log` | Log | voice parse result, today's entries, remaining macros |
| `peakx_training_meal_plan` | Plan | week plan, today's meals, today's workout with last-session comparison |
| `peakx_insights_biometrics` | Insights | 8-week calories vs weight, training heatmap, device sync status |
| `peakx_ai_coach` | Coach (Pro) | chat thread plus a "What the coach knows" panel |
| `peakx_form_check_analysis` | Form check (Pro) | upload state, analysis result, fix plan |
| _(next Stitch round)_ | Reviews, Recipes, Blood work, Plateau check, Devices | keep the current screens working in the new tokens until those designs exist |

## 6. Content rules (apply even if a Stitch screen breaks them)

- **Plain language.** Short, coach-like copy.
  - Do not use telemetry, kinetic, neural, bio-, matrix, vector, synthesized, metabolic flux, glycogen, CNS, or similar jargon.
  - Each card gets at most one sentence of description.
- **Indian context.** Indian dishes and units (katori, roti, plate), and voice logging in English and Hindi.
- **Only real features.**
  - No barcode or UPC scanning and no plate scan on web.
  - No CGM or glucose data, no Whoop, Apple Watch, Withings, DEXA, skin temperature or HRV.
  - Devices are Fitbit and Google Fit only.
  - No supplement dosages.
- **No fake system stats.** No "latency", "confidence %", "sample rate", "cohort percentile" or version badges.
- **Every button works or uses `useSoon` with a release label.**

## 7. Build order (one commit per step; tests and build must pass each time)

1. Tokens, fonts and base styles in `peakx.css`. Remove the old ZIXO tokens.
2. `AppShell`: pill nav with active state, Tools menu, avatar menu, mobile dock, Pro lock.
3. Shared UI components (section 4).
4. Home, including the new-user empty state and the "Set up your plan" banner.
5. Log (voice-first), including the missing-quantity chip flow.
6. Plan.
7. Insights.
8. Coach (Pro).
9. Form check (Pro), with upload state, result state and locked state.
10. Restyle Reviews, Recipes, Blood work, Plateau check and Devices with the new components until their own designs land.

## 8. Quality bar for each screen

- Matches `screen.png` at 1440px wide in layout, spacing and hierarchy (with the content rules above applied).
- Works at 390px with no horizontal scroll. Cards stack, the dark band becomes a horizontal snap carousel, and the mobile dock shows.
- Text contrast is at least 4.5:1 for body and labels. Nothing is smaller than 12px.
- Visible focus rings on all interactive elements, and keyboard navigation works in the nav and Tools menu.
- `backdrop-filter` has a solid `--surface` fallback, and animations respect `prefers-reduced-motion`.
- Empty state, loading state and Pro-locked state are all checked.
- `npx vitest run` and `npm run build` pass. Take Playwright screenshots at 1440 and 390 for review.
