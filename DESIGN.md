# DESIGN.md

> Source of truth for how Podacium _looks_ and _why it is built the way it is_.
> Read this before any UI change or any structural change. If you only read one file
> for UI work, read this one. The YAML front matter is machine-readable and carries the
> normative token values; the prose explains how and why to apply them.

```yaml
version: alpha
name: podacium
description: >-
  Podacium visual identity and system invariants. Blue→indigo gradient brand on a
  light, glassmorphic UI; Inter / Baloo Bhaijaan 2 (Arabic) / DM Mono; fixed glass
  pill navbar and dark gradient footer; dual light/dark themes driven by a persisted
  ThemeProvider.
```

## Overview

### Brand & Style

Podacium is an Algerian platform that combines EdTech, freelancing, and business
intelligence. The visual identity should read **innovative, trustworthy, and warm —
with a clear premium/enterprise confidence**. The emotional contract: _"Serious platform
for serious learning and work, presented with modern polish."_

The dominant design language is:

- **Blue→indigo gradient as the single brand gesture.** One gradient family
  (`from-blue-600 to-indigo-600` and its indigo/purple siblings), used sparingly but
  consistently for CTAs, hero headline text, avatars, and active states. Scarcity is
  the point — one accent family, not many.
- **Light, airy, glassmorphic surfaces.** White/gray-50 backgrounds, frosted panels
  (`bg-white/70` + `backdrop-blur`), hairline borders (`border-white/40`), soft shadows.
- **Dark footer / dark CTA panels as deliberate contrast.** `gray-900 → gray-950`
  gradient blocks anchor the bottom of every page.
- **Motion that signals confidence:** gentle entrance fades, spring taps, staggered
  reveals (`framer-motion`), never gratuitous.

### North Star invariants

1. **The Blue-Means-Action Rule.** The blue/indigo gradient and `primary` color are
   reserved for interactive and brand moments. Content, chrome, and decoration stay neutral.
2. **The Glass-Pill Rule.** The navbar is a floating frosted pill (`fixed top-(--nav-pill-top) inset-x-4`,
   `bg-white/70 backdrop-blur-xl`, `rounded-[2rem]`). Keep it. Do not redesign it into a
   solid bar or a sticky-underline nav. It supports three responsive density modes:
   `full` (marketing/catalogues, `max-w-7xl mx-auto`), `compact` (docked to the content column
   clearing workspace/admin spines via `--content-start`), and `focus` (minimal cinema/exam player).
3. **The Bidi-By-Default Rule.** The app must read correctly in LTR (en/fr/kab) and RTL
   (ar). Use logical properties (`ms-*`, `me-*`, `start-*`, `end-*`, `rtl:*`) and the
   `@custom-variant rtl/ltr` utilities; never hardcode physical left/right for text flow.
4. **The Dual-Theme System (Light + Dark).** Light and dark are both active, token-driven
   themes. `ThemeProvider` (`src/contexts/ThemeContext.tsx`) resolves `light` / `dark` /
   `system`, persists the choice in `localStorage` (`podacium-theme`), and toggles `.dark`
   on `<html>`. Every surface must be checked in both themes; never fork the theme system
   or add per-component theme state.

## Colors

### Palette

| Token                                  | HSL           | Hex       | Role                                       |
| -------------------------------------- | ------------- | --------- | ------------------------------------------ |
| `--primary`                            | `221 83% 53%` | `#2463eb` | Brand / primary actions, links, focus ring |
| `--primary-foreground`                 | `0 0% 100%`   | `#ffffff` | Text on primary                            |
| `--background`                         | `0 0% 100%`   | `#ffffff` | Page background                            |
| `--foreground`                         | `220 13% 13%` | `#1d2025` | Primary text                               |
| `--secondary` / `--muted` / `--accent` | `220 14% 96%` | `#f3f4f6` | Panels, hovers, subtle fills               |
| `--muted-foreground`                   | `220 9% 46%`  | `#6b7280` | Secondary text, captions                   |
| `--destructive`                        | `0 84% 60%`   | `#ef4343` | Errors, destructive actions                |
| `--destructive-foreground`             | `0 0% 100%`   | `#ffffff` | Text on destructive                        |
| `--border` / `--input`                 | `220 13% 91%` | `#e5e7eb` | Borders, inputs                            |
| `--ring`                               | `221 83% 53%` | `#2463eb` | Focus rings                                |

