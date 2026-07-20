/**
 * Landing Agent — THE core contract file.
 *
 * Contract source: docs/BLOCK-CATALOG.md (blocks, fixtures, page order)
 *                  docs/DESIGN-SYSTEM.md (theme)
 *
 * ARCHITECTURAL PRINCIPLE
 * The AI never emits HTML, JSX, CSS or Tailwind classes. It emits a JSON document that
 * conforms to `PageSchema`, composed only from the locked block registry below. The Puck
 * editor reads and writes the exact same JSON. There is no lossy transformation anywhere:
 *
 *   Anthropic SDK ──(JSON)──▶ Zod validate ──▶ page.json ──▶ Puck ──▶ page.json ──▶ Renderer
 *                                 ▲                                      │
 *                                 └───────────── AI edit pass ◀──────────┘
 *
 * ADDRESSING RULE (non-negotiable)
 * Every block instance carries a stable string `id`. All AI edit operations and all editor
 * operations address blocks by `id` — never by array index, never by type.
 *
 * SHALLOWNESS
 * This schema is converted into an Anthropic tool definition for constrained sampling, so it
 * stays JSON-Schema-representable: no recursion, no z.lazy, no transforms, no dynamic records,
 * no cross-field refinements. Cross-field business rules (price integrity, exactly-one
 * mostPopular, cells.length === columns.length, message match, …) live in the CRO validator
 * under `cro/*` rule ids — see BLOCK-CATALOG §5 and §6 — not here.
 */

import { z } from "zod";

import {
  CheckoutActionSchema,
  CountdownConfigSchema,
  CtaSpecSchema,
  DataSourceSchema,
  IconNameSchema,
  IdSchema,
  ImageRefSchema,
  MoneySchema,
  RatingSchema,
  RatingSummarySchema,
  ToneTokenSchema,
  TrustChipSchema,
  BrandThemeSchema,
} from "./primitives";

export * from "./primitives";

/* ────────────────────────────────────────────────────────────────────────────
   Small shared structural helpers
   ──────────────────────────────────────────────────────────────────────────── */

const Columns2to3 = z.union([z.literal(2), z.literal(3)]);
const Columns2to4 = z.union([z.literal(2), z.literal(3), z.literal(4)]);
const Columns1to2 = z.union([z.literal(1), z.literal(2)]);

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 1 — announcement-bar                                BLOCK-CATALOG §2.1
   ══════════════════════════════════════════════════════════════════════════════ */

