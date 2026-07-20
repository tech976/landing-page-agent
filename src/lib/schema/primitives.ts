/**
 * Landing Agent — shared schema primitives.
 *
 * Contract source: docs/BLOCK-CATALOG.md §0.3, §1  and  docs/DESIGN-SYSTEM.md §2.
 *
 * These types are referenced by many blocks. Define once here, import everywhere.
 * `src/lib/schema/page.ts` re-exports every symbol in this file, so downstream code
 * may import from either path.
 *
 * DESIGN CONSTRAINT — this schema is converted into an Anthropic tool definition for
 * constrained sampling. Keep it representable in plain JSON Schema:
 *   - no z.lazy / recursive types
 *   - no z.record with dynamic keys (except the fixed 5-key rating distribution)
 *   - no transforms, no z.custom, no branded types
 *   - structural props are always enums or bounded numbers, never free strings
 */

import { z } from "zod";

/* ────────────────────────────────────────────────────────────────────────────
   Identity
   ──────────────────────────────────────────────────────────────────────────── */

/** Stable, unique-per-page id. NEVER an array index. NEVER reused. */
export const IdSchema = z.string().min(1).max(64);

/* ────────────────────────────────────────────────────────────────────────────
   Money — integer paise, India-only in this prototype. 149900 === ₹1,499.00
   ──────────────────────────────────────────────────────────────────────────── */

export const CurrencySchema = z.literal("INR");

export const MoneySchema = z.object({
  /** Integer, in paise. 149900 = ₹1,499.00 */
  amount: z.number().int().min(0),
  currency: CurrencySchema.default("INR"),
});

/* ────────────────────────────────────────────────────────────────────────────
   Images
   ──────────────────────────────────────────────────────────────────────────── */

export const FocalPointSchema = z.enum(["center", "top", "bottom", "left", "right"]);

export const ImageRefSchema = z.object({
  /** Absolute URL or /public path. */
  src: z.string().min(1),
  /** Required, non-empty — accessibility AND Meta/Google ad policy review. */
  alt: z.string().min(1).max(125),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  focal: FocalPointSchema.default("center"),
  /** next/image blur placeholder, generated at ingest. See DESIGN-SYSTEM §8.3. */
  blurDataURL: z.string().optional(),
  /** Dominant colour as an oklch string — the one sanctioned inline style. §8.3(2) */
  dominant: z.string().optional(),
});

/* ────────────────────────────────────────────────────────────────────────────
   Icons — locked lucide-react subset. The AI cannot supply arbitrary SVG.
   ──────────────────────────────────────────────────────────────────────────── */

export const ICON_NAMES = [
  "truck",
  "shield-check",
  "rotate-ccw",
  "banknote",
  "smartphone",
  "leaf",
  "sparkles",
  "clock",
  "flame",
  "heart",
  "star",
  "award",
  "package",
  "thumbs-up",
  "zap",
  "lock",
  "headphones",
  "check",
  "x",
  "gift",
] as const;

export const IconNameSchema = z.enum(ICON_NAMES);

/* ────────────────────────────────────────────────────────────────────────────
   Tone / colour tokens
   ──────────────────────────────────────────────────────────────────────────── */

/** Block-level background/tint slots. BLOCK-CATALOG §0.3 */
export const TONE_TOKENS = [
  "brand",
  "accent",
  "neutral",
  "success",
  "warning",
  "danger",
  "dark",
  "light",
] as const;

export const ToneTokenSchema = z.enum(TONE_TOKENS);

/**
 * The full semantic colour token list. DESIGN-SYSTEM §2.4(a).
 * The ONLY colour-ish value a block prop may ever contain. Blocks map a token to a
 * class via a static lookup object — never `bg-${token}` string interpolation.
 */
export const COLOR_TOKENS = [
  "primary",
  "primary-soft",
  "secondary",
  "secondary-soft",
  "accent",
  "accent-soft",
  "surface",
  "surface-raised",
  "surface-sunken",
  "surface-invert",
  "fg",
  "fg-strong",
  "muted",
  "muted-fg",
  "on-invert",
  "border",
  "success",
  "warning",
  "danger",
  "discount",
  "urgency",
  "savings",
  "trust",
] as const;