These are the semantic tokens in `apps/web/src/app/globals.css` (`:root`), exposed to
Tailwind via `@theme` as `bg-primary`, `text-muted-foreground`, `border-border`, etc.
**Prefer tokens over raw hex.** For a semantic color, use its token; only reach for the
Tailwind palette below for pure decorative/gradient work.

### Brand gradient family (de-facto, used across the app)

| Gradient                                     | Stops                         | Typical use                                        |
| -------------------------------------------- | ----------------------------- | -------------------------------------------------- |
| `from-blue-600 to-indigo-600`                | `#2563eb → #4f46e5`           | Primary CTAs, newsletter button, waitlist, pricing |
| `from-indigo-600 to-purple-600`              | `#4f46e5 → #9333ea`           | Navbar logo glow, mobile auth buttons              |
| `from-indigo-500 to-purple-600`              | `#6366f1 → #9333ea`           | Avatars, profile header                            |
| `from-blue-600 via-indigo-600 to-purple-600` | `#2563eb → #4f46e5 → #9333ea` | Hero headline gradient text                        |
| `from-primary to-cyan-500`                   | `#2463eb → #06b6d4`           | 404 page                                           |

Pricing/course cards may use `blue-500→cyan-500`, `indigo-500→purple-500`,
`purple-500→pink-500` for differentiation. Keep these within the same blue/indigo/purple
family — the brand never uses red/orange/green gradients for branding.

### Dark theme

Dark mode is wired, not scaffolded. `ThemeProvider` owns the `.dark` class on `<html>`
(`@custom-variant dark (&:where(.dark, .dark *))` in `globals.css`), and the semantic
tokens in the `.dark` block supply the palette:

| Token                                  | Light                    | Dark                          |
| -------------------------------------- | ------------------------ | ----------------------------- |
| `--background`                         | white                    | slate-950 (`224 71% 4%`)      |
| `--card` / `--popover`                 | white                    | slate-900 (`222 47% 11%`)     |
| `--foreground`                         | slate-900                | slate-50 (`210 20% 98%`)      |
| `--muted` / `--secondary` / `--accent` | slate-100                | slate-800 (`217 33% 17%`)     |
| `--muted-foreground`                   | slate-500                | slate-400 (`215 20.2% 65.1%`) |
| `--border` / `--input`                 | slate-200                | slate-800 (`217 33% 20%`)     |
| `--primary`                            | blue-600 (`221 83% 53%`) | unchanged                     |

Use semantic utilities (`bg-background`, `bg-card`, `text-foreground`, `border-border`) and
the `dark:` variant only for genuinely theme-specific decoration (e.g. softened aurora
opacity). The theme toggle lives in the navbar/workspace settings; do not build a second one.
`ThemeContext` also owns font-size scale (`data-font-size`), density (`data-density`),
reduced motion (`data-reduced-motion`), and high contrast (`data-high-contrast`).

### Always-dark surfaces (footer, hero panels, dark CTA blocks, and the live room)

| Usage                 | Value                                                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Footer background     | `bg-gradient-to-b from-gray-900 to-gray-950` (`#111827 → #030712`)                                                                                                                                                               |
| Footer body text      | `text-gray-400` (`#9ca3af`)                                                                                                                                                                                                      |
| Footer legal text     | `text-gray-500` (`#6b7280`)                                                                                                                                                                                                      |
| Dark CTA panels       | `from-gray-900 to-gray-800`, `from-indigo-900 via-blue-900 to-indigo-950`                                                                                                                                                        |
| Loading screen        | `bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900`                                                                                                                                                                   |
| **Live room**         | `bg-slate-950` (`#020617`) with a drifting `indigo-600/20 → purple-600/18` ambient radial at ~12–20% opacity behind the participant grid                                                                                         |
| **Live control dock** | Floating glassmorphism: `bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl`; controls are `text-white hover:bg-white/10`; the Leave action is a solid red pill (`bg-red-500`) separated by a `bg-white/20` divider |
| Live room sidebar     | Stays a light, glassy white panel (`bg-white`) so chat/QA/ecosystem stay readable against the dark chrome                                                                                                                        |

The live room is an intentional dark surface — a "dark studio" for the video stage,
analogous to the dark footer. It stays dark in both themes and does not rely on the
`.dark` class; its colors are fixed dark tokens regardless of the active theme. All
interactions in the room (dock buttons, toasts, banners) use the same blue→indigo→purple
accent family; red is reserved for destructive/mute states (mic/camera off, recording,
leave).

