/**
 * Landing Agent — brand theme compiler.
 *
 * Contract source: docs/DESIGN-SYSTEM.md §2.3 (JSON → scoped CSS variable block).
 *
 * Turns a `BrandTheme` JSON object into CSS custom property overrides. Because every
 * brand-overridable token is declared in plain `@theme` (never `@theme inline`),
 * `bg-primary` compiled to `background-color: var(--color-primary)` — so overriding
 * `--color-brand-600` inside a scope recolors every block instantly, live, with no
 * rebuild. That is what makes the Puck canvas re-theme in real time.
 *
 * Two consumers:
 *   themeToCssVars(theme)          → React.CSSProperties for an inline `style` prop
 *   compileThemeCss(theme, pageId) → a scoped `<style>` string keyed by data-lp-theme
 *
 * Scope, never `:root` — the editor chrome must keep the app theme while the canvas
 * gets the brand theme.
 */

import type { CSSProperties } from "react";

import type { BrandTheme, FontKey } from "./schema/primitives";

/* ────────────────────────────────────────────────────────────────────────────
   Colour model — hex / oklch in, OKLCH out
   ──────────────────────────────────────────────────────────────────────────── */

export interface Oklch {
  /** Lightness, 0–1. */
  l: number;
  /** Chroma, ~0–0.4. */
  c: number;
  /** Hue, degrees 0–360. */
  h: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, dp: number) => Number(n.toFixed(dp));

/** Formats an OKLCH triple as a CSS colour string. */
export function formatOklch({ l, c, h }: Oklch, alpha?: number): string {
  const base = `oklch(${round(clamp(l, 0, 1), 3)} ${round(Math.max(c, 0), 3)} ${round(
    ((h % 360) + 360) % 360,
    1,
  )}`;
  return alpha === undefined ? `${base})` : `${base} / ${round(clamp(alpha, 0, 1), 2)})`;
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** sRGB hex → OKLCH. Björn Ottosson's transform. */
function hexToOklch(hex: string): Oklch | null {
  let value = hex.replace("#", "").trim();
  if (value.length === 3 || value.length === 4) {
    value = value
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (value.length !== 6 && value.length !== 8) return null;

  const r = srgbToLinear(parseInt(value.slice(0, 2), 16) / 255);
  const g = srgbToLinear(parseInt(value.slice(2, 4), 16) / 255);
  const b = srgbToLinear(parseInt(value.slice(4, 6), 16) / 255);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;

  const lCone = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mCone = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const sCone = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * lCone + 0.793617785 * mCone - 0.0040720468 * sCone;
  const aAxis = 1.9779984951 * lCone - 2.428592205 * mCone + 0.4505937099 * sCone;
  const bAxis = 0.0259040371 * lCone + 0.7827717662 * mCone - 0.808675766 * sCone;

  const c = Math.sqrt(aAxis * aAxis + bAxis * bAxis);
  const h = ((Math.atan2(bAxis, aAxis) * 180) / Math.PI + 360) % 360;

  return { l: L, c, h };
}

/** Parses `oklch(L C H)`, `oklch(L% C H / a)`. */
function parseOklchString(input: string): Oklch | null {
  const match = /^oklch\(\s*([^)]+)\)$/i.exec(input.trim());
  if (!match) return null;
  const parts = match[1].split("/")[0].trim().split(/[\s,]+/);
  if (parts.length < 3) return null;

  const lRaw = parts[0];
  const l = lRaw.endsWith("%") ? parseFloat(lRaw) / 100 : parseFloat(lRaw);
  const c = parseFloat(parts[1]);
  const h = parseFloat(parts[2]);
  if ([l, c, h].some((n) => Number.isNaN(n))) return null;

  return { l, c, h };
}

/**
 * Parses a theme colour (hex or oklch) into OKLCH.
 * Returns null for anything it cannot interpret — callers fall back to the preset,
 * so an unparseable colour degrades to the personality default rather than breaking
 * the page.
 */
export function parseThemeColor(input: string): Oklch | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) return hexToOklch(trimmed);
  if (trimmed.toLowerCase().startsWith("oklch(")) return parseOklchString(trimmed);
  return null;
}

/* ────────────────────────────────────────────────────────────────────────────
   Ramp generation — hold hue, hold the chroma curve, vary lightness
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The reference bold-commerce brand ramp, expressed as (lightness, chroma-ratio)
 * relative to the 600 step. Feeding it `oklch(0.577 0.211 30)` reproduces
 * DESIGN-SYSTEM §1.1 exactly.
 */
