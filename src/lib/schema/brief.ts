/**
 * Landing Agent — the intake brief.
 *
 * This is what a marketer fills in (or what an importer scrapes from a Shopify product +
 * a live ad). It is the ONLY input to the generation pass:
 *
 *   BriefSchema ──▶ Anthropic tool call ──▶ PageSchema JSON ──▶ Zod validate ──▶ page.json
 *
 * A brief is intentionally looser than a page: prices are plain rupee numbers, copy is
 * whatever the brand supplied, and nothing is laid out yet. The generator's job is to turn
 * this into a validated `Page` composed from the locked block registry.
 *
 * Money note: brief prices are entered in WHOLE RUPEES (₹899), because that is what a
 * marketer types. `PageSchema` stores integer paise (89900). The generator converts.
 */

import { z } from "zod";

import {
  CheckoutActionSchema,
  ImageRefSchema,
  RatingSchema,
  StylePersonalitySchema,
  ThemeColorSchema,
} from "./primitives";

/* ────────────────────────────────────────────────────────────────────────────
   Brand
   ──────────────────────────────────────────────────────────────────────────── */

export const BriefBrandSchema = z.object({
  name: z.string().min(1).max(60),
  logoUrl: z.string().max(500).optional(),
  /** Hex or oklch. Seeds BrandTheme.primary. */
  primaryColor: ThemeColorSchema.optional(),
  /** Hex or oklch. Seeds BrandTheme.accent. */
  accentColor: ThemeColorSchema.optional(),
  tagline: z.string().max(120).optional(),
});

/* ────────────────────────────────────────────────────────────────────────────
   Product
   ──────────────────────────────────────────────────────────────────────────── */

export const BriefVariantSchema = z.object({
  /** Grouping label, e.g. "Pack", "Size", "Colour". */
  group: z.string().min(1).max(40),
  label: z.string().min(1).max(48),
  /** Whole rupees for this variant, when it differs from the base price. */
  price: z.number().min(0).optional(),
  shopifyVariantId: z.string().max(64).optional(),
  imageUrl: z.string().max(500).optional(),
  soldOut: z.boolean().default(false),
});

export const BriefSpecSchema = z.object({
  label: z.string().min(1).max(40),
  /** String so units render exactly: "30 ml", "24 months". */
  value: z.string().min(1).max(160),
  /** Optional grouping, e.g. "The basics", "Key ingredients". */
  group: z.string().max(48).optional(),
});

export const BriefProductSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  /** 1–12 image URLs or ImageRefs. The first is treated as the hero/LCP image. */
  images: z.array(ImageRefSchema).min(1).max(12),
  /** Selling price in WHOLE RUPEES. */
  price: z.number().min(0),
  /** MRP in WHOLE RUPEES. Must exceed `price`. */
  compareAtPrice: z.number().min(0).optional(),
  currency: z.literal("INR").default("INR"),
  variants: z.array(BriefVariantSchema).max(24).default([]),
  specs: z.array(BriefSpecSchema).max(40).default([]),
  /** Shopify numeric product id or handle, when the destination is Shopify. */
  shopifyProductId: z.string().max(64).optional(),
  category: z.string().max(60).optional(),
});

/* ────────────────────────────────────────────────────────────────────────────
   Offer
   ──────────────────────────────────────────────────────────────────────────── */

export const BriefOfferSchema = z.object({
  /** The promise the ad made. Feeds the announcement bar verbatim in substance. */
  headline: z.string().min(1).max(90),
  /** Free text so both "40% OFF" and "Buy 2 Get 1" fit. */
  discount: z.string().max(48).optional(),
  discountCode: z
    .string()
    .regex(/^[A-Z0-9_-]{3,32}$/, "Discount code must be A-Z, 0-9, _ or -, 3–32 chars")
    .optional(),
  terms: z.string().max(300).optional(),
  /** ISO 8601 with offset. Drives countdown mode "fixed-deadline". */
  campaignEndsAt: z.string().max(40).optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  codAvailable: z.boolean().default(true),
  returnWindowDays: z.number().int().min(0).max(90).optional(),
});

/* ────────────────────────────────────────────────────────────────────────────
   Proof
   ──────────────────────────────────────────────────────────────────────────── */

export const BriefReviewSchema = z.object({
  name: z.string().min(1).max(40),
  /** "Pune, Maharashtra" — strongly recommended for India. */
  location: z.string().max(40).optional(),
  rating: RatingSchema,
  /** ISO date "2026-06-14". */
  date: z.string().max(32).optional(),
  title: z.string().max(60).optional(),
  body: z.string().min(1).max(600),
  verified: z.boolean().default(false),
  variantPurchased: z.string().max(40).optional(),
  photoUrls: z.array(z.string().max(500)).max(3).default([]),
});