### Section tints

CTA band backgrounds use `bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50`
(careers, terms, refund, help). Content pages alternate `bg-white` and `bg-gray-50`
via `PageLayout` `background` prop.

## Typography

### Families (self-hosted via `@fontsource`, imported in `apps/web/src/app/layout.tsx`)

| Role           | Family                                             | Weights loaded | Notes                                                                                                    |
| -------------- | -------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| Sans (default) | **Inter** (`'Inter', system-ui, sans-serif`)       | 400–700        | `--font-sans` in `@theme`                                                                                |
| Display        | **Baloo Bhaijaan 2**                               | 400–700        | `--font-display`; **also the Arabic body font** (`html[dir="rtl"] { --font-sans: 'Baloo Bhaijaan 2'; }`) |
| Mono           | **DM Mono** (`'DM Mono', ui-monospace, monospace`) | 400–500        | IDs, codes, certificates, spreadsheets, OTP inputs                                                       |

### Sizes in use (no named scale — match these patterns)

| Level           | Classes                                                                   | Context                                 |
| --------------- | ------------------------------------------------------------------------- | --------------------------------------- |
| Hero display    | `text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]` | Landing hero                            |
| Section heading | `text-3xl md:text-4xl lg:text-5xl font-bold`                              | `BILayer`, `EducationLayer`             |
| Page header     | `text-2xl lg:text-3xl font-bold`                                          | `PageHeader`                            |
| Card title      | `text-lg font-semibold`                                                   | Cards, stat values `text-2xl font-bold` |
| Micro-label     | `text-[10px] font-black tracking-[0.2em] uppercase`                       | Hero pill, pillars                      |
| Body            | `text-sm` / `text-base`; muted `text-sm text-gray-500`                    | General content                         |

Base rules (in `globals.css`): all `h1–h6` are `font-weight: 700; letter-spacing: -0.025em;`
`code`/`pre` always use `--font-mono`.

**RTL (Arabic):** body font switches to Baloo Bhaijaan 2 via the `html[dir="rtl"]` override —
never manually set `font-family` per element. Do not add `font-arabic` (undefined utility, no-op).

## Layout & Spacing

- **Content width:** `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` everywhere; `container` config
  is centered with `2rem` padding and a `2xl` breakpoint at `1400px`.
- **Fixed navbar compensation:** the navbar floats at `top-4`, so pages use `pt-20` (5rem)
  via `PageLayout` (`navbarPadding` defaults to true). Match that; don't hand-roll smaller
  offsets that make content slide under the pill.
- **Section rhythm:** marketing sections `py-14 lg:py-16`; hero `pt-24 pb-8 lg:pt-32`;
  legal pages `pt-28 pb-16`. Grids use `gap-4`–`gap-8`.