const RAMP_STOPS: ReadonlyArray<readonly [step: number, l: number, cRatio: number]> = [
  [50, 0.971, 0.062],
  [100, 0.936, 0.152],
  [200, 0.885, 0.294],
  [300, 0.808, 0.507],
  [400, 0.704, 0.749],
  [500, 0.637, 0.929],
  [600, 0.577, 1],
  [700, 0.505, 0.886],
  [800, 0.444, 0.744],
  [900, 0.396, 0.63],
  [950, 0.258, 0.417],
];

/** Neutral ramp lightness/chroma from DESIGN-SYSTEM §1.1, hue supplied by the theme. */
const NEUTRAL_STOPS: ReadonlyArray<readonly [step: number, l: number, c: number]> = [
  [0, 1, 0],
  [50, 0.985, 0.002],
  [100, 0.967, 0.003],
  [200, 0.928, 0.006],
  [300, 0.872, 0.01],
  [400, 0.708, 0.016],
  [500, 0.556, 0.019],
  [600, 0.446, 0.02],
  [700, 0.373, 0.021],
  [800, 0.279, 0.02],
  [900, 0.208, 0.017],
  [950, 0.129, 0.014],
];

/**
 * Regenerates an 11-step ramp from a single seed colour by holding the seed's hue and
 * chroma curve and varying lightness. The seed lands on the 600 step.
 */
export function buildRamp(seed: Oklch): Record<number, string> {
  const ramp: Record<number, string> = {};
  for (const [step, l, cRatio] of RAMP_STOPS) {
    // The seed's own lightness nudges the ramp so a very light or very dark brand
    // colour still produces a usable spread rather than snapping to the reference.
    const lightnessShift = (seed.l - 0.577) * (1 - Math.abs(l - 0.577) / 0.713) * 0.5;
    ramp[step] = formatOklch({
      l: clamp(l + lightnessShift, 0.05, 0.995),
      c: seed.c * cRatio,
      h: seed.h,
    });
  }
  return ramp;
}

/* ────────────────────────────────────────────────────────────────────────────
   Font stacks — DESIGN-SYSTEM §2.2 (locked keys, self-hosted via next/font)
   ──────────────────────────────────────────────────────────────────────────── */

const SANS_FALLBACK = 'ui-sans-serif, system-ui, "Segoe UI", sans-serif';
const SERIF_FALLBACK = "ui-serif, Georgia, serif";

export const FONT_STACKS: Record<FontKey, string> = {
  "plus-jakarta": `"Plus Jakarta Sans", ${SANS_FALLBACK}`,
  inter: `"Inter", ${SANS_FALLBACK}`,
  outfit: `"Outfit", ${SANS_FALLBACK}`,
  "clash-display": `"Clash Display", "Outfit", ${SANS_FALLBACK}`,
  fraunces: `"Fraunces", ${SERIF_FALLBACK}`,
  "instrument-serif": `"Instrument Serif", ${SERIF_FALLBACK}`,
  "dm-sans": `"DM Sans", ${SANS_FALLBACK}`,
  manrope: `"Manrope", ${SANS_FALLBACK}`,
  sora: `"Sora", ${SANS_FALLBACK}`,
};

/* ────────────────────────────────────────────────────────────────────────────
   The compiler
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Below this lightness the primary colour needs white text on it; at or above it,
 * near-black. DESIGN-SYSTEM §2.3.
 */
const ON_PRIMARY_LIGHTNESS_CUTOFF = 0.62;

/**
 * Maps a `BrandTheme` to CSS custom properties. Exact and total — every field in the
 * §2.3 mapping table is written, and nothing else is.
 *
 * `personality` is NOT written here: it is applied by the `data-lp-personality`
 * attribute selector in globals.css, which sits in a wider scope than these variables,
 * so these values correctly win over the preset.
 */
