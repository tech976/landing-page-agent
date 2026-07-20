# Landing Agent — Design System Spec

Version 1.0 · Tailwind CSS v4 (CSS-first `@theme`) · Next.js App Router · Mobile-first Indian D2C

This document is **normative**. Block authors, the AI generation prompt, and the Puck editor all
depend on it. If a block violates a rule here, the block is wrong, not the spec.

---

## 0. Non-negotiables (read this first)

1. **No block hardcodes a color.** Ever. Not a hex, not `rgb()`, not `oklch()`, not `bg-[#ff0000]`.
   Blocks reference **token names only** (`bg-primary`, `text-muted-fg`, `border-border`). See §2.4.
2. **No block hardcodes a radius, shadow, or font family.** Use `rounded-lg`, `shadow-card`,
   `font-heading`. All three are brand-swappable.
3. **All brand-overridable tokens must be declared in plain `@theme`, never `@theme inline`.**
   Plain `@theme` compiles `bg-primary` → `background-color: var(--color-primary)`, so a scoped
   runtime override cascades. `@theme inline` bakes the literal value in and **breaks per-brand
   theming**. This is the single most important technical constraint in the whole system.
4. **Minimum tap target is 44×44 px** on every interactive element. Non-negotiable — 67%+ of
   traffic is mobile.
5. **The hero image is the LCP element.** It is `priority`, never `loading="lazy"`. See §8.

---

## 1. Design Tokens — `app/globals.css`

This is the literal, complete base token layer. Ship it as-is.