export const AnnouncementBarPropsSchema = z.object({
  /** Offer line. Max 70 chars — longer wraps on a 360px screen and pushes the hero down. */
  text: z.string().min(1).max(70),
  /** Shorter variant used below 640px. Falls back to `text`. */
  mobileText: z.string().max(48).optional(),
  /** Substring of `text` rendered bold/accent, e.g. the code "FLAT30". */
  emphasis: z.string().max(40).optional(),
  tone: ToneTokenSchema.default("dark"),
  icon: IconNameSchema.optional(),
  /** Makes the whole bar tappable. Usually { kind: "url", href: "#offer-stack" }. */
  link: CheckoutActionSchema.nullable().default(null),
  /** Default false for paid traffic. Dismissal persists 24h in localStorage. */
  dismissible: z.boolean().default(false),
  /** If true, sticky-cta must set an offsetTop. */
  sticky: z.boolean().default(false),
  countdown: CountdownConfigSchema.nullable().default(null),
  marquee: z.boolean().default(false),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 2 — hero-product                                     BLOCK-CATALOG §2.2
   ══════════════════════════════════════════════════════════════════════════════ */

export const DiscountBadgeSchema = z.object({
  mode: z.enum(["auto-percent", "auto-amount", "manual"]),
  /** Required when mode = "manual", e.g. "LAUNCH PRICE". */
  text: z.string().max(24).optional(),
  tone: ToneTokenSchema.default("danger"),
  shape: z.enum(["pill", "corner-ribbon", "burst"]).default("pill"),
});

export const VariantOptionSchema = z.object({
  id: IdSchema,
  label: z.string().min(1).max(48),
  /** Overrides primaryCta.action.variantId on selection. */
  shopifyVariantId: z.string().optional(),
  /** Added to the base price when selected. */
  priceDelta: MoneySchema.optional(),
  /** For style "swatch". */
  swatchHex: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  /** Switches the gallery on selection. */
  image: ImageRefSchema.optional(),
  soldOut: z.boolean().default(false),
  badge: z.string().max(20).optional(),
});

export const VariantGroupSchema = z.object({
  /** "size" | "colour" | custom slug. */
  id: IdSchema,
  label: z.string().min(1).max(40),
  style: z.enum(["swatch", "chip", "dropdown", "card"]),
  required: z.boolean().default(true),
  options: z.array(VariantOptionSchema).min(1).max(12),
});

export const HeroProductPropsSchema = z.object({
  /** e.g. "Bestseller · 12,000+ sold". */
  eyebrow: z.string().max(40).optional(),
  /** Product name. Must contain the ad's core keyword — see cro/message-match. */
  title: z.string().min(1).max(60),
  /** One-sentence benefit, not a feature. */
  subtitle: z.string().max(110).optional(),
  /** 1–8 images. The first is the LCP element and is the page's only `priority` image. */
  gallery: z.array(ImageRefSchema).min(1).max(8),
  galleryLayout: z
    .enum(["thumbs-left", "thumbs-below", "carousel", "stacked"])
    .default("thumbs-below"),
  rating: RatingSummarySchema.nullable().default(null),
  price: MoneySchema,
  /** Struck-through MRP. Must exceed `price` — enforced by cro/price-integrity. */
  compareAtPrice: MoneySchema.nullable().default(null),
  discountBadge: DiscountBadgeSchema.nullable().default(null),
  priceNote: z.string().max(80).default("Inclusive of all taxes"),
  /** 0–3 groups (e.g. Size, Colour, Pack). */
  variants: z.array(VariantGroupSchema).max(3).default([]),
  showQuantity: z.boolean().default(true),
  quantityMax: z.number().int().min(1).max(10).default(5),
  primaryCta: CtaSpecSchema,
  secondaryCta: CtaSpecSchema.nullable().default(null),
  trustChips: z.array(TrustChipSchema).max(4).default([]),
  /** 0–5 scannable benefit lines. */
  bullets: z.array(z.string().max(70)).max(5).default([]),
  /** e.g. "Only 14 left in stock". Prefer urgency-strip for anything data-bound. */
  stockLine: z.string().max(48).optional(),
  layout: z.enum(["media-left", "media-right"]).default("media-left"),
  background: ToneTokenSchema.default("light"),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 3 — urgency-strip                                    BLOCK-CATALOG §2.3
   Every signal carries a DataSource. No value may be a bare invented number.
   ══════════════════════════════════════════════════════════════════════════════ */

export const UnitsSoldSignalSchema = z.object({
  kind: z.literal("units-sold"),
  /** Template with a {value} token, e.g. "{value} sold in the last 24 hours". */
  label: z.string().min(1).max(48),
  source: DataSourceSchema,
  period: z.string().max(24).default("24 hours"),
  /** compact → "12.4k" · plus → "12,000+" · plain → "12,431" */
  format: z.enum(["plain", "compact", "plus"]).default("compact"),
  icon: IconNameSchema.optional(),
});

export const PeopleViewingSignalSchema = z.object({
  kind: z.literal("people-viewing"),
  label: z.string().min(1).max(48),
  source: DataSourceSchema,
  /** Never renders below this. "1 person viewing" is anti-social-proof. */
  minDisplay: z.number().int().min(1).default(3),
  icon: IconNameSchema.optional(),
});

export const StockRemainingSignalSchema = z.object({
  kind: z.literal("stock-remaining"),
  label: z.string().min(1).max(48),
  source: DataSourceSchema,
  /** Clamps to this minimum. Showing "0 left" next to Buy is a guaranteed bounce. */
  stockCriticalFloor: z.number().int().min(1).default(3),
  showBar: z.boolean().default(true),
  barMax: z.number().int().min(1).default(50),
  icon: IconNameSchema.optional(),
});

export const CountdownSignalSchema = z.object({
  kind: z.literal("countdown"),
  label: z.string().min(1).max(48),
  config: CountdownConfigSchema,
  icon: IconNameSchema.optional(),
});

export const CustomSignalSchema = z.object({
  kind: z.literal("custom"),
  label: z.string().min(1).max(48),
  value: z.string().max(48),
  source: DataSourceSchema,
  icon: IconNameSchema.optional(),
});

export const UrgencySignalSchema = z.discriminatedUnion("kind", [
  UnitsSoldSignalSchema,
  PeopleViewingSignalSchema,
  StockRemainingSignalSchema,
  CountdownSignalSchema,
  CustomSignalSchema,
]);

export const UrgencyStripPropsSchema = z.object({
  /** 1–4 signals. More than 4 reads as noise and loses credibility. */
  signals: z.array(UrgencySignalSchema).min(1).max(4),
  layout: z.enum(["row", "grid", "ticker"]).default("row"),
  tone: ToneTokenSchema.default("warning"),
  dividers: z.boolean().default(true),
  /** Pulse dot on live signals. Respects prefers-reduced-motion. */
  animate: z.boolean().default(true),
  /** Footnote shown when any signal is simulated or unverified. */
  disclosureText: z.string().max(200).optional(),
  sticky: z.boolean().default(false),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 4 — offer-stack                                      BLOCK-CATALOG §2.4
   ══════════════════════════════════════════════════════════════════════════════ */

export const OfferSchema = z.object({
  /** Stable — referenced by persona-cards `recommended.offerId`. */
  id: IdSchema,
  title: z.string().min(1).max(32),
  subtitle: z.string().max(60).optional(),
  image: ImageRefSchema.optional(),
  price: MoneySchema,
  /** Must exceed `price` — enforced by cro/price-integrity. */
  compareAtPrice: MoneySchema.optional(),
  /** Used with showPerUnit, e.g. "per bottle". */
  perUnitLabel: z.string().max(24).optional(),
  unitCount: z.number().int().min(1).default(1),
  /** Overrides the computed savings text. */
  savingsLabel: z.string().max(32).optional(),
  /** Max one per block — enforced by cro/offer-anchor. */
  mostPopular: z.boolean().default(false),
  badge: z.string().max(20).optional(),
  badgeTone: ToneTokenSchema.default("accent"),
  includes: z.array(z.string().max(60)).max(6).default([]),
  freebies: z.array(z.string().max(60)).max(3).default([]),
  soldOut: z.boolean().default(false),
  cta: CtaSpecSchema,
});

export const OfferStackPropsSchema = z.object({
  heading: z.string().max(60).default("Choose your pack"),
  subheading: z.string().max(120).optional(),
  /** 2–4 offers. Exactly one may set mostPopular. */
  offers: z.array(OfferSchema).min(2).max(4),
  /** Defaults to offers.length when omitted. */
  columns: Columns2to4.optional(),
  emphasis: z
    .enum(["popular-scale", "popular-border", "flat"])
    .default("popular-scale"),
  /** Rupee savings convert better than percentages in India. */
  savingsDisplay: z.enum(["amount", "percent", "both"]).default("both"),
  /** Renders "₹450/bottle" — the strongest bundle justification. */
  showPerUnit: z.boolean().default(true),
  background: ToneTokenSchema.default("neutral"),
  footnote: z.string().max(120).optional(),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 5 — product-narrative                                BLOCK-CATALOG §2.5
   ══════════════════════════════════════════════════════════════════════════════ */

export const NarrativeStatSchema = z.object({
  /** String, not number, so units render exactly: "12,000+", "4.6★", "100%". */
  value: z.string().min(1).max(16),
  label: z.string().min(1).max(32),
  icon: IconNameSchema.optional(),
  /** When present the value is resolved from the binding, not typed. */
  source: DataSourceSchema.optional(),
});

export const SignatureSchema = z.object({
  name: z.string().min(1).max(48),
  /** e.g. "Founder, Vedaroots". */
  role: z.string().min(1).max(48),
  avatar: ImageRefSchema.optional(),
});

export const ProductNarrativePropsSchema = z.object({
  eyebrow: z.string().max(30).optional(),
  /** Should be a claim, not a label. */
  heading: z.string().min(1).max(80),
  /** Plain text; supports "\n\n" paragraph breaks. No HTML. */
  body: z.string().min(40).max(600),
  /** Exactly 0 or 3 entries — a "stat trio" with 2 items looks broken (cro/stat-trio). */
  stats: z.array(NarrativeStatSchema).max(3).default([]),
  image: ImageRefSchema.nullable().default(null),
  imagePosition: z
    .enum(["left", "right", "background", "none"])
    .default("right"),
  signature: SignatureSchema.nullable().default(null),
  cta: CtaSpecSchema.nullable().default(null),
  background: ToneTokenSchema.default("light"),
  /** "prose" caps the measure at ~68ch. */
  maxWidth: z.enum(["prose", "wide"]).default("prose"),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 6 — collection-grid                                  BLOCK-CATALOG §2.6
   ══════════════════════════════════════════════════════════════════════════════ */

export const CollectionItemSchema = z.object({
  id: IdSchema,
  /** Required — a grid card with no image is dead weight. */
  image: ImageRefSchema,
  name: z.string().min(1).max(48),
  subtitle: z.string().max(60).optional(),
  price: MoneySchema,
  compareAtPrice: MoneySchema.optional(),
  badge: z.string().max(16).optional(),
  badgeTone: ToneTokenSchema.optional(),
  rating: RatingSummarySchema.optional(),
  soldOut: z.boolean().default(false),
  action: CheckoutActionSchema,
});

export const CollectionGridPropsSchema = z.object({
  heading: z.string().max(60).default("Explore the full range"),
  subheading: z.string().max(120).optional(),
  items: z.array(CollectionItemSchema).min(2).max(12),
  columns: Columns2to4.default(4),
  /** 2 is correct for Indian D2C — thumbnail browsing beats one-up scrolling. */
  mobileColumns: Columns1to2.default(2),
  mobileLayout: z.enum(["grid", "carousel"]).default("carousel"),
  /** Enforced image box; prevents CLS. */
  aspectRatio: z.enum(["1:1", "4:5", "3:4"]).default("1:1"),
  showPrice: z.boolean().default(true),
  showCompareAt: z.boolean().default(true),
  cardCta: z.enum(["none", "button", "whole-card"]).default("whole-card"),
  cardCtaLabel: z.string().max(20).default("View"),
  viewAll: CtaSpecSchema.nullable().default(null),
  background: ToneTokenSchema.default("light"),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 7 — persona-cards                                    BLOCK-CATALOG §2.7
   ══════════════════════════════════════════════════════════════════════════════ */

export const PersonaRecommendationSchema = z.object({
  /** Preferred: references an Offer.id in offer-stack — keeps pricing single-sourced. */
  offerId: IdSchema.optional(),
  /** Fallback display name when offerId is absent. */
  productName: z.string().max(48).optional(),
  image: ImageRefSchema.optional(),
  /** Only when offerId is absent. */
  price: MoneySchema.optional(),
  reason: z.string().max(60).optional(),
  cta: CtaSpecSchema,
});

export const PersonaSchema = z.object({
  id: IdSchema,
  /** Second person, e.g. "You're 30+ with dull, uneven skin". */
  title: z.string().min(1).max(52),
  /** Names the pain before the fix. */
  description: z.string().min(40).max(220),
  image: ImageRefSchema.optional(),
  /** Used when no image is supplied. */
  icon: IconNameSchema.optional(),
  /** 0–4 "This is you if…" checklist lines. */
  matchPoints: z.array(z.string().max(60)).max(4).default([]),
  /** Required — a persona card with no route is decoration. */
  recommended: PersonaRecommendationSchema,
});

export const PersonaCardsPropsSchema = z.object({
  heading: z.string().max(70).default("Which one is right for you?"),
  subheading: z.string().max(120).optional(),
  /** 2–4 entries. */
  personas: z.array(PersonaSchema).min(2).max(4),
  /** Defaults to personas.length when omitted. */
  columns: Columns2to4.optional(),
  cardStyle: z.enum(["outlined", "filled", "image-top"]).default("outlined"),
  background: ToneTokenSchema.default("neutral"),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 8 — value-pillars                                    BLOCK-CATALOG §2.8
   ══════════════════════════════════════════════════════════════════════════════ */

export const PillarSchema = z.object({
  id: IdSchema,
  icon: IconNameSchema,
  /** Benefit phrasing, not feature phrasing. */
  title: z.string().min(1).max(36),
  description: z.string().min(30).max(160),
  /** Overrides the icon when present. */
  image: ImageRefSchema.optional(),
  tone: ToneTokenSchema.optional(),
});

export const ValuePillarsPropsSchema = z.object({
  /** Optional — pillars can run headless. */
  heading: z.string().max(70).optional(),
  subheading: z.string().max(120).optional(),
  pillars: z.array(PillarSchema).min(3).max(6),
  /** "numeric" for process steps, "none" for parallel benefits. */
  numbering: z.enum(["none", "numeric", "roman"]).default("numeric"),
  columns: Columns2to4.default(3),
  iconStyle: z.enum(["plain", "circle", "square", "none"]).default("circle"),
  align: z.enum(["left", "center"]).default("center"),
  divider: z.boolean().default(false),
  background: ToneTokenSchema.default("light"),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 9 — spec-table                                       BLOCK-CATALOG §2.9
   ══════════════════════════════════════════════════════════════════════════════ */

export const SpecRowSchema = z.object({
  id: IdSchema,
  label: z.string().min(1).max(40),
  /** String, not number — units must render exactly ("30 ml", "24 months"). */
  value: z.string().min(1).max(160),
  icon: IconNameSchema.optional(),
  /** Bolds the row for a hero spec. */
  highlight: z.boolean().default(false),
  tooltip: z.string().max(160).optional(),
});

export const SpecGroupSchema = z.object({
  id: IdSchema,
  /** Omit for an ungrouped table. */
  title: z.string().max(48).optional(),
  rows: z.array(SpecRowSchema).min(1).max(20),
});

export const SpecTablePropsSchema = z.object({
  heading: z.string().max(60).default("Product details"),
  subheading: z.string().max(120).optional(),
  /** 1–4 groups. Use a single unnamed group for simple products. */
  groups: z.array(SpecGroupSchema).min(1).max(4),
  layout: z
    .enum(["two-column", "single-column", "cards"])
    .default("two-column"),
  /** Zebra shading materially improves scan accuracy. */
  striped: z.boolean().default(true),
  /** Recommended when total rows > 12. */
  collapsibleGroups: z.boolean().default(false),
  image: ImageRefSchema.nullable().default(null),
  footnote: z.string().max(160).optional(),
  background: ToneTokenSchema.default("neutral"),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 10 — review-wall                                    BLOCK-CATALOG §2.10
   ══════════════════════════════════════════════════════════════════════════════ */

export const ReviewDistributionSchema = z.object({
  "5": z.number().int().min(0),
  "4": z.number().int().min(0),
  "3": z.number().int().min(0),
  "2": z.number().int().min(0),
  "1": z.number().int().min(0),
});

export const ReviewSummarySchema = z.object({
  value: RatingSchema,
  count: z.number().int().min(0),
  /** All five keys required when showDistribution is true. */
  distribution: ReviewDistributionSchema,
  label: z.string().max(60).optional(),
  /** Optional binding to a reviews API (Judge.me, Loox). */
  source: DataSourceSchema.optional(),
  sourceBadge: z.string().max(40).optional(),
});

export const ReviewResponseSchema = z.object({
  author: z.string().min(1).max(40),
  body: z.string().min(1).max(400),
  /** ISO date, e.g. "2026-05-29". */
  date: z.string().max(32).optional(),
});

export const ReviewSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(40),
  /** "Pune, Maharashtra" — strongly recommended for India. */
  location: z.string().max(40).optional(),
  rating: RatingSchema,
  /** ISO date "2026-06-14". Rendered as "14 Jun 2026". */
  date: z.string().min(1).max(32),
  title: z.string().max(60).optional(),
  body: z.string().min(20).max(600),
  /** Renders the "Verified buyer" badge. */
  verified: z.boolean().default(false),
  photos: z.array(ImageRefSchema).max(3).default([]),
  variantPurchased: z.string().max(40).optional(),
  helpfulCount: z.number().int().min(0).optional(),
  response: ReviewResponseSchema.optional(),
});

export const ReviewWallPropsSchema = z.object({
  heading: z.string().max(60).default("What our customers say"),
  summary: ReviewSummarySchema,
  showDistribution: z.boolean().default(true),
  /** 3–24 entries. */
  reviews: z.array(ReviewSchema).min(3).max(24),
  layout: z.enum(["grid", "masonry", "carousel"]).default("grid"),
  columns: Columns2to3.default(3),
  /** Reviews shown before "Load more". */
  initialCount: z.number().int().min(1).max(24).default(6),
  sortDefault: z.enum(["recent", "helpful", "rating-desc"]).default("helpful"),
  /** Off by default — filters invite 1-star hunting on cold traffic. */
  filterable: z.boolean().default(false),
  showPhotos: z.boolean().default(true),
  cta: CtaSpecSchema.nullable().default(null),
  background: ToneTokenSchema.default("light"),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 11 — comparison-table                               BLOCK-CATALOG §2.11
   ══════════════════════════════════════════════════════════════════════════════ */

export const ComparisonCellSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("check") }),
  z.object({ type: z.literal("cross") }),
  z.object({ type: z.literal("partial") }),
  z.object({ type: z.literal("text"), value: z.string().max(40) }),
  z.object({ type: z.literal("rating"), value: RatingSchema }),
]);

export const ComparisonColumnSchema = z.object({
  id: IdSchema,
  /** Prefer categories ("Ordinary market oils") over named competitors. */
  label: z.string().min(1).max(28),
  sublabel: z.string().max(32).optional(),
  /** Exactly one column must be true — enforced by cro/comparison-us-column. */
  isUs: z.boolean().default(false),
  logo: ImageRefSchema.optional(),
  /** Rendered in the CTA row; usually only on the "us" column. */
  cta: CtaSpecSchema.optional(),
});

export const ComparisonRowSchema = z.object({
  id: IdSchema,
  label: z.string().min(1).max(48),
  tooltip: z.string().max(160).optional(),
  /** Length MUST equal columns.length — enforced by cro/comparison-cell-arity. */
  cells: z.array(ComparisonCellSchema).min(2).max(4),
});

export const PriceRowSchema = z.object({
  label: z.string().max(32).default("Price"),
  /** Length MUST equal columns.length. Strings so ranges render: "₹300–₹600". */
  values: z.array(z.string().max(40)).min(2).max(4),
  note: z.string().max(48).optional(),
});

export const ComparisonTablePropsSchema = z.object({
  heading: z.string().max(60).default("How we compare"),
  subheading: z.string().max(120).optional(),
  /** 2–4 columns. Exactly one must set isUs: true. */
  columns: z.array(ComparisonColumnSchema).min(2).max(4),
  rows: z.array(ComparisonRowSchema).min(3).max(12),
  priceRow: PriceRowSchema.nullable().default(null),
  ctaRow: z.boolean().default(true),
  highlightUs: z.boolean().default(true),
  stickyFirstColumn: z.boolean().default(true),
  background: ToneTokenSchema.default("neutral"),
  disclaimer: z.string().max(200).optional(),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK 12 — faq-accordion                                  BLOCK-CATALOG §2.12
   ══════════════════════════════════════════════════════════════════════════════ */

export const FaqGroupSchema = z.object({
  id: IdSchema,
  label: z.string().min(1).max(32),
});

export const FaqItemSchema = z.object({
  id: IdSchema,
  /** Write it in the customer's words, not the brand's. */
  question: z.string().min(1).max(110),
  /** Plain text, "\n\n" paragraphs. No HTML. */
  answer: z.string().min(20).max(800),
  /** FaqGroup.id */
  group: IdSchema.optional(),
  cta: CtaSpecSchema.optional(),
});

export const SupportCtaSchema = z.object({
  heading: z.string().min(1).max(60),
  body: z.string().max(160).optional(),
  /** Usually a whatsapp action. */
  cta: CtaSpecSchema,
  icon: IconNameSchema.default("headphones"),
});

export const FaqAccordionPropsSchema = z.object({
  heading: z.string().max(60).default("Frequently asked questions"),
  subheading: z.string().max(120).optional(),
  /** 4–15 entries. Fewer looks unfinished; more is a knowledge base. */
  items: z.array(FaqItemSchema).min(4).max(15),
  /** "single-column" measures better. Mobile is always single column. */
  layout: z.enum(["single-column", "two-column"]).default("single-column"),
  /** FaqItem ids open on load. The first item should always be open. */
  defaultOpen: z.array(IdSchema).max(15).default([]),
  allowMultipleOpen: z.boolean().default(true),
  /** Optional category tabs, e.g. Shipping / Product / Returns. */
  groups: z.array(FaqGroupSchema).max(6).nullable().default(null),
  supportCta: SupportCtaSchema.nullable().default(null),
  /** Emits FAQPage structured data. Locked true for pages with an organic path. */
  emitJsonLd: z.boolean().default(true),
  background: ToneTokenSchema.default("light"),
});

/* ══════════════════════════════════════════════════════════════════════════════
   BLOCK INSTANCE ENVELOPE + THE LOCKED REGISTRY UNION
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Fields shared by every block instance. `id` is stable, unique per page and never an index.
 */
const blockEnvelope = {
  id: IdSchema,
  /** Soft-delete: keeps the block in the JSON but skips render. */
  hidden: z.boolean().default(false),
  /** Internal marketer/AI annotation. Never rendered. */
  notes: z.string().max(500).optional(),
};

export const AnnouncementBarBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("announcement-bar"),
  props: AnnouncementBarPropsSchema,
});

export const HeroProductBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("hero-product"),
  props: HeroProductPropsSchema,
});

export const UrgencyStripBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("urgency-strip"),
  props: UrgencyStripPropsSchema,
});

export const OfferStackBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("offer-stack"),
  props: OfferStackPropsSchema,
});

export const ProductNarrativeBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("product-narrative"),
  props: ProductNarrativePropsSchema,
});

export const CollectionGridBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("collection-grid"),
  props: CollectionGridPropsSchema,
});

export const PersonaCardsBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("persona-cards"),
  props: PersonaCardsPropsSchema,
});

export const ValuePillarsBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("value-pillars"),
  props: ValuePillarsPropsSchema,
});

