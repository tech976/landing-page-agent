"use client";

/**
 * BLOCK 2 — hero-product                                  BLOCK-CATALOG §2.2
 *
 * The above-the-fold conversion unit. 40–60% of paid visitors never scroll past it,
 * so it must be independently sufficient: what it is, what it costs, what they save,
 * that others trust it, and how to buy — in one screen.
 *
 * "use client" justification: the gallery (swipe + thumbs), the variant selector, the
 * quantity stepper and the price/CTA recomputation that depends on both are one
 * interlocked interactive unit. Splitting them would mean lifting state above the
 * block. The markup still server-renders, so the LCP image is in the initial HTML and
 * `priority` preloads it before hydration (DESIGN-SYSTEM §8.4).
 */

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { ComponentConfig, Field } from "@measured/puck";
import {
  Award,
  Banknote,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Gift,
  Headphones,
  Heart,
  Leaf,
  Lock,
  Minus,
  Package,
  Plus,
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
  CtaSpec,
  DiscountBadge,
  HeroProductProps,
  IconName,
  ImageRef,
  ToneToken,
  VariantGroup,
  VariantOption,
} from "@/lib/schema/page";
import { cn, discountPercent, formatINR } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Static lookups — never `bg-${token}`. DESIGN-SYSTEM §2.4.
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

/** DESIGN-SYSTEM §5.5 — the composed hero primary. */
const CTA_BASE =
  "inline-flex items-center justify-center gap-2.5 shrink-0 select-none cursor-pointer " +
  "touch-manipulation whitespace-nowrap font-heading font-bold tracking-tight text-center " +
  "rounded-[var(--radius-cta)] transition-[background-color,box-shadow,transform,border-color] " +
  "duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] focus-visible:outline-none " +
  "focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-surface active:duration-[var(--dur-instant)]";

const CTA_PRIMARY =
  "bg-primary text-on-primary shadow-cta hover:bg-primary-hover hover:shadow-cta-hover " +
  "hover:-translate-y-0.5 active:bg-primary-active active:translate-y-0 active:scale-[0.98] active:shadow-cta";

const CTA_OUTLINE =
  "bg-surface text-fg-strong border-2 border-border-strong shadow-xs hover:bg-surface-sunken " +
  "hover:border-primary hover:text-primary active:bg-muted active:scale-[0.98]";

const CTA_WHATSAPP =
  "bg-whatsapp text-white shadow-cta hover:brightness-105 hover:-translate-y-0.5 active:scale-[0.98]";

const CTA_GHOST =
  "bg-transparent text-primary border-2 border-transparent hover:bg-primary-soft " +
  "hover:text-primary-hover active:bg-primary-soft active:scale-[0.98]";

/* ────────────────────────────────────────────────────────────────────────────
   Checkout action resolution — BLOCK-CATALOG §1.
   Variant selection and the quantity stepper override the action's own values at
   click time, exactly as §1.1 specifies.
   ──────────────────────────────────────────────────────────────────────────── */

interface ActionContext {
  variantId?: string;
  quantity: number;
  productName: string;
  variantLabel: string;
  priceLabel: string;
}

function resolveHref(action: CheckoutAction, ctx: ActionContext): string {
  switch (action.kind) {
    case "url":
      return action.href;

    case "whatsapp": {
      const message = action.messageTemplate
        .replaceAll("{{product}}", ctx.productName)
        .replaceAll("{{variant}}", ctx.variantLabel || "—")
        .replaceAll("{{price}}", ctx.priceLabel);
      return `https://wa.me/${action.phone}?text=${encodeURIComponent(message)}`;
    }

    case "shopify": {
      const variantId = ctx.variantId ?? action.variantId ?? action.productId;
      const quantity = ctx.quantity || action.quantity;
      if (action.mode === "cart") {
        return `/cart/add?id=${variantId}&quantity=${quantity}`;
      }
      const discount = action.discountCode ? `?discount=${action.discountCode}` : "";
      return `/cart/${variantId}:${quantity}${discount}`;
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

/* ────────────────────────────────────────────────────────────────────────────
   Small presentational parts
   ──────────────────────────────────────────────────────────────────────────── */

function Stars({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={cn("relative inline-flex shrink-0", className)} aria-hidden="true">
      <span className="flex text-border-strong">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="size-4 fill-current" strokeWidth={0} />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 flex overflow-hidden text-rating"
        style={{ width: `${pct}%` }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} className="size-4 shrink-0 fill-current" strokeWidth={0} />
        ))}
      </span>
    </span>
  );
}