```css
@import "tailwindcss";

@theme {
  /* ─────────────────────────────────────────────────────────────
     1.1  BRAND RAMP  (default = bold-commerce saffron-red, hue 30)
     The ramp is the only place raw color literals exist.
     Semantic tokens below point at the ramp.
     ───────────────────────────────────────────────────────────── */
  --color-brand-50:  oklch(0.971 0.013 30);
  --color-brand-100: oklch(0.936 0.032 30);
  --color-brand-200: oklch(0.885 0.062 30);
  --color-brand-300: oklch(0.808 0.107 30);
  --color-brand-400: oklch(0.704 0.158 30);
  --color-brand-500: oklch(0.637 0.196 30);
  --color-brand-600: oklch(0.577 0.211 30);
  --color-brand-700: oklch(0.505 0.187 30);
  --color-brand-800: oklch(0.444 0.157 30);
  --color-brand-900: oklch(0.396 0.133 30);
  --color-brand-950: oklch(0.258 0.088 30);

  /* Accent ramp (default = trust green, hue 155) */
  --color-accent-50:  oklch(0.979 0.021 155);
  --color-accent-100: oklch(0.950 0.052 155);
  --color-accent-200: oklch(0.905 0.093 155);
  --color-accent-300: oklch(0.845 0.143 155);
  --color-accent-400: oklch(0.782 0.177 155);
  --color-accent-500: oklch(0.723 0.180 155);
  --color-accent-600: oklch(0.627 0.158 155);
  --color-accent-700: oklch(0.527 0.132 155);
  --color-accent-800: oklch(0.442 0.108 155);
  --color-accent-900: oklch(0.383 0.090 155);
  --color-accent-950: oklch(0.245 0.062 155);

  /* Neutral ramp — warm-cool neutral, hue 265, very low chroma */
  --color-neutral-0:   oklch(1 0 0);
  --color-neutral-50:  oklch(0.985 0.002 265);
  --color-neutral-100: oklch(0.967 0.003 265);
  --color-neutral-200: oklch(0.928 0.006 265);
  --color-neutral-300: oklch(0.872 0.010 265);
  --color-neutral-400: oklch(0.708 0.016 265);
  --color-neutral-500: oklch(0.556 0.019 265);
  --color-neutral-600: oklch(0.446 0.020 265);
  --color-neutral-700: oklch(0.373 0.021 265);
  --color-neutral-800: oklch(0.279 0.020 265);
  --color-neutral-900: oklch(0.208 0.017 265);
  --color-neutral-950: oklch(0.129 0.014 265);

  /* ─────────────────────────────────────────────────────────────
     1.2  SEMANTIC COLOR TOKENS  — this is what blocks consume
     ───────────────────────────────────────────────────────────── */
  --color-primary:        var(--color-brand-600);
  --color-primary-hover:  var(--color-brand-700);
  --color-primary-active: var(--color-brand-800);
  --color-primary-soft:   var(--color-brand-50);
  --color-on-primary:     oklch(1 0 0);

  --color-secondary:       var(--color-neutral-900);
  --color-secondary-hover: var(--color-neutral-800);
  --color-secondary-soft:  var(--color-neutral-100);
  --color-on-secondary:    oklch(1 0 0);

  --color-accent:        var(--color-accent-600);
  --color-accent-hover:  var(--color-accent-700);
  --color-accent-soft:   var(--color-accent-50);
  --color-on-accent:     oklch(1 0 0);

  --color-surface:        var(--color-neutral-0);   /* page background      */
  --color-surface-raised: var(--color-neutral-0);   /* cards on tinted bg   */
  --color-surface-sunken: var(--color-neutral-50);  /* alternating sections */
  --color-surface-invert: var(--color-neutral-950); /* dark CTA sections    */

  --color-fg:          var(--color-neutral-900);  /* body text            */
  --color-fg-strong:   var(--color-neutral-950);  /* headings             */
  --color-muted:       var(--color-neutral-100);  /* muted fill           */
  --color-muted-fg:    var(--color-neutral-500);  /* secondary text       */
  --color-on-invert:   var(--color-neutral-50);   /* text on dark surface */

  --color-border:        var(--color-neutral-200);
  --color-border-strong: var(--color-neutral-300);
  --color-ring:          var(--color-brand-400);  /* focus ring           */

  --color-success:    oklch(0.627 0.158 155);
  --color-success-fg: oklch(0.393 0.098 155);
  --color-success-soft: oklch(0.960 0.038 155);

  --color-warning:    oklch(0.795 0.162 78);
  --color-warning-fg: oklch(0.470 0.114 78);
  --color-warning-soft: oklch(0.973 0.045 78);

  --color-danger:     oklch(0.596 0.221 27);
  --color-danger-fg:  oklch(0.455 0.180 27);
  --color-danger-soft: oklch(0.966 0.033 27);

  /* Commerce-specific semantics — used by price, badge, urgency blocks */
  --color-price:        var(--color-fg-strong);
  --color-price-strike: var(--color-muted-fg);
  --color-discount:     var(--color-danger);
  --color-discount-fg:  oklch(1 0 0);
  --color-savings:      var(--color-success);
  --color-urgency:      var(--color-danger);
  --color-urgency-fg:   oklch(1 0 0);
  --color-rating:       oklch(0.795 0.162 78);   /* star gold */
  --color-trust:        var(--color-accent-600); /* COD / UPI / secure badges */

  /* Gradients (personality-dependent; bold-commerce keeps them flat) */
  --gradient-brand: linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700));
  --gradient-hero:  linear-gradient(180deg, var(--color-brand-50), var(--color-surface));
  --gradient-cta:   none;

  /* ─────────────────────────────────────────────────────────────
     1.3  TYPOGRAPHY
     ───────────────────────────────────────────────────────────── */
  --font-heading: "Plus Jakarta Sans", ui-sans-serif, system-ui, "Segoe UI", sans-serif;
  --font-body:    "Inter", ui-sans-serif, system-ui, "Segoe UI", sans-serif;
  --font-mono:    ui-monospace, "JetBrains Mono", "SF Mono", monospace;
  /* Indic fallback — appended automatically for hi/mr/ta copy */
  --font-indic:   "Noto Sans Devanagari", "Nirmala UI", sans-serif;

  /* Fluid scale — see §4 for the full table and lock points */
  --text-xs:   clamp(0.75rem,   0.734rem + 0.07vw, 0.8125rem);
  --text-sm:   clamp(0.875rem,  0.853rem + 0.10vw, 0.9375rem);
  --text-base: clamp(1rem,      0.973rem + 0.12vw, 1.0625rem);
  --text-lg:   clamp(1.0625rem, 1.000rem + 0.28vw, 1.25rem);
  --text-xl:   clamp(1.1875rem, 1.085rem + 0.46vw, 1.5rem);
  --text-2xl:  clamp(1.375rem,  1.221rem + 0.68vw, 1.875rem);
  --text-3xl:  clamp(1.625rem,  1.393rem + 1.03vw, 2.375rem);
  --text-4xl:  clamp(1.875rem,  1.529rem + 1.54vw, 3rem);
  --text-5xl:  clamp(2.25rem,   1.779rem + 2.09vw, 3.75rem);
  --text-6xl:  clamp(2.625rem,  1.993rem + 2.81vw, 4.5rem);
  --text-7xl:  clamp(3rem,      2.135rem + 3.85vw, 5.5rem);

  --text-xs--line-height:   1.45;
  --text-sm--line-height:   1.5;
  --text-base--line-height: 1.6;
  --text-lg--line-height:   1.55;
  --text-xl--line-height:   1.45;
  --text-2xl--line-height:  1.3;
  --text-3xl--line-height:  1.2;
  --text-4xl--line-height:  1.12;
  --text-5xl--line-height:  1.06;
  --text-6xl--line-height:  1.02;
  --text-7xl--line-height:  1.0;

  --tracking-tightest: -0.045em;
  --tracking-tighter:  -0.03em;
  --tracking-tight:    -0.015em;
  --tracking-normal:   0em;
  --tracking-wide:     0.02em;
  --tracking-wider:    0.06em;
  --tracking-widest:   0.14em;   /* eyebrow / uppercase labels */

  --font-weight-heading:   800;
  --font-weight-subhead:   700;
  --font-weight-body:      400;
  --font-weight-emphasis:  600;

  /* ─────────────────────────────────────────────────────────────
     1.4  SPACING  — 4px base, extended for section rhythm
     ───────────────────────────────────────────────────────────── */
  --spacing: 0.25rem;  /* Tailwind v4 multiplier: p-4 => 1rem */

  /* Named rhythm tokens (fluid) — use these, not raw numbers, for sections */
  --space-section-sm: clamp(2.5rem, 1.8rem + 3.1vw, 4rem);
  --space-section:    clamp(3.5rem, 2.4rem + 4.9vw, 6rem);
  --space-section-lg: clamp(5rem,   3.4rem + 7.1vw, 8rem);
  --space-gutter:     clamp(1rem,   0.7rem + 1.3vw, 1.5rem);
  --space-stack:      clamp(0.75rem, 0.6rem + 0.7vw, 1.25rem);

  /* ─────────────────────────────────────────────────────────────
     1.5  RADIUS  — every value derives from ONE token
     ───────────────────────────────────────────────────────────── */
  --radius: 0.75rem;

  --radius-xs:   calc(var(--radius) * 0.25);
  --radius-sm:   calc(var(--radius) * 0.5);
  --radius-md:   calc(var(--radius) * 0.75);
  --radius-lg:   var(--radius);
  --radius-xl:   calc(var(--radius) * 1.5);
  --radius-2xl:  calc(var(--radius) * 2);
  --radius-3xl:  calc(var(--radius) * 3);
  --radius-pill: 9999px;
  --radius-full: 9999px;

  /* ─────────────────────────────────────────────────────────────
     1.6  SHADOWS  — tinted with brand hue, never pure black
     ───────────────────────────────────────────────────────────── */
  --shadow-xs:   0 1px 2px 0 oklch(0.208 0.017 265 / 0.05);
  --shadow-sm:   0 1px 3px 0 oklch(0.208 0.017 265 / 0.08),
                 0 1px 2px -1px oklch(0.208 0.017 265 / 0.06);
  --shadow-card: 0 2px 4px -1px oklch(0.208 0.017 265 / 0.06),
                 0 8px 20px -6px oklch(0.208 0.017 265 / 0.10);
  --shadow-lg:   0 4px 8px -2px oklch(0.208 0.017 265 / 0.07),
                 0 16px 36px -10px oklch(0.208 0.017 265 / 0.14);
  --shadow-xl:   0 8px 16px -4px oklch(0.208 0.017 265 / 0.08),
                 0 28px 60px -16px oklch(0.208 0.017 265 / 0.18);
  --shadow-cta:       0 4px 14px -2px var(--shadow-cta-tint);
  --shadow-cta-hover: 0 10px 28px -4px var(--shadow-cta-tint-strong);
  --shadow-sticky:    0 -4px 20px -4px oklch(0.208 0.017 265 / 0.14);
  --shadow-inset-top: inset 0 1px 0 0 oklch(1 0 0 / 0.14);

  /* CTA shadow tint is brand-derived so it re-colors on theme swap */
  --shadow-cta-tint:        oklch(0.577 0.211 30 / 0.35);
  --shadow-cta-tint-strong: oklch(0.577 0.211 30 / 0.45);

  /* ─────────────────────────────────────────────────────────────
     1.7  MOTION
     ───────────────────────────────────────────────────────────── */
  --ease-out-soft:  cubic-bezier(0.22, 1, 0.36, 1);
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in-out-soft: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Durations are NOT a Tailwind v4 theme namespace. They are plain
     custom properties, consumed as duration-[var(--dur-fast)]. */
  --dur-instant: 90ms;
  --dur-fast:    160ms;
  --dur-base:    240ms;
  --dur-slow:    420ms;
  --dur-slower:  700ms;
  --dur-marquee: 28s;
  --dur-pulse:   2.2s;

  --animate-fade-up:   fade-up var(--dur-slow) var(--ease-out-soft) both;
  --animate-fade-in:   fade-in var(--dur-base) var(--ease-out-soft) both;
  --animate-cta-pulse: cta-pulse var(--dur-pulse) var(--ease-in-out-soft) infinite;
  --animate-marquee:   marquee var(--dur-marquee) linear infinite;
  --animate-toast-in:  toast-in var(--dur-base) var(--ease-spring) both;
  --animate-shimmer:   shimmer 1.4s linear infinite;

  /* ─────────────────────────────────────────────────────────────
     1.8  LAYOUT
     ───────────────────────────────────────────────────────────── */
  --container-prose:  42rem;   /* 672px  — FAQ, narrative copy      */
  --container-narrow: 56rem;   /* 896px  — single-column sections   */
  --container-page:   75rem;   /* 1200px — default section width    */
  --container-wide:   85.5rem; /* 1368px — collection grid, gallery */

  --breakpoint-xs: 24rem;      /* 384px — small Android phones      */

  /* ─────────────────────────────────────────────────────────────
     1.9  ASPECT RATIOS  (see §8)
     ───────────────────────────────────────────────────────────── */
  --aspect-hero:     4 / 5;
  --aspect-hero-lg:  1 / 1;
  --aspect-product:  1 / 1;
  --aspect-card:     4 / 3;
  --aspect-lifestyle: 16 / 9;
  --aspect-persona:  3 / 4;
  --aspect-story:    9 / 16;
  --aspect-logo:     3 / 1;
}

/* ── Keyframes (outside @theme) ─────────────────────────────── */
@keyframes fade-up {
  from { opacity: 0; transform: translate3d(0, 1.25rem, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes fade-in {
  from { opacity: 0; } to { opacity: 1; }
}
@keyframes cta-pulse {
  0%, 100% { box-shadow: 0 4px 14px -2px var(--shadow-cta-tint),
                         0 0 0 0 var(--shadow-cta-tint-strong); }
  55%      { box-shadow: 0 4px 14px -2px var(--shadow-cta-tint),
                         0 0 0 0.75rem oklch(0.577 0.211 30 / 0); }
}
@keyframes marquee {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
}
@keyframes toast-in {
  from { opacity: 0; transform: translate3d(0, 1rem, 0) scale(0.96); }
  to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}
@keyframes shimmer {
  from { background-position: -150% 0; }
  to   { background-position: 250% 0; }
}

/* ── Base layer ────────────────────────────────────────────── */
@layer base {
  html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
  body {
    background-color: var(--color-surface);
    color: var(--color-fg);
    font-family: var(--font-body);
    font-weight: var(--font-weight-body);
    font-size: var(--text-base);
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3, h4 {
    font-family: var(--font-heading);
    font-weight: var(--font-weight-heading);
    color: var(--color-fg-strong);
    letter-spacing: var(--tracking-tight);
    text-wrap: balance;
  }
  p { text-wrap: pretty; }
  :focus-visible { outline: none; }
  ::selection {
    background-color: var(--color-primary);
    color: var(--color-on-primary);
  }
}
```

