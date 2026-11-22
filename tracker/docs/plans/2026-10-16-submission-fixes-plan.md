---
title: Submission fixes — UI, flow and server load
date: 2026-10-16
status: active
depth: standard
deadline: 2026-10-17 23:59 IST (AI in Business – 2, Submission 3)
---

# Submission fixes — UI, flow and server load

## Summary

An evaluator will open peakx.in, sign up and try the core features. Today they would land in a demo
account ("Arjun", Pro) whose data is copied into their new cloud account on first sign-in, and every
`/api/*` function on Vercel crashes on load, so AI voice parsing, the Coach, payments and wearables all
fail. This plan makes a new visitor start clean, keeps the demo one click away, gets the server
functions loading, and fixes the visible UI/copy defects found in the audit.

## Problem frame (audit, 16 Oct, commit 1fd95c5)

Audit method: production build served locally, 26 routes crawled at 1440 px and 390 px with Playwright
(overflow, clipped text, tap targets, console/page errors), first-visit flow clicked through, live
`/api/*` probed from the browser.

| # | Sev | Finding |
|---|-----|---------|
| 1 | P0 | Every `/api/*` returns 500 FUNCTION_INVOCATION_FAILED. `package.json` is `"type": "module"`; Vercel compiles `api/**` file by file, and the relative imports have no extension (`'./_lib/http'`), so Node throws ERR_MODULE_NOT_FOUND. Reproduced locally. |
| 2 | P0 | First visit loads the Arjun demo (Pro, devices "Connected", onboarding pre-filled). On first sign-in `auth.tsx` uploads local data to the empty account, so new accounts inherit the demo, including `plan: 'pro'`. |
| 3 | P1 | Recipes shows the founding-cohort upsell to Pro users. |
| 4 | P1 | Price copy disagrees: hero footnote leads with ₹399/month, Pro card leads with ₹999 for 4 weeks. |
| 5 | P1 | Pricing page promises "50 Indian recipes"; the library has 12. |
| 6 | P1 | Food log shows "Logged by voice · logged by voice" (seed typo). |
| 7 | P1 | Two analytics tests fail on some weekdays (seed dated relative to today). |
| 8 | P1 | Pre-sign-up pages show the demo user's profile card. Resolved by #2. |
| 9 | P2 | Phone tap targets under 32 px (date-strip arrows, recipe save, remove match, Edit). |
| 10 | P2 | Workout screen renders two `h1`. |
| 11 | P2 | Plateau result headline joins causes awkwardly ("…, then too early to call."). |

## Scope

In: all findings above. Out: new features, screen redesigns, pricing or tier changes, backend behaviour
beyond making functions load (handled in the separate backend audit pass).

## Key decisions

- **Fresh by default, demo on request.** A browser with no saved data starts from an empty account
  (free plan, no history, onboarding not done). The demo stays available from the landing page and an
  in-app banner; the demo data carries `demo: true`. Existing saved demo data is detected (seed ids) and
  flagged so returning browsers see the banner too.
- **Never upload a demo.** On first sign-in to an empty account, a demo device uploads a fresh account
  (keeping plateau answers) instead.
- **Prices are untouched.** `src/data/founding.ts` stays the source of truth; copy is reworded to read
  the same way everywhere: founding cohort ₹999 for the first 4 weeks, then ₹399/month or ₹3,999/year.
- **Server fix is mechanical.** Add `.js` to every relative import reachable from `api/**`
  (TypeScript `moduleResolution: Bundler` and Vite both resolve `.js` to `.ts`). Verify by compiling
  `api/**` file-by-file and importing each function in Node.

## Implementation units

1. **Server functions load** — `.js` extensions in `api/**` and the `src/**` files it imports; a test
   that fails if a relative import without extension is added under `api/` or its `src` dependencies.
2. **Fresh account + demo mode** — `makeFresh()` in `domain/seed.ts`; `demo` flag; repository loads
   fresh when empty, `loadDemo()`/`startFresh()`; store exposes both; detect legacy demo data.
3. **Empty states** — every app route renders with no history (no crash, sensible copy); This Week shows
   a "finish your plan" prompt until onboarding is done; sidebar card handles a blank name.
4. **Demo entry/exit UI** — landing link "See a demo account", in-app demo banner with "Start my own".
5. **Sign-in never uploads demo** — `auth.tsx` first-sign-in branch.
6. **Copy and entitlement fixes** — #3–#6, #10, #11.
7. **Tests** — fresh/demo repository behaviour, auth decision helper, analytics tests made
   weekday-independent.
8. **Phone tap targets** — #9.

## Verification

- `npx vitest run` and `npm run build` pass.
- Crawl all 26 routes at 1440/390 on fresh state and demo state: no page errors, no horizontal scroll.
- Click through: landing → plateau check → plan → This Week → log a meal by text → workout, on fresh state.
- After deploy: `/api/health` returns 200 JSON on the live domain.

## Risks

- Screens written against seeded data may assume non-empty arrays (e.g. latest weight). Mitigated by the
  fresh-state crawl in Verification.