- **Breakpoints:** Tailwind defaults (`sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280 / `2xl` 1536);
  the navbar collapses to a hamburger menu below `xl`.
- **Modals:** centered, `max-w` constrained, scroll-locked body.
- **Layout components:** use `PageLayout`/`PageHeader` (from `src/components/PageLayout.tsx`),
  `SectionCard`, `StatCard`, `EmptyState`, `LoadingState`.

## Elevation & Depth

The UI is light and flat; hierarchy comes from **soft shadows, blur, and borders**, not heavy
fills.

| Element                           | Shadow                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| Navbar (rest)                     | `shadow-[0_8px_16px_rgba(0,0,0,0.06)]`                              |
| Navbar (scrolled, `scrollY > 20`) | `shadow-[0_8px_32px_rgba(0,0,0,0.12)]`                              |
| Cards (`PodaciumCard` elevated)   | `shadow-md`; glass `shadow-[0_8px_30px_rgb(0,0,0,0.04)]`            |
| Gradient CTAs                     | `shadow-lg shadow-primary/25` → hover `shadow-xl shadow-primary/30` |
| Hero mock / large panels          | `shadow-2xl` and `shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)]`      |
| Dropdowns / mega-menus            | `shadow-2xl` + `bg-white/95 backdrop-blur-2xl`                      |
| Premium card hover (elevated)     | `hover:shadow-[0_20px_60px_-15px_rgba(79,70,229,0.25)]` indigo halo |

Glass recipe: `bg-<color>/<opacity> + backdrop-blur-<n> + border-white/<opacity>`. Reuse it
instead of inventing new transparency stacks.

## Premium layer (shared utilities)

Global utilities live in `globals.css` (`@theme` keyframes + component classes). Use them
across pages; they respect `prefers-reduced-motion`.

| Utility               | Effect                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `animate-aurora`      | Slow drifting ambient blobs (`aurora` keyframe; `-slow` variant is even gentler)                             |
| `animate-shimmer`     | Moving diagonal highlight — skeletons, progress fills (`bg-[length:200%_100%]` required)                     |
| `animate-float-slow`  | Gentle up/down bob for decorative icons and empty-state glyphs                                               |
| `animate-gradient-x`  | Drifting background-position for animated gradient text/panels                                               |
| `animate-glow-pulse`  | Soft opacity pulse for accent halos and behind-loaders                                                       |
| `animate-ring-pulse`  | Expanding focus-style halo ring (used by `PodaciumButton glow`)                                              |
| `animate-sheen`       | One-shot light sweep across a surface (`shimmer-sweep` overlay class)                                        |
| `.aurora-blob`        | Pre-styled absolutely-positioned blurred orb; pair with `animate-aurora*` + a `blue/indigo/purple-*` bg      |
| `.gradient-text`      | Animated blue→indigo→purple clip-text headline                                                               |
| `.gradient-border`    | 1px gradient hairline around a surface (used by `PodaciumCard variant="premium"`)                            |
| `.card-spotlight`     | Radial highlight follows the cursor (`--x`/`--y` via JS `onMouseMove`) on hover                              |
| `.glass-deep`         | Stronger blur + saturate glass panel with inner top highlight                                                |
| `.grid-light`         | Subtle light grid backdrop (44px) for hero/empty panels                                                      |
| `.shimmer-sweep`      | Absolutely-positioned sheen overlay for gradient buttons                                                     |
| `.podacium-reveal`    | CSS entrance reveal driven by `PodaciumReveal` (`data-entrance="fade\|up\|scale"`); off under reduced motion |
| `.podacium-sparkle`   | One-shot twinkle for `PodaciumSparkles`; `opacity: 0` base, so it is inert under both reduced-motion gates   |
| `animate-border-beam` | Travelling light along a surface edge (used by `PodaciumBorderBeam`)                                         |

**Motion tokens** in `@theme` (prefer these over ad-hoc `duration-*`/`ease-*` values):
`--duration-snap` (150ms), `--duration-ui` (300ms), `--duration-reveal` (600ms),
`--duration-ambient` (900ms); `--ease-out-soft`, `--ease-in-out-soft`; `--motion-stagger` (80ms)
and `--motion-travel` (20px) for choreographed entrances.

### Hero entrance primitives (`src/components/velora/`)

| Component            | Use for                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PodaciumReveal`     | Staggered entrance of copy/panels. CSS-only, so it starts at first paint. Props: `entrance`, `delay` (ms), `duration`, `distance`, `as`                                                                               |
| `PodaciumSparkles`   | Sparkle burst around a badge/pill. Text stays real DOM text, the layer is `aria-hidden` and CSS-only. `loop` twinkles 45% duty over a 4s cycle, phased → ~2–3 lit at once. Props: `count` (1–6), `delay` (ms), `loop` |
| `PodaciumBorderBeam` | One travelling hairline of light on a panel's top edge                                                                                                                                                                |
| `PodaciumRetroGrid`  | Decorative drifting canvas grid; static frame under reduced motion, capped at 2× DPR                                                                                                                                  |

Hero rules:

- **Never** hide the `h1` behind an entrance animation — it is the LCP element. Animate the
  badge, sub-copy, CTAs and mockup instead.
- Product mockups are DOM + inline SVG, not screenshots: no extra request on the LCP path,
  crisp at any DPR, and they mirror in RTL without a second asset.
- Decorative panels use `role="img"` + a translated `aria-label` so mockup micro-copy never
  leaks into the accessibility tree.
- Keep numeric/lTR-only strings (`+14%`, URLs, amounts) in `dir="ltr"` spans so Arabic does not
  reorder the sign.

**Presets** in `src/lib/animation-presets.ts`: `premiumStagger`/`premiumStaggerItem` (parent+child
reveal), `premiumReveal` (scroll reveal), `premiumHero` (blur-in display text), `premiumFloat`,
`premiumDrift`, `premiumCardHover`, `premiumStat`.