**Tailwind v4 namespace note.** `--color-*`, `--font-*`, `--text-*`, `--tracking-*`,
`--font-weight-*`, `--spacing`, `--radius-*`, `--shadow-*`, `--ease-*`, `--animate-*`,
`--container-*`, `--breakpoint-*`, and `--aspect-*` auto-generate utilities. `--dur-*`,
`--space-*`, and `--gradient-*` do **not** — consume them with arbitrary values:
`duration-[var(--dur-base)]`, `py-[var(--space-section)]`, `bg-[image:var(--gradient-hero)]`.

---

## 2. Theming Model

### 2.1 The brand theme JSON

Stored on the page document as `page.theme`. Small, human-editable, AI-writable, Puck-editable.

```ts
// lib/schema/theme.ts  (shape only — implemented with Zod)
export interface BrandTheme {
  /** oklch or hex; hex is converted to oklch at compile time */
  primary: string;          // e.g. "oklch(0.577 0.211 30)" or "#E4572E"
  accent: string;           // e.g. "oklch(0.627 0.158 155)"
  neutralHue: number;       // 0–360, default 265
  headingFont: FontKey;     // enum, see 2.2
  bodyFont: FontKey;
  radius: number;           // rem, 0–2. Drives the entire radius scale.
  personality: "bold-commerce" | "premium-minimal" | "vibrant-youth";
  /** optional overrides — omit to inherit from personality preset */
  surfaceTint?: "none" | "warm" | "cool";
  ctaShape?: "rounded" | "pill" | "square";
  darkCtaSection?: boolean;
}
```

Canonical example:

```json
{
  "primary": "oklch(0.577 0.211 30)",
  "accent": "oklch(0.627 0.158 155)",
  "neutralHue": 265,
  "headingFont": "plus-jakarta",
  "bodyFont": "inter",
  "radius": 0.75,
  "personality": "bold-commerce",
  "ctaShape": "rounded"
}
```

