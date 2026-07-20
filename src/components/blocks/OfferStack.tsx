/**
 * BLOCK 4 — offer-stack                                   BLOCK-CATALOG §2.4
 *
 * Moves the visitor from *whether* to buy to *which one* to buy, and lifts AOV via
 * decoy pricing. In Indian D2C the per-unit rupee saving is the strongest bundle
 * justification there is — so it is computed, not written by hand.
 *
 * No "use client": every card is a link with a resolved href. There is nothing to
 * hydrate, so this block ships zero JavaScript.
 */

import Image from "next/image";
import type { ComponentConfig, Field } from "@measured/puck";
import {
  Award,
  Banknote,
  Check,
  Clock,
  Flame,
  Gift,
  Headphones,
  Heart,
  Leaf,
  Lock,
  Package,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  ThumbsUp,
  Truck,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type {
  CheckoutAction,
  IconName,
  Offer,
  OfferStackProps,
  ToneToken,
} from "@/lib/schema/page";
import { cn, discountPercent, formatINR, formatMoney } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Static lookups
   ──────────────────────────────────────────────────────────────────────────── */

const ICONS: Record<IconName, LucideIcon> = {
  award: Award,
  banknote: Banknote,
  check: Check,
  clock: Clock,
  flame: Flame,
  gift: Gift,
  headphones: Headphones,
  heart: Heart,
  leaf: Leaf,
  lock: Lock,
  package: Package,
  "rotate-ccw": RotateCcw,
  "shield-check": ShieldCheck,
  smartphone: Smartphone,
  sparkles: Sparkles,
  star: Star,
  "thumbs-up": ThumbsUp,
  truck: Truck,
  x: X,
  zap: Zap,
};

const TONE_SECTION: Record<ToneToken, string> = {
  brand: "bg-primary-soft",
  accent: "bg-accent-soft",
  neutral: "bg-surface-sunken",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  dark: "bg-surface-invert",
  light: "bg-surface",
};

const TONE_BADGE: Record<ToneToken, string> = {
  brand: "bg-primary text-on-primary",
  accent: "bg-accent text-on-accent",
  neutral: "bg-secondary text-on-secondary",
  success: "bg-success text-white",
  warning: "bg-warning text-warning-fg",
  danger: "bg-discount text-discount-fg",
  dark: "bg-surface-invert text-on-invert",
  light: "bg-surface text-fg-strong",
};

const COLUMN_CLASS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

const CTA_BASE =
  "inline-flex items-center justify-center gap-2 shrink-0 w-full select-none cursor-pointer " +
  "touch-manipulation whitespace-nowrap font-heading font-bold tracking-tight " +
  "h-12 min-h-12 px-6 text-base rounded-[var(--radius-cta)] " +
  "transition-[background-color,box-shadow,transform,border-color] duration-[var(--dur-fast)] " +
  "ease-[var(--ease-out-soft)] focus-visible:outline-none focus-visible:ring-4 " +
  "focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface " +
  "active:duration-[var(--dur-instant)]";

const CTA_SOLID =
  "bg-primary text-on-primary shadow-cta hover:bg-primary-hover hover:shadow-cta-hover " +
  "hover:-translate-y-0.5 active:bg-primary-active active:translate-y-0 active:scale-[0.98]";

const CTA_OUTLINE =
  "bg-surface text-fg-strong border-2 border-border-strong shadow-xs hover:bg-surface-sunken " +
  "hover:border-primary hover:text-primary active:bg-muted active:scale-[0.98]";

const CTA_GHOST =
  "bg-transparent text-primary border-2 border-transparent hover:bg-primary-soft " +
  "hover:text-primary-hover active:bg-primary-soft active:scale-[0.98]";

const CTA_WHATSAPP =
  "bg-whatsapp text-white shadow-cta hover:brightness-105 hover:-translate-y-0.5 active:scale-[0.98]";

/* ────────────────────────────────────────────────────────────────────────────
   Checkout action resolution — BLOCK-CATALOG §1
   ──────────────────────────────────────────────────────────────────────────── */

function resolveHref(action: CheckoutAction, productName: string, priceLabel: string): string {
  switch (action.kind) {
    case "url":
      return action.href;
    case "whatsapp": {
      const message = action.messageTemplate
        .replaceAll("{{product}}", productName)
        .replaceAll("{{price}}", priceLabel);
      return `https://wa.me/${action.phone}?text=${encodeURIComponent(message)}`;
    }
    case "shopify": {
      const variantId = action.variantId ?? action.productId;
      if (action.mode === "cart") {
        return `/cart/add?id=${variantId}&quantity=${action.quantity}`;
      }
      const discount = action.discountCode ? `?discount=${action.discountCode}` : "";
      return `/cart/${variantId}:${action.quantity}${discount}`;
    }
    case "form":
      return `#form-${action.formId}`;
  }
}

function linkAttrs(action: CheckoutAction) {
  if (action.kind === "url") {
    return {
      target: action.target,
      rel: action.rel ?? (action.target === "_blank" ? "noopener noreferrer" : undefined),
    };
  }
  if (action.kind === "whatsapp") {
    return { target: "_blank" as const, rel: "noopener noreferrer" };
  }
  return {};
}

/** "Save ₹1,399 (47%)" — rupees first; percentages convert worse in India. */
function savingsText(offer: Offer, display: OfferStackProps["savingsDisplay"]): string | null {
  if (offer.savingsLabel) return offer.savingsLabel;
  const compare = offer.compareAtPrice?.amount;
  if (!compare || compare <= offer.price.amount) return null;

  const amount = formatINR(compare - offer.price.amount, { fromPaise: true });
  const percent = discountPercent(offer.price.amount, compare);

  if (display === "amount") return `Save ${amount}`;
  if (display === "percent") return percent > 0 ? `Save ${percent}%` : `Save ${amount}`;
  return percent > 0 ? `Save ${amount} (${percent}%)` : `Save ${amount}`;
}

/* ────────────────────────────────────────────────────────────────────────────
   Card
   ──────────────────────────────────────────────────────────────────────────── */

function OfferCard({
  offer,
  emphasis,
  savingsDisplay,
  showPerUnit,
  carousel,
}: {
  offer: Offer;
  emphasis: OfferStackProps["emphasis"];
  savingsDisplay: OfferStackProps["savingsDisplay"];
  showPerUnit: boolean;
  carousel: boolean;
}) {
  const anchored = offer.mostPopular && emphasis !== "flat";
  const savings = savingsText(offer, savingsDisplay);
  const priceLabel = formatMoney(offer.price);
  const perUnit =
    showPerUnit && offer.unitCount > 1 && offer.perUnitLabel
      ? `${formatINR(Math.round(offer.price.amount / offer.unitCount), { fromPaise: true })} ${offer.perUnitLabel}`
      : null;

  const ctaVariant = offer.cta.variant ?? (offer.mostPopular ? "solid" : "outline");
  const ctaSkin =
    offer.cta.action.kind === "whatsapp"
      ? CTA_WHATSAPP
      : ctaVariant === "solid"
        ? CTA_SOLID
        : ctaVariant === "ghost"
          ? CTA_GHOST
          : CTA_OUTLINE;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-surface-raised shadow-card",
        // The anchor is seen first on mobile without reordering the JSON. §2.4
        offer.mostPopular && "order-first sm:order-none",
        anchored && emphasis === "popular-scale"
          ? "border-primary ring-2 ring-primary lg:scale-[1.04] lg:shadow-lg"
          : anchored && emphasis === "popular-border"
            ? "border-2 border-primary"
            : "border-border",
        offer.soldOut && "opacity-60",
        carousel && "w-[78%] shrink-0 snap-start xs:w-[70%] sm:w-[46%] lg:w-auto",
      )}
    >
      {offer.badge ? (
        <span
          className={cn(
            "absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-pill)] px-3 py-1 font-heading text-xs font-bold tracking-wide",
            TONE_BADGE[offer.badgeTone],
          )}
        >
          {offer.badge}
        </span>
      ) : null}

      <div className="flex flex-1 flex-col gap-3 p-4 pt-6 sm:p-6 sm:pt-7">
        {offer.image ? (
          <div className="relative aspect-product w-full overflow-hidden rounded-[var(--radius-md)] bg-surface-sunken">
            <Image
              src={offer.image.src}
              alt={offer.image.alt}
              fill
              sizes="(max-width: 639px) 78vw, (max-width: 1023px) 46vw, 300px"
              loading="lazy"
              decoding="async"
              placeholder={offer.image.blurDataURL ? "blur" : "empty"}
              blurDataURL={offer.image.blurDataURL}
              className="size-full object-contain p-3"
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-xl font-bold tracking-tight text-fg-strong">
            {offer.title}
          </h3>
          {offer.subtitle ? (
            <p className="font-body text-sm text-muted-fg text-pretty">{offer.subtitle}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-heading text-3xl font-extrabold tracking-tighter tabular-nums text-price">
              {priceLabel}
            </span>
            {offer.compareAtPrice && offer.compareAtPrice.amount > offer.price.amount ? (
              <s className="font-body text-base font-medium tabular-nums text-price-strike">
                {formatMoney(offer.compareAtPrice)}
              </s>
            ) : null}
          </div>

          {perUnit ? (
            <p className="font-body text-sm font-semibold tabular-nums text-fg">{perUnit}</p>
          ) : null}

          {savings ? (
            <p className="font-body text-sm font-bold tabular-nums text-savings">{savings}</p>
          ) : null}
        </div>

        {offer.includes.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {offer.includes.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-accent"
                  strokeWidth={3}
                  aria-hidden="true"
                />
                <span className="font-body text-sm text-fg">{line}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {offer.freebies.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {offer.freebies.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Gift
                  className="mt-0.5 size-4 shrink-0 text-accent"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                <span className="font-body text-sm font-semibold text-accent">{line}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* CTA pinned to the bottom so cards with different body lengths still line up. */}
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          {offer.soldOut ? (
            <span
              aria-disabled="true"
              className={cn(CTA_BASE, "pointer-events-none bg-muted text-muted-fg shadow-none")}
            >
              Sold out
            </span>
          ) : (
            <OfferCta offer={offer} skin={ctaSkin} priceLabel={priceLabel} />
          )}
          {offer.cta.sublabel && !offer.soldOut ? (
            <span className="text-center font-body text-xs text-muted-fg">
              {offer.cta.sublabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OfferCta({
  offer,
  skin,
  priceLabel,
}: {
  offer: Offer;
  skin: string;
  priceLabel: string;
}) {
  const CtaIcon = offer.cta.icon ? ICONS[offer.cta.icon] : null;
  return (
    <a
      href={resolveHref(offer.cta.action, offer.title, priceLabel)}
      {...linkAttrs(offer.cta.action)}
      data-cta-slot={`offer:${offer.id}`}
      data-action-kind={offer.cta.action.kind}
      className={cn(
        CTA_BASE,
        skin,
        offer.cta.pulse && "motion-safe:animate-[var(--animate-cta-pulse)]",
      )}
    >
      {CtaIcon ? <CtaIcon className="size-5 shrink-0" aria-hidden="true" strokeWidth={2.5} /> : null}
      {offer.cta.label}
    </a>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function OfferStack({
  heading,
  subheading,
  offers,
  columns,
  emphasis,
  savingsDisplay,
  showPerUnit,
  background,
  footnote,
}: OfferStackProps) {
  // Four cards stacked vertically is a 2000px wall on a phone; peek-scroll instead.
  const carousel = offers.length === 4;
  const cols = columns ?? (Math.min(4, Math.max(2, offers.length)) as 2 | 3 | 4);

  return (
    <section
      id="offer-stack"
      aria-labelledby="offer-stack-heading"
      className={cn("w-full py-[var(--space-section)]", TONE_SECTION[background])}
    >
      <div className="mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)]">
        <header className="mx-auto mb-10 flex max-w-[var(--container-narrow)] flex-col gap-3 text-center sm:mb-14 sm:gap-4">
          <h2
            id="offer-stack-heading"
            className="font-heading text-3xl font-extrabold tracking-tight text-balance text-fg-strong sm:text-4xl"
          >
            {heading}
          </h2>
          {subheading ? (
            <p className="mx-auto max-w-prose font-body text-lg leading-relaxed text-pretty text-muted-fg">
              {subheading}
            </p>
          ) : null}
        </header>

        <div
          className={cn(
            carousel
              ? // Peek-scroll on mobile, real grid from lg. `-mx-` cancels the gutter so
                // the first card starts flush with the section's left edge.
                "-mx-[var(--space-gutter)] flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-[var(--space-gutter)] px-[var(--space-gutter)] pb-3 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0"
              : cn("grid grid-cols-1 gap-5 pt-4 sm:gap-6", COLUMN_CLASS[cols]),
            emphasis === "popular-scale" && "lg:items-center",
          )}
        >
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              emphasis={emphasis}
              savingsDisplay={savingsDisplay}
              showPerUnit={showPerUnit}
              carousel={carousel}
            />
          ))}
        </div>

        {footnote ? (
          <p className="mt-8 text-center font-body text-sm text-muted-fg">{footnote}</p>
        ) : null}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   PUCK EDITOR CONFIG
   ──────────────────────────────────────────────────────────────────────────── */

const TONE_OPTIONS = [
  { label: "Neutral", value: "neutral" },
  { label: "Light", value: "light" },
  { label: "Brand", value: "brand" },
  { label: "Accent", value: "accent" },
  { label: "Success", value: "success" },
  { label: "Warning", value: "warning" },
  { label: "Danger", value: "danger" },
  { label: "Dark", value: "dark" },
];

const ICON_OPTIONS = [
  { label: "— none —", value: undefined },
  ...(Object.keys(ICONS) as IconName[]).map((name) => ({ label: name, value: name })),
];

const BOOL_OPTIONS = [
  { label: "No", value: false },
  { label: "Yes", value: true },
];

const FOCAL_OPTIONS = [
  { label: "Center", value: "center" },
  { label: "Top", value: "top" },
  { label: "Bottom", value: "bottom" },
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
];

/**
 * Puck's `Field<T>` reduces optional objects and discriminated unions (Money,
 * ImageRef, CtaSpec → CheckoutAction) to their common keys, so a usable editor for
 * one cannot be expressed structurally. These builders are the single documented
 * place we bridge that gap.
 */
function moneyField<T>(label: string): Field<T> {
  return {
    type: "object",
    label,
    objectFields: {
      amount: { type: "number", label: "Amount in paise (₹899 = 89900)", min: 0, step: 100 },
      currency: { type: "select", label: "Currency", options: [{ label: "INR (₹)", value: "INR" }] },
    },
  } as unknown as Field<T>;
}

function imageField<T>(label: string): Field<T> {
  return {
    type: "object",
    label,
    objectFields: {
      src: { type: "text", label: "Image URL or /public path" },
      alt: { type: "text", label: "Alt text (required, max 125)" },
      width: { type: "number", label: "Intrinsic width", min: 1 },
      height: { type: "number", label: "Intrinsic height", min: 1 },
      focal: { type: "select", label: "Focal point", options: FOCAL_OPTIONS },
      blurDataURL: { type: "text", label: "Blur placeholder", visible: false },
      dominant: { type: "text", label: "Dominant colour", visible: false },
    },
  } as unknown as Field<T>;
}

function ctaField<T>(label: string): Field<T> {
  return {
    type: "object",
    label,
    objectFields: {
      label: { type: "text", label: "Button label (max 28)" },
      sublabel: { type: "text", label: 'Reassurance line, e.g. "Save ₹1,399"' },
      variant: {
        type: "select",
        label: "Style",
        options: [
          { label: "Solid", value: "solid" },
          { label: "Outline", value: "outline" },
          { label: "Ghost", value: "ghost" },
        ],
      },
      tone: { type: "select", label: "Tone", options: TONE_OPTIONS },
      icon: { type: "select", label: "Icon", options: ICON_OPTIONS },
      fullWidth: { type: "radio", label: "Full width", options: BOOL_OPTIONS },
      pulse: { type: "radio", label: "Pulse (max one per viewport)", options: BOOL_OPTIONS },
      action: {
        type: "object",
        label: "Destination",
        objectFields: {
          kind: {
            type: "select",
            label: "Destination type",
            options: [
              { label: "Shopify checkout", value: "shopify" },
              { label: "WhatsApp order", value: "whatsapp" },
              { label: "Lead form", value: "form" },
              { label: "Link / anchor", value: "url" },
            ],
          },
          productId: { type: "text", label: "Shopify product id" },
          variantId: { type: "text", label: "Shopify variant id" },
          quantity: { type: "number", label: "Quantity", min: 1 },
          discountCode: { type: "text", label: "Discount code" },
          mode: {
            type: "select",
            label: "Shopify mode",
            options: [
              { label: "Direct checkout", value: "direct-checkout" },
              { label: "Add to cart", value: "cart" },
            ],
          },
          phone: { type: "text", label: "WhatsApp number (919876543210)" },
          messageTemplate: { type: "textarea", label: "WhatsApp prefilled message" },
          businessName: { type: "text", label: "WhatsApp business name" },
          formId: { type: "text", label: "Form id" },
          href: { type: "text", label: "URL or #anchor" },
          target: {
            type: "select",
            label: "Open in",
            options: [
              { label: "Same tab", value: "_self" },
              { label: "New tab", value: "_blank" },
            ],
          },
        },
      },
    },
  } as unknown as Field<T>;
}

/** The subset of Puck's custom-field render params this editor needs. */
interface CustomFieldParams {
  value: unknown;
  onChange: (value: unknown) => void;
  id?: string;
  readOnly?: boolean;
}

/**
 * Puck has no first-class editor for `string[]`; an array field would write objects
 * and break the schema. A one-per-line textarea writes a real string array.
 */
function stringListField<T>(label: string, placeholder: string): Field<T> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, id, readOnly }: CustomFieldParams) => (
      <textarea
        id={id}
        rows={4}
        readOnly={readOnly}
        placeholder={placeholder}
        value={(Array.isArray(value) ? (value as string[]) : []).join("\n")}
        onChange={(event) => onChange(event.currentTarget.value.split("\n"))}
        className="w-full rounded-[var(--radius-sm)] border border-border bg-surface p-2 font-body text-sm text-fg"
      />
    ),
  } as unknown as Field<T>;
}

export const offerStackPuckConfig: Omit<ComponentConfig<OfferStackProps>, "render"> = {
  label: "Offer stack",
  fields: {
    heading: { type: "text", label: "Heading (max 60)" },
    subheading: { type: "textarea", label: "Supporting line (max 120)" },
    offers: {
      type: "array",
      label: "Offers (2–4 · exactly one may be 'most popular')",
      min: 2,
      max: 4,
      getItemSummary: (item) => item.title || item.id || "Offer",
      arrayFields: {
        id: { type: "text", label: 'Offer id — persona cards reference this, e.g. "off_pack2"' },
        title: { type: "text", label: "Title (max 32)" },
        subtitle: { type: "text", label: "Subtitle (max 60)" },
        image: imageField<Offer["image"]>("Pack image"),
        price: moneyField<Offer["price"]>("Price"),
        compareAtPrice: moneyField<Offer["compareAtPrice"]>("Compare-at price (must exceed price)"),
        perUnitLabel: { type: "text", label: 'Per-unit label, e.g. "per bottle"' },
        unitCount: { type: "number", label: "Units in this pack", min: 1 },
        savingsLabel: { type: "text", label: "Override the computed savings text" },
        mostPopular: { type: "radio", label: "Most popular (max one)", options: BOOL_OPTIONS },
        badge: { type: "text", label: 'Badge, e.g. "Most popular"' },
        badgeTone: { type: "select", label: "Badge tone", options: TONE_OPTIONS },
        includes: stringListField<Offer["includes"]>(
          "What's included (one per line, max 6)",
          "2 × 30ml bottle",
        ),
        freebies: stringListField<Offer["freebies"]>(
          "Freebies (one per line, max 3)",
          "+ Free jade roller (worth ₹499)",
        ),
        soldOut: { type: "radio", label: "Sold out", options: BOOL_OPTIONS },
        cta: ctaField<Offer["cta"]>("Offer CTA"),
      },
    },
    columns: {
      type: "select",
      label: "Desktop columns",
      options: [
        { label: "Match the number of offers", value: undefined },
        { label: "2", value: 2 },
        { label: "3", value: 3 },
        { label: "4", value: 4 },
      ],
    },
    emphasis: {
      type: "select",
      label: "How the anchor card stands out",
      options: [
        { label: "Scale it up", value: "popular-scale" },
        { label: "Border it", value: "popular-border" },
        { label: "Flat — all equal", value: "flat" },
      ],
    },
    savingsDisplay: {
      type: "select",
      label: "Savings display",
      options: [
        { label: "Both — Save ₹1,399 (47%)", value: "both" },
        { label: "Rupees only", value: "amount" },
        { label: "Percent only", value: "percent" },
      ],
    },
    showPerUnit: {
      type: "radio",
      label: 'Show per-unit price ("₹450 per bottle")',
      options: BOOL_OPTIONS,
    },
    background: { type: "select", label: "Section background", options: TONE_OPTIONS },
    footnote: { type: "text", label: "Footnote under the cards (max 120)" },
  },
  defaultProps: {
    heading: "Choose your pack",
    subheading: undefined,
    offers: [
      {
        id: "off_single",
        title: "1 Bottle",
        subtitle: "Try it for a month",
        unitCount: 1,
        perUnitLabel: "per bottle",
        price: { amount: 89900, currency: "INR" },
        compareAtPrice: { amount: 149900, currency: "INR" },
        mostPopular: false,
        badgeTone: "accent",
        includes: [],
        freebies: [],
        soldOut: false,
        cta: {
          label: "Buy 1 Bottle",
          variant: "outline",
          pulse: false,
          action: { kind: "shopify", productId: "", quantity: 1, mode: "direct-checkout" },
        },
      },
      {
        id: "off_pack2",
        title: "Pack of 2",
        subtitle: "Best for a full 8-week course",
        unitCount: 2,
        perUnitLabel: "per bottle",
        price: { amount: 159900, currency: "INR" },
        compareAtPrice: { amount: 299800, currency: "INR" },
        mostPopular: true,
        badge: "Most popular",
        badgeTone: "accent",
        includes: [],
        freebies: [],
        soldOut: false,
        cta: {
          label: "Buy Pack of 2",
          variant: "solid",
          tone: "brand",
          pulse: false,
          action: { kind: "shopify", productId: "", quantity: 1, mode: "direct-checkout" },
        },
      },
    ],
    emphasis: "popular-scale",
    savingsDisplay: "both",
    showPerUnit: true,
    background: "neutral",
  },
};