export const SpecTableBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("spec-table"),
  props: SpecTablePropsSchema,
});

export const ReviewWallBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("review-wall"),
  props: ReviewWallPropsSchema,
});

export const ComparisonTableBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("comparison-table"),
  props: ComparisonTablePropsSchema,
});

export const FaqAccordionBlockSchema = z.object({
  ...blockEnvelope,
  type: z.literal("faq-accordion"),
  props: FaqAccordionPropsSchema,
});

/**
 * THE LOCKED REGISTRY. If a type is not in this union it does not exist.
 * Fixtures (sticky-cta, social-proof-popup, trust-bar) are deliberately NOT here —
 * they are singletons on `page.fixtures` and must not be drag-reordered.
 */
export const BlockSchema = z.discriminatedUnion("type", [
  AnnouncementBarBlockSchema,
  HeroProductBlockSchema,
  UrgencyStripBlockSchema,
  OfferStackBlockSchema,
  ProductNarrativeBlockSchema,
  CollectionGridBlockSchema,
  PersonaCardsBlockSchema,
  ValuePillarsBlockSchema,
  SpecTableBlockSchema,
  ReviewWallBlockSchema,
  ComparisonTableBlockSchema,
  FaqAccordionBlockSchema,
]);

/** The 12 flow block type ids, in BLOCK-CATALOG §2 declaration order. */
export const BLOCK_TYPES = [
  "announcement-bar",
  "hero-product",
  "urgency-strip",
  "offer-stack",
  "product-narrative",
  "collection-grid",
  "persona-cards",
  "value-pillars",
  "spec-table",
  "review-wall",
  "comparison-table",
  "faq-accordion",
] as const;