### 2.2 Allowed font keys (locked — self-hosted via `next/font`)

| Key | Family | Role |
|---|---|---|
| `plus-jakarta` | Plus Jakarta Sans | heading |
| `inter` | Inter | body / heading |
| `outfit` | Outfit | heading / body |
| `clash-display` | Clash Display | heading |
| `fraunces` | Fraunces | heading (serif) |
| `instrument-serif` | Instrument Serif | heading (serif) |
| `dm-sans` | DM Sans | body |
| `manrope` | Manrope | body |
| `sora` | Sora | heading |

The AI may only emit keys from this table. Anything else fails Zod validation.

### 2.3 Compilation: JSON → scoped CSS variable block

`compileTheme(theme, pageId)` returns a `<style>` string injected once per page, scoped by a
data attribute on the page root — **never `:root`**, so the Puck editor chrome keeps the app theme
while the canvas gets the brand theme.

Mapping is exact and total:

| JSON field | CSS variables written |
|---|---|
| `personality` | applied **first** — writes the full preset from §3 |
| `primary` | `--color-brand-50…950` (ramp regenerated by holding hue+chroma curve, varying L), then `--color-primary`, `--color-primary-hover` (=`brand-700`), `--color-primary-active` (=`brand-800`), `--color-primary-soft` (=`brand-50`), `--color-on-primary` (auto: white if L(primary) < 0.62 else `--color-neutral-950`), `--shadow-cta-tint`, `--shadow-cta-tint-strong`, `--color-ring` (=`brand-400`), `--gradient-brand` |
| `accent` | `--color-accent-50…950`, `--color-accent`, `--color-accent-hover`, `--color-accent-soft`, `--color-on-accent`, `--color-trust` |
| `neutralHue` | `--color-neutral-50…950` (hue channel only), and all shadow tints |
| `headingFont` | `--font-heading` |
| `bodyFont` | `--font-body` |
| `radius` | `--radius` only. The other nine radius tokens are `calc()` of it and follow automatically. |
| `ctaShape` | `rounded` → no-op · `pill` → `--radius-cta: var(--radius-pill)` · `square` → `--radius-cta: var(--radius-xs)` |
| `surfaceTint` | `warm` → `--color-surface-sunken: oklch(0.980 0.008 70)` · `cool` → `oklch(0.980 0.008 240)` · `none` → no-op |
| `darkCtaSection` | toggles `--color-cta-section-bg` between `--color-surface-invert` and `--color-primary` |

Emitted output for the example above:

```html
<div data-lp-theme="pg_7fh2" class="lp-root">
  <style>
    [data-lp-theme="pg_7fh2"] {
      --color-brand-50:  oklch(0.971 0.013 30);
      --color-brand-100: oklch(0.936 0.032 30);
      --color-brand-200: oklch(0.885 0.062 30);
      --color-brand-300: oklch(0.808 0.107 30);
      --color-brand-400: oklch(0.704 0.158 30);
      --color-brand-500: oklch(0.637 0.196 30);
      --color-brand-600: oklch(0.577 0.211 30);
      --color-brand-700: oklch(0.505 0.187 30);
      --color-brand-800: oklch(0.444 0.157 30);
      --color-brand-900: oklch(0.396 0.133 30);
      --color-brand-950: oklch(0.258 0.088 30);
      --color-accent-600: oklch(0.627 0.158 155);
      --color-on-primary: oklch(1 0 0);
      --shadow-cta-tint: oklch(0.577 0.211 30 / 0.35);
      --shadow-cta-tint-strong: oklch(0.577 0.211 30 / 0.45);
      --font-heading: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
      --font-body: "Inter", ui-sans-serif, system-ui, sans-serif;
      --radius: 0.75rem;
      --radius-cta: var(--radius-lg);
    }
  </style>
  <!-- blocks render here -->
</div>
```

Because `bg-primary` compiled to `background-color: var(--color-primary)` and
`--color-primary: var(--color-brand-600)`, overriding `--color-brand-600` inside the scope
recolors every block instantly — including in the Puck canvas, live, with no rebuild.

### 2.4 Enforcing "blocks never hardcode a color"

Four layers. All four are required; any one alone leaks.

**(a) Schema layer — colors are not free text.** Block prop schemas may not contain a raw color
string. The only color-ish prop permitted is a token enum:

```ts
export const ColorToken = z.enum([
  "primary","primary-soft","secondary","secondary-soft","accent","accent-soft",
  "surface","surface-raised","surface-sunken","surface-invert",
  "fg","fg-strong","muted","muted-fg","on-invert",
  "border","success","warning","danger","discount","urgency","savings","trust",
]);
export type ColorToken = z.infer<typeof ColorToken>;
```

Blocks map the token to a class via a static lookup object — **never** string interpolation like
`` `bg-${token}` ``, which Tailwind's scanner cannot see.

**(b) Editor layer — no color picker.** Puck field configs for blocks expose
`type: "select"` over `ColorToken` options. There is no `type: "color"` field anywhere in the
registry. A marketer physically cannot enter a hex.

**(c) Lint layer — CI fails on literals.** Run against `components/blocks/**`:

```
/(#[0-9a-fA-F]{3,8}\b)|(\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\()|(\b(bg|text|border|ring|from|via|to|fill|stroke|shadow|decoration|outline|accent|caret|divide)-\[(?!var\()[^\]]*\])/
```

Wired as `eslint no-restricted-syntax` on `JSXAttribute[name.name="className"]` and
`Literal`, plus a `stylelint` `color-no-hex` rule for any `.module.css`. Arbitrary values are
allowed **only** when they wrap a token: `bg-[var(--gradient-hero)]` passes, `bg-[#111]` fails.

**(d) Runtime layer — dev-mode assertion.** In `NODE_ENV !== "production"`, the block wrapper
scans its own rendered `className` with the same regex and `console.error`s the offending block
`id` and type. Cheap, and catches AI-authored props that slipped through as class strings.

**Rule of thumb for block authors:** if you typed a color, you made a mistake. Add a semantic
token to §1.2 instead and give it a name that describes *purpose* (`--color-urgency`), not
*appearance* (`--color-red`).

---

## 3. Style Personalities

