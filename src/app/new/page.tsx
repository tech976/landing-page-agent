"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ZodType } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wand2,
} from "lucide-react";

import {
  BriefAudienceSchema,
  BriefBrandSchema,
  BriefCampaignSchema,
  BriefOfferSchema,
  BriefProductSchema,
  BriefProofSchema,
  BriefStyleSchema,
  BriefSchema,
} from "@/lib/schema/brief";
import { CHECKOUT_ACTION_KINDS, STYLE_PERSONALITIES } from "@/lib/schema/primitives";
import { DOMAIN_OPTIONS } from "@/lib/generate/domains";
import { cn, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FieldError, FieldHint, Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { Stepper, type StepDefinition } from "@/components/ui/Stepper";
import { Textarea } from "@/components/ui/Textarea";

/**
 * Landing Agent — the intake brief.
 *
 * This is the screen the PPC team lives in, so it is built around three rules:
 *
 *  1. NOTHING IS LOST. All seven steps share one draft object, mirrored to
 *     sessionStorage on every keystroke. A refresh, an accidental back, or a
 *     failed generation never costs typing.
 *
 *  2. VALIDATION IS THE SCHEMA. Each step validates against the matching section
 *     of `BriefSchema` — the same Zod that the generator will run server-side.
 *     There is no second, drifting copy of the rules in the UI.
 *
 *  3. THE FORM HOLDS STRINGS. Number and date inputs give strings; they are
 *     coerced once, in `toBrief()`, at the boundary. Keeping raw strings in state
 *     means a half-typed "12" in a price field is never silently turned into 12.
 */

/* ══════════════════════════════════════════════════════════════════════════════
   Draft shape — the form's own state. Looser than Brief by design.
   ══════════════════════════════════════════════════════════════════════════════ */

interface DraftImage {
  src: string;
  alt: string;
}
interface DraftVariant {
  group: string;
  label: string;
  price: string;
  soldOut: boolean;
}
interface DraftSpec {
  label: string;
  value: string;
  group: string;
}
interface DraftReview {
  name: string;
  location: string;
  rating: string;
  date: string;
  title: string;
  body: string;
  verified: boolean;
}
interface DraftTrustBadge {
  label: string;
  sublabel: string;
}
interface DraftPersona {
  title: string;
  description: string;
  recommendedVariant: string;
  /** Comma-separated in the UI, split on submit. */
  painPoints: string;
}
interface DraftFormField {
  name: string;
  label: string;
  type: "text" | "tel" | "email" | "pincode" | "select" | "textarea";
  required: boolean;
  placeholder: string;
}

interface Draft {
  /** Market vertical. Free text: a listed option value or a custom "Other" entry. */
  domain: string;
  brand: {
    name: string;
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
    tagline: string;
  };
  product: {
    name: string;
    description: string;
    images: DraftImage[];
    price: string;
    compareAtPrice: string;
    variants: DraftVariant[];
    specs: DraftSpec[];
    shopifyProductId: string;
    category: string;
  };
  offer: {
    headline: string;
    discount: string;
    discountCode: string;
    terms: string;
    campaignEndsAt: string;
    freeShippingThreshold: string;
    codAvailable: boolean;
    returnWindowDays: string;
  };
  proof: {
    rating: string;
    reviewCount: string;
    reviews: DraftReview[];
    trustBadges: DraftTrustBadge[];
    /** One claim per line. */
    claims: string;
    /** Comma-separated. */
    certifications: string;
  };
  audience: {
    description: string;
    personas: DraftPersona[];
    /** One objection per line. */
    objections: string;
    /** Comma-separated. */
    geoFocus: string;
  };
  campaign: {
    adHeadline: string;
    adBody: string;
    /** Comma-separated. First keyword is the primary. */
    keywords: string;
    platform: "meta" | "google" | "both" | "other";
    temperature: "cold" | "warm" | "retargeting";
    utmCampaign: string;
    destination: {
      kind: (typeof CHECKOUT_ACTION_KINDS)[number];
      /* Every kind keeps its own sub-object so switching the destination and
         switching back does not wipe what was already typed. */
      shopify: {
        productId: string;
        variantId: string;
        quantity: string;
        discountCode: string;
        mode: "cart" | "direct-checkout";
      };
      whatsapp: { phone: string; messageTemplate: string; businessName: string };
      form: {
        formId: string;
        fields: DraftFormField[];
        submitLabel: string;
        successMessage: string;
        webhookUrl: string;
      };
      url: { href: string; target: "_self" | "_blank"; rel: string };
    };
  };
  style: {
    personality: (typeof STYLE_PERSONALITIES)[number];
    referenceNotes: string;
  };
}

const EMPTY_DRAFT: Draft = {
  domain: "",
  brand: {
    name: "",
    logoUrl: "",
    primaryColor: "#e4572e",
    accentColor: "#16a34a",
    tagline: "",
  },
  product: {
    name: "",
    description: "",
    images: [{ src: "", alt: "" }],
    price: "",
    compareAtPrice: "",
    variants: [],
    specs: [],
    shopifyProductId: "",
    category: "",
  },
  offer: {
    headline: "",
    discount: "",
    discountCode: "",
    terms: "",
    campaignEndsAt: "",
    freeShippingThreshold: "",
    codAvailable: true,
    returnWindowDays: "",
  },
  proof: {
    rating: "",
    reviewCount: "",
    reviews: [],
    trustBadges: [],
    claims: "",
    certifications: "",
  },
  audience: { description: "", personas: [], objections: "", geoFocus: "" },
  campaign: {
    adHeadline: "",
    adBody: "",
    keywords: "",
    platform: "meta",
    temperature: "cold",
    utmCampaign: "",
    destination: {
      kind: "shopify",
      shopify: {
        productId: "",
        variantId: "",
        quantity: "1",
        discountCode: "",
        mode: "direct-checkout",
      },
      whatsapp: { phone: "", messageTemplate: "", businessName: "" },
      form: {
        formId: "lead-form",
        fields: [
          { name: "full_name", label: "Name", type: "text", required: true, placeholder: "" },
          { name: "phone", label: "Mobile number", type: "tel", required: true, placeholder: "" },
        ],
        submitLabel: "Submit",
        successMessage: "Thanks! We'll call you shortly.",
        webhookUrl: "",
      },
      url: { href: "", target: "_self", rel: "" },
    },
  },
  style: { personality: "bold-commerce", referenceNotes: "" },
};

/* ══════════════════════════════════════════════════════════════════════════════
   Sample data — a realistic Indian D2C brief, so the whole flow demos in seconds.
   ══════════════════════════════════════════════════════════════════════════════ */

function sampleDraft(): Draft {
  // Campaign deadline 6 days out, 11:59pm — the shape a real sale takes.
  const ends = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
  ends.setHours(23, 59, 0, 0);
  const endsLocal = new Date(ends.getTime() - ends.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

  return {
    // Kumkumadi face oil is a skincare product — the beauty vertical playbook.
    domain: "beauty",
    brand: {
      name: "Vanya Naturals",
      logoUrl: "https://cdn.vanyanaturals.in/brand/logo.png",
      primaryColor: "#b8433a",
      accentColor: "#1f8a5f",
      tagline: "Ayurveda, made for modern Indian skin",
    },
    product: {
      name: "Kumkumadi Radiance Face Oil",
      description:
        "A cold-pressed Kumkumadi tailam built on 16 classical herbs, led by Kashmiri saffron and steeped in sesame oil for 21 days. Three to four drops at night, massaged in until absorbed. Made for pigmentation, dullness and uneven tone on Indian skin — non-comedogenic, fragrance-free, and safe for daily use. Visible evening of tone reported by most users between weeks four and six.",
      images: [
        {
          src: "https://cdn.vanyanaturals.in/kumkumadi/hero-bottle.jpg",
          alt: "Kumkumadi Radiance Face Oil 30 ml amber glass bottle with dropper",
        },
        {
          src: "https://cdn.vanyanaturals.in/kumkumadi/texture.jpg",
          alt: "Golden oil texture swatch on a fingertip",
        },
        {
          src: "https://cdn.vanyanaturals.in/kumkumadi/ingredients.jpg",
          alt: "Saffron strands, sesame seeds and manjistha root on a stone surface",
        },
      ],
      price: "899",
      compareAtPrice: "1499",
      variants: [
        { group: "Pack", label: "1 bottle · 30 ml", price: "899", soldOut: false },
        { group: "Pack", label: "Pack of 2 · save ₹300", price: "1499", soldOut: false },
        { group: "Pack", label: "Pack of 3 · best value", price: "1999", soldOut: false },
      ],
      specs: [
        { label: "Volume", value: "30 ml", group: "The basics" },
        { label: "Shelf life", value: "24 months", group: "The basics" },
        { label: "Skin type", value: "All, including oily and acne-prone", group: "The basics" },
        { label: "Key ingredient", value: "Kashmiri saffron (Crocus sativus)", group: "Key ingredients" },
        { label: "Base oil", value: "Cold-pressed sesame (Sesamum indicum)", group: "Key ingredients" },
        { label: "Free from", value: "Parabens, sulphates, mineral oil, synthetic fragrance", group: "Key ingredients" },
      ],
      shopifyProductId: "8123456789012",
      category: "Skincare · Face oil",
    },
    offer: {
      headline: "Flat 40% off the Kumkumadi Radiance Face Oil — this week only",
      discount: "40% OFF",
      discountCode: "GLOW40",
      terms:
        "Offer valid on prepaid and COD orders until stocks last. Discount applies automatically at checkout. Not combinable with other coupons.",
      campaignEndsAt: endsLocal,
      freeShippingThreshold: "499",
      codAvailable: true,
      returnWindowDays: "15",
    },
    proof: {
      rating: "4.6",
      reviewCount: "2184",
      reviews: [
        {
          name: "Ananya Kulkarni",
          location: "Pune, Maharashtra",
          rating: "5",
          date: "2026-06-14",
          title: "Pigmentation is visibly lighter",
          body: "I have had stubborn melasma patches since my second pregnancy. Six weeks of using three drops every night and the patches on my cheeks are genuinely lighter. It absorbs fully, no greasy pillow. Repurchasing the pack of 2.",
          verified: true,
        },
        {
          name: "Ritika Sharma",
          location: "Bengaluru, Karnataka",
          rating: "4",
          date: "2026-05-29",
          title: "Good for oily skin too",
          body: "I was worried an oil would break me out because my T-zone is very oily. It did not. Skin looks less dull in the morning. Taking off a star only because the dropper is a bit slow.",
          verified: true,
        },
        {
          name: "Meera Nair",
          location: "Kochi, Kerala",
          rating: "5",
          date: "2026-06-02",
          title: "Smells like actual saffron",
          body: "You can tell there is real kesar in this. My mother uses it too and her skin looks brighter. Delivery to Kochi took three days with COD, no issues.",
          verified: true,
        },
      ],
      trustBadges: [
        { label: "COD available", sublabel: "All India" },
        { label: "Free shipping", sublabel: "Above ₹499" },
        { label: "15-day returns", sublabel: "No questions" },
        { label: "Secure UPI", sublabel: "GPay · PhonePe" },
      ],
      claims:
        "18,400+ bottles sold since 2023\n89% of users reported a more even tone by week 6 (n=312 self-reported survey)\nMade in a GMP-certified facility in Nashik",
      certifications: "Ayush certified, Cruelty-free, GMP certified",
    },
    audience: {
      description:
        "Women aged 27–45 in Indian metros and tier-2 cities dealing with post-pregnancy pigmentation, sun-induced tanning and dullness. They have tried drugstore vitamin C serums that stung or did nothing, and are cautiously moving toward ayurvedic formulations they associate with their mothers — but they need modern proof, clean-ingredient transparency and a brand that does not look like a temple shop. Price-sensitive above ₹1200 unless a pack discount justifies it. Strong COD preference outside metros.",
      personas: [
        {
          title: "You're 30+ with stubborn pigmentation",
          description:
            "Melasma or post-pregnancy patches that foundation only hides. You want something that works overnight without a dermatologist appointment.",
          recommendedVariant: "Pack of 2",
          painPoints: "Melasma patches, Uneven tone, Foundation caking",
        },
        {
          title: "You're oily and scared of face oils",
          description:
            "Every oil you tried felt heavy and triggered breakouts. You need a non-comedogenic formula that absorbs completely.",
          recommendedVariant: "1 bottle · 30 ml",
          painPoints: "Greasy finish, Breakouts, Clogged pores",
        },
        {
          title: "You're buying for the whole family",
          description:
            "One bottle gets shared between you and your mother. You want the per-bottle cost down and enough supply to last the season.",
          recommendedVariant: "Pack of 3",
          painPoints: "Runs out fast, Cost per bottle",
        },
      ],
      objections:
        "Will an oil break out my oily skin?\nHow long before I actually see a difference?\nIs the saffron real or just colouring?\nCan I use it with retinol or vitamin C?\nWhat if it does not work for me?",
      geoFocus: "Mumbai, Pune, Bengaluru, Delhi NCR, Hyderabad, Tier 2",
    },
    campaign: {
      adHeadline: "Fade pigmentation in 6 weeks — Kumkumadi oil at 40% off",
      adBody:
        "Real Kashmiri saffron, cold-pressed sesame base, 16 classical herbs. 2,184 reviews at 4.6 stars. COD available, free shipping above ₹499.",
      keywords:
        "kumkumadi oil, pigmentation treatment, face oil for dark spots, ayurvedic face oil, saffron face oil",
      platform: "meta",
      temperature: "cold",
      utmCampaign: "kumkumadi_glow40_jul",
      destination: {
        kind: "shopify",
        shopify: {
          productId: "8123456789012",
          variantId: "44987654321098",
          quantity: "1",
          discountCode: "GLOW40",
          mode: "direct-checkout",
        },
        whatsapp: {
          phone: "919876543210",
          messageTemplate:
            "Hi Vanya Naturals! I want to order {{product}} ({{variant}}) at {{price}}. Please confirm COD availability.",
          businessName: "Vanya Naturals",
        },
        form: {
          formId: "kumkumadi-cod-lead",
          fields: [
            { name: "full_name", label: "Name", type: "text", required: true, placeholder: "Your name" },
            { name: "phone", label: "Mobile number", type: "tel", required: true, placeholder: "10-digit mobile" },
            { name: "pincode", label: "Pincode", type: "pincode", required: true, placeholder: "6-digit pincode" },
          ],
          submitLabel: "Book COD order",
          successMessage: "Thanks! Our team will call you within 2 hours to confirm.",
          webhookUrl: "",
        },
        url: { href: "https://vanyanaturals.in/products/kumkumadi-oil", target: "_self", rel: "" },
      },
    },
    style: {
      personality: "premium-minimal",
      referenceNotes:
        "Warm paper background, serif headings, no shouting. Look at Forest Essentials and Kama Ayurveda for restraint, but keep the discount badge legible — this is still a performance page. Avoid temple/mandala iconography and anything that reads as a festival sale. Ingredient photography over model shots.",
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   Draft → Brief. The single coercion boundary.
   ══════════════════════════════════════════════════════════════════════════════ */

/** "" / "abc" → undefined, so Zod reports "required" rather than "expected number". */
function num(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function text(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function commaList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function lineList(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** datetime-local ("2026-07-26T23:59") → ISO 8601 with offset. */
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function buildDestination(destination: Draft["campaign"]["destination"]) {
  switch (destination.kind) {
    case "shopify":
      return {
        kind: "shopify" as const,
        productId: destination.shopify.productId.trim(),
        variantId: text(destination.shopify.variantId),
        quantity: num(destination.shopify.quantity) ?? 1,
        discountCode: text(destination.shopify.discountCode),
        mode: destination.shopify.mode,
      };
    case "whatsapp":
      return {
        kind: "whatsapp" as const,
        phone: destination.whatsapp.phone.replace(/[\s+-]/g, ""),
        messageTemplate: destination.whatsapp.messageTemplate.trim(),
        businessName: text(destination.whatsapp.businessName),
      };
    case "form":
      return {
        kind: "form" as const,
        formId: destination.form.formId.trim(),
        fields: destination.form.fields.map((field) => ({
          name: field.name.trim(),
          label: field.label.trim(),
          type: field.type,
          required: field.required,
          placeholder: text(field.placeholder),
        })),
        submitLabel: destination.form.submitLabel.trim() || "Submit",
        successMessage:
          destination.form.successMessage.trim() || "Thanks! We'll call you shortly.",
        webhookUrl: text(destination.form.webhookUrl),
      };
    case "url":
      return {
        kind: "url" as const,
        href: destination.url.href.trim(),
        target: destination.url.target,
        rel: text(destination.url.rel),
      };
  }
}

function toBrief(draft: Draft) {
  return {
    domain: text(draft.domain),
    brand: {
      name: draft.brand.name.trim(),
      logoUrl: text(draft.brand.logoUrl),
      primaryColor: text(draft.brand.primaryColor),
      accentColor: text(draft.brand.accentColor),
      tagline: text(draft.brand.tagline),
    },
    product: {
      name: draft.product.name.trim(),
      description: draft.product.description.trim(),
      images: draft.product.images
        .filter((image) => image.src.trim() || image.alt.trim())
        .map((image) => ({ src: image.src.trim(), alt: image.alt.trim() })),
      price: num(draft.product.price),
      compareAtPrice: num(draft.product.compareAtPrice),
      currency: "INR" as const,
      variants: draft.product.variants.map((variant) => ({
        group: variant.group.trim(),
        label: variant.label.trim(),
        price: num(variant.price),
        soldOut: variant.soldOut,
      })),
      specs: draft.product.specs.map((spec) => ({
        label: spec.label.trim(),
        value: spec.value.trim(),
        group: text(spec.group),
      })),
      shopifyProductId: text(draft.product.shopifyProductId),
      category: text(draft.product.category),
    },
    offer: {
      headline: draft.offer.headline.trim(),
      discount: text(draft.offer.discount),
      discountCode: text(draft.offer.discountCode)?.toUpperCase(),
      terms: text(draft.offer.terms),
      campaignEndsAt: toIso(draft.offer.campaignEndsAt),
      freeShippingThreshold: num(draft.offer.freeShippingThreshold),
      codAvailable: draft.offer.codAvailable,
      returnWindowDays: num(draft.offer.returnWindowDays),
    },
    proof: {
      rating: num(draft.proof.rating),
      reviewCount: num(draft.proof.reviewCount),
      reviews: draft.proof.reviews.map((review) => ({
        name: review.name.trim(),
        location: text(review.location),
        rating: num(review.rating),
        date: text(review.date),
        title: text(review.title),
        body: review.body.trim(),
        verified: review.verified,
        photoUrls: [],
      })),
      trustBadges: draft.proof.trustBadges.map((badge) => ({
        label: badge.label.trim(),
        sublabel: text(badge.sublabel),
      })),
      claims: lineList(draft.proof.claims),
      certifications: commaList(draft.proof.certifications),
    },
    audience: {
      description: draft.audience.description.trim(),
      personas: draft.audience.personas.map((persona) => ({
        title: persona.title.trim(),
        description: persona.description.trim(),
        recommendedVariant: text(persona.recommendedVariant),
        painPoints: commaList(persona.painPoints),
      })),
      objections: lineList(draft.audience.objections),
      geoFocus: commaList(draft.audience.geoFocus),
    },
    campaign: {
      adHeadline: draft.campaign.adHeadline.trim(),
      adBody: text(draft.campaign.adBody),
      keywords: commaList(draft.campaign.keywords),
      destination: buildDestination(draft.campaign.destination),
      platform: draft.campaign.platform,
      temperature: draft.campaign.temperature,
      utmCampaign: text(draft.campaign.utmCampaign),
    },
    style: {
      personality: draft.style.personality,
      referenceNotes: text(draft.style.referenceNotes),
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   Steps
   ══════════════════════════════════════════════════════════════════════════════ */

const STEPS = [
  { id: "brand", title: "Brand", description: "Who is selling, and in what colours." },
  { id: "product", title: "Product", description: "What is being sold, at what price." },
  { id: "offer", title: "Offer", description: "The promise the ad made." },
  { id: "proof", title: "Proof", description: "Why a stranger should believe you." },
  { id: "audience", title: "Audience", description: "Who is landing here, and why." },
  { id: "campaign", title: "Campaign", description: "Message match, and the one action." },
  { id: "style", title: "Style", description: "How it should feel." },
] as const satisfies readonly (StepDefinition & { id: keyof Draft })[];

type StepId = (typeof STEPS)[number]["id"];

const SECTION_SCHEMAS: Record<StepId, ZodType> = {
  brand: BriefBrandSchema,
  product: BriefProductSchema,
  offer: BriefOfferSchema,
  proof: BriefProofSchema,
  audience: BriefAudienceSchema,
  campaign: BriefCampaignSchema,
  style: BriefStyleSchema,
};

/** Zod issue list → { "images.0.src": "message" } for direct field lookup. */
type ErrorMap = Record<string, string>;

function issuesToErrors(issues: readonly { path: PropertyKey[]; message: string }[]): ErrorMap {
  const errors: ErrorMap = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".");
    // Keep the first message per path — it is the most specific.
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

const DRAFT_STORAGE_KEY = "landing-agent:brief-draft";

const GENERATION_STAGES = [
  "Reading the brief",
  "Choosing blocks from the registry",
  "Writing copy that matches your ad",
  "Validating against the page schema",
  "Saving the page",
] as const;

/* ══════════════════════════════════════════════════════════════════════════════
   Screen
   ══════════════════════════════════════════════════════════════════════════════ */

export default function NewBriefPage() {
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [status, setStatus] = useState<"idle" | "generating" | "failed">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const [stage, setStage] = useState(0);

  const step = STEPS[stepIndex];

  /* ── Draft persistence ──────────────────────────────────────────────────── */

  useEffect(() => {
    // Restoring persisted state after hydration is the one case where an effect
    // must call setState. The alternative — a lazy `useState` initialiser — runs
    // during the SSR render where `sessionStorage` does not exist, and reading it
    // only on the client produces a hydration mismatch on every controlled input.
    // This fires once, on mount, so there is no cascading-render risk.
    try {
      const stored = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      if (stored) setDraft(JSON.parse(stored) as Draft);
    } catch {
      /* corrupt or unavailable storage — start clean */
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* quota or private mode — persistence is a convenience, not a requirement */
    }
  }, [draft]);

  /* ── Generation progress ticker ─────────────────────────────────────────── */

  useEffect(() => {
    if (status !== "generating") return;
    // `stage` is reset in handleSubmit, at the same moment status flips — resetting
    // it here instead would be a synchronous setState inside the effect body.
    const timer = window.setInterval(() => {
      // Park on the last stage rather than looping — a loop reads as a hang.
      setStage((current) => Math.min(current + 1, GENERATION_STAGES.length - 1));
    }, 2200);
    return () => window.clearInterval(timer);
  }, [status]);

  /* ── Section updaters ───────────────────────────────────────────────────── */

  // `domain` is a top-level string, not a section object, so it is excluded here —
  // it has its own `setDomain` setter below.
  const patch = useCallback(
    <K extends Exclude<keyof Draft, "domain">>(section: K, changes: Partial<Draft[K]>) => {
      setDraft((current) => ({ ...current, [section]: { ...current[section], ...changes } }));
    },
    [],
  );

  const setBrand = useCallback(
    (changes: Partial<Draft["brand"]>) => patch("brand", changes),
    [patch],
  );
  const setProduct = useCallback(
    (changes: Partial<Draft["product"]>) => patch("product", changes),
    [patch],
  );
  const setOffer = useCallback(
    (changes: Partial<Draft["offer"]>) => patch("offer", changes),
    [patch],
  );
  const setProof = useCallback(
    (changes: Partial<Draft["proof"]>) => patch("proof", changes),
    [patch],
  );
  const setAudience = useCallback(
    (changes: Partial<Draft["audience"]>) => patch("audience", changes),
    [patch],
  );
  const setCampaign = useCallback(
    (changes: Partial<Draft["campaign"]>) => patch("campaign", changes),
    [patch],
  );
  const setStyle = useCallback(
    (changes: Partial<Draft["style"]>) => patch("style", changes),
    [patch],
  );

  // `domain` is a top-level string, not a section object, so it gets its own setter
  // rather than going through `patch`.
  const setDomain = useCallback((next: string) => {
    setDraft((current) => ({ ...current, domain: next }));
  }, []);

  const setDestination = useCallback(
    (changes: Partial<Draft["campaign"]["destination"]>) => {
      setDraft((current) => ({
        ...current,
        campaign: {
          ...current.campaign,
          destination: { ...current.campaign.destination, ...changes },
        },
      }));
    },
    [],
  );

  /* ── Navigation ─────────────────────────────────────────────────────────── */

  const brief = useMemo(() => toBrief(draft), [draft]);

  const validateStep = useCallback(
    (index: number): boolean => {
      const id = STEPS[index].id;
      const result = SECTION_SCHEMAS[id].safeParse(brief[id]);
      setErrors(result.success ? {} : issuesToErrors(result.error.issues));
      return result.success;
    },
    [brief],
  );

  const goTo = useCallback((index: number) => {
    setErrors({});
    setStepIndex(index);
    setFurthest((current) => Math.max(current, index));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleNext = useCallback(() => {
    if (!validateStep(stepIndex)) return;
    if (stepIndex < STEPS.length - 1) goTo(stepIndex + 1);
  }, [goTo, stepIndex, validateStep]);

  const handleBack = useCallback(() => {
    // Never validate on the way back — a marketer must be able to retreat from a
    // half-filled step to check something.
    if (stepIndex > 0) goTo(stepIndex - 1);
  }, [goTo, stepIndex]);

  const handleFillSample = useCallback(() => {
    setDraft(sampleDraft());
    setErrors({});
    setFurthest(STEPS.length - 1);
  }, []);

  const handleReset = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setStepIndex(0);
    setFurthest(0);
  }, []);

  /* ── Submit ─────────────────────────────────────────────────────────────── */

  const handleSubmit = useCallback(async () => {
    const parsed = BriefSchema.safeParse(brief);

    if (!parsed.success) {
      // Jump to the earliest offending step and show its errors in place, rather
      // than dumping a wall of paths at the end of the wizard.
      const sections = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
      const firstBadStep = STEPS.findIndex((entry) => sections.has(entry.id));
      const target = firstBadStep === -1 ? 0 : firstBadStep;

      const scoped = parsed.error.issues
        .filter((issue) => String(issue.path[0]) === STEPS[target].id)
        .map((issue) => ({ path: issue.path.slice(1), message: issue.message }));

      setStepIndex(target);
      setErrors(issuesToErrors(scoped));
      setFailure("Some required details are still missing. We've jumped you to them.");
      setStatus("failed");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setStage(0);
    setStatus("generating");
    setFailure(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: parsed.data }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          detail.slice(0, 400) || `Generation failed with status ${response.status}`,
        );
      }

      const payload: unknown = await response.json();
      const record = (payload ?? {}) as Record<string, unknown>;
      const page = (record.page ?? {}) as Record<string, unknown>;
      const pageId = String(page.id ?? record.id ?? record.pageId ?? "");

      if (!pageId) {
        throw new Error("Generation succeeded but returned no page id.");
      }

      // The brief is committed — clear the scratch draft so the next "New page"
      // starts blank rather than resurrecting this one.
      try {
        window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        /* ignore */
      }

      router.push(`/editor/${pageId}`);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Generation failed.");
      setStatus("failed");
    }
  }, [brief, router]);

  /* ── Generation takeover ────────────────────────────────────────────────── */

  if (status === "generating") {
    return <GenerationProgress stage={stage} brandName={draft.brand.name} />;
  }

  const isLastStep = stepIndex === STEPS.length - 1;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[var(--container-page)] flex-wrap items-center gap-3 px-[var(--space-gutter)] py-3">
          <Link
            href="/"
            className={buttonStyles({ variant: "ghost", size: "sm", className: "-ml-2" })}
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <span className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Clear
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleFillSample}
              icon={<Wand2 className="size-4" />}
            >
              Fill with sample data
            </Button>
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[var(--container-page)] flex-1 px-[var(--space-gutter)] py-6 sm:py-10">
        <div className="flex flex-col gap-1">
          <p className="font-body text-xs font-semibold tracking-widest text-primary uppercase">
            New landing page
          </p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-fg-strong sm:text-4xl">
            Campaign brief
          </h1>
        </div>

        <Stepper
          steps={STEPS}
          current={stepIndex}
          furthest={furthest}
          onStepSelect={goTo}
          className="mt-6 sm:mt-8"
        />

        {status === "failed" && failure ? (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-lg border border-danger bg-danger-soft p-4"
          >
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger-fg" aria-hidden />
            <div>
              <p className="font-body text-sm font-semibold text-danger-fg">
                Could not generate the page
              </p>
              <p className="mt-0.5 font-body text-sm text-danger-fg">{failure}</p>
            </div>
          </div>
        ) : null}

        <Card className="mt-6">
          <CardBody className="gap-6 sm:gap-7">
            <div className="hidden flex-col gap-1 md:flex">
              <h2 className="font-heading text-2xl font-extrabold tracking-tight text-fg-strong">
                {step.title}
              </h2>
              <p className="font-body text-sm text-muted-fg">{step.description}</p>
            </div>

            {step.id === "brand" ? (
              <BrandStep
                value={draft.brand}
                onChange={setBrand}
                errors={errors}
                domain={draft.domain}
                onDomainChange={setDomain}
              />
            ) : null}
            {step.id === "product" ? (
              <ProductStep value={draft.product} onChange={setProduct} errors={errors} />
            ) : null}
            {step.id === "offer" ? (
              <OfferStep value={draft.offer} onChange={setOffer} errors={errors} />
            ) : null}
            {step.id === "proof" ? (
              <ProofStep value={draft.proof} onChange={setProof} errors={errors} />
            ) : null}
            {step.id === "audience" ? (
              <AudienceStep value={draft.audience} onChange={setAudience} errors={errors} />
            ) : null}
            {step.id === "campaign" ? (
              <CampaignStep
                value={draft.campaign}
                onChange={setCampaign}
                onDestinationChange={setDestination}
                errors={errors}
              />
            ) : null}
            {step.id === "style" ? (
              <StyleStep value={draft.style} onChange={setStyle} errors={errors} />
            ) : null}
          </CardBody>
        </Card>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="secondary"
            onClick={handleBack}
            disabled={stepIndex === 0}
            icon={<ArrowLeft className="size-4" />}
          >
            Back
          </Button>

          {isLastStep ? (
            <Button
              size="lg"
              onClick={handleSubmit}
              icon={<Sparkles className="size-5" />}
              fullWidth
              className="sm:w-auto"
            >
              Generate landing page
            </Button>
          ) : (
            <Button onClick={handleNext} fullWidth className="sm:w-auto">
              Next: {STEPS[stepIndex + 1].title}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Shared step scaffolding
   ══════════════════════════════════════════════════════════════════════════════ */

interface StepProps<T> {
  value: T;
  onChange: (changes: Partial<T>) => void;
  errors: ErrorMap;
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-border pt-5">
      <legend className="sr-only">{legend}</legend>
      <div className="flex flex-col gap-0.5">
        <p className="font-heading text-base font-bold tracking-tight text-fg-strong">
          {legend}
        </p>
        {hint ? <FieldHint>{hint}</FieldHint> : null}
      </div>
      {children}
    </fieldset>
  );
}

/** Repeatable list shell — add / remove / empty state, consistent everywhere. */
function Repeater({
  items,
  addLabel,
  emptyLabel,
  onAdd,
  onRemove,
  max,
  renderItem,
  itemLabel,
}: {
  items: unknown[];
  addLabel: string;
  emptyLabel: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  max: number;
  itemLabel: (index: number) => string;
  renderItem: (index: number) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-surface-sunken px-4 py-5 text-center font-body text-sm text-muted-fg">
          {emptyLabel}
        </p>
      ) : null}

      {items.map((_, index) => (
        <div
          key={index}
          className="relative rounded-lg border border-border bg-surface-sunken p-4 pr-14"
        >
          <p className="mb-3 font-body text-xs font-semibold tracking-wide text-muted-fg uppercase">
            {itemLabel(index)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${itemLabel(index)}`}
            title="Remove"
            className="absolute top-3 right-3 size-11 p-0 text-danger-fg"
          >
            <Trash2 className="size-4" />
          </Button>
          <div className="flex flex-col gap-4">{renderItem(index)}</div>
        </div>
      ))}

      {items.length < max ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onAdd}
          icon={<Plus className="size-4" />}
          className="self-start"
        >
          {addLabel}
        </Button>
      ) : (
        <FieldHint>Maximum of {max} reached.</FieldHint>
      )}
    </div>
  );
}

function replaceAt<T>(items: T[], index: number, changes: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...changes } : item));
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

/** Checkbox with a 44px hit area. */
function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-body text-sm font-semibold text-fg-strong">{label}</span>
        {hint ? <span className="font-body text-xs text-muted-fg">{hint}</span> : null}
      </span>
    </label>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Step 1 — Brand
   ══════════════════════════════════════════════════════════════════════════════ */

function ColorField({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} colour picker`}
          className="size-11 shrink-0 cursor-pointer rounded-md border border-border bg-surface p-1"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#e4572e"
          aria-label={`${label} value`}
          wrapperClassName="flex-1"
          className="font-mono"
        />
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

/** Sentinel select value that reveals the free-text vertical input. */
const DOMAIN_OTHER = "__other__";

/** "baby_kids" → "Baby Kids". Display only — the stored value is left untouched. */
function prettyDomain(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Market-vertical picker. A native select backed by DOMAIN_OPTIONS, plus an
 * "Other" escape hatch that reveals a free-text input for a vertical not in the
 * list. The field is OPTIONAL — an empty value maps to the generator's generic
 * fallback, so "Not specified" stays re-selectable (it is not a disabled placeholder).
 */
function DomainField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const isListed = DOMAIN_OPTIONS.some((option) => option.value === value);
  // "Other" is active when the user picks it, or when a restored draft carries a
  // custom (non-empty, non-listed) vertical.
  const [other, setOther] = useState(value !== "" && !isListed);

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="Market / vertical"
        value={other ? DOMAIN_OTHER : value}
        onChange={(event) => {
          const next = event.target.value;
          if (next === DOMAIN_OTHER) {
            setOther(true);
            onChange("");
          } else {
            setOther(false);
            onChange(next);
          }
        }}
        hint="Pick the market your product sells in — the page is optimized differently for each. Not listed? Type your own."
      >
        <option value="">Not specified</option>
        {DOMAIN_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {prettyDomain(option.label)}
          </option>
        ))}
        <option value={DOMAIN_OTHER}>Other — type your own</option>
      </Select>

      {other ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="e.g. pet care, stationery, travel"
          aria-label="Custom vertical"
          maxLength={60}
        />
      ) : null}
    </div>
  );
}

function BrandStep({
  value,
  onChange,
  errors,
  domain,
  onDomainChange,
}: StepProps<Draft["brand"]> & {
  domain: string;
  onDomainChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <DomainField value={domain} onChange={onDomainChange} />

      <Input
        label="Brand name"
        requiredMark
        value={value.name}
        onChange={(event) => onChange({ name: event.target.value })}
        error={errors.name}
        placeholder="Vanya Naturals"
        maxLength={60}
        autoFocus
      />

      <Input
        label="Logo URL"
        value={value.logoUrl}
        onChange={(event) => onChange({ logoUrl: event.target.value })}
        error={errors.logoUrl}
        placeholder="https://cdn.yourbrand.in/logo.png"
        hint="Paste a hosted URL, or a /public path if the asset ships with the app."
        inputMode="url"
      />

      <FieldRow>
        <ColorField
          label="Primary colour"
          value={value.primaryColor}
          onChange={(next) => onChange({ primaryColor: next })}
          error={errors.primaryColor}
          hint="Drives CTAs, badges and the whole brand ramp."
        />
        <ColorField
          label="Accent colour"
          value={value.accentColor}
          onChange={(next) => onChange({ accentColor: next })}
          error={errors.accentColor}
          hint="Trust signals — COD, UPI, secure-checkout marks."
        />
      </FieldRow>

      <Input
        label="Tagline"
        value={value.tagline}
        onChange={(event) => onChange({ tagline: event.target.value })}
        error={errors.tagline}
        placeholder="Ayurveda, made for modern Indian skin"
        maxLength={120}
        aside={`${value.tagline.length}/120`}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Step 2 — Product
   ══════════════════════════════════════════════════════════════════════════════ */

function ProductStep({ value, onChange, errors }: StepProps<Draft["product"]>) {
  const price = Number(value.price);
  const compareAt = Number(value.compareAtPrice);
  const showDiscount =
    Number.isFinite(price) && Number.isFinite(compareAt) && compareAt > price && price > 0;
  const discountPct = showDiscount
    ? Math.floor(((compareAt - price) / compareAt) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Product name"
        requiredMark
        value={value.name}
        onChange={(event) => onChange({ name: event.target.value })}
        error={errors.name}
        placeholder="Kumkumadi Radiance Face Oil"
        maxLength={80}
        autoFocus
      />

      <Textarea
        label="Description"
        requiredMark
        value={value.description}
        onChange={(event) => onChange({ description: event.target.value })}
        error={errors.description}
        placeholder="What it is, who it is for, how it is used, and what result to expect."
        maxLength={2000}
        counter
        rows={6}
        hint="Raw brand copy is fine — the generator rewrites it into blocks."
      />

      <FieldRow>
        <Input
          label="Price"
          requiredMark
          value={value.price}
          onChange={(event) => onChange({ price: event.target.value })}
          error={errors.price}
          placeholder="899"
          inputMode="numeric"
          prefix="₹"
          hint="Whole rupees. The generator converts to paise."
        />
        <Input
          label="Compare-at price (MRP)"
          value={value.compareAtPrice}
          onChange={(event) => onChange({ compareAtPrice: event.target.value })}
          error={errors.compareAtPrice}
          placeholder="1499"
          inputMode="numeric"
          prefix="₹"
          hint={
            showDiscount
              ? `${discountPct}% off · saves ${formatINR(compareAt - price)}`
              : "Must exceed the selling price to render a discount badge."
          }
        />
      </FieldRow>

      <FieldRow>
        <Input
          label="Category"
          value={value.category}
          onChange={(event) => onChange({ category: event.target.value })}
          error={errors.category}
          placeholder="Skincare · Face oil"
          maxLength={60}
        />
        <Input
          label="Shopify product ID or handle"
          value={value.shopifyProductId}
          onChange={(event) => onChange({ shopifyProductId: event.target.value })}
          error={errors.shopifyProductId}
          placeholder="8123456789012"
          hint="Only needed when the destination is Shopify."
        />
      </FieldRow>

      <Fieldset
        legend="Images"
        hint="The first image is the hero and the LCP element — make it the strongest product shot. Alt text is required by both accessibility and Meta/Google ad review."
      >
        {errors.images ? <FieldError>{errors.images}</FieldError> : null}
        <Repeater
          items={value.images}
          max={12}
          addLabel="Add image"
          emptyLabel="No images yet. At least one is required."
          itemLabel={(index) => (index === 0 ? "Hero image" : `Image ${index + 1}`)}
          onAdd={() => onChange({ images: [...value.images, { src: "", alt: "" }] })}
          onRemove={(index) => onChange({ images: removeAt(value.images, index) })}
          renderItem={(index) => (
            <>
              <Input
                label="Image URL"
                requiredMark
                value={value.images[index].src}
                onChange={(event) =>
                  onChange({
                    images: replaceAt(value.images, index, { src: event.target.value }),
                  })
                }
                error={errors[`images.${index}.src`]}
                placeholder="https://cdn.yourbrand.in/product/hero.jpg"
                inputMode="url"
              />
              <Input
                label="Alt text"
                requiredMark
                value={value.images[index].alt}
                onChange={(event) =>
                  onChange({
                    images: replaceAt(value.images, index, { alt: event.target.value }),
                  })
                }
                error={errors[`images.${index}.alt`]}
                placeholder="30 ml amber glass bottle with dropper"
                maxLength={125}
              />
            </>
          )}
        />
      </Fieldset>

      <Fieldset
        legend="Variants"
        hint="Packs, sizes or shades. Leave empty for a single-SKU page."
      >
        <Repeater
          items={value.variants}
          max={24}
          addLabel="Add variant"
          emptyLabel="No variants — this page sells one SKU."
          itemLabel={(index) => `Variant ${index + 1}`}
          onAdd={() =>
            onChange({
              variants: [
                ...value.variants,
                { group: "Pack", label: "", price: "", soldOut: false },
              ],
            })
          }
          onRemove={(index) => onChange({ variants: removeAt(value.variants, index) })}
          renderItem={(index) => (
            <>
              <FieldRow>
                <Input
                  label="Group"
                  requiredMark
                  value={value.variants[index].group}
                  onChange={(event) =>
                    onChange({
                      variants: replaceAt(value.variants, index, {
                        group: event.target.value,
                      }),
                    })
                  }
                  error={errors[`variants.${index}.group`]}
                  placeholder="Pack"
                  maxLength={40}
                />
                <Input
                  label="Label"
                  requiredMark
                  value={value.variants[index].label}
                  onChange={(event) =>
                    onChange({
                      variants: replaceAt(value.variants, index, {
                        label: event.target.value,
                      }),
                    })
                  }
                  error={errors[`variants.${index}.label`]}
                  placeholder="Pack of 2 · save ₹300"
                  maxLength={48}
                />
              </FieldRow>
              <FieldRow>
                <Input
                  label="Price"
                  value={value.variants[index].price}
                  onChange={(event) =>
                    onChange({
                      variants: replaceAt(value.variants, index, {
                        price: event.target.value,
                      }),
                    })
                  }
                  error={errors[`variants.${index}.price`]}
                  placeholder="1499"
                  inputMode="numeric"
                  prefix="₹"
                  hint="Only when it differs from the base price."
                />
                <div className="flex items-end">
                  <Checkbox
                    checked={value.variants[index].soldOut}
                    onChange={(next) =>
                      onChange({
                        variants: replaceAt(value.variants, index, { soldOut: next }),
                      })
                    }
                    label="Sold out"
                  />
                </div>
              </FieldRow>
            </>
          )}
        />
      </Fieldset>

      <Fieldset
        legend="Specs"
        hint="Feeds the spec table. Group related rows to keep it scannable on mobile."
      >
        <Repeater
          items={value.specs}
          max={40}
          addLabel="Add spec"
          emptyLabel="No specs yet."
          itemLabel={(index) => `Spec ${index + 1}`}
          onAdd={() =>
            onChange({ specs: [...value.specs, { label: "", value: "", group: "" }] })
          }
          onRemove={(index) => onChange({ specs: removeAt(value.specs, index) })}
          renderItem={(index) => (
            <FieldRow>
              <Input
                label="Label"
                requiredMark
                value={value.specs[index].label}
                onChange={(event) =>
                  onChange({
                    specs: replaceAt(value.specs, index, { label: event.target.value }),
                  })
                }
                error={errors[`specs.${index}.label`]}
                placeholder="Volume"
                maxLength={40}
              />
              <Input
                label="Value"
                requiredMark
                value={value.specs[index].value}
                onChange={(event) =>
                  onChange({
                    specs: replaceAt(value.specs, index, { value: event.target.value }),
                  })
                }
                error={errors[`specs.${index}.value`]}
                placeholder="30 ml"
                maxLength={160}
              />
              <Input
                label="Group"
                value={value.specs[index].group}
                onChange={(event) =>
                  onChange({
                    specs: replaceAt(value.specs, index, { group: event.target.value }),
                  })
                }
                error={errors[`specs.${index}.group`]}
                placeholder="The basics"
                maxLength={48}
                wrapperClassName="sm:col-span-2"
              />
            </FieldRow>
          )}
        />
      </Fieldset>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Step 3 — Offer
   ══════════════════════════════════════════════════════════════════════════════ */

function OfferStep({ value, onChange, errors }: StepProps<Draft["offer"]>) {
  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Offer headline"
        requiredMark
        value={value.headline}
        onChange={(event) => onChange({ headline: event.target.value })}
        error={errors.headline}
        placeholder="Flat 40% off — this week only"
        maxLength={90}
        aside={`${value.headline.length}/90`}
        hint="The promise the ad made. This runs in the announcement bar, so it must match the ad word for word in substance."
        autoFocus
      />

      <FieldRow>
        <Input
          label="Discount"
          value={value.discount}
          onChange={(event) => onChange({ discount: event.target.value })}
          error={errors.discount}
          placeholder="40% OFF"
          maxLength={48}
          hint="Free text — “40% OFF” or “Buy 2 Get 1” both work."
        />
        <Input
          label="Discount code"
          value={value.discountCode}
          onChange={(event) => onChange({ discountCode: event.target.value.toUpperCase() })}
          error={errors.discountCode}
          placeholder="GLOW40"
          className="font-mono uppercase"
          hint="A–Z, 0–9, _ or -. Auto-applied at checkout."
        />
      </FieldRow>

      <Input
        label="Campaign ends at"
        type="datetime-local"
        value={value.campaignEndsAt}
        onChange={(event) => onChange({ campaignEndsAt: event.target.value })}
        error={errors.campaignEndsAt}
        hint="Drives the fixed-deadline countdown. Leave empty for no countdown — a timer that expires mid-campaign costs more than it earns."
      />

      <Textarea
        label="Terms"
        value={value.terms}
        onChange={(event) => onChange({ terms: event.target.value })}
        error={errors.terms}
        placeholder="Valid on prepaid and COD orders until stocks last."
        maxLength={300}
        counter
        rows={3}
      />

      <Fieldset legend="Indian commerce defaults" hint="These drive the trust bar and the offer stack.">
        <FieldRow>
          <Input
            label="Free shipping above"
            value={value.freeShippingThreshold}
            onChange={(event) => onChange({ freeShippingThreshold: event.target.value })}
            error={errors.freeShippingThreshold}
            placeholder="499"
            inputMode="numeric"
            prefix="₹"
          />
          <Input
            label="Return window"
            value={value.returnWindowDays}
            onChange={(event) => onChange({ returnWindowDays: event.target.value })}
            error={errors.returnWindowDays}
            placeholder="15"
            inputMode="numeric"
            hint="In days. 0–90."
          />
        </FieldRow>
        <Checkbox
          checked={value.codAvailable}
          onChange={(next) => onChange({ codAvailable: next })}
          label="Cash on delivery available"
          hint="COD availability is the single strongest trust signal outside metros. Turn it off only if it genuinely is not offered."
        />
      </Fieldset>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Step 4 — Proof
   ══════════════════════════════════════════════════════════════════════════════ */

function ProofStep({ value, onChange, errors }: StepProps<Draft["proof"]>) {
  return (
    <div className="flex flex-col gap-5">
      <FieldRow>
        <Input
          label="Average rating"
          value={value.rating}
          onChange={(event) => onChange({ rating: event.target.value })}
          error={errors.rating}
          placeholder="4.6"
          inputMode="decimal"
          hint="0–5, one decimal."
          autoFocus
        />
        <Input
          label="Review count"
          value={value.reviewCount}
          onChange={(event) => onChange({ reviewCount: event.target.value })}
          error={errors.reviewCount}
          placeholder="2184"
          inputMode="numeric"
        />
      </FieldRow>

      <Fieldset
        legend="Reviews"
        hint="Paste real reviews. City and state matter in India — “Pune, Maharashtra” converts better than an unplaced name."
      >
        <Repeater
          items={value.reviews}
          max={40}
          addLabel="Add review"
          emptyLabel="No reviews yet. The review wall needs at least a few to be worth rendering."
          itemLabel={(index) => `Review ${index + 1}`}
          onAdd={() =>
            onChange({
              reviews: [
                ...value.reviews,
                {
                  name: "",
                  location: "",
                  rating: "5",
                  date: "",
                  title: "",
                  body: "",
                  verified: true,
                },
              ],
            })
          }
          onRemove={(index) => onChange({ reviews: removeAt(value.reviews, index) })}
          renderItem={(index) => (
            <>
              <FieldRow>
                <Input
                  label="Name"
                  requiredMark
                  value={value.reviews[index].name}
                  onChange={(event) =>
                    onChange({
                      reviews: replaceAt(value.reviews, index, { name: event.target.value }),
                    })
                  }
                  error={errors[`reviews.${index}.name`]}
                  placeholder="Ananya Kulkarni"
                  maxLength={40}
                />
                <Input
                  label="Location"
                  value={value.reviews[index].location}
                  onChange={(event) =>
                    onChange({
                      reviews: replaceAt(value.reviews, index, {
                        location: event.target.value,
                      }),
                    })
                  }
                  error={errors[`reviews.${index}.location`]}
                  placeholder="Pune, Maharashtra"
                  maxLength={40}
                />
              </FieldRow>
              <FieldRow>
                <Select
                  label="Rating"
                  value={value.reviews[index].rating}
                  onChange={(event) =>
                    onChange({
                      reviews: replaceAt(value.reviews, index, {
                        rating: event.target.value,
                      }),
                    })
                  }
                  error={errors[`reviews.${index}.rating`]}
                  options={[
                    { value: "5", label: "5 — Excellent" },
                    { value: "4", label: "4 — Good" },
                    { value: "3", label: "3 — Average" },
                    { value: "2", label: "2 — Poor" },
                    { value: "1", label: "1 — Bad" },
                  ]}
                />
                <Input
                  label="Date"
                  type="date"
                  value={value.reviews[index].date}
                  onChange={(event) =>
                    onChange({
                      reviews: replaceAt(value.reviews, index, { date: event.target.value }),
                    })
                  }
                  error={errors[`reviews.${index}.date`]}
                />
              </FieldRow>
              <Input
                label="Title"
                value={value.reviews[index].title}
                onChange={(event) =>
                  onChange({
                    reviews: replaceAt(value.reviews, index, { title: event.target.value }),
                  })
                }
                error={errors[`reviews.${index}.title`]}
                placeholder="Pigmentation is visibly lighter"
                maxLength={60}
              />
              <Textarea
                label="Review"
                requiredMark
                value={value.reviews[index].body}
                onChange={(event) =>
                  onChange({
                    reviews: replaceAt(value.reviews, index, { body: event.target.value }),
                  })
                }
                error={errors[`reviews.${index}.body`]}
                maxLength={600}
                counter
                rows={3}
              />
              <Checkbox
                checked={value.reviews[index].verified}
                onChange={(next) =>
                  onChange({
                    reviews: replaceAt(value.reviews, index, { verified: next }),
                  })
                }
                label="Verified purchase"
              />
            </>
          )}
        />
      </Fieldset>

      <Fieldset legend="Trust badges" hint="Short, concrete, and true. These run in the trust bar.">
        <Repeater
          items={value.trustBadges}
          max={10}
          addLabel="Add badge"
          emptyLabel="No trust badges yet."
          itemLabel={(index) => `Badge ${index + 1}`}
          onAdd={() =>
            onChange({ trustBadges: [...value.trustBadges, { label: "", sublabel: "" }] })
          }
          onRemove={(index) => onChange({ trustBadges: removeAt(value.trustBadges, index) })}
          renderItem={(index) => (
            <FieldRow>
              <Input
                label="Label"
                requiredMark
                value={value.trustBadges[index].label}
                onChange={(event) =>
                  onChange({
                    trustBadges: replaceAt(value.trustBadges, index, {
                      label: event.target.value,
                    }),
                  })
                }
                error={errors[`trustBadges.${index}.label`]}
                placeholder="COD available"
                maxLength={24}
              />
              <Input
                label="Sublabel"
                value={value.trustBadges[index].sublabel}
                onChange={(event) =>
                  onChange({
                    trustBadges: replaceAt(value.trustBadges, index, {
                      sublabel: event.target.value,
                    }),
                  })
                }
                error={errors[`trustBadges.${index}.sublabel`]}
                placeholder="All India"
                maxLength={32}
              />
            </FieldRow>
          )}
        />
      </Fieldset>

      <Textarea
        label="Claims"
        value={value.claims}
        onChange={(event) => onChange({ claims: event.target.value })}
        error={errors.claims}
        placeholder={"18,400+ bottles sold since 2023\n89% reported a more even tone by week 6"}
        rows={4}
        hint="One per line. Only claims the brand can actually evidence — unattributed numbers are flagged by the validator."
      />

      <Input
        label="Certifications"
        value={value.certifications}
        onChange={(event) => onChange({ certifications: event.target.value })}
        error={errors.certifications}
        placeholder="Ayush certified, Cruelty-free, GMP certified"
        hint="Comma-separated."
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Step 5 — Audience
   ══════════════════════════════════════════════════════════════════════════════ */

function AudienceStep({ value, onChange, errors }: StepProps<Draft["audience"]>) {
  return (
    <div className="flex flex-col gap-5">
      <Textarea
        label="Audience description"
        requiredMark
        value={value.description}
        onChange={(event) => onChange({ description: event.target.value })}
        error={errors.description}
        placeholder="Who is clicking this ad, what they have already tried, what they are afraid of, and what they will pay."
        maxLength={600}
        counter
        rows={5}
        autoFocus
      />

      <Input
        label="Geo focus"
        value={value.geoFocus}
        onChange={(event) => onChange({ geoFocus: event.target.value })}
        error={errors.geoFocus}
        placeholder="Mumbai, Pune, Bengaluru, Tier 2"
        hint="Comma-separated."
      />

      <Textarea
        label="Objections"
        value={value.objections}
        onChange={(event) => onChange({ objections: event.target.value })}
        error={errors.objections}
        placeholder={"Will an oil break out my oily skin?\nHow long before I see a difference?"}
        rows={4}
        hint="One per line. Every one of these must be answered above the final CTA."
      />

      <Fieldset
        legend="Personas"
        hint="Written in second person — “You're 30+ with stubborn pigmentation”. Each persona can route to a different variant."
      >
        <Repeater
          items={value.personas}
          max={4}
          addLabel="Add persona"
          emptyLabel="No personas yet. Up to four."
          itemLabel={(index) => `Persona ${index + 1}`}
          onAdd={() =>
            onChange({
              personas: [
                ...value.personas,
                { title: "", description: "", recommendedVariant: "", painPoints: "" },
              ],
            })
          }
          onRemove={(index) => onChange({ personas: removeAt(value.personas, index) })}
          renderItem={(index) => (
            <>
              <Input
                label="Title"
                requiredMark
                value={value.personas[index].title}
                onChange={(event) =>
                  onChange({
                    personas: replaceAt(value.personas, index, { title: event.target.value }),
                  })
                }
                error={errors[`personas.${index}.title`]}
                placeholder="You're 30+ with stubborn pigmentation"
                maxLength={52}
              />
              <Textarea
                label="Description"
                requiredMark
                value={value.personas[index].description}
                onChange={(event) =>
                  onChange({
                    personas: replaceAt(value.personas, index, {
                      description: event.target.value,
                    }),
                  })
                }
                error={errors[`personas.${index}.description`]}
                maxLength={300}
                counter
                rows={3}
              />
              <FieldRow>
                <Input
                  label="Recommended variant"
                  value={value.personas[index].recommendedVariant}
                  onChange={(event) =>
                    onChange({
                      personas: replaceAt(value.personas, index, {
                        recommendedVariant: event.target.value,
                      }),
                    })
                  }
                  error={errors[`personas.${index}.recommendedVariant`]}
                  placeholder="Pack of 2"
                  maxLength={48}
                />
                <Input
                  label="Pain points"
                  value={value.personas[index].painPoints}
                  onChange={(event) =>
                    onChange({
                      personas: replaceAt(value.personas, index, {
                        painPoints: event.target.value,
                      }),
                    })
                  }
                  error={errors[`personas.${index}.painPoints`]}
                  placeholder="Melasma patches, Uneven tone"
                  hint="Comma-separated, up to four."
                />
              </FieldRow>
            </>
          )}
        />
      </Fieldset>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Step 6 — Campaign
   ══════════════════════════════════════════════════════════════════════════════ */

const DESTINATION_COPY: Record<
  (typeof CHECKOUT_ACTION_KINDS)[number],
  { title: string; description: string }
> = {
  shopify: {
    title: "Shopify",
    description: "Straight to checkout or the cart. Best for warm, card-ready traffic.",
  },
  whatsapp: {
    title: "WhatsApp order",
    description: "Opens a pre-filled chat. Highest intent capture for COD categories.",
  },
  form: {
    title: "Lead form",
    description: "Collects details for a call-back. Use for high-consideration purchases.",
  },
  url: {
    title: "External URL",
    description: "Any other destination, or an in-page anchor.",
  },
};

function CampaignStep({
  value,
  onChange,
  onDestinationChange,
  errors,
}: StepProps<Draft["campaign"]> & {
  onDestinationChange: (changes: Partial<Draft["campaign"]["destination"]>) => void;
}) {
  const destination = value.destination;

  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Ad headline"
        requiredMark
        value={value.adHeadline}
        onChange={(event) => onChange({ adHeadline: event.target.value })}
        error={errors.adHeadline}
        placeholder="Fade pigmentation in 6 weeks — 40% off"
        maxLength={120}
        aside={`${value.adHeadline.length}/120`}
        hint="Paste the exact headline from the ad. Message match is scored against this — the hero must echo it."
        autoFocus
      />

      <Textarea
        label="Ad body"
        value={value.adBody}
        onChange={(event) => onChange({ adBody: event.target.value })}
        error={errors.adBody}
        maxLength={600}
        counter
        rows={3}
      />

      <Input
        label="Keywords"
        requiredMark
        value={value.keywords}
        onChange={(event) => onChange({ keywords: event.target.value })}
        error={errors.keywords}
        placeholder="kumkumadi oil, pigmentation treatment, ayurvedic face oil"
        hint="Comma-separated. The first keyword must appear in the hero title or subtitle."
      />

      <FieldRow>
        <Select
          label="Platform"
          value={value.platform}
          onChange={(event) =>
            onChange({ platform: event.target.value as Draft["campaign"]["platform"] })
          }
          error={errors.platform}
          options={[
            { value: "meta", label: "Meta" },
            { value: "google", label: "Google" },
            { value: "both", label: "Both" },
            { value: "other", label: "Other" },
          ]}
        />
        <Select
          label="Traffic temperature"
          value={value.temperature}
          onChange={(event) =>
            onChange({ temperature: event.target.value as Draft["campaign"]["temperature"] })
          }
          error={errors.temperature}
          options={[
            { value: "cold", label: "Cold — never heard of you" },
            { value: "warm", label: "Warm — knows the brand" },
            { value: "retargeting", label: "Retargeting — already visited" },
          ]}
        />
      </FieldRow>

      <Input
        label="UTM campaign"
        value={value.utmCampaign}
        onChange={(event) => onChange({ utmCampaign: event.target.value })}
        error={errors.utmCampaign}
        placeholder="kumkumadi_glow40_jul"
        className="font-mono"
        maxLength={60}
      />

      <Fieldset
        legend="Checkout destination"
        hint="One primary action for the whole page. Every CTA in every block points here."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CHECKOUT_ACTION_KINDS.map((kind) => {
            const selected = destination.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onDestinationChange({ kind })}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border-2 p-4 text-left",
                  "transition-[border-color,background-color] duration-[var(--dur-fast)]",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface hover:border-border-strong",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="font-heading text-base font-bold tracking-tight text-fg-strong">
                    {DESTINATION_COPY[kind].title}
                  </span>
                  {selected ? (
                    <Check className="size-4 text-primary" aria-hidden />
                  ) : null}
                </span>
                <span className="font-body text-xs text-muted-fg">
                  {DESTINATION_COPY[kind].description}
                </span>
              </button>
            );
          })}
        </div>

        {errors.destination ? <FieldError>{errors.destination}</FieldError> : null}

        {destination.kind === "shopify" ? (
          <div className="flex flex-col gap-4">
            <FieldRow>
              <Input
                label="Product ID or handle"
                requiredMark
                value={destination.shopify.productId}
                onChange={(event) =>
                  onDestinationChange({
                    shopify: { ...destination.shopify, productId: event.target.value },
                  })
                }
                error={errors["destination.productId"]}
                placeholder="8123456789012"
              />
              <Input
                label="Variant ID"
                value={destination.shopify.variantId}
                onChange={(event) =>
                  onDestinationChange({
                    shopify: { ...destination.shopify, variantId: event.target.value },
                  })
                }
                error={errors["destination.variantId"]}
                hint="Overridden by the on-page variant selector at click time."
              />
            </FieldRow>
            <FieldRow>
              <Input
                label="Quantity"
                value={destination.shopify.quantity}
                onChange={(event) =>
                  onDestinationChange({
                    shopify: { ...destination.shopify, quantity: event.target.value },
                  })
                }
                error={errors["destination.quantity"]}
                inputMode="numeric"
              />
              <Input
                label="Discount code"
                value={destination.shopify.discountCode}
                onChange={(event) =>
                  onDestinationChange({
                    shopify: {
                      ...destination.shopify,
                      discountCode: event.target.value.toUpperCase(),
                    },
                  })
                }
                error={errors["destination.discountCode"]}
                className="font-mono uppercase"
              />
            </FieldRow>
            <Select
              label="Checkout mode"
              value={destination.shopify.mode}
              onChange={(event) =>
                onDestinationChange({
                  shopify: {
                    ...destination.shopify,
                    mode: event.target.value as "cart" | "direct-checkout",
                  },
                })
              }
              error={errors["destination.mode"]}
              options={[
                { value: "direct-checkout", label: "Direct checkout — skip the cart" },
                { value: "cart", label: "Add to cart" },
              ]}
              hint="Cold paid traffic should skip the cart."
            />
          </div>
        ) : null}

        {destination.kind === "whatsapp" ? (
          <div className="flex flex-col gap-4">
            <FieldRow>
              <Input
                label="WhatsApp number"
                requiredMark
                value={destination.whatsapp.phone}
                onChange={(event) =>
                  onDestinationChange({
                    whatsapp: { ...destination.whatsapp, phone: event.target.value },
                  })
                }
                error={errors["destination.phone"]}
                placeholder="919876543210"
                inputMode="tel"
                className="font-mono"
                hint="India only, E.164 without the +. Country code 91 included."
              />
              <Input
                label="Business name"
                value={destination.whatsapp.businessName}
                onChange={(event) =>
                  onDestinationChange({
                    whatsapp: { ...destination.whatsapp, businessName: event.target.value },
                  })
                }
                error={errors["destination.businessName"]}
                maxLength={60}
              />
            </FieldRow>
            <Textarea
              label="Message template"
              requiredMark
              value={destination.whatsapp.messageTemplate}
              onChange={(event) =>
                onDestinationChange({
                  whatsapp: {
                    ...destination.whatsapp,
                    messageTemplate: event.target.value,
                  },
                })
              }
              error={errors["destination.messageTemplate"]}
              maxLength={400}
              counter
              rows={3}
              hint="Tokens: {{product}} {{variant}} {{price}} {{page}} {{utm_campaign}}"
            />
          </div>
        ) : null}

        {destination.kind === "form" ? (
          <div className="flex flex-col gap-4">
            <FieldRow>
              <Input
                label="Form ID"
                requiredMark
                value={destination.form.formId}
                onChange={(event) =>
                  onDestinationChange({
                    form: { ...destination.form, formId: event.target.value },
                  })
                }
                error={errors["destination.formId"]}
                className="font-mono"
                hint="Storage key for the submissions file."
              />
              <Input
                label="Submit label"
                value={destination.form.submitLabel}
                onChange={(event) =>
                  onDestinationChange({
                    form: { ...destination.form, submitLabel: event.target.value },
                  })
                }
                error={errors["destination.submitLabel"]}
                maxLength={28}
              />
            </FieldRow>
            <Input
              label="Success message"
              value={destination.form.successMessage}
              onChange={(event) =>
                onDestinationChange({
                  form: { ...destination.form, successMessage: event.target.value },
                })
              }
              error={errors["destination.successMessage"]}
              maxLength={160}
            />
            <Input
              label="Webhook URL"
              value={destination.form.webhookUrl}
              onChange={(event) =>
                onDestinationChange({
                  form: { ...destination.form, webhookUrl: event.target.value },
                })
              }
              error={errors["destination.webhookUrl"]}
              placeholder="https://hooks.yourcrm.in/lead"
              inputMode="url"
            />

            <div className="flex flex-col gap-2">
              <Label>Fields</Label>
              {destination.form.fields.length > 4 ? (
                <div className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft p-3">
                  <TriangleAlert
                    className="mt-0.5 size-4 shrink-0 text-warning-fg"
                    aria-hidden
                  />
                  <p className="font-body text-xs text-warning-fg">
                    Above four fields, mobile lead rate collapses. Cut everything you can
                    ask for on the call instead.
                  </p>
                </div>
              ) : null}
              {errors["destination.fields"] ? (
                <FieldError>{errors["destination.fields"]}</FieldError>
              ) : null}
              <Repeater
                items={destination.form.fields}
                max={6}
                addLabel="Add field"
                emptyLabel="At least one field is required."
                itemLabel={(index) => `Field ${index + 1}`}
                onAdd={() =>
                  onDestinationChange({
                    form: {
                      ...destination.form,
                      fields: [
                        ...destination.form.fields,
                        {
                          name: "",
                          label: "",
                          type: "text",
                          required: true,
                          placeholder: "",
                        },
                      ],
                    },
                  })
                }
                onRemove={(index) =>
                  onDestinationChange({
                    form: {
                      ...destination.form,
                      fields: removeAt(destination.form.fields, index),
                    },
                  })
                }
                renderItem={(index) => (
                  <>
                    <FieldRow>
                      <Input
                        label="Name"
                        requiredMark
                        value={destination.form.fields[index].name}
                        onChange={(event) =>
                          onDestinationChange({
                            form: {
                              ...destination.form,
                              fields: replaceAt(destination.form.fields, index, {
                                name: event.target.value,
                              }),
                            },
                          })
                        }
                        error={errors[`destination.fields.${index}.name`]}
                        placeholder="full_name"
                        className="font-mono"
                        hint="snake_case machine key."
                      />
                      <Input
                        label="Label"
                        requiredMark
                        value={destination.form.fields[index].label}
                        onChange={(event) =>
                          onDestinationChange({
                            form: {
                              ...destination.form,
                              fields: replaceAt(destination.form.fields, index, {
                                label: event.target.value,
                              }),
                            },
                          })
                        }
                        error={errors[`destination.fields.${index}.label`]}
                        placeholder="Name"
                      />
                    </FieldRow>
                    <FieldRow>
                      <Select
                        label="Type"
                        value={destination.form.fields[index].type}
                        onChange={(event) =>
                          onDestinationChange({
                            form: {
                              ...destination.form,
                              fields: replaceAt(destination.form.fields, index, {
                                type: event.target.value as DraftFormField["type"],
                              }),
                            },
                          })
                        }
                        error={errors[`destination.fields.${index}.type`]}
                        options={[
                          { value: "text", label: "Text" },
                          { value: "tel", label: "Phone" },
                          { value: "email", label: "Email" },
                          { value: "pincode", label: "Pincode" },
                          { value: "select", label: "Select" },
                          { value: "textarea", label: "Long text" },
                        ]}
                      />
                      <div className="flex items-end">
                        <Checkbox
                          checked={destination.form.fields[index].required}
                          onChange={(next) =>
                            onDestinationChange({
                              form: {
                                ...destination.form,
                                fields: replaceAt(destination.form.fields, index, {
                                  required: next,
                                }),
                              },
                            })
                          }
                          label="Required"
                        />
                      </div>
                    </FieldRow>
                  </>
                )}
              />
            </div>
          </div>
        ) : null}

        {destination.kind === "url" ? (
          <div className="flex flex-col gap-4">
            <Input
              label="Destination URL"
              requiredMark
              value={destination.url.href}
              onChange={(event) =>
                onDestinationChange({
                  url: { ...destination.url, href: event.target.value },
                })
              }
              error={errors["destination.href"]}
              placeholder="https://yourbrand.in/products/hero-product"
              inputMode="url"
              hint="Absolute URL, or an in-page anchor like #offer-stack."
            />
            <FieldRow>
              <Select
                label="Target"
                value={destination.url.target}
                onChange={(event) =>
                  onDestinationChange({
                    url: {
                      ...destination.url,
                      target: event.target.value as "_self" | "_blank",
                    },
                  })
                }
                error={errors["destination.target"]}
                options={[
                  { value: "_self", label: "Same tab" },
                  { value: "_blank", label: "New tab" },
                ]}
              />
              <Input
                label="Rel"
                value={destination.url.rel}
                onChange={(event) =>
                  onDestinationChange({
                    url: { ...destination.url, rel: event.target.value },
                  })
                }
                error={errors["destination.rel"]}
                placeholder="noopener"
                maxLength={60}
              />
            </FieldRow>
          </div>
        ) : null}
      </Fieldset>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Step 7 — Style
   ══════════════════════════════════════════════════════════════════════════════ */

const PERSONALITY_COPY: Record<
  (typeof STYLE_PERSONALITIES)[number],
  { title: string; blurb: string; bestFor: string }
> = {
  "bold-commerce": {
    title: "Bold commerce",
    blurb: "High contrast, saturated CTA, chunky type, big radius.",
    bestFor: "Value-led offers, COD-heavy categories, aggressive discounting.",
  },
  "premium-minimal": {
    title: "Premium minimal",
    blurb: "Restrained palette, serif headings, tight radius, generous whitespace.",
    bestFor: "Skincare, jewellery, home. ₹3000+ AOV.",
  },
  "vibrant-youth": {
    title: "Vibrant youth",
    blurb: "Gradients, pill shapes, playful and energetic.",
    bestFor: "₹299–₹1499 impulse buys, streetwear, beauty, snacks, gadgets.",
  },
};

/**
 * Live preview swatch.
 *
 * `data-lp-personality` is the same attribute the renderer puts on a page root, and
 * the presets in globals.css §3 are plain attribute selectors — so this swatch is
 * painted with the personality's real tokens, not an approximation that can drift.
 */
function PersonalityPreview({
  personality,
}: {
  personality: (typeof STYLE_PERSONALITIES)[number];
}) {
  return (
    <div
      data-lp-personality={personality}
      aria-hidden
      className="overflow-hidden rounded-lg border border-border bg-surface"
    >
      <div className="flex flex-col gap-2 bg-[image:var(--gradient-hero)] p-4">
        <span className="h-1.5 w-10 rounded-pill bg-primary" />
        <span className="font-heading text-lg leading-none font-[weight:var(--font-weight-heading)] tracking-tight text-fg-strong">
          Aa
        </span>
        <span className="h-1.5 w-full rounded-pill bg-border" />
        <span className="h-1.5 w-3/4 rounded-pill bg-border" />
        <span className="mt-1 flex items-center gap-2">
          <span className="h-7 w-20 rounded-[var(--radius-cta)] bg-primary" />
          <span className="h-7 w-10 rounded-[var(--radius-cta)] bg-discount" />
          <span className="size-7 rounded-[var(--radius-cta)] bg-accent" />
        </span>
      </div>
    </div>
  );
}

function StyleStep({ value, onChange, errors }: StepProps<Draft["style"]>) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Label>Style personality</Label>
        <FieldHint>
          Sets the colour ramp, type, radius, shadows and section rhythm. Everything
          stays editable afterwards.
        </FieldHint>
      </div>

      <div
        role="radiogroup"
        aria-label="Style personality"
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        {STYLE_PERSONALITIES.map((personality) => {
          const selected = value.personality === personality;
          const copy = PERSONALITY_COPY[personality];
          return (
            <button
              key={personality}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ personality })}
              className={cn(
                "flex flex-col gap-3 rounded-xl border-2 p-3 text-left",
                "transition-[border-color,box-shadow] duration-[var(--dur-fast)]",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
                selected
                  ? "border-primary shadow-card"
                  : "border-border hover:border-border-strong",
              )}
            >
              <PersonalityPreview personality={personality} />
              <span className="flex items-center justify-between gap-2">
                <span className="font-heading text-base font-bold tracking-tight text-fg-strong">
                  {copy.title}
                </span>
                {selected ? (
                  <Badge tone="brand" variant="soft">
                    <Check className="size-3" />
                    Selected
                  </Badge>
                ) : null}
              </span>
              <span className="font-body text-xs text-muted-fg">{copy.blurb}</span>
              <span className="font-body text-xs text-muted-fg">
                <span className="font-semibold">Best for:</span> {copy.bestFor}
              </span>
            </button>
          );
        })}
      </div>

      {errors.personality ? <FieldError>{errors.personality}</FieldError> : null}

      <Textarea
        label="Reference notes"
        value={value.referenceNotes}
        onChange={(event) => onChange({ referenceNotes: event.target.value })}
        error={errors.referenceNotes}
        placeholder="Reference pages, tone of voice, and things to avoid."
        maxLength={1000}
        counter
        rows={5}
        hint="Free-text art direction. “Avoid stock model photography”, “match the Diwali campaign”, “no countdown timers” all land."
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Generation progress
   ══════════════════════════════════════════════════════════════════════════════ */

function GenerationProgress({ stage, brandName }: { stage: number; brandName: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[var(--container-narrow)] flex-1 flex-col items-center justify-center px-[var(--space-gutter)] py-[var(--space-section)]">
      <div className="flex w-full max-w-prose flex-col items-center gap-6 text-center">
        <span
          aria-hidden
          className="flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary"
        >
          <Loader2 className="size-8 motion-safe:animate-spin" />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-fg-strong">
            Building your page
          </h1>
          <p className="font-body text-base text-muted-fg">
            {brandName
              ? `Composing a landing page for ${brandName} from the block registry.`
              : "Composing a landing page from the block registry."}
          </p>
        </div>

        <ol
          aria-live="polite"
          className="flex w-full flex-col gap-2 rounded-xl border border-border bg-surface-sunken p-4 text-left"
        >
          {GENERATION_STAGES.map((label, index) => {
            const done = index < stage;
            const active = index === stage;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full",
                    done && "bg-primary text-on-primary",
                    active && "bg-primary-soft text-primary",
                    !done && !active && "bg-muted text-muted-fg",
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" />
                  ) : active ? (
                    <Loader2 className="size-3.5 motion-safe:animate-spin" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span
                  className={cn(
                    "font-body text-sm",
                    active || done ? "text-fg-strong" : "text-muted-fg",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="font-body text-xs text-muted-fg">
          This usually takes 20–40 seconds. Leaving this page cancels the run.
        </p>
      </div>
    </main>
  );
}