export const BlockTypeSchema = z.enum(BLOCK_TYPES);

/**
 * Default composition for cold paid traffic (BLOCK-CATALOG §4). The generator produces
 * this order unless the brief explicitly overrides it.
 */
export const RECOMMENDED_BLOCK_ORDER = [
  "announcement-bar",
  "hero-product",
  "urgency-strip",
  "value-pillars",
  "offer-stack",
  "review-wall",
  "product-narrative",
  "persona-cards",
  "comparison-table",
  "spec-table",
  "faq-accordion",
  "collection-grid",
] as const satisfies readonly BlockType[];

/** Props schema lookup, keyed by block type. Used by the Puck registry and the validator. */
export const BLOCK_PROPS_SCHEMAS = {
  "announcement-bar": AnnouncementBarPropsSchema,
  "hero-product": HeroProductPropsSchema,
  "urgency-strip": UrgencyStripPropsSchema,
  "offer-stack": OfferStackPropsSchema,
  "product-narrative": ProductNarrativePropsSchema,
  "collection-grid": CollectionGridPropsSchema,
  "persona-cards": PersonaCardsPropsSchema,
  "value-pillars": ValuePillarsPropsSchema,
  "spec-table": SpecTablePropsSchema,
  "review-wall": ReviewWallPropsSchema,
  "comparison-table": ComparisonTablePropsSchema,
  "faq-accordion": FaqAccordionPropsSchema,
} as const;