Three complete presets. `personality` is applied first in the cascade; explicit JSON fields
(`primary`, `radius`, …) then override individual values. The AI picks one from the brand brief.

### 3.1 `bold-commerce` — mass-market D2C

High contrast, saturated CTA, chunky type, big radius. The default. Best for value-led offers,
COD-heavy categories, aggressive discounting.

```css
[data-lp-personality="bold-commerce"] {
  --color-brand-50:  oklch(0.971 0.013 30);
  --color-brand-400: oklch(0.704 0.158 30);
  --color-brand-500: oklch(0.637 0.196 30);
  --color-brand-600: oklch(0.577 0.211 30);
  --color-brand-700: oklch(0.505 0.187 30);
  --color-brand-800: oklch(0.444 0.157 30);
  --color-brand-950: oklch(0.258 0.088 30);

  --color-primary:      var(--color-brand-600);
  --color-accent:       oklch(0.627 0.158 155);
  --color-on-primary:   oklch(1 0 0);
  --color-surface:        oklch(1 0 0);
  --color-surface-sunken: oklch(0.976 0.004 60);
  --color-surface-invert: oklch(0.185 0.020 30);
  --color-fg-strong:      oklch(0.175 0.018 265);
  --color-border:         oklch(0.918 0.006 265);

  --font-heading: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-body:    "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-weight-heading: 800;
  --tracking-heading: -0.03em;

  --radius: 1rem;
  --radius-cta: var(--radius-lg);

  --shadow-card: 0 2px 4px -1px oklch(0.208 0.017 265 / 0.07),
                 0 10px 24px -8px oklch(0.208 0.017 265 / 0.12);
  --shadow-cta-tint:        oklch(0.577 0.211 30 / 0.38);
  --shadow-cta-tint-strong: oklch(0.577 0.211 30 / 0.50);

  --gradient-hero: linear-gradient(180deg, oklch(0.971 0.013 30), oklch(1 0 0));
  --gradient-cta:  none;

  --space-section: clamp(3.5rem, 2.4rem + 4.9vw, 6rem);
  --lp-section-divider: 0;          /* flat blocks, color-blocked sections */
  --lp-cta-uppercase: 1;            /* CTAs render uppercase              */
  --lp-badge-style: solid;
}
```

Signature moves: solid discount badges, `text-5xl` price, full-bleed color-blocked sections,
uppercase CTA labels, sticky mobile bar always on.

### 3.2 `premium-minimal` — considered / higher AOV

Restrained palette, serif headings, tight radius, generous whitespace. Best for skincare,
jewellery, home, ₹3000+ AOV.

```css
[data-lp-personality="premium-minimal"] {
  --color-brand-50:  oklch(0.968 0.006 55);
  --color-brand-400: oklch(0.560 0.038 55);
  --color-brand-500: oklch(0.470 0.038 55);
  --color-brand-600: oklch(0.390 0.034 55);
  --color-brand-700: oklch(0.320 0.028 55);
  --color-brand-800: oklch(0.265 0.022 55);
  --color-brand-950: oklch(0.165 0.014 55);

  --color-primary:      var(--color-brand-800);
  --color-primary-hover: var(--color-brand-950);
  --color-accent:       oklch(0.720 0.092 85);   /* muted brass */
  --color-on-primary:   oklch(0.985 0.004 85);
  --color-surface:        oklch(0.993 0.003 85);  /* warm paper   */
  --color-surface-sunken: oklch(0.968 0.006 85);
  --color-surface-invert: oklch(0.205 0.012 85);
  --color-fg:             oklch(0.300 0.012 85);
  --color-fg-strong:      oklch(0.195 0.012 85);
  --color-muted-fg:       oklch(0.545 0.012 85);
  --color-border:         oklch(0.900 0.006 85);
  --color-discount:       oklch(0.470 0.114 30);  /* desaturated, no shouting */

  --font-heading: "Fraunces", "Instrument Serif", ui-serif, Georgia, serif;
  --font-body:    "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-weight-heading: 500;
  --tracking-heading: -0.018em;

  --radius: 0.25rem;
  --radius-cta: var(--radius-xs);

  --shadow-card: 0 1px 2px 0 oklch(0.205 0.012 85 / 0.04),
                 0 6px 20px -10px oklch(0.205 0.012 85 / 0.10);
  --shadow-cta-tint:        oklch(0.265 0.022 55 / 0.20);
  --shadow-cta-tint-strong: oklch(0.265 0.022 55 / 0.28);

  --gradient-hero: none;
  --gradient-cta:  none;

  --space-section: clamp(4.5rem, 3rem + 6.5vw, 8rem);
  --lp-section-divider: 1;          /* 1px hairline rules between sections */
  --lp-cta-uppercase: 1;
  --lp-badge-style: outline;
}
```

Signature moves: hairline dividers, outline badges, no shadows on product cards, `tracking-widest`
uppercase eyebrows, price in body font not display, single hero image not a carousel.

### 3.3 `vibrant-youth` — Gen-Z

Gradients, playful, rounded, energetic. Best for ₹299–₹1499 impulse categories, streetwear,
beauty, snacks, gadgets.