/** Renders the ratio wrapper + image. §8.1–§8.3: the wrapper never collapses, so CLS is 0. */
function GalleryImage({
  image,
  priority,
  className,
  sizes,
}: {
  image: ImageRef;
  priority: boolean;
  className?: string;
  sizes: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-surface-sunken", className)}>
      {/* §8.3(2) — dominant-colour fill is the one sanctioned inline style: it is
          content data stored on the image record, not a design decision. */}
      {image.dominant && !image.blurDataURL ? (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: image.dominant }}
          aria-hidden="true"
        />
      ) : null}
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        // Exactly ONE priority image per page: hero gallery image 1. §8.4.
        priority={priority}
        loading={priority ? undefined : "lazy"}
        decoding={priority ? "sync" : "async"}
        placeholder={image.blurDataURL ? "blur" : "empty"}
        blurDataURL={image.blurDataURL}
        className={cn(
          "size-full object-contain p-3 sm:p-5",
          image.focal === "top" && "object-top",
          image.focal === "bottom" && "object-bottom",
          image.focal === "left" && "object-left",
          image.focal === "right" && "object-right",
        )}
      />
    </div>
  );
}

function DiscountBadgePill({
  badge,
  priceAmount,
  compareAmount,
  className,
}: {
  badge: DiscountBadge;
  priceAmount: number;
  compareAmount: number | null;
  className?: string;
}) {
  let text = badge.text ?? "";

  if (badge.mode === "auto-percent") {
    if (compareAmount === null) return null;
    const pct = discountPercent(priceAmount, compareAmount);
    if (pct <= 0) return null;
    text = `${pct}% OFF`;
  } else if (badge.mode === "auto-amount") {
    if (compareAmount === null || compareAmount <= priceAmount) return null;
    text = `SAVE ${formatINR(compareAmount - priceAmount, { fromPaise: true })}`;
  }

  if (!text) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-heading text-sm font-bold tracking-wide tabular-nums",
        TONE_BADGE[badge.tone],
        badge.shape === "pill" && "rounded-[var(--radius-pill)] px-3 py-1",
        badge.shape === "burst" && "rounded-[var(--radius-sm)] px-3 py-1 -rotate-6 shadow-sm",
        badge.shape === "corner-ribbon" &&
          "rounded-[var(--radius-sm)] px-3 py-1.5 shadow-card",
        className,
      )}
    >
      {text}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function HeroProduct({
  eyebrow,
  title,
  subtitle,
  gallery,
  galleryLayout,
  rating,
  price,
  compareAtPrice,
  discountBadge,
  priceNote,
  variants,
  showQuantity,
  quantityMax,
  primaryCta,
  secondaryCta,
  trustChips,
  bullets,
  stockLine,
  layout,
  background,
}: HeroProductProps) {
  const isDark = background === "dark";

  /* ── Gallery ─────────────────────────────────────────────────────────────
     Variant images are appended once, up front, so indices are stable and image 0
     (the LCP element) never moves. */
  const items = useMemo<ImageRef[]>(() => {
    const list = [...gallery];
    const seen = new Set(list.map((i) => i.src));
    for (const group of variants) {
      for (const option of group.options) {
        if (option.image && !seen.has(option.image.src) && list.length < 12) {
          seen.add(option.image.src);
          list.push(option.image);
        }
      }
    }
    return list;
  }, [gallery, variants]);

  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current;
    const item = track?.children[index] as HTMLElement | undefined;
    if (!track || !item) return;
    setActive(index);
    // scrollTo (not scrollIntoView) — scrollIntoView would drag the whole page.
    track.scrollTo({ left: item.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }, []);

  const onTrackScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActive((current) => (current === index ? current : index));
  }, []);

  /* ── Variant selection ───────────────────────────────────────────────────── */
  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const group of variants) {
      const first = group.options.find((o) => !o.soldOut) ?? group.options[0];
      if (first) initial[group.id] = first.id;
    }
    return initial;
  });

  const selectedOptions = useMemo(
    () =>
      variants
        .map((group) => group.options.find((o) => o.id === selection[group.id]))
        .filter((o): o is VariantOption => Boolean(o)),
    [variants, selection],
  );

  const chooseOption = useCallback(
    (group: VariantGroup, option: VariantOption) => {
      if (option.soldOut) return;
      setSelection((prev) => ({ ...prev, [group.id]: option.id }));
      if (option.image) {
        const index = items.findIndex((i) => i.src === option.image!.src);
        if (index >= 0) scrollToIndex(index);
      }
    },
    [items, scrollToIndex],
  );

  /* ── Price ───────────────────────────────────────────────────────────────
     A variant's priceDelta shifts BOTH the price and the compare-at, so the rupee
     saving stays constant and the pair can never invert (cro/price-integrity). */
  const delta = selectedOptions.reduce((sum, o) => sum + (o.priceDelta?.amount ?? 0), 0);
  const priceAmount = price.amount + delta;
  const compareAmount = compareAtPrice ? compareAtPrice.amount + delta : null;
  const savings = compareAmount && compareAmount > priceAmount ? compareAmount - priceAmount : 0;
  const savingsPct = compareAmount ? discountPercent(priceAmount, compareAmount) : 0;

  const priceLabel = formatINR(priceAmount, { fromPaise: true });

  /* ── Quantity ────────────────────────────────────────────────────────────── */
  const [quantity, setQuantity] = useState(1);
  const step = useCallback(
    (by: number) => setQuantity((q) => Math.min(quantityMax, Math.max(1, q + by))),
    [quantityMax],
  );

  const ctx: ActionContext = {
    variantId: [...selectedOptions].reverse().find((o) => o.shopifyVariantId)?.shopifyVariantId,
    quantity,
    productName: title,
    variantLabel: selectedOptions.map((o) => o.label).join(" · "),
    priceLabel,
  };

  /* ── Layout switches ─────────────────────────────────────────────────────── */
  const showThumbs =
    items.length > 1 &&
    (galleryLayout === "thumbs-below" ||
      galleryLayout === "thumbs-left" ||
      galleryLayout === "stacked");
  const showDots = items.length > 1 && !showThumbs;
  const showArrows = items.length > 1 && galleryLayout === "carousel";
  const cornerBadge = discountBadge?.shape === "corner-ribbon" ? discountBadge : null;
  const inlineBadge = discountBadge && discountBadge.shape !== "corner-ribbon" ? discountBadge : null;

  const headingClass = isDark ? "text-on-invert" : "text-fg-strong";
  const bodyClass = isDark ? "text-on-invert/85" : "text-muted-fg";
  const priceClass = isDark ? "text-on-invert" : "text-price";
  const cardClass = isDark
    ? "border-on-invert/20 bg-on-invert/5"
    : "border-border bg-surface-raised";

  return (
    <section
      className={cn("relative w-full", TONE_SECTION[background])}
      aria-labelledby="hero-product-title"
    >
      <div className="mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)] pt-5 pb-[var(--space-section-sm)] lg:py-[var(--space-section-sm)]">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
          {/* ══ MEDIA ══════════════════════════════════════════════════════ */}
          <div
            className={cn(
              "flex min-w-0 flex-col gap-3",
              galleryLayout === "thumbs-left" && "lg:flex-row-reverse lg:items-start lg:gap-4",
              layout === "media-right" && "lg:order-2",
            )}
          >
            <div className="relative min-w-0 flex-1">
              <div
                ref={trackRef}
                onScroll={onTrackScroll}
                // One mechanism for every layout: a snap track. Mobile swipes it
                // natively; thumbs/arrows drive it on desktop; "stacked" turns it
                // into a column at lg with no duplicated DOM.
                className={cn(
                  "flex snap-x snap-mandatory overflow-x-auto scroll-smooth",
                  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  galleryLayout === "stacked" &&
                    "lg:flex-col lg:gap-3 lg:overflow-x-visible lg:snap-none",
                )}
              >
                {items.map((image, index) => (
                  <GalleryImage
                    key={`${image.src}-${index}`}
                    image={image}
                    priority={index === 0}
                    sizes="(max-width: 1023px) 100vw, 46vw"
                    // 60vh cap on mobile (§2.2) — keeps the price and the primary CTA
                    // reachable within one thumb-scroll on a 360×640 viewport.
                    className="aspect-hero max-h-[60vh] w-full shrink-0 snap-start lg:aspect-hero-lg lg:max-h-none"
                  />
                ))}
              </div>

              {cornerBadge ? (
                <DiscountBadgePill
                  badge={cornerBadge}
                  priceAmount={priceAmount}
                  compareAmount={compareAmount}
                  className="pointer-events-none absolute left-3 top-3 z-10"
                />
              ) : null}

              {showArrows ? (
                <>
                  <button
                    type="button"
                    onClick={() => scrollToIndex(Math.max(0, active - 1))}
                    disabled={active === 0}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius-pill)] bg-surface/90 text-fg-strong shadow-card backdrop-blur-sm transition-transform duration-[var(--dur-fast)] hover:scale-105 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 lg:flex"
                  >
                    <ChevronLeft className="size-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToIndex(Math.min(items.length - 1, active + 1))}
                    disabled={active === items.length - 1}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius-pill)] bg-surface/90 text-fg-strong shadow-card backdrop-blur-sm transition-transform duration-[var(--dur-fast)] hover:scale-105 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 lg:flex"
                  >
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>

            {showThumbs ? (
              <div
                role="tablist"
                aria-label="Product images"
                className={cn(
                  "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  galleryLayout === "thumbs-left" && "lg:w-20 lg:flex-col lg:overflow-visible",
                  galleryLayout === "stacked" && "lg:hidden",
                )}
              >
                {items.map((image, index) => (
                  <button
                    key={`thumb-${image.src}-${index}`}
                    type="button"
                    role="tab"
                    aria-selected={active === index}
                    aria-label={`Show image ${index + 1} of ${items.length}`}
                    onClick={() => scrollToIndex(index)}
                    className={cn(
                      "relative aspect-product size-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] border-2 bg-surface-sunken transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 sm:size-20",
                      active === index ? "border-primary" : "border-border hover:border-border-strong",
                    )}
                  >
                    <Image
                      src={image.src}
                      alt=""
                      fill
                      sizes="80px"
                      loading="lazy"
                      decoding="async"
                      className="size-full object-contain p-1.5"
                    />
                  </button>
                ))}
              </div>
            ) : null}

            {showDots ? (
              <div className="flex items-center justify-center gap-2" aria-hidden="true">
                {items.map((image, index) => (
                  <button
                    key={`dot-${image.src}-${index}`}
                    type="button"
                    tabIndex={-1}
                    onClick={() => scrollToIndex(index)}
                    // 44px tap target around a 8px dot.
                    className="flex size-11 items-center justify-center"
                  >
                    <span
                      className={cn(
                        "block size-2 rounded-[var(--radius-pill)] transition-colors duration-[var(--dur-fast)]",
                        active === index ? "bg-primary" : "bg-border-strong",
                      )}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* ══ BUY COLUMN ═════════════════════════════════════════════════ */}
          <div
            className={cn(
              "flex min-w-0 flex-col gap-4",
              layout === "media-right" && "lg:order-1",
            )}
          >
            {eyebrow ? (
              <p className="font-body text-xs font-semibold uppercase tracking-widest text-primary sm:text-sm">
                {eyebrow}
              </p>
            ) : null}

            <h1
              id="hero-product-title"
              className={cn(
                "font-heading text-3xl font-extrabold tracking-tighter text-balance sm:text-4xl lg:text-5xl",
                headingClass,
              )}
            >
              {title}
            </h1>

            {subtitle ? (
              <p className={cn("font-body text-base text-pretty sm:text-lg", bodyClass)}>
                {subtitle}
              </p>
            ) : null}

            {rating ? (
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={rating.value} />
                <span className={cn("font-body text-sm font-semibold tabular-nums", headingClass)}>
                  {rating.value.toFixed(1)}
                </span>
                {rating.linkToReviews ? (
                  <a
                    href="#reviews"
                    className={cn(
                      "font-body text-sm underline decoration-from-font underline-offset-4 hover:text-primary",
                      bodyClass,
                    )}
                  >
                    {formatINR(rating.count, { symbol: false })} {rating.label ?? "reviews"}
                  </a>
                ) : (
                  <span className={cn("font-body text-sm", bodyClass)}>
                    {formatINR(rating.count, { symbol: false })} {rating.label ?? "reviews"}
                  </span>
                )}
              </div>
            ) : null}

            {/* Price */}
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2" aria-live="polite">
                <span
                  className={cn(
                    "font-heading text-4xl font-extrabold tracking-tighter tabular-nums sm:text-5xl",
                    priceClass,
                  )}
                >
                  {priceLabel}
                </span>
                {compareAmount && compareAmount > priceAmount ? (
                  <s className="font-body text-lg font-medium tabular-nums text-price-strike">
                    {formatINR(compareAmount, { fromPaise: true })}
                  </s>
                ) : null}
                {inlineBadge ? (
                  <DiscountBadgePill
                    badge={inlineBadge}
                    priceAmount={priceAmount}
                    compareAmount={compareAmount}
                  />
                ) : null}
              </div>

              {savings > 0 ? (
                <p className="font-body text-sm font-semibold tabular-nums text-savings">
                  You save {formatINR(savings, { fromPaise: true })}
                  {savingsPct > 0 ? ` (${savingsPct}%)` : ""}
                </p>
              ) : null}

              <p className={cn("font-body text-xs", bodyClass)}>{priceNote}</p>

              {stockLine ? (
                <p className="font-body text-sm font-semibold text-urgency">{stockLine}</p>
              ) : null}
            </div>

            {bullets.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-accent"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                    <span className={cn("font-body text-sm sm:text-base", isDark ? "text-on-invert/90" : "text-fg")}>
                      {bullet}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {/* Variants */}
            {variants.map((group) => {
              const selected = selection[group.id];
              return (
                <fieldset key={group.id} className="flex flex-col gap-2 border-0 p-0">
                  <legend className={cn("font-body text-sm font-semibold", headingClass)}>
                    {group.label}
                    {group.required ? <span className="sr-only"> (required)</span> : null}
                  </legend>

                  {group.style === "dropdown" ? (
                    <select
                      value={selected ?? ""}
                      onChange={(event) => {
                        const option = group.options.find((o) => o.id === event.target.value);
                        if (option) chooseOption(group, option);
                      }}
                      aria-label={group.label}
                      className="h-12 min-h-12 w-full rounded-[var(--radius-md)] border-2 border-border-strong bg-surface px-3 font-body text-base text-fg-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60"
                    >
                      {group.options.map((option) => (
                        <option key={option.id} value={option.id} disabled={option.soldOut}>
                          {option.label}
                          {option.soldOut ? " — sold out" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label={group.label}
                      className={cn(
                        "flex flex-wrap gap-2",
                        group.style === "card" && "flex-col",
                      )}
                    >
                      {group.options.map((option) => {
                        const isOn = selected === option.id;
                        const common =
                          "relative touch-manipulation transition-[border-color,background-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-45";

                        if (group.style === "swatch") {
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="radio"
                              aria-checked={isOn}
                              disabled={option.soldOut}
                              title={option.label}
                              onClick={() => chooseOption(group, option)}
                              className={cn(
                                common,
                                "flex size-11 items-center justify-center rounded-[var(--radius-pill)] border-2",
                                isOn ? "border-primary" : "border-border hover:border-border-strong",
                              )}
                            >
                              {/* swatchHex is content data supplied per product, like an
                                  image src — there is no token that can express it. */}
                              <span
                                className="block size-7 rounded-[var(--radius-pill)] border border-border"
                                style={option.swatchHex ? { backgroundColor: option.swatchHex } : undefined}
                              />
                              <span className="sr-only">{option.label}</span>
                            </button>
                          );
                        }

                        if (group.style === "card") {
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="radio"
                              aria-checked={isOn}
                              disabled={option.soldOut}
                              onClick={() => chooseOption(group, option)}
                              className={cn(
                                common,
                                "flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border-2 px-4 py-3 text-left",
                                isOn
                                  ? "border-primary bg-primary-soft"
                                  : cn("hover:border-border-strong", cardClass),
                              )}
                            >
                              <span
                                className={cn(
                                  "font-body text-sm font-semibold sm:text-base",
                                  option.soldOut && "line-through",
                                  headingClass,
                                )}
                              >
                                {option.label}
                              </span>
                              {option.badge ? (
                                <span className="shrink-0 rounded-[var(--radius-pill)] bg-accent-soft px-2 py-0.5 font-body text-xs font-bold text-accent">
                                  {option.badge}
                                </span>
                              ) : null}
                            </button>
                          );
                        }

                        // "chip"
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={isOn}
                            disabled={option.soldOut}
                            onClick={() => chooseOption(group, option)}
                            className={cn(
                              common,
                              "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-pill)] border-2 px-4 font-body text-sm font-semibold",
                              option.soldOut && "line-through",
                              isOn
                                ? "border-primary bg-primary-soft text-primary"
                                : cn("text-fg-strong hover:border-border-strong", cardClass),
                            )}
                          >
                            {option.label}
                            {option.badge ? (
                              <span className="rounded-[var(--radius-pill)] bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">
                                {option.badge}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              );
            })}

            {/* Quantity */}
            {showQuantity && quantityMax > 1 ? (
              <div className="flex items-center gap-3">
                <span className={cn("font-body text-sm font-semibold", headingClass)} id="hero-qty-label">
                  Quantity
                </span>
                <div
                  className="inline-flex items-center rounded-[var(--radius-md)] border-2 border-border-strong bg-surface"
                  role="group"
                  aria-labelledby="hero-qty-label"
                >
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="flex size-11 items-center justify-center rounded-l-[var(--radius-md)] text-fg-strong transition-colors duration-[var(--dur-fast)] hover:bg-surface-sunken disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/60"
                  >
                    <Minus className="size-4" aria-hidden="true" strokeWidth={3} />
                  </button>
                  <span
                    aria-live="polite"
                    className="min-w-10 text-center font-heading text-base font-bold tabular-nums text-fg-strong"
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={quantity >= quantityMax}
                    aria-label="Increase quantity"
                    className="flex size-11 items-center justify-center rounded-r-[var(--radius-md)] text-fg-strong transition-colors duration-[var(--dur-fast)] hover:bg-surface-sunken disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/60"
                  >
                    <Plus className="size-4" aria-hidden="true" strokeWidth={3} />
                  </button>
                </div>
              </div>
            ) : null}

            {/* CTAs */}
            <div className="flex flex-col gap-3">
              <CtaButton cta={primaryCta} ctx={ctx} slot="primary" emphasis="primary" />
              {secondaryCta ? (
                <CtaButton cta={secondaryCta} ctx={ctx} slot="secondary" emphasis="secondary" />
              ) : null}
            </div>

            {/* Trust chips — 2×2 on mobile, inline row on desktop. */}
            {trustChips.length > 0 ? (
              <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                {trustChips.map((chip) => {
                  const ChipIcon = ICONS[chip.icon];
                  return (
                    <li
                      key={chip.label}
                      title={chip.tooltip}
                      className={cn(
                        "flex items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-2",
                        cardClass,
                      )}
                    >
                      <ChipIcon className="size-4 shrink-0 text-trust" aria-hidden="true" strokeWidth={2.25} />
                      <span className={cn("font-body text-xs font-medium sm:text-sm", isDark ? "text-on-invert/90" : "text-fg")}>
                        {chip.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaButton({
  cta,
  ctx,
  slot,
  emphasis,
}: {
  cta: CtaSpec;
  ctx: ActionContext;
  slot: string;
  emphasis: "primary" | "secondary";
}) {
  const CtaIcon = cta.icon ? ICONS[cta.icon] : null;
  const isWhatsapp = cta.action.kind === "whatsapp";
  const variant = cta.variant ?? (emphasis === "primary" ? "solid" : "outline");

  const skin = isWhatsapp
    ? CTA_WHATSAPP
    : variant === "solid"
      ? CTA_PRIMARY
      : variant === "ghost"
        ? CTA_GHOST
        : CTA_OUTLINE;

  return (
    <div className="flex flex-col gap-1.5">
      <a
        href={resolveHref(cta.action, ctx)}
        {...linkAttrs(cta.action)}
        data-cta-slot={slot}
        data-action-kind={cta.action.kind}
        className={cn(
          CTA_BASE,
          skin,
          // lg size: 56px — comfortably above the 44px floor. §5.3
          "h-14 min-h-14 w-full px-8 text-lg sm:w-auto",
          cta.fullWidth !== false && "sm:w-full",
          cta.pulse && "motion-safe:animate-[var(--animate-cta-pulse)]",
        )}
      >
        {CtaIcon ? <CtaIcon className="size-5 shrink-0" aria-hidden="true" strokeWidth={2.5} /> : null}
        {cta.label}
      </a>
      {cta.sublabel ? (
        <span className="text-center font-body text-xs text-muted-fg">{cta.sublabel}</span>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   PUCK EDITOR CONFIG
   ──────────────────────────────────────────────────────────────────────────── */

const TONE_OPTIONS = [
  { label: "Light", value: "light" },
  { label: "Neutral", value: "neutral" },
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

const ICON_OPTIONS_REQUIRED = (Object.keys(ICONS) as IconName[]).map((name) => ({
  label: name,
  value: name,
}));

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
 * Puck's `Field<T>` reduces a nullable object (`Money | null`) or a discriminated
 * union (`CheckoutAction`) to its *common* keys, so a usable editor for one cannot be
 * written structurally. These builders are the single documented place we bridge that
 * gap; every other field below is fully type-checked.
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

function checkoutActionObjectFields() {
  return {
    kind: {
      type: "select" as const,
      label: "Destination type",
      options: [
        { label: "Shopify checkout", value: "shopify" },
        { label: "WhatsApp order", value: "whatsapp" },
        { label: "Lead form", value: "form" },
        { label: "Link / anchor", value: "url" },
      ],
    },
    productId: { type: "text" as const, label: "Shopify product id" },
    variantId: { type: "text" as const, label: "Shopify variant id" },
    quantity: { type: "number" as const, label: "Quantity", min: 1 },
    discountCode: { type: "text" as const, label: "Discount code" },
    mode: {
      type: "select" as const,
      label: "Shopify mode",
      options: [
        { label: "Direct checkout", value: "direct-checkout" },
        { label: "Add to cart", value: "cart" },
      ],
    },
    phone: { type: "text" as const, label: "WhatsApp number (919876543210)" },
    messageTemplate: { type: "textarea" as const, label: "WhatsApp prefilled message" },
    businessName: { type: "text" as const, label: "WhatsApp business name" },
    formId: { type: "text" as const, label: "Form id" },
    href: { type: "text" as const, label: "URL or #anchor" },
    target: {
      type: "select" as const,
      label: "Open in",
      options: [
        { label: "Same tab", value: "_self" },
        { label: "New tab", value: "_blank" },
      ],
    },
  };
}

function ctaField<T>(label: string): Field<T> {
  return {
    type: "object",
    label,
    objectFields: {
      label: { type: "text", label: "Button label (max 28)" },
      sublabel: { type: "text", label: "Reassurance line under the button" },
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
      fullWidth: { type: "radio", label: "Full width on desktop", options: BOOL_OPTIONS },
      pulse: { type: "radio", label: "Pulse (max one per viewport)", options: BOOL_OPTIONS },
      action: { type: "object", label: "Destination", objectFields: checkoutActionObjectFields() },
    },
  } as unknown as Field<T>;
}

function ratingField<T>(label: string): Field<T> {
  return {
    type: "object",
    label,
    objectFields: {
      value: { type: "number", label: "Rating (0–5)", min: 0, max: 5, step: 0.1 },
      count: { type: "number", label: "Number of reviews", min: 0 },
      label: { type: "text", label: 'Suffix, e.g. "verified reviews"' },
      linkToReviews: { type: "radio", label: "Link to the review wall", options: BOOL_OPTIONS },
    },
  } as unknown as Field<T>;
}

function discountBadgeField<T>(label: string): Field<T> {
  return {
    type: "object",
    label,
    objectFields: {
      mode: {
        type: "select",
        label: "Badge text",
        options: [
          { label: "Auto — % off", value: "auto-percent" },
          { label: "Auto — ₹ saved", value: "auto-amount" },
          { label: "Manual text", value: "manual" },
        ],
      },
      text: { type: "text", label: "Manual text (max 24)" },
      tone: { type: "select", label: "Tone", options: TONE_OPTIONS },
      shape: {
        type: "select",
        label: "Shape",
        options: [
          { label: "Pill", value: "pill" },
          { label: "Corner ribbon (on the image)", value: "corner-ribbon" },
          { label: "Burst", value: "burst" },
        ],
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
        rows={5}
        readOnly={readOnly}
        placeholder={placeholder}
        value={(Array.isArray(value) ? (value as string[]) : []).join("\n")}
        onChange={(event) => onChange(event.currentTarget.value.split("\n"))}
        className="w-full rounded-[var(--radius-sm)] border border-border bg-surface p-2 font-body text-sm text-fg"
      />
    ),
  } as unknown as Field<T>;
}

export const heroProductPuckConfig: Omit<ComponentConfig<HeroProductProps>, "render"> = {
  label: "Hero — product",
  fields: {
    eyebrow: { type: "text", label: 'Eyebrow, e.g. "Bestseller · 18,400+ sold"' },
    title: { type: "text", label: "Product title (max 60)" },
    subtitle: { type: "textarea", label: "One-sentence benefit (max 110)" },
    gallery: {
      type: "array",
      label: "Gallery (1–8 · image 1 is the LCP image)",
      min: 1,
      max: 8,
      getItemSummary: (item) => item.alt || item.src || "Image",
      defaultItemProps: { src: "", alt: "", focal: "center" },
      arrayFields: {
        src: { type: "text", label: "Image URL or /public path" },
        alt: { type: "text", label: "Alt text (required, max 125)" },
        width: { type: "number", label: "Intrinsic width", min: 1 },
        height: { type: "number", label: "Intrinsic height", min: 1 },
        focal: { type: "select", label: "Focal point", options: FOCAL_OPTIONS },
        blurDataURL: { type: "text", label: "Blur placeholder", visible: false },
        dominant: { type: "text", label: "Dominant colour", visible: false },
      },
    },
    galleryLayout: {
      type: "select",
      label: "Gallery layout (desktop — mobile always swipes)",
      options: [
        { label: "Thumbnails below", value: "thumbs-below" },
        { label: "Thumbnails left", value: "thumbs-left" },
        { label: "Carousel with arrows", value: "carousel" },
        { label: "Stacked", value: "stacked" },
      ],
    },
    rating: ratingField<HeroProductProps["rating"]>("Rating summary"),
    price: moneyField<HeroProductProps["price"]>("Selling price"),
    compareAtPrice: moneyField<HeroProductProps["compareAtPrice"]>("MRP / compare-at price"),
    discountBadge: discountBadgeField<HeroProductProps["discountBadge"]>("Discount badge"),
    priceNote: { type: "text", label: "Small print under the price" },
    variants: {
      type: "array",
      label: "Variant groups (max 3)",
      max: 3,
      getItemSummary: (item) => item.label || item.id || "Variant group",
      arrayFields: {
        id: { type: "text", label: 'Group id, e.g. "pack"' },
        label: { type: "text", label: 'Group label, e.g. "Choose your pack"' },
        style: {
          type: "select",
          label: "Selector style",
          options: [
            { label: "Cards", value: "card" },
            { label: "Chips", value: "chip" },
            { label: "Colour swatches", value: "swatch" },
            { label: "Dropdown", value: "dropdown" },
          ],
        },
        required: { type: "radio", label: "Required", options: BOOL_OPTIONS },
        options: {
          type: "array",
          label: "Options (1–12)",
          min: 1,
          max: 12,
          getItemSummary: (item) => item.label || item.id || "Option",
          arrayFields: {
            id: { type: "text", label: "Option id" },
            label: { type: "text", label: "Option label (max 48)" },
            shopifyVariantId: { type: "text", label: "Shopify variant id" },
            priceDelta: moneyField<VariantOption["priceDelta"]>("Price change vs base"),
            swatchHex: { type: "text", label: "Swatch colour (swatch style only)" },
            image: imageField<VariantOption["image"]>("Gallery image for this option"),
            soldOut: { type: "radio", label: "Sold out", options: BOOL_OPTIONS },
            badge: { type: "text", label: 'Badge, e.g. "Most popular"' },
          },
        },
      },
    },
    showQuantity: { type: "radio", label: "Show quantity stepper", options: BOOL_OPTIONS },
    quantityMax: { type: "number", label: "Maximum quantity", min: 1, max: 10 },
    primaryCta: ctaField<HeroProductProps["primaryCta"]>("Primary CTA"),
    secondaryCta: ctaField<HeroProductProps["secondaryCta"]>("Secondary CTA"),
    trustChips: {
      type: "array",
      label: "Trust chips (max 4)",
      max: 4,
      getItemSummary: (item) => item.label || "Chip",
      defaultItemProps: { icon: "truck", label: "" },
      arrayFields: {
        icon: { type: "select", label: "Icon", options: ICON_OPTIONS_REQUIRED },
        label: { type: "text", label: "Label (max 22)" },
        tooltip: { type: "text", label: "Tooltip" },
      },
    },
    bullets: stringListField<HeroProductProps["bullets"]>(
      "Benefit bullets (one per line, max 5)",
      "Fades pigmentation in 4 weeks",
    ),
    stockLine: { type: "text", label: 'Stock line, e.g. "Only 14 left in stock"' },
    layout: {
      type: "radio",
      label: "Desktop split",
      options: [
        { label: "Image left", value: "media-left" },
        { label: "Image right", value: "media-right" },
      ],
    },
    background: { type: "select", label: "Section background", options: TONE_OPTIONS },
  },
  defaultProps: {
    eyebrow: "Bestseller · 18,400+ sold",
    title: "Kumkumadi Radiance Face Oil",
    subtitle:
      "Cold-pressed Ayurvedic oil that visibly fades dark spots in 4 weeks — dermat tested.",
    gallery: [
      {
        src: "/img/hero-product.webp",
        alt: "Product bottle on a plain background",
        width: 1200,
        height: 1200,
        focal: "center",
      },
    ],
    galleryLayout: "thumbs-below",
    rating: { value: 4.6, count: 2841, label: "verified reviews", linkToReviews: true },
    price: { amount: 89900, currency: "INR" },
    compareAtPrice: { amount: 149900, currency: "INR" },
    discountBadge: { mode: "auto-percent", tone: "danger", shape: "pill" },
    priceNote: "Inclusive of all taxes · Free shipping over ₹499",
    variants: [],
    showQuantity: true,
    quantityMax: 5,
    primaryCta: {
      label: "Buy Now",
      sublabel: "COD available · Ships in 24 hrs",
      variant: "solid",
      tone: "brand",
      icon: "zap",
      pulse: false,
      action: {
        kind: "shopify",
        productId: "",
        quantity: 1,
        mode: "direct-checkout",
      },
    },
    secondaryCta: null,
    trustChips: [
      { icon: "truck", label: "Free shipping ₹499+" },
      { icon: "banknote", label: "Cash on Delivery" },
      { icon: "rotate-ccw", label: "15-day returns" },
      { icon: "shield-check", label: "100% authentic" },
    ],
    bullets: [],
    layout: "media-left",
    background: "light",
  },
};