export const ColorTokenSchema = z.enum(COLOR_TOKENS);

/* ────────────────────────────────────────────────────────────────────────────
   Rating
   ──────────────────────────────────────────────────────────────────────────── */

/** 0–5, one decimal place. e.g. 4.6 */
export const RatingSchema = z.number().min(0).max(5);

export const RatingSummarySchema = z.object({
  value: RatingSchema,
  count: z.number().int().min(0),
  label: z.string().max(60).optional(),
  /** Anchors to the review-wall block. */
  linkToReviews: z.boolean().default(true),
});

/* ────────────────────────────────────────────────────────────────────────────
   CHECKOUT ACTION — the single most important shared type. BLOCK-CATALOG §1.
   Every CTA button in every block uses it. No block defines its own link shape.
   ──────────────────────────────────────────────────────────────────────────── */

export const FormFieldTypeSchema = z.enum([
  "text",
  "tel",
  "email",
  "pincode",
  "select",
  "textarea",
]);

/** Named validator ids resolved by the form renderer. */
export const FormValidationSchema = z.enum(["in-mobile", "in-pincode", "email"]);

export const FormFieldSchema = z.object({
  /** Machine key, snake_case. */
  name: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  type: FormFieldTypeSchema,
  required: z.boolean().default(false),
  placeholder: z.string().max(60).optional(),
  /** Required when type === "select". */
  options: z.array(z.string().max(60)).max(20).optional(),
  validation: FormValidationSchema.optional(),
});

export const ShopifyCheckoutModeSchema = z.enum(["cart", "direct-checkout"]);

export const ShopifyActionSchema = z.object({
  kind: z.literal("shopify"),
  /** Shopify numeric product id or handle. */
  productId: z.string().min(1),
  /** Overridden by the containing block's variant selector at click time. */
  variantId: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  /** Uppercase, [A-Z0-9_-]{3,32}. Auto-applied at checkout. */
  discountCode: z
    .string()
    .regex(/^[A-Z0-9_-]{3,32}$/, "Discount code must be A-Z, 0-9, _ or -, 3–32 chars")
    .optional(),
  /** Cold paid traffic should skip the cart. The default is deliberate. */
  mode: ShopifyCheckoutModeSchema.default("direct-checkout"),
});

export const WhatsappActionSchema = z.object({
  kind: z.literal("whatsapp"),
  /** E.164 without "+", India only: ^91[6-9]\d{9}$ */
  phone: z
    .string()
    .regex(/^91[6-9]\d{9}$/, "Indian WhatsApp number in E.164 without '+', e.g. 919876543210"),
  /** Tokens: {{product}} {{variant}} {{price}} {{page}} {{utm_campaign}} */
  messageTemplate: z.string().min(1).max(400),
  businessName: z.string().max(60).optional(),
});

export const FormActionSchema = z.object({
  kind: z.literal("form"),
  /** Stable id; storage key for the submissions JSON. */
  formId: z.string().min(1).max(64),
  /** 1–6 fields. The generator must warn above 4 — mobile lead rate collapses. */
  fields: z.array(FormFieldSchema).min(1).max(6),
  submitLabel: z.string().max(28).default("Submit"),
  successMessage: z.string().max(160).default("Thanks! We'll call you shortly."),
  webhookUrl: z.url().optional(),
});

export const UrlTargetSchema = z.enum(["_self", "_blank"]);

export const UrlActionSchema = z.object({
  kind: z.literal("url"),
  /** Absolute URL or in-page anchor ("#offer-stack"). */
  href: z.string().min(1),
  target: UrlTargetSchema.default("_self"),
  rel: z.string().max(60).optional(),
});

export const CheckoutActionSchema = z.discriminatedUnion("kind", [
  ShopifyActionSchema,
  WhatsappActionSchema,
  FormActionSchema,
  UrlActionSchema,
]);

export const CHECKOUT_ACTION_KINDS = ["shopify", "whatsapp", "form", "url"] as const;
export const CheckoutActionKindSchema = z.enum(CHECKOUT_ACTION_KINDS);