/* ══════════════════════════════════════════════════════════════════════════════
   PAGE FIXTURES — singletons, not members of page.blocks[]. BLOCK-CATALOG §3.
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── FIXTURE 13 — sticky-cta ─────────────────────────────────────── §3.1 ──── */

export const StickyTriggerSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("immediate") }),
  z.object({
    mode: z.literal("scroll-percent"),
    percent: z.number().int().min(1).max(100),
  }),
  z.object({
    mode: z.literal("after-block"),
    /** Appears once this block scrolls out of view. Addressed by block id. */
    blockId: IdSchema,
  }),
  z.object({ mode: z.literal("delay"), seconds: z.number().min(0).max(120) }),
]);

export const StickyCtaPropsSchema = z.object({
  enabled: z.boolean().default(true),
  /** "mobile" = below 768px. */
  showOn: z.enum(["mobile", "always", "desktop"]).default("mobile"),
  trigger: StickyTriggerSchema.nullable().default(null),
  /** Inherited from hero-product.title when omitted. */
  productName: z.string().max(60).optional(),
  /** Inherited from the first hero gallery image when omitted. */
  image: ImageRefSchema.nullable().default(null),
  /** Inherited from hero-product.price when omitted. */
  price: MoneySchema.optional(),
  compareAtPrice: MoneySchema.nullable().default(null),
  /** e.g. "Save ₹600". Auto-computed when omitted. */
  savingsLabel: z.string().max(32).optional(),
  /** Must resolve to the same destination as the hero primary CTA. */
  cta: CtaSpecSchema,
  /** Small icon-only button, typically WhatsApp. */
  secondaryIconCta: CtaSpecSchema.nullable().default(null),
  /** Hides when the final CTA section is in view so two CTAs never stack. */
  hideNearFooter: z.boolean().default(true),
  reflectVariantSelection: z.boolean().default(true),
  tone: ToneTokenSchema.default("brand"),
});

