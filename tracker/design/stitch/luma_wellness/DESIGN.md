---
name: Luma Wellness
colors:
  surface: '#fbf9f3'
  surface-dim: '#dbdad4'
  surface-bright: '#fbf9f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f4ee'
  surface-container: '#efeee8'
  surface-container-high: '#eae8e2'
  surface-container-highest: '#e4e2dd'
  on-surface: '#1b1c19'
  on-surface-variant: '#444934'
  inverse-surface: '#30312d'
  inverse-on-surface: '#f2f1eb'
  outline: '#747962'
  outline-variant: '#c4c9ae'
  surface-tint: '#506600'
  primary: '#506600'
  on-primary: '#ffffff'
  primary-container: '#c6f432'
  on-primary-container: '#566d00'
  inverse-primary: '#aad600'
  secondary: '#ac2a5b'
  on-secondary: '#ffffff'
  secondary-container: '#ff6b9a'
  on-secondary-container: '#6e0032'
  tertiary: '#3e6376'
  on-tertiary: '#ffffff'
  tertiary-container: '#c2e9ff'
  on-tertiary-container: '#446a7c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c5f331'
  primary-fixed-dim: '#aad600'
  on-primary-fixed: '#161f00'
  on-primary-fixed-variant: '#3b4d00'
  secondary-fixed: '#ffd9e0'
  secondary-fixed-dim: '#ffb1c4'
  on-secondary-fixed: '#3f001a'
  on-secondary-fixed-variant: '#8c0b43'
  tertiary-fixed: '#c1e8fe'
  tertiary-fixed-dim: '#a5cce1'
  on-tertiary-fixed: '#001e2b'
  on-tertiary-fixed-variant: '#244b5d'
  background: '#fbf9f3'
  on-background: '#1b1c19'
  surface-variant: '#e4e2dd'
  canvas-light: '#F5F5F2'
  surface-glass: rgba(255, 255, 255, 0.72)
  surface-glass-border: rgba(255, 255, 255, 0.65)
  contrast-band: '#0E0F0C'
  contrast-surface: '#1A1B17'
  text-primary: '#0E0F0C'
  text-secondary: '#6A6B66'
  text-muted: '#9A9B94'
  coral-gradient-start: '#FF6B9A'
  coral-gradient-end: '#FFB3C7'
  electric-lime: '#C6F432'
  lime-glow: rgba(198, 244, 50, 0.16)
typography:
  stat-display:
    fontFamily: Manrope
    fontSize: 56px
    fontWeight: '300'
    lineHeight: 60px
    letterSpacing: -0.04em
  stat-display-mobile:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '300'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-xl:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Manrope
    fontSize: 30px
    fontWeight: '400'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  stat-unit:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-desktop: 1.5rem
  margin: 1.25rem
  margin-desktop: 2.5rem
  space-xxs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

The design system embodies an editorial, calm, and hyper-refined aesthetic tailored for an executive-tier wellness and bio-optimization SaaS platform. It bridges holistic health with modern clinical precision, evoking serene focus, scientific authority, and effortless luxury. 

The visual style blends **Editorial Minimalism** with subtle **Bioluminescent Glassmorphism**. The top interface relies on a warm, organic off-white matte canvas paired with frosted translucency, while the lower viewport anchors deep routines through an obsidian contrast dock. Precision line-work, generous negative space, ethereal volumetric gradients, and crisp monochrome typography project quiet confidence without clutter or digital noise.

## Colors

The palette employs dual atmospheric tiers:
- **Canvas & Frosted Light Surface:** The default background is a warm, paper-like off-white (`#F5F5F2`), paired with luminous glass cards rendered with `rgba(255, 255, 255, 0.72)` and micro-fine translucent strokes.
- **Obsidian Program Band:** A grounded contrast foundation (`#0E0F0C`) anchors the bottom routine panels, elevating luminous program tiles and glowing telemetry.
- **Accents:** The primary vibrant catalyst is an electric acid lime / chartreuse (`#C6F432`), deployed for vitality milestones, live session indicators, and luminous green ambient aura cards. The secondary accent is an ethereal coral-pink gradient (`#FF6B9A` to `#FFB3C7`), reserved exclusively for sensory flow states and plateau risk indicators.

Never use pure black (`#000000`) for primary typography on the light canvas; use the bespoke warm-tinted obsidian neutral (`#0E0F0C`).

## Typography