**Design-system additions**: `PodaciumCard variant="premium"` (gradient hairline + indigo hover
halo) and `variant="glass"`; `PodaciumBadge variant="gradient"`; `PodaciumButton` `glow` prop
(ring-pulse halo on hover) plus a `shimmer-sweep` on the `gradient` variant; `PodaciumInput`
focus glow (`shadow-[0_0_0_4px_rgba(37,99,235,0.08)]` + hover border). `SectionCard`, `StatCard`,
`EmptyState`, `LoadingState`, `ProgressBar`, `PageHeader`, and `PageLayout` (default `ambient`)
carry the premium treatment automatically on every page that uses them.

## Shapes

Two radius systems coexist deliberately:

- **Token radius** `--radius: 0.375rem` (6px). The `Podacium*` design-system components use
  `rounded-sm` (2px) / `rounded-md` (4px) / `rounded-lg` (6px) derived from it
  (`rounded-lg` is the default for buttons/inputs/cards).
- **Marketing/section scale** (override freely on landing surfaces): `rounded-xl` 12px,
  `rounded-2xl` 16px, `rounded-3xl` 24px, `rounded-[2rem]` 32px (navbar pill, mobile menu),
  `rounded-[2.5rem]` 40px (hero dashboard mock), `rounded-[3rem]` 48px (BILayer CTA).

Within a component or page, pick one radius system and stay consistent — don't mix 6px
buttons inside a 32px pill next to 4px chips.

## Components

> Canonical UI lives in `apps/web/src/components/design-system/` — `Podacium*` components
> built with `class-variance-authority` + `cn()` (clsx + tailwind-merge) + `framer-motion`,
> each with a co-located `*.test.tsx`. **Use them; don't rebuild them.**

### Navbar — `src/components/Navbar.tsx` (the glass pill)

```tsx
<nav className="fixed top-4 inset-x-4 z-50 mx-auto max-w-7xl rounded-[2rem] border border-white/40 bg-white/70 backdrop-blur-xl transition-shadow duration-300 print:hidden ...">
```

- Fixed, floating frosted pill, `top-4 inset-x-4`, `max-w-7xl`, `z-50`, hidden on print.
- Active nav item: `text-white bg-indigo-600 shadow-sm`; hover `text-indigo-700 hover:bg-white/50`.
- Desktop CTA: `bg-indigo-600 hover:bg-indigo-700`; mobile auth: gradient
  `from-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/40`.
- Full `role="menubar"` accessibility, focus-trapped mega-menus, Escape + outside-click close.
- Notification bell / search / language switcher live in the pill's right side.

### Footer — `src/components/Footer.tsx`

- **Normal document flow** (never fixed), `motion.footer` fade-in `whileInView once:true`.
- `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`, grid `py-14 lg:py-16`.
- Background `bg-gradient-to-b from-gray-900 to-gray-950 text-white relative overflow-hidden`
  with a white dot-grid texture (`radial-gradient` 1px dots at 2.5% opacity).
- Link headings `text-xs font-semibold tracking-wider text-gray-500 uppercase`; links
  `text-sm text-gray-400 hover:text-white`. Newsletter CTA is the standard
  `from-blue-600 to-indigo-600` gradient button.

### `Podacium*` design-system components (key variants)