/* ── FIXTURE 14 — social-proof-popup ─────────────────────────────── §3.2 ──── */

/** "full" (surname included) is FORBIDDEN by the validator — a live privacy exposure. */
export const AnonymiseModeSchema = z.enum([
  "first-name-initial",
  "first-name-only",
  "full",
]);

export const PopupEventSchema = z.object({
  id: IdSchema,
  /** Already anonymised for static/simulated sources. */
  name: z.string().min(1).max(40),
  city: z.string().min(1).max(40),
  product: z.string().min(1).max(60),
  variant: z.string().max(40).optional(),
  quantity: z.number().int().min(1).optional(),
  /** Rendered as "12 minutes ago". */
  minutesAgo: z.number().int().min(1).optional(),
  image: ImageRefSchema.optional(),
  verified: z.boolean().default(false),
});

export const PopupSourceSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("orders-api"),
    endpoint: z.string().min(1),
    jsonPath: z.string().min(1),
    refreshSeconds: z.number().int().min(1).optional(),
    anonymise: AnonymiseModeSchema.default("first-name-initial"),
    fallback: z.array(PopupEventSchema).min(1).max(20),
  }),
  z.object({
    mode: z.literal("shopify-orders"),
    shop: z.string().min(1),
    lookbackHours: z.number().int().min(1).max(720),
    anonymise: AnonymiseModeSchema.default("first-name-initial"),
    fallback: z.array(PopupEventSchema).min(1).max(20),
  }),
  z.object({
    mode: z.literal("static"),
    events: z.array(PopupEventSchema).min(1).max(20),
    verified: z.boolean().default(false),
  }),
  z.object({
    mode: z.literal("simulated"),
    events: z.array(PopupEventSchema).min(1).max(20),
    disclosure: z.string().min(1).max(200),
    shuffle: z.boolean().default(true),
    jitterMinutes: z.number().int().min(0).max(240).optional(),
  }),
]);