```css
[data-lp-personality="vibrant-youth"] {
  --color-brand-50:  oklch(0.972 0.021 325);
  --color-brand-400: oklch(0.718 0.194 325);
  --color-brand-500: oklch(0.656 0.229 325);
  --color-brand-600: oklch(0.592 0.245 325);
  --color-brand-700: oklch(0.518 0.219 325);
  --color-brand-800: oklch(0.452 0.186 325);
  --color-brand-950: oklch(0.278 0.118 325);

  --color-primary:    var(--color-brand-600);
  --color-accent:     oklch(0.780 0.163 195);   /* electric cyan */
  --color-on-primary: oklch(1 0 0);
  --color-surface:        oklch(0.995 0.004 300);
  --color-surface-sunken: oklch(0.966 0.017 300);
  --color-surface-invert: oklch(0.215 0.062 300);
  --color-fg:             oklch(0.265 0.030 300);
  --color-fg-strong:      oklch(0.175 0.038 300);
  --color-border:         oklch(0.912 0.014 300);
  --color-rating:         oklch(0.812 0.170 85);

  --font-heading: "Clash Display", "Outfit", ui-sans-serif, system-ui, sans-serif;
  --font-body:    "Outfit", ui-sans-serif, system-ui, sans-serif;
  --font-weight-heading: 700;
  --tracking-heading: -0.025em;

  --radius: 1.5rem;
  --radius-cta: var(--radius-pill);

  --shadow-card: 0 4px 8px -2px oklch(0.278 0.118 325 / 0.08),
                 0 16px 32px -12px oklch(0.278 0.118 325 / 0.18);
  --shadow-cta-tint:        oklch(0.592 0.245 325 / 0.42);
  --shadow-cta-tint-strong: oklch(0.592 0.245 325 / 0.55);

  --gradient-brand: linear-gradient(135deg, oklch(0.656 0.229 325), oklch(0.700 0.190 275));
  --gradient-hero:  linear-gradient(160deg, oklch(0.955 0.045 325), oklch(0.960 0.040 200) 55%, oklch(1 0 0));
  --gradient-cta:   linear-gradient(100deg, oklch(0.626 0.245 325), oklch(0.680 0.200 275));

  --space-section: clamp(3rem, 2.1rem + 4.2vw, 5.5rem);
  --lp-section-divider: 0;
  --lp-cta-uppercase: 0;
  --lp-badge-style: gradient;
}
```

Signature moves: gradient CTA fill, pill everything, sticker-style rotated badges
(`rotate-[-4deg]`), emoji-adjacent iconography, marquee trust bar, blob background shapes.

---

## 4. Typography Scale

Fluid between **360px** (min lock) and **1280px** (max lock). Mobile-first: the minimum value is
the phone value and it is always ≥ the readable floor.

| Token | Utility | 360px | 1280px | Use |
|---|---|---|---|---|
| `--text-xs` | `text-xs` | 12px | 13px | legal, strike-through, badge micro |
| `--text-sm` | `text-sm` | 14px | 15px | captions, spec table cells, footer |
| `--text-base` | `text-base` | 16px | 17px | body copy (never below 16px on mobile) |
| `--text-lg` | `text-lg` | 17px | 20px | lead paragraph, offer stack items |
| `--text-xl` | `text-xl` | 19px | 24px | card titles, FAQ questions |
| `--text-2xl` | `text-2xl` | 22px | 30px | sub-section headings |
| `--text-3xl` | `text-3xl` | 26px | 38px | section headings (mobile) |
| `--text-4xl` | `text-4xl` | 30px | 48px | section headings (desktop), price |
| `--text-5xl` | `text-5xl` | 36px | 60px | hero H1 (mobile), hero price |
| `--text-6xl` | `text-6xl` | 42px | 72px | hero H1 (desktop) |
| `--text-7xl` | `text-7xl` | 48px | 88px | statement numerals, final CTA |

### Semantic type roles (literal Tailwind strings)

```
eyebrow      "font-body text-xs sm:text-sm font-semibold uppercase tracking-widest text-primary"
h1-hero      "font-heading text-5xl sm:text-6xl font-extrabold tracking-tighter text-fg-strong text-balance"
h2-section   "font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-fg-strong text-balance"
h3-card      "font-heading text-xl font-bold tracking-tight text-fg-strong"
h4-sub       "font-heading text-lg font-semibold tracking-tight text-fg-strong"
lead         "font-body text-lg sm:text-xl leading-relaxed text-muted-fg text-pretty max-w-prose"
body         "font-body text-base leading-relaxed text-fg text-pretty"
small        "font-body text-sm leading-normal text-muted-fg"
micro        "font-body text-xs leading-normal text-muted-fg"
price        "font-heading text-4xl sm:text-5xl font-extrabold tracking-tighter tabular-nums text-price"
price-strike "font-body text-lg font-medium tabular-nums line-through text-price-strike"
discount     "font-heading text-sm font-bold tracking-wide tabular-nums text-discount-fg"
stat-number  "font-heading text-4xl sm:text-5xl font-extrabold tracking-tighter tabular-nums text-primary"
```

Rules: `tabular-nums` on every ₹ figure, rating, countdown, and stat — prevents jitter during
count-up. `max-w-prose` (65ch) on all paragraph copy. `text-balance` on headings ≤ 3 lines,
`text-pretty` on paragraphs. For `premium-minimal`, swap `font-extrabold` → `font-medium` in
`h1-hero`/`h2-section` — the personality preset already sets `--font-weight-heading: 500`, so
prefer `font-[weight:var(--font-weight-heading)]` in shared block code.

---

## 5. CTA Button Spec

The single highest-leverage element on the page. Every landing page has 4–9 CTA instances that
must be visually identical.

### 5.1 Shared base (all variants)

```
inline-flex items-center justify-center gap-2 shrink-0
font-heading font-bold tracking-tight text-center whitespace-nowrap
select-none cursor-pointer touch-manipulation
rounded-[var(--radius-cta)]
transition-[background-color,box-shadow,transform,border-color]
duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]
focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60
focus-visible:ring-offset-2 focus-visible:ring-offset-surface
disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none
active:duration-[var(--dur-instant)]
```

### 5.2 Variants

**Primary** — one per viewport. Buy Now / Order on WhatsApp / Get Offer.

```
bg-primary text-on-primary shadow-cta
hover:bg-primary-hover hover:shadow-cta-hover hover:-translate-y-0.5
active:bg-primary-active active:translate-y-0 active:scale-[0.98] active:shadow-cta
```

Gradient variant (auto-applied when `--gradient-cta` is not `none`, i.e. `vibrant-youth`):

```
bg-[image:var(--gradient-cta)] text-on-primary shadow-cta
hover:shadow-cta-hover hover:-translate-y-0.5 hover:brightness-[1.06]
active:translate-y-0 active:scale-[0.98] active:brightness-95
```

**Secondary** — Add to Cart next to a Buy Now, "View all", "Compare".

```
bg-surface text-fg-strong border-2 border-border-strong shadow-xs
hover:bg-surface-sunken hover:border-primary hover:text-primary
active:bg-muted active:scale-[0.98]
```

**Ghost** — tertiary, in-section links, accordion toggles, gallery thumbs.

```
bg-transparent text-primary border-2 border-transparent
hover:bg-primary-soft hover:text-primary-hover
active:bg-primary-soft active:scale-[0.98]
```