/* ────────────────────────────────────────────────────────────────────────────
   CTA spec — shared by nearly every block. BLOCK-CATALOG §2.2.
   ──────────────────────────────────────────────────────────────────────────── */

export const CtaVariantSchema = z.enum(["solid", "outline", "ghost"]);

export const CtaSpecSchema = z.object({
  label: z.string().min(1).max(28),
  /** e.g. "COD available · Ships in 24h" */
  sublabel: z.string().max(40).optional(),
  action: CheckoutActionSchema,
  variant: CtaVariantSchema.optional(),
  tone: ToneTokenSchema.optional(),
  icon: IconNameSchema.optional(),
  /** Always full-width on mobile regardless of this flag. */
  fullWidth: z.boolean().optional(),
  /** DESIGN-SYSTEM §5.4 — maximum ONE pulsing element per viewport. */
  pulse: z.boolean().default(false),
});

export const TrustChipSchema = z.object({
  icon: IconNameSchema,
  label: z.string().min(1).max(22),
  tooltip: z.string().max(120).optional(),
});

/* ────────────────────────────────────────────────────────────────────────────
   Countdown — announcement-bar and urgency-strip. BLOCK-CATALOG §2.1.
   ──────────────────────────────────────────────────────────────────────────── */

export const CountdownModeSchema = z.enum([
  "fixed-deadline",
  "rolling-window",
  "daily-reset",
]);

export const CountdownExpiredBehaviourSchema = z.enum([
  "hide",
  "show-expired-text",
  "restart",
]);

export const CountdownLabelsSchema = z.object({
  d: z.string().max(4),
  h: z.string().max(4),
  m: z.string().max(4),
  s: z.string().max(4),
});

export const CountdownConfigSchema = z.object({
  mode: CountdownModeSchema,
  /** ISO 8601 with offset. Required when mode = "fixed-deadline". */
  deadline: z.string().optional(),
  /** Required when mode = "rolling-window". Per-session, localStorage-backed. */
  windowMinutes: z.number().int().min(1).max(10080).optional(),
  /** 0–23 IST. Required when mode = "daily-reset". */
  resetAtHour: z.number().int().min(0).max(23).optional(),
  expiredBehaviour: CountdownExpiredBehaviourSchema.default("hide"),
  expiredText: z.string().max(80).optional(),
  labels: CountdownLabelsSchema.optional(),
});

/* ────────────────────────────────────────────────────────────────────────────
   DATA SOURCE — no asserted number may be invented. BLOCK-CATALOG §2.3.
   ──────────────────────────────────────────────────────────────────────────── */

export const StaleBehaviourSchema = z.enum(["show-fallback", "hide-signal"]);

export const AnalyticsMetricSchema = z.enum([
  "active_visitors",
  "units_sold",
  "add_to_cart",
  "orders",
]);

export const StaticDataSourceSchema = z.object({
  mode: z.literal("static"),
  value: z.number(),
  /** false raises a `cro/unattributed-claim` warn until a human confirms it. */
  verified: z.boolean().default(false),
});

export const ApiDataSourceSchema = z.object({
  mode: z.literal("api"),
  endpoint: z.string().min(1),
  jsonPath: z.string().min(1),
  refreshSeconds: z.number().int().min(1).optional(),
  /** Mandatory — the strip must never paint an empty slot, a 0, or a spinner. */
  fallback: z.number(),
  staleBehaviour: StaleBehaviourSchema.default("show-fallback"),
});

export const ShopifyInventoryDataSourceSchema = z.object({
  mode: z.literal("shopify-inventory"),
  productId: z.string().min(1),
  variantId: z.string().optional(),
  fallback: z.number(),
});

export const AnalyticsDataSourceSchema = z.object({
  mode: z.literal("analytics"),
  metric: AnalyticsMetricSchema,
  windowMinutes: z.number().int().min(1),
  fallback: z.number(),
});

export const SimulatedDataSourceSchema = z.object({
  mode: z.literal("simulated"),
  min: z.number(),
  max: z.number(),
  driftPerMinute: z.number().optional(),
  seed: z.string().max(40).optional(),
  /** Non-empty and mandatory — renders the "*indicative" footnote. */
  disclosure: z.string().min(1).max(200),
});