export const SocialProofPopupPropsSchema = z.object({
  enabled: z.boolean().default(true),
  source: PopupSourceSchema,
  position: z
    .enum(["bottom-left", "bottom-right", "top-right"])
    .default("bottom-left"),
  /** On mobile "bottom" collides with sticky-cta — never default it there. */
  mobilePosition: z.enum(["top", "bottom", "hidden"]).default("top"),
  /** Tokens: {name} {city} {product} {variant} {timeAgo} {quantity} */
  template: z
    .string()
    .max(120)
    .default("{name} from {city} just ordered {product}"),
  showImage: z.boolean().default(true),
  showTimeAgo: z.boolean().default(true),
  /** Never fire before the visitor has read the hero. */
  initialDelaySeconds: z.number().int().min(0).max(120).default(8),
  /** Minimum 10 enforced here. */
  intervalSeconds: z.number().int().min(10).max(300).default(18),
  displaySeconds: z.number().int().min(2).max(30).default(5),
  /** Beyond ~6 it reads as spam and hurts trust (cro/urgency-restraint). */
  maxPerSession: z.number().int().min(1).max(12).default(6),
  dismissible: z.boolean().default(true),
  clickAction: CheckoutActionSchema.nullable().default(null),
  /** Required by the validator when source.mode === "simulated". */
  disclosure: z.string().max(200).optional(),
});

/* ── FIXTURE 15 — trust-bar ──────────────────────────────────────── §3.3 ──── */

export const PAYMENT_LOGOS = [
  "upi",
  "gpay",
  "phonepe",
  "paytm",
  "visa",
  "mastercard",
  "rupay",
  "amex",
  "netbanking",
  "cod",
  "razorpay",
] as const;

export const PaymentLogoSchema = z.enum(PAYMENT_LOGOS);

export const TrustBadgeSchema = z.object({
  id: IdSchema,
  icon: IconNameSchema.optional(),
  /** Certification mark; overrides the icon. */
  image: ImageRefSchema.optional(),
  label: z.string().min(1).max(24),
  sublabel: z.string().max(32).optional(),
  tooltip: z.string().max(120).optional(),
});

export const TrustBarPropsSchema = z.object({
  enabled: z.boolean().default(true),
  placement: z
    .enum(["above-footer", "below-hero", "both"])
    .default("above-footer"),
  badges: z.array(TrustBadgeSchema).min(3).max(8),
  style: z.enum(["icons", "logos", "mixed"]).default("mixed"),
  showLabels: z.boolean().default(true),
  paymentLogos: z.array(PaymentLogoSchema).max(11).default([]),
  tone: ToneTokenSchema.default("neutral"),
  bordered: z.boolean().default(true),
});

export const PageFixturesSchema = z.object({
  stickyCta: StickyCtaPropsSchema.nullable().default(null),
  socialProofPopup: SocialProofPopupPropsSchema.nullable().default(null),
  trustBar: TrustBarPropsSchema.nullable().default(null),
});

export const FIXTURE_KEYS = ["stickyCta", "socialProofPopup", "trustBar"] as const;

/** Fixture props schema lookup, keyed by the fixture key on page.fixtures. */
export const FIXTURE_PROPS_SCHEMAS = {
  stickyCta: StickyCtaPropsSchema,
  socialProofPopup: SocialProofPopupPropsSchema,
  trustBar: TrustBarPropsSchema,
} as const;

/* ══════════════════════════════════════════════════════════════════════════════
   PAGE DOCUMENT
   ══════════════════════════════════════════════════════════════════════════════ */

/** Records a human acknowledgement of a `warn`-severity validator rule. §6 */
export const AcknowledgementSchema = z.object({
  /** e.g. "cro/unattributed-claim". */
  ruleId: z.string().min(1).max(64),
  acknowledgedBy: z.string().min(1).max(120),
  /** ISO 8601. */
  acknowledgedAt: z.string().min(1).max(40),
  note: z.string().max(300).optional(),
});

export const PageMetaSchema = z.object({
  /** <title>. Max 60 chars renders without truncation on SERP. */
  title: z.string().min(1).max(70),
  description: z.string().min(1).max(180),
  keywords: z.array(z.string().max(60)).max(20).default([]),
  canonicalUrl: z.string().max(300).optional(),
  ogImage: ImageRefSchema.nullable().default(null),
  ogTitle: z.string().max(70).optional(),
  ogDescription: z.string().max(200).optional(),
  /** Paid-only landing pages are usually noindex. */
  noindex: z.boolean().default(false),
  locale: z.string().max(12).default("en-IN"),
  /** Human sign-offs required before a page with `warn` findings can publish. */
  acknowledgements: z.array(AcknowledgementSchema).max(50).default([]),
});