Typography establishes an editorial cadence by counterbalancing structural precision with light, airy metrics:
- **Display Numerals (`stat-display`):** Telemetry metrics (sleep score, recovery, stress, heart rate) leverage `Manrope` at ultra-light weight `300` with negative tracking. Pair these large numerals immediately beside lowercase, muted, small units styled via `stat-unit` (e.g., `84 / 100`, `23 min`).
- **Headings:** Manrope provides clean modern grotesk balance with geometric circular letterforms.
- **Interface & Data:** Inter delivers functional, crystal-clear micro-typography across metrics, timelines, and navigation labels.

## Layout & Spacing

The interface is structured on a fluid, multi-density layout bounded by safe canvas margins:
- **Upper Canvas (Light Deck):** A flexible 12-column grid housing metric telemetry cards, bio-feedback monitors, and calendar strips.
- **Lower Canvas (The Contrast Band):** An obsidian grounding block docked at the viewport base or transitioning below the fold to contain multi-card program routines and cadence gauges.
- **Responsive Adaptations:**
  - **Desktop (>= 1200px):** 12-column layout with 24px gutters, fixed-height program dock, and central floating pill bar.
  - **Tablet (768px – 1199px):** 8-column layout with 20px gutters; metrics switch to a 2x2 grid, and bottom routines convert to a horizontal snap carousel.
  - **Mobile (< 768px):** 4-column layout with 16px gutters and margins; top navigation collapses into a floating bottom pill; cards stack into a unified single column.

## Elevation & Depth

Visual hierarchy relies on atmospheric glass layering, translucent borders, and bioluminescent diffusion:
- **Frosted Light Cards:** Created with `background: rgba(255, 255, 255, 0.72)`, hardware-accelerated `backdrop-filter: blur(20px)`, a hairline translucent border (`1px solid rgba(255, 255, 255, 0.85)`), and an ultra-soft shadow: `0 8px 32px -4px rgba(14, 15, 12, 0.04)`.
- **Obsidian Dark Cards:** Built with dark charcoal surfaces (`#1A1B17`) with `1px solid rgba(255, 255, 255, 0.08)`.
- **Aura / Luminous Cards:** Highlights (such as the Inner Flow pink tile or the green routine highlights) use internal diffuse radial glows (`radial-gradient(circle at 50% 120%, rgba(198, 244, 50, 0.28), transparent 70%)`) combined with ambient tinted drop-shadows (`0 16px 36px -8px rgba(198, 244, 50, 0.2)`).

## Shapes

The design uses an organic, ultra-curved shape language that softens the clinical data:
- **Primary Content Cards:** Formed with a consistent `24px` radius (`rounded-xl`), creating soft tablet-like enclosures.
- **Interactive Controls & Badges:** Use full circular or pill contours (`rounded-full` / `9999px`) for navigation segments, filter chips, calendar day capsules, and action triggers.
- **Sub-containers & Media Panels:** Use `16px` (`rounded-lg`) for nested metric badges and embedded sparkline viewports.

## Components

### Navigation Pill
- **Structure:** Floating, horizontally centered container with rounded pill shape (`9999px`).
- **Styling:** Frosted white glass backdrop (`rgba(255, 255, 255, 0.85)`), 1px white border, soft drop shadow.
- **States:** Active segment features a high-contrast dark capsule (`#0E0F0C`) with crisp white text; inactive items display muted slate text (`#6A6B66`) transitioning on hover.

### Telemetry Cards
- **Structure:** 24px rounded frosted surface with internal padding of `20px` to `24px`.
- **Visuals:** Features ultra-large thin numerals (`font-weight: 300`) alongside muted metric units. Embedded charts include dot-matrix stress patterns, smooth bezier sparklines (1.5px stroke), and circular cadence rings without heavy container boxes.

### Buttons & Action Badges
- **Primary Button:** High-contrast pill filled with `#0E0F0C` (or `#C6F432` within dark program bands) with medium weight typography and 1.5px linear icons.
- **Icon Actions:** 40px circular translucent glass buttons with 1.5px stroke monochrome vector icons (e.g., search, notifications, settings, document export).

### Program Routine Tiles (Bottom Band)
- **Structure:** Encased in dark charcoal tiles (`#1A1B17`) on the `#0E0F0C` contrast band.
- **Visuals:** Internal glowing fluid 3D waveform visuals (acid lime or coral pink) radiating from bottom to top, subtle navigation arrow capsules, and clean fractional completion counters (`0 / 5`, `2 / 5`).

### Calendar Strip & Chips
- **Structure:** Horizontal carousel of date pills displaying day initial and number.
- **States:** Active date highlighted with a vertical rounded pill container and high-contrast micro-dot indicator.