export const DataSourceSchema = z.discriminatedUnion("mode", [
  StaticDataSourceSchema,
  ApiDataSourceSchema,
  ShopifyInventoryDataSourceSchema,
  AnalyticsDataSourceSchema,
  SimulatedDataSourceSchema,
]);

/* ────────────────────────────────────────────────────────────────────────────
   Brand theme — DESIGN-SYSTEM §2.1 / §2.2 / §3.
   ──────────────────────────────────────────────────────────────────────────── */

/** Locked, self-hosted via next/font. Anything else fails validation. */
export const FONT_KEYS = [
  "plus-jakarta",
  "inter",
  "outfit",
  "clash-display",
  "fraunces",
  "instrument-serif",
  "dm-sans",
  "manrope",
  "sora",
] as const;

export const FontKeySchema = z.enum(FONT_KEYS);

export const STYLE_PERSONALITIES = [
  "bold-commerce",
  "premium-minimal",
  "vibrant-youth",
] as const;

export const StylePersonalitySchema = z.enum(STYLE_PERSONALITIES);

export const SurfaceTintSchema = z.enum(["none", "warm", "cool"]);
export const CtaShapeSchema = z.enum(["rounded", "pill", "square"]);

/**
 * Hex (#rgb/#rrggbb/#rrggbbaa) or an oklch()/oklab()/rgb()/hsl() function string.
 * The brand theme is the ONE place a raw colour literal is legal in the whole system.
 */
const COLOR_VALUE_RE =
  /^(#([0-9a-fA-F]{3,8})|(oklch|oklab|lch|lab|rgb|rgba|hsl|hsla)\([^)]{1,120}\))$/;

export const ThemeColorSchema = z
  .string()
  .regex(COLOR_VALUE_RE, "Must be a hex value or an oklch()/rgb()/hsl() colour function");

export const BrandThemeSchema = z.object({
  /** oklch or hex; hex is converted to oklch at compile time. */
  primary: ThemeColorSchema,
  accent: ThemeColorSchema,
  /** 0–360. Hue channel of the neutral ramp and all shadow tints. */
  neutralHue: z.number().min(0).max(360).default(265),
  headingFont: FontKeySchema.default("plus-jakarta"),
  bodyFont: FontKeySchema.default("inter"),
  /** rem, 0–2. Drives the entire radius scale via calc(). */
  radius: z.number().min(0).max(2).default(0.75),
  /** Applied FIRST in the cascade; explicit fields above override it. */
  personality: StylePersonalitySchema.default("bold-commerce"),
  surfaceTint: SurfaceTintSchema.optional(),
  ctaShape: CtaShapeSchema.optional(),
  darkCtaSection: z.boolean().optional(),
});

/* ────────────────────────────────────────────────────────────────────────────
   Inferred types
   ──────────────────────────────────────────────────────────────────────────── */

export type Money = z.infer<typeof MoneySchema>;
export type ImageRef = z.infer<typeof ImageRefSchema>;
export type IconName = z.infer<typeof IconNameSchema>;
export type ToneToken = z.infer<typeof ToneTokenSchema>;
export type ColorToken = z.infer<typeof ColorTokenSchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type RatingSummary = z.infer<typeof RatingSummarySchema>;
export type FormField = z.infer<typeof FormFieldSchema>;
export type CheckoutAction = z.infer<typeof CheckoutActionSchema>;
export type CheckoutActionKind = z.infer<typeof CheckoutActionKindSchema>;
export type CtaSpec = z.infer<typeof CtaSpecSchema>;
export type TrustChip = z.infer<typeof TrustChipSchema>;
export type CountdownConfig = z.infer<typeof CountdownConfigSchema>;
export type DataSource = z.infer<typeof DataSourceSchema>;
export type FontKey = z.infer<typeof FontKeySchema>;
export type StylePersonality = z.infer<typeof StylePersonalitySchema>;
export type BrandTheme = z.infer<typeof BrandThemeSchema>;