export function themeToCssVarRecord(theme: BrandTheme): Record<string, string> {
  const vars: Record<string, string> = {};

  /* ── primary ───────────────────────────────────────────────────────────── */
  const primary = parseThemeColor(theme.primary);
  if (primary) {
    const ramp = buildRamp(primary);
    for (const [step, value] of Object.entries(ramp)) {
      vars[`--color-brand-${step}`] = value;
    }
    vars["--color-primary"] = "var(--color-brand-600)";
    vars["--color-primary-hover"] = "var(--color-brand-700)";
    vars["--color-primary-active"] = "var(--color-brand-800)";
    vars["--color-primary-soft"] = "var(--color-brand-50)";
    vars["--color-on-primary"] =
      primary.l < ON_PRIMARY_LIGHTNESS_CUTOFF ? "oklch(1 0 0)" : "var(--color-neutral-950)";
    vars["--color-ring"] = "var(--color-brand-400)";
    vars["--shadow-cta-tint"] = formatOklch(primary, 0.35);
    vars["--shadow-cta-tint-strong"] = formatOklch(primary, 0.45);
    vars["--gradient-brand"] =
      "linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))";
  }

  /* ── accent ────────────────────────────────────────────────────────────── */
  const accent = parseThemeColor(theme.accent);
  if (accent) {
    const ramp = buildRamp(accent);
    for (const [step, value] of Object.entries(ramp)) {
      vars[`--color-accent-${step}`] = value;
    }
    vars["--color-accent"] = "var(--color-accent-600)";
    vars["--color-accent-hover"] = "var(--color-accent-700)";
    vars["--color-accent-soft"] = "var(--color-accent-50)";
    vars["--color-on-accent"] =
      accent.l < ON_PRIMARY_LIGHTNESS_CUTOFF ? "oklch(1 0 0)" : "var(--color-neutral-950)";
    vars["--color-trust"] = "var(--color-accent-600)";
  }

  /* ── neutralHue (hue channel only) + shadow tints ──────────────────────── */
  const hue = theme.neutralHue;
  for (const [step, l, c] of NEUTRAL_STOPS) {
    vars[`--color-neutral-${step}`] = formatOklch({ l, c, h: hue });
  }
  const shadowBase: Oklch = { l: 0.208, c: 0.017, h: hue };
  vars["--shadow-xs"] = `0 1px 2px 0 ${formatOklch(shadowBase, 0.05)}`;
  vars["--shadow-sm"] =
    `0 1px 3px 0 ${formatOklch(shadowBase, 0.08)}, 0 1px 2px -1px ${formatOklch(shadowBase, 0.06)}`;
  vars["--shadow-card"] =
    `0 2px 4px -1px ${formatOklch(shadowBase, 0.06)}, 0 8px 20px -6px ${formatOklch(shadowBase, 0.1)}`;
  vars["--shadow-lg"] =
    `0 4px 8px -2px ${formatOklch(shadowBase, 0.07)}, 0 16px 36px -10px ${formatOklch(shadowBase, 0.14)}`;
  vars["--shadow-xl"] =
    `0 8px 16px -4px ${formatOklch(shadowBase, 0.08)}, 0 28px 60px -16px ${formatOklch(shadowBase, 0.18)}`;
  vars["--shadow-sticky"] = `0 -4px 20px -4px ${formatOklch(shadowBase, 0.14)}`;

  /* ── fonts ─────────────────────────────────────────────────────────────── */
  vars["--font-heading"] = FONT_STACKS[theme.headingFont];
  vars["--font-body"] = FONT_STACKS[theme.bodyFont];

  /* ── radius (one token; the other nine are calc() of it) ───────────────── */
  vars["--radius"] = `${theme.radius}rem`;

  /* ── ctaShape ──────────────────────────────────────────────────────────── */
  if (theme.ctaShape === "pill") vars["--radius-cta"] = "var(--radius-pill)";
  else if (theme.ctaShape === "square") vars["--radius-cta"] = "var(--radius-xs)";
  else if (theme.ctaShape === "rounded") vars["--radius-cta"] = "var(--radius-lg)";

  /* ── surfaceTint ───────────────────────────────────────────────────────── */
  if (theme.surfaceTint === "warm") {
    vars["--color-surface-sunken"] = "oklch(0.98 0.008 70)";
  } else if (theme.surfaceTint === "cool") {
    vars["--color-surface-sunken"] = "oklch(0.98 0.008 240)";
  }

  /* ── darkCtaSection ────────────────────────────────────────────────────── */
  vars["--color-cta-section-bg"] = theme.darkCtaSection
    ? "var(--color-surface-invert)"
    : "var(--color-primary)";

  return vars;
}

/**
 * Converts a brand theme into inline CSS custom property overrides, ready for a
 * React `style` prop on the page root:
 *
 *   <div data-lp-personality={theme.personality} style={themeToCssVars(theme)}>
 *
 * Custom properties are not in React's CSSProperties key union, hence the cast — the
 * values are all plain strings and safe to inline.
 */
export function themeToCssVars(theme: BrandTheme): CSSProperties {
  return themeToCssVarRecord(theme) as CSSProperties;
}

/**
 * The `<style>`-tag form from DESIGN-SYSTEM §2.3, scoped by page id so the Puck
 * editor chrome keeps the app theme. Returns CSS text, not a React element.
 */
export function compileThemeCss(theme: BrandTheme, pageId: string): string {
  const vars = themeToCssVarRecord(theme);
  const body = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
  // Attribute values are page ids (IdSchema: max 64 chars) — sanitise anyway so a
  // hostile id can never break out of the selector.
  const safeId = pageId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `[data-lp-theme="${safeId}"] {\n${body}\n}`;
}

/** Root-element attributes for a themed page. Pair with `themeToCssVars`. */
export function themeRootAttributes(theme: BrandTheme, pageId: string) {
  return {
    "data-lp-theme": pageId,
    "data-lp-personality": theme.personality,
  } as const;
}