export const BriefTrustBadgeSchema = z.object({
  label: z.string().min(1).max(24),
  sublabel: z.string().max(32).optional(),
});

export const BriefProofSchema = z.object({
  rating: RatingSchema.optional(),
  reviewCount: z.number().int().min(0).optional(),
  reviews: z.array(BriefReviewSchema).max(40).default([]),
  trustBadges: z.array(BriefTrustBadgeSchema).max(10).default([]),
  /** e.g. "18,400+ bottles sold" — anything the brand can actually evidence. */
  claims: z.array(z.string().max(120)).max(10).default([]),
  certifications: z.array(z.string().max(60)).max(10).default([]),
});

/* ────────────────────────────────────────────────────────────────────────────
   Audience
   ──────────────────────────────────────────────────────────────────────────── */

export const BriefPersonaSchema = z.object({
  /** Second person, e.g. "You're 30+ with stubborn pigmentation". */
  title: z.string().min(1).max(52),
  description: z.string().min(1).max(300),
  /** What this persona should be routed to, e.g. "Pack of 2". */
  recommendedVariant: z.string().max(48).optional(),
  painPoints: z.array(z.string().max(60)).max(4).default([]),
});

export const BriefAudienceSchema = z.object({
  description: z.string().min(1).max(600),
  personas: z.array(BriefPersonaSchema).max(4).default([]),
  /** Free-text objections the page must answer above the final CTA. */
  objections: z.array(z.string().max(160)).max(10).default([]),
  /** e.g. ["Mumbai", "Bengaluru", "Tier 2"]. */
  geoFocus: z.array(z.string().max(60)).max(10).default([]),
});

/* ────────────────────────────────────────────────────────────────────────────
   Campaign
   ──────────────────────────────────────────────────────────────────────────── */

export const TrafficTemperatureSchema = z.enum(["cold", "warm", "retargeting"]);

export const BriefCampaignSchema = z.object({
  /** The exact ad headline. cro/message-match is scored against this. */
  adHeadline: z.string().min(1).max(120),
  adBody: z.string().max(600).optional(),
  /** The primary keyword must appear in the hero title or subtitle. */
  keywords: z.array(z.string().max(60)).min(1).max(20),
  /** THE single conversion destination for the whole page. One primary action per page. */
  destination: CheckoutActionSchema,
  platform: z.enum(["meta", "google", "both", "other"]).default("meta"),
  temperature: TrafficTemperatureSchema.default("cold"),
  utmCampaign: z.string().max(60).optional(),
});

/* ────────────────────────────────────────────────────────────────────────────
   Style
   ──────────────────────────────────────────────────────────────────────────── */

export const BriefStyleSchema = z.object({
  personality: StylePersonalitySchema.default("bold-commerce"),
  /** Free-text art direction: reference pages, tone of voice, things to avoid. */
  referenceNotes: z.string().max(1000).optional(),
});

/* ────────────────────────────────────────────────────────────────────────────
   The brief
   ──────────────────────────────────────────────────────────────────────────── */

export const BriefSchema = z.object({
  brand: BriefBrandSchema,
  product: BriefProductSchema,
  offer: BriefOfferSchema,
  proof: BriefProofSchema,
  audience: BriefAudienceSchema,
  campaign: BriefCampaignSchema,
  style: BriefStyleSchema,
});

/* ────────────────────────────────────────────────────────────────────────────
   Inferred types
   ──────────────────────────────────────────────────────────────────────────── */

export type BriefBrand = z.infer<typeof BriefBrandSchema>;
export type BriefProduct = z.infer<typeof BriefProductSchema>;
export type BriefVariant = z.infer<typeof BriefVariantSchema>;
export type BriefSpec = z.infer<typeof BriefSpecSchema>;
export type BriefOffer = z.infer<typeof BriefOfferSchema>;
export type BriefProof = z.infer<typeof BriefProofSchema>;
export type BriefReview = z.infer<typeof BriefReviewSchema>;
export type BriefTrustBadge = z.infer<typeof BriefTrustBadgeSchema>;
export type BriefAudience = z.infer<typeof BriefAudienceSchema>;
export type BriefPersona = z.infer<typeof BriefPersonaSchema>;
export type BriefCampaign = z.infer<typeof BriefCampaignSchema>;
export type BriefStyle = z.infer<typeof BriefStyleSchema>;
export type TrafficTemperature = z.infer<typeof TrafficTemperatureSchema>;
export type Brief = z.infer<typeof BriefSchema>;

/** Input shape — what a form or the API accepts before defaults are applied. */
export type BriefInput = z.input<typeof BriefSchema>;