**On-invert** (inside `surface-invert` sections and the final CTA):

```
bg-surface text-fg-strong shadow-lg
hover:bg-neutral-100 hover:-translate-y-0.5
active:translate-y-0 active:scale-[0.98]
focus-visible:ring-offset-surface-invert
```

**WhatsApp CTA** — special-cased for the Indian market; the green is a third-party brand mark and
is the *only* sanctioned non-token color. It lives as `--color-whatsapp: oklch(0.700 0.170 148)`
in `@theme` and is referenced as a token like everything else.

```
bg-whatsapp text-white shadow-cta hover:brightness-105 hover:-translate-y-0.5 active:scale-[0.98]
```

### 5.3 Sizes — all meet or exceed 44px

| Size | Classes | Height |
|---|---|---|
| `sm` | `h-11 min-h-11 px-4 gap-1.5 text-sm` | 44px |
| `md` | `h-12 min-h-12 px-6 gap-2 text-base` | 48px |
| `lg` | `h-14 min-h-14 px-8 gap-2.5 text-lg` | 56px |
| `xl` | `h-16 min-h-16 px-10 gap-3 text-xl` | 64px |

Defaults: hero CTA `lg`, sticky mobile bar `lg`, final CTA section `xl`, in-card `md`,
inline/utility `sm`. **`sm` is the floor — no smaller size exists.**

Mobile width: primary CTAs are `w-full sm:w-auto`. Icon-only buttons are
`size-11 p-0` (44×44) minimum. Any interactive target smaller than 44px visually (e.g. a 24px
close icon) must be padded to 44px or wrapped in
`before:absolute before:-inset-3 before:content-[''] relative` to extend the hit area.

### 5.4 Pulse attention animation

Opt-in per block via a `pulse: boolean` prop. **Maximum one pulsing element per viewport.**

```
motion-safe:animate-[var(--animate-cta-pulse)]
```

Allowed only on: hero primary CTA, sticky mobile bar CTA, final CTA section button. Never on
secondary/ghost. Auto-disabled when the urgency countdown block is present in the same viewport
(two competing attention signals cancel out).

### 5.5 Composed reference strings

Hero primary, mobile-first:

```
inline-flex items-center justify-center gap-2.5 shrink-0 w-full sm:w-auto
h-14 min-h-14 px-8 text-lg font-heading font-bold tracking-tight whitespace-nowrap
select-none cursor-pointer touch-manipulation rounded-[var(--radius-cta)]
bg-primary text-on-primary shadow-cta
transition-[background-color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]
hover:bg-primary-hover hover:shadow-cta-hover hover:-translate-y-0.5
active:bg-primary-active active:translate-y-0 active:scale-[0.98] active:duration-[var(--dur-instant)]
focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface
motion-safe:animate-[var(--animate-cta-pulse)]
```

Sticky mobile bar (`<= sm` only):

```
fixed inset-x-0 bottom-0 z-50 sm:hidden
bg-surface/95 backdrop-blur-md border-t border-border shadow-sticky
px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
flex items-center gap-3
```

`env(safe-area-inset-bottom)` is mandatory — iOS home indicator overlap is the #1 sticky-CTA bug.

---

## 6. Layout Primitives

### 6.1 Containers

```
container-page   "mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)]"
container-wide   "mx-auto w-full max-w-[var(--container-wide)] px-[var(--space-gutter)]"
container-narrow "mx-auto w-full max-w-[var(--container-narrow)] px-[var(--space-gutter)]"
container-prose  "mx-auto w-full max-w-[var(--container-prose)] px-[var(--space-gutter)]"
full-bleed       "w-full"   /* no max-width; child uses container-* internally */
```

Gutter is `clamp(1rem, …, 1.5rem)` — 16px on a 360px phone, 24px on desktop. Never less than
16px; Indian Android devices with edge-curved screens clip content below that.

### 6.2 Section rhythm

```
section          "py-[var(--space-section)]"
section-sm       "py-[var(--space-section-sm)]"
section-lg       "py-[var(--space-section-lg)]"
section-tinted   "py-[var(--space-section)] bg-surface-sunken"
section-invert   "py-[var(--space-section-lg)] bg-surface-invert text-on-invert"
section-header   "mx-auto max-w-[var(--container-narrow)] text-center mb-10 sm:mb-14 flex flex-col gap-3 sm:gap-4"
stack            "flex flex-col gap-[var(--space-stack)]"
```

Alternation rule: consecutive sections must not share a background. The renderer walks the block
list and alternates `surface` / `surface-sunken`, forcing `surface` before any `section-invert`.
Hero and final-CTA are exempt.

### 6.3 Grid patterns

```
grid-products-4  "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6"
grid-products-3  "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 lg:gap-6"
grid-features-3  "grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8"
grid-pillars-4   "grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-8"
grid-reviews     "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6"
grid-personas    "grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8"
grid-hero        "grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 lg:items-center"
grid-split       "grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 lg:items-center"
scroller         "flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-4 px-4 -mx-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:none"
scroller-item    "snap-start shrink-0 w-[78%] xs:w-[70%] sm:w-[46%] lg:w-[30%]"
```

**Product grids are 2-up on mobile, never 1-up** — Indian shoppers scan density; 1-up doubles
scroll depth and kills collection-grid engagement. Review walls and persona cards are 1-up on
mobile. Above 3 rows on mobile, prefer `scroller` over `grid`.

### 6.4 Card primitive

```
card       "rounded-xl bg-surface-raised border border-border shadow-card overflow-hidden"
card-flat  "rounded-xl bg-surface-sunken border border-border"   /* premium-minimal */
card-body  "p-4 sm:p-6 flex flex-col gap-3"
card-hover "transition-[transform,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:shadow-lg"
```

### 6.5 Z-index ladder (fixed, do not improvise)

| Layer | z |
|---|---|
| section content | `z-0` |
| sticky section header | `z-20` |
| recent-purchase toast | `z-40` |
| sticky mobile CTA bar | `z-50` |
| modal / gallery lightbox | `z-60` |
| exit-intent overlay | `z-70` |

---

## 7. Motion

Only these five animations exist. Anything else is a bug.