| Component                                                                                                    | Variants                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PodaciumButton`                                                                                             | `primary`, `secondary`, `outline`, `ghost`, `link`, `destructive`, `gradient` (`from-primary to-indigo-600`); sizes `sm`/`default`/`lg`/`xl`/`icon`; `fullWidth`; spring `whileTap` press; `glow` prop (ring-pulse halo)                                                                                                                  |
| `PodaciumCard`                                                                                               | `default` (`border-border bg-white`), `elevated` (`shadow-md`), `outline` (`border-2`), `glass` (`border-border/50 bg-background/80 backdrop-blur-sm`), `premium` (`gradient-border` hairline + indigo hover halo); padding `sm`/`md`/`lg`                                                                                                |
| `PodaciumBadge`                                                                                              | `default`, `secondary`, `destructive`, `outline`, `success` (`emerald-100/800`), `warning` (`amber-100/800`), `gradient` (`from-blue-600 to-indigo-600`)                                                                                                                                                                                  |
| `PodaciumInput`                                                                                              | states `default` / `error` (`border-red-500`) / `success` (`border-green-500`); sizes `sm`/`md`/`lg`; label/hint/error slots with `role="alert"`                                                                                                                                                                                          |
| `PodaciumTabs`                                                                                               | `underline`, `pills`, `enclosed`, `glass`                                                                                                                                                                                                                                                                                                 |
| `PodaciumModal`                                                                                              | overlay `bg-black/50 backdrop-blur-sm`, panel `bg-white rounded-2xl shadow-2xl`, Escape + scroll lock                                                                                                                                                                                                                                     |
| `PodaciumDrawer`                                                                                             | edge panels: `position` `start`/`end`/`top`/`bottom` (logical — flips in RTL), size `auto`/`sm`/`md`/`lg`/`xl`/`full`, variant `modal`/`dismissible`/`persistent`; swipe-to-dismiss, snap points, focus trap + restore, Escape/overlay dismissal                                                                                          |
| `PodaciumSwitch`, `PodaciumSelect`, `PodaciumTextarea`, `PodaciumTooltip`, `PodaciumToast`, `PodaciumAvatar` | follow the same cva + token pattern                                                                                                                                                                                                                                                                                                       |
| Feedback                                                                                                     | `PodaciumLoadingScreen`, `PodaciumProgressRing`, `PodaciumSkeleton`                                                                                                                                                                                                                                                                       |
| Motion                                                                                                       | `PodaciumMotionStatus` (5×5 dot-matrix + rotating label) and `PodaciumMotionGrid` (primitive). States `idle`/`thinking`/`searching`/`busy`/`saving`/`importing`/`syncing`/`initializing`/`listening`/`success`/`error`; variants `brand`/`glass`/`soft`/`outline`/`ghost`/`mono`; sizes `sm`/`md`/`lg`; layouts `pill`/`inline`/`stacked` |

### Async UI patterns

- Loading: `LoadingState` (centered blue spinner) / `PodaciumSkeleton` / `SectionCard isLoading`.
- Activity: `PodaciumMotionStatus` for agent/tool/upload/sync/save feedback. Drive it from
  `useMotionStatus({ isLoading, isFetching, isStreaming, activeTool, isListening, isSaving, ... })`
  or pass a controlled `state`. Animate only `transform`/`opacity`, honor `prefers-reduced-motion`,
  and keep labels in `component.motionStatus.*` for all four locales. Interactive playground:
  `/design/motion-status`.
- Empty: `EmptyState` — icon tile `w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100` + gradient CTA.
- Navigation: skeletons on SSR (Navbar/Footer), `InfiniteScroll` sentinel, `PullToRefresh` on mobile.

## Do's and Don'ts

### Do

- Use the **`Podacium*` design-system components** for anything a component covers; extend
  behavior only via new `cva` variants on the existing component.
- Use **semantic tokens** (`bg-primary`, `text-muted-foreground`, `border-border`) for
  semantic colors; use the **blue→indigo gradient family** for brand gestures.
- Keep the **fixed glass-pill navbar** (`fixed top-4 inset-x-4 ... rounded-[2rem]`) and the
  **dark gradient footer** in normal flow. Preserve the `pt-20` page offset.
- Use **logical/flow-aware utilities** (`ms-*`, `me-*`, `start-*`, `end-*`, `rtl:*`) and the
  `@custom-variant rtl/ltr` variants; verify every UI in both LTR and RTL.
- Use the **custom i18n** (`useTranslations` from `src/lib/i18n.tsx`) with keys in
  `locales/{en,fr,ar,kab}/`; test `en`, `fr`, `ar` (RTL), `kab`.
- Animate with **framer-motion** entrance patterns (`whileInView once:true`, staggered
  reveals, spring taps) using the presets in `src/lib/animation-presets.ts`.
- Keep content inside `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.
- Use `font-bold tracking-tight` for headings; `font-mono` for IDs/codes/OTP.

### Don't

- **Don't introduce new fonts** or a new typography scale — Inter / Baloo Bhaijaan 2 / DM Mono only.
- **Don't invent brand colors** outside the blue/indigo/purple gradient family, and don't use
  red/orange/green gradients for branding (green is reserved for success states, red for errors).
- **Don't use undefined utilities** that silently no-op:
  `animate-tilt`, `animate-in`/`fade-in-*`/`zoom-in-*`/`slide-in-from-*` (no
  `tailwindcss-animate`), `font-arabic`, and the numeric `primary-50/500/600/900` scale
  (only `primary` + `primary-foreground` exist). The premium utilities documented above
  (`animate-aurora*`, `animate-shimmer`, `animate-gradient-x`, `.gradient-text`,
  `.aurora-blob`, `.card-spotlight`, `.glass-deep`, `.gradient-border`, …) **are defined** in
  `globals.css` — use those rather than inventing new animation utilities.