export const TrackingSchema = z.object({
  gtmId: z.string().max(40).optional(),
  ga4MeasurementId: z.string().max(40).optional(),
  metaPixelId: z.string().max(40).optional(),
  googleAdsConversionId: z.string().max(40).optional(),
  googleAdsConversionLabel: z.string().max(60).optional(),
  /** Fired on primary CTA click in addition to the automatic `cta_click`. */
  conversionEventName: z.string().max(60).default("cta_click"),
  /** Applied when the visitor arrives without utm_* params. */
  utmDefaults: z
    .object({
      source: z.string().max(60).optional(),
      medium: z.string().max(60).optional(),
      campaign: z.string().max(60).optional(),
      term: z.string().max(60).optional(),
      content: z.string().max(60).optional(),
    })
    .nullable()
    .default(null),
});

export const PageStatusSchema = z.enum(["draft", "review", "published", "archived"]);

export const PageSchema = z.object({
  id: IdSchema,
  /** URL path segment, lowercase kebab. */
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case"),
  /** Internal working title shown in the dashboard, not the SEO title. */
  title: z.string().min(1).max(120),
  meta: PageMetaSchema,
  theme: BrandThemeSchema,
  /** 8–13 flow blocks for a cold-traffic page (cro/block-count). Addressed by id. */
  blocks: z.array(BlockSchema).min(1).max(20),
  fixtures: PageFixturesSchema,
  tracking: TrackingSchema,
  status: PageStatusSchema.default("draft"),
  /** ISO 8601. */
  createdAt: z.string().min(1).max(40),
  updatedAt: z.string().min(1).max(40),
});

/* ══════════════════════════════════════════════════════════════════════════════
   INFERRED TYPES
   ══════════════════════════════════════════════════════════════════════════════ */

/* Block props */
export type AnnouncementBarProps = z.infer<typeof AnnouncementBarPropsSchema>;
export type HeroProductProps = z.infer<typeof HeroProductPropsSchema>;
export type UrgencyStripProps = z.infer<typeof UrgencyStripPropsSchema>;
export type OfferStackProps = z.infer<typeof OfferStackPropsSchema>;
export type ProductNarrativeProps = z.infer<typeof ProductNarrativePropsSchema>;
export type CollectionGridProps = z.infer<typeof CollectionGridPropsSchema>;
export type PersonaCardsProps = z.infer<typeof PersonaCardsPropsSchema>;
export type ValuePillarsProps = z.infer<typeof ValuePillarsPropsSchema>;
export type SpecTableProps = z.infer<typeof SpecTablePropsSchema>;
export type ReviewWallProps = z.infer<typeof ReviewWallPropsSchema>;
export type ComparisonTableProps = z.infer<typeof ComparisonTablePropsSchema>;
export type FaqAccordionProps = z.infer<typeof FaqAccordionPropsSchema>;

/* Fixture props */
export type StickyCtaProps = z.infer<typeof StickyCtaPropsSchema>;
export type SocialProofPopupProps = z.infer<typeof SocialProofPopupPropsSchema>;
export type TrustBarProps = z.infer<typeof TrustBarPropsSchema>;

/* Sub-object types */
export type DiscountBadge = z.infer<typeof DiscountBadgeSchema>;
export type VariantGroup = z.infer<typeof VariantGroupSchema>;
export type VariantOption = z.infer<typeof VariantOptionSchema>;
export type UrgencySignal = z.infer<typeof UrgencySignalSchema>;
export type Offer = z.infer<typeof OfferSchema>;
export type NarrativeStat = z.infer<typeof NarrativeStatSchema>;
export type Signature = z.infer<typeof SignatureSchema>;
export type CollectionItem = z.infer<typeof CollectionItemSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type PersonaRecommendation = z.infer<typeof PersonaRecommendationSchema>;
export type Pillar = z.infer<typeof PillarSchema>;
export type SpecGroup = z.infer<typeof SpecGroupSchema>;
export type SpecRow = z.infer<typeof SpecRowSchema>;
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type ComparisonColumn = z.infer<typeof ComparisonColumnSchema>;
export type ComparisonRow = z.infer<typeof ComparisonRowSchema>;
export type ComparisonCell = z.infer<typeof ComparisonCellSchema>;
export type PriceRow = z.infer<typeof PriceRowSchema>;
export type FaqItem = z.infer<typeof FaqItemSchema>;
export type FaqGroup = z.infer<typeof FaqGroupSchema>;
export type SupportCta = z.infer<typeof SupportCtaSchema>;
export type StickyTrigger = z.infer<typeof StickyTriggerSchema>;
export type PopupSource = z.infer<typeof PopupSourceSchema>;
export type PopupEvent = z.infer<typeof PopupEventSchema>;
export type PaymentLogo = z.infer<typeof PaymentLogoSchema>;
export type TrustBadge = z.infer<typeof TrustBadgeSchema>;

/* Page-level */
export type BlockType = z.infer<typeof BlockTypeSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type PageFixtures = z.infer<typeof PageFixturesSchema>;
export type PageMeta = z.infer<typeof PageMetaSchema>;
export type Tracking = z.infer<typeof TrackingSchema>;
export type Acknowledgement = z.infer<typeof AcknowledgementSchema>;
export type PageStatus = z.infer<typeof PageStatusSchema>;
export type Page = z.infer<typeof PageSchema>;

/** Narrows the props type for a given block type, e.g. PropsFor<"hero-product">. */
export type PropsFor<T extends BlockType> = Extract<Block, { type: T }>["props"];

/** A single block instance, optionally narrowed to one type. */
export type BlockInstance<T extends BlockType = BlockType> = Extract<Block, { type: T }>;