| Name | Duration | Easing | Where |
|---|---|---|---|
| `fade-up` | `--dur-slow` (420ms) | `--ease-out-soft` | section entry on scroll, once, 60px stagger |
| `fade-in` | `--dur-base` (240ms) | `--ease-out-soft` | images on decode, accordion panels |
| `cta-pulse` | `--dur-pulse` (2.2s) loop | `--ease-in-out-soft` | max one CTA per viewport |
| `marquee` | `--dur-marquee` (28s) loop | `linear` | trust badge bar, logo strip |
| `count-up` | 1200ms, JS-driven | `--ease-out-quart` | stat numbers, review counts, savings |

Rules:

- Scroll reveal uses `IntersectionObserver` at `threshold: 0.15, rootMargin: "0px 0px -10% 0px"`,
  fires **once**, then unobserves. Never a scroll-linked continuous transform.
- Stagger: `style={{ animationDelay: `${Math.min(i, 5) * 60}ms` }}` — capped at 5 so long grids
  don't crawl.
- Hover transforms are capped at `-translate-y-1` (4px) and `scale-[1.02]`.
- Nothing animates above the fold on load except the hero's own `fade-up` at ≤200ms delay —
  motion must never delay LCP paint.
- `count-up` respects reduced motion by rendering the final value immediately.
- Every animated utility is prefixed `motion-safe:`.

### Reduced motion — mandatory global rule

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  /* Reveal content that would otherwise sit at opacity:0 waiting for an observer */
  [data-reveal] { opacity: 1 !important; transform: none !important; }
  .marquee-track { animation: none !important; transform: none !important; }
}
```

---

## 8. Image Handling

### 8.1 Aspect ratio per block (locked)

| Block | Ratio | Token | Classes |
|---|---|---|---|
| Hero gallery — main (mobile) | 4:5 | `--aspect-hero` | `aspect-hero lg:aspect-hero-lg` |
| Hero gallery — thumbnails | 1:1 | `--aspect-product` | `aspect-product size-16 sm:size-20` |
| Collection grid card | 1:1 | `--aspect-product` | `aspect-product` |
| Product narrative / split | 4:3 | `--aspect-card` | `aspect-card lg:aspect-lifestyle` |
| Buyer persona card | 3:4 | `--aspect-persona` | `aspect-persona` |
| Value pillar icon | 1:1 | — | `size-12 sm:size-14` |
| Review photo (UGC) | 1:1 | `--aspect-product` | `aspect-product` |
| Comparison table thumb | 1:1 | `--aspect-product` | `aspect-product size-14` |
| Trust badge / logo | 3:1 | `--aspect-logo` | `aspect-logo h-8 w-auto` |
| Final CTA background | 16:9 | `--aspect-lifestyle` | `aspect-lifestyle lg:aspect-auto` |

Ratios are enforced on the **wrapper**, not the `<img>` — the wrapper is
`relative overflow-hidden rounded-lg bg-muted` and never collapses, so CLS is 0 even before
the image decodes.

### 8.2 object-fit rules

- Product shots on white/transparent: `object-contain p-4 sm:p-6` on a `bg-surface-sunken`
  wrapper. Contain — never crop a product.
- Lifestyle / persona / editorial: `object-cover object-center`.
- Faces (persona, review avatars): `object-cover object-top` — center crop decapitates people.
- Logos: `object-contain` with `h-8 w-auto max-w-[7.5rem]`.
- Every `<img>` also gets `size-full` inside its ratio wrapper.

### 8.3 Placeholder strategy

1. **Preferred** — `placeholder="blur"` with a real `blurDataURL`. Generated at ingest for
   uploaded assets and stored on the image record in the page JSON.
2. **Remote / AI-sourced URLs** where no blur hash exists — dominant-color fill:
   `<div class="absolute inset-0" style={{ backgroundColor: img.dominant }} />` where
   `dominant` is an oklch string stored alongside the URL. This is the one sanctioned inline
   style; it is *content data*, not design, and is exempt from the §2.4 lint via an allowlist on
   `style.backgroundColor` in `<ImageFrame>` only.
3. **Nothing known** — skeleton shimmer:
   `bg-muted bg-[linear-gradient(90deg,transparent,var(--color-neutral-200),transparent)] bg-[length:40%_100%] bg-no-repeat motion-safe:animate-[var(--animate-shimmer)]`
4. **Broken / missing** — render the ratio wrapper with `bg-muted` and a centered muted product
   glyph. Never render a broken-image icon on a live landing page.

### 8.4 LCP guidance — the hard rules

The hero image is the LCP element on ~every generated page. Getting this wrong costs more
conversion than any design choice in this document.

- The **first** hero gallery image gets `priority` (`fetchPriority="high"`, `loading="eager"`,
  `decoding="sync"`). Every other image on the page — including hero thumbnails 2..n — is
  `loading="lazy" decoding="async"`.
- Exactly **one** `priority` image per page. The renderer asserts this at build time and throws
  on violation; more than one priority image de-prioritises all of them.
- Hero `sizes` must be explicit and correct:
  `sizes="(max-width: 1023px) 100vw, 46vw"`. A missing/wrong `sizes` is the most common cause of
  a 3× oversized LCP download on mobile.
- Preload the hero via `<link rel="preload" as="image" imagesrcset=... imagesizes=...>` emitted
  from the page's `generateMetadata`, so it starts before React hydrates.
- Hero image budget: **≤ 120 KB** at 4:5 on a 390px viewport. Format order AVIF → WebP → JPEG.
  Quality 72 for photography, 82 for product-on-white with fine text.
- The hero wrapper never carries `backdrop-blur`, a CSS `filter`, or a CSS gradient overlay on the
  image element itself — all three delay paint on mid-range Android. Use a sibling absolutely
  positioned overlay div instead.
- No hero carousel auto-advance before `load`. No JS-driven hero animation on mount other than the
  ≤200ms `fade-up`.
- Above-the-fold text must never wait on a webfont: heading and body fonts use
  `next/font` with `display: "swap"` and a size-adjusted fallback so the swap causes no shift.
- Target: LCP ≤ 2.5s on Moto G Power / Slow 4G, CLS ≤ 0.05, INP ≤ 200ms. These are the ship gates.