- **Don't fork the theme system.** `ThemeProvider` owns the `.dark` class and persisted
  preferences. Read `theme` / `resolvedTheme` and call `setTheme()` via `useTheme()` from
  `@/contexts/ThemeContext`; never write `.dark` directly in a page or component. Use
  semantic tokens and verify both themes.
- **Don't mix radius systems** within a component.
- **Don't hardcode gray/blue hexes** where a token exists (`text-gray-500` → `text-muted-foreground`).
- **Don't add new state/data libraries** — server data is TanStack Query, client state is React
  Context, i18n is the custom system. `zustand`/`swr`/`next-intl` are present but not the active
  systems; don't extend them.
- **Don't hand-edit `globals.css` tokens** without updating both `@theme` and `:root` _and_
  the YAML front matter above.

## System design & invariants

> Deep architecture: `docs/ARCHITECTURE.md`; decisions: `docs/adr/`. What follows are the
> **load-bearing rules** an agent must not break while changing code.

- **One backend.** The API is a single FastAPI monolith (API + Celery workers + Celery beat
  sharing one codebase and database). Do not introduce a new service or message broker without
  asking.
- **Layering.** `routers` are thin HTTP shells → `services` hold business logic → Pydantic v2
  schemas validate at the boundary → Prisma is the only data-access layer. Business logic never
  lives in routers; raw SQL only where Prisma can't express it.
- **Prisma is generated.** `app/generated/prisma/` is checked in but regenerated by
  `make db-generate` — never hand-edit. Migrations in `prisma/migrations/` are append-only;
  schema changes are gated (ask first).
- **API contract is authoritative.** `openapi.json` is generated via `make openapi-gen` and
  validated in CI (`scripts/validate_openapi.py` + OWASP ZAP). Never hand-edit it; new/edited
  endpoints must conform.
- **Auth invariants.** Production hard-blocks HS256 (RS256 required). Tokens are HTTP-only
  cookies; revocation via Redis blocklist + DB. Passwords are Argon2 with OWASP params.
  Rate limiting is fail-closed on auth paths. Changing any of this requires approval.
- **Payments.** All gateways implement the `PaymentGateway` ABC (`payment_providers/`).
  Production refuses `PAYMENT_GATEWAY=mock`. Webhooks are HMAC-verified.
- **Secrets.** Never committed, never logged. Env vars referenced by name only; prod reads the
  DB password from a secrets file, never a URL in `.env`.
- **Async work.** Background work goes through Celery tasks (`app/tasks/`) or FastAPI
  background tasks — never `asyncio.create_task` strewn through routers.
- **i18n on the API** is a service concern (localized emails, etc.); the frontend owns all UI
  strings via its custom i18n system.

## Rejected alternatives (so they don't come back)

- **GraphQL** — rejected for a plain REST, versioned (`/api/v1`) contract. Don't propose it.
- **Microservices** — rejected for a single deployable monolith + Celery. Don't split services
  without asking.
- **next-intl / i18next as the UI system** — rejected in favor of the custom `IntlProvider`
  system (`src/lib/i18n.tsx`). `next-intl` remains in 4 files as a legacy straggler; don't
  extend it.
- **Zustand / SWR as primary state** — rejected; TanStack Query + React Context are the active
  systems (zustand/SWR are present but unused-as-primary).
- **React 19 / Next.js 16** — not adopted yet; the app runs React 18 + Next 15.5. Don't
  "upgrade" as part of unrelated work.
- **Tailwind v3 config as source of truth** — rejected; Tailwind v4 `@theme`/`@custom-variant`
  in `globals.css` is authoritative. The legacy `tailwind.config.js` is a compatibility stub.
- **Single-theme UI** — rejected; light and dark are both shipped via `ThemeProvider` + `.dark`
  tokens. Don't propose removing or deferring dark mode.

## Keeping this file honest

Update `DESIGN.md` in the same change that alters the design or a rule above. A stale design
doc is worse than none — agents will confidently follow rules that no longer apply. When a
change touches a decision recorded in `docs/adr/`, add a new ADR rather than editing the old one.
