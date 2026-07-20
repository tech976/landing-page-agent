"use client";

/**
 * BLOCK 10 — review-wall                                    BLOCK-CATALOG §2.10
 *
 * Aggregate rating + star-distribution histogram + a wall of review cards.
 * The heaviest-lifting trust block on the page: the visible *spread* of ratings is
 * what makes the average believable, so the distribution bars are not decoration.
 *
 * Client component: the star filter, the "Show more reviews" expansion and the
 * mount-triggered bar animation all require state.
 *
 * Colour/radius/shadow/font values are design tokens only — see DESIGN-SYSTEM §2.4.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { BadgeCheck, MapPin, Star, ThumbsUp } from "lucide-react";
import type { ComponentConfig, Fields } from "@measured/puck";

import type {
  CheckoutAction,
  ImageRef,
  Review,
  ReviewWallProps,
  ToneToken,
} from "@/lib/schema/page";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Static token lookups. NEVER `bg-${token}` — Tailwind's scanner cannot see it.
   ──────────────────────────────────────────────────────────────────────────── */

const SECTION_TONE: Record<ToneToken, string> = {
  light: "bg-surface",
  neutral: "bg-surface-sunken",
  dark: "bg-surface-invert",
  brand: "bg-primary-soft",
  accent: "bg-accent-soft",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
};

const HEADING_TONE: Record<ToneToken, string> = {
  light: "text-fg-strong",
  neutral: "text-fg-strong",
  dark: "text-on-invert",
  brand: "text-fg-strong",
  accent: "text-fg-strong",
  success: "text-fg-strong",
  warning: "text-fg-strong",
  danger: "text-fg-strong",
};

const BODY_TONE: Record<ToneToken, string> = {
  light: "text-muted-fg",
  neutral: "text-muted-fg",
  dark: "text-on-invert",
  brand: "text-muted-fg",
  accent: "text-muted-fg",
  success: "text-muted-fg",
  warning: "text-muted-fg",
  danger: "text-muted-fg",
};

const GRID_COLUMNS: Record<2 | 3, string> = {
  2: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6",
  3: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6",
};

const MASONRY_COLUMNS: Record<2 | 3, string> = {
  2: "columns-1 gap-4 md:columns-2 lg:gap-6 [&>*]:mb-4 lg:[&>*]:mb-6 [&>*]:break-inside-avoid",
  3: "columns-1 gap-4 md:columns-2 lg:columns-3 lg:gap-6 [&>*]:mb-4 lg:[&>*]:mb-6 [&>*]:break-inside-avoid",
};

const STAR_SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5 sm:size-6",
};

const DISTRIBUTION_KEYS = ["5", "4", "3", "2", "1"] as const;

/* ────────────────────────────────────────────────────────────────────────────
   Pure helpers
   ──────────────────────────────────────────────────────────────────────────── */

/** Fixed timezone so server and client render identical markup (no hydration drift). */
const REVIEW_DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatReviewDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : REVIEW_DATE_FORMAT.format(parsed);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function sortReviews(reviews: Review[], mode: ReviewWallProps["sortDefault"]): Review[] {
  const copy = [...reviews];
  if (mode === "recent") {
    return copy.sort((a, b) => b.date.localeCompare(a.date));
  }
  if (mode === "rating-desc") {
    return copy.sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));
  }
  return copy.sort(
    (a, b) =>
      (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0) || b.date.localeCompare(a.date),
  );
}

/**
 * Minimal client-side destination resolver. Shopify/form actions are finalised by the
 * renderer (shop domain, UTM passthrough, form mount) — the block only needs a valid
 * href and the `data-cta-*` hooks the analytics layer reads. BLOCK-CATALOG §1.2.
 */
function ctaHref(action: CheckoutAction): string {
  switch (action.kind) {
    case "url":
      return action.href;
    case "whatsapp":
      return `https://wa.me/${action.phone}?text=${encodeURIComponent(action.messageTemplate)}`;
    case "shopify":
      return action.variantId
        ? `/cart/${action.variantId}:${action.quantity ?? 1}`
        : `/products/${action.productId}`;
    case "form":
      return `#${action.formId}`;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────────────────────── */

function StarRow({
  value,
  size = "sm",
  label,
}: {
  value: number;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn(
            STAR_SIZE[size],
            star <= rounded ? "fill-rating text-rating" : "fill-transparent text-border-strong",
          )}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

function ReviewCard({
  review,
  showPhotos,
}: {
  review: Review;
  showPhotos: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.body.length > 220;
  const photos = showPhotos ? review.photos.slice(0, 3) : [];

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4 shadow-card sm:p-5">
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-heading text-base font-bold text-primary"
        >
          {review.name.trim().charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-bold tracking-tight text-fg-strong">
            {review.name}
          </p>
          {review.location ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-fg">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{review.location}</span>
            </p>
          ) : null}
        </div>

        {review.verified ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-success-soft px-2 py-1 text-xs font-semibold text-success-fg">
            <BadgeCheck aria-hidden="true" className="size-3.5" />
            <span className="hidden xs:inline">Verified</span>
            <span className="sr-only">Verified buyer</span>
          </span>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarRow value={review.rating} label={`${review.name} rated ${review.rating} out of 5`} />
        <time className="text-xs text-muted-fg" dateTime={review.date}>
          {formatReviewDate(review.date)}
        </time>
        {review.variantPurchased ? (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-fg">
            {review.variantPurchased}
          </span>
        ) : null}
      </div>

      {review.title ? (
        <h3 className="font-heading text-base font-bold tracking-tight text-fg-strong">
          {review.title}
        </h3>
      ) : null}

      <p
        className={cn(
          "text-sm leading-relaxed text-pretty text-fg",
          isLong && !expanded && "line-clamp-4",
        )}
      >
        {review.body}
      </p>

      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="-mx-2 inline-flex h-11 min-h-11 w-fit items-center rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-primary transition-colors duration-[var(--dur-fast)] hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      ) : null}

      {photos.length > 0 ? (
        <ul className="flex gap-2">
          {photos.map((photo) => (
            <li key={photo.src} className="w-1/3 max-w-24">
              <span className="relative block aspect-product overflow-hidden rounded-lg border border-border bg-muted">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 640px) 30vw, 120px"
                  className="size-full object-cover object-center"
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {typeof review.helpfulCount === "number" && review.helpfulCount > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-fg">
          <ThumbsUp aria-hidden="true" className="size-3.5" />
          {formatCount(review.helpfulCount)} found this helpful
        </p>
      ) : null}

      {review.response ? (
        <div className="rounded-lg border border-border bg-surface-sunken p-3">
          <p className="font-heading text-sm font-bold tracking-tight text-fg-strong">
            {review.response.author}
            {review.response.date ? (
              <time className="ml-2 font-body text-xs font-normal text-muted-fg" dateTime={review.response.date}>
                {formatReviewDate(review.response.date)}
              </time>
            ) : null}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-fg">
            {review.response.body}
          </p>
        </div>
      ) : null}
    </article>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Block
   ──────────────────────────────────────────────────────────────────────────── */

export default function ReviewWall({
  heading,
  summary,
  showDistribution,
  reviews,
  layout,
  columns,
  initialCount,
  sortDefault,
  filterable,
  showPhotos,
  cta,
  background,
}: ReviewWallProps) {
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [barsVisible, setBarsVisible] = useState(false);
  const summaryRef = useRef<HTMLDivElement | null>(null);

  /* Bars grow once, when the summary scrolls into view. DESIGN-SYSTEM §7. */
  useEffect(() => {
    const node = summaryRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setBarsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setBarsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* Collapse back to the initial page size when the filter or the prop changes.
     Adjusted during render (React's documented pattern) rather than in an effect,
     which would render the stale list once and then cascade a second render. */
  const resetKey = `${initialCount}:${starFilter ?? "all"}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setVisibleCount(initialCount);
  }

  const sorted = useMemo(() => sortReviews(reviews, sortDefault), [reviews, sortDefault]);
  const filtered = useMemo(
    () => (starFilter === null ? sorted : sorted.filter((r) => Math.round(r.rating) === starFilter)),
    [sorted, starFilter],
  );

  const isCarousel = layout === "carousel";
  const visible = isCarousel ? filtered : filtered.slice(0, visibleCount);
  const remaining = isCarousel ? 0 : filtered.length - visible.length;

  const distributionTotal =
    DISTRIBUTION_KEYS.reduce((total, key) => total + (summary.distribution[key] ?? 0), 0) || 0;

  return (
    <section
      className={cn("py-[var(--space-section)]", SECTION_TONE[background])}
      aria-labelledby="review-wall-heading"
    >
      <div className="mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)]">
        <h2
          id="review-wall-heading"
          className={cn(
            "text-center font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-4xl",
            HEADING_TONE[background],
          )}
        >
          {heading}
        </h2>

        {/* ── Aggregate + distribution ─────────────────────────────────── */}
        <div
          ref={summaryRef}
          className="mt-8 flex flex-col gap-6 rounded-xl border border-border bg-surface-raised p-4 shadow-card sm:p-6 md:flex-row md:items-center md:gap-10 lg:mt-10"
        >
          <div className="flex flex-col items-center gap-2 md:shrink-0 md:px-4">
            <p className="font-heading text-5xl font-extrabold tracking-tighter tabular-nums text-fg-strong">
              {summary.value.toFixed(1)}
            </p>
            <StarRow
              value={summary.value}
              size="lg"
              label={`Average rating ${summary.value} out of 5 from ${summary.count} reviews`}
            />
            <p className="text-center text-sm text-muted-fg">
              {summary.label ?? `Based on ${formatCount(summary.count)} reviews`}
            </p>
            {summary.sourceBadge ? (
              <p className="inline-flex items-center gap-1 rounded-pill bg-muted px-2.5 py-1 text-xs font-semibold text-muted-fg">
                <BadgeCheck aria-hidden="true" className="size-3.5 text-trust" />
                {summary.sourceBadge}
              </p>
            ) : null}
          </div>

          {showDistribution && distributionTotal > 0 ? (
            <ul className="flex flex-1 flex-col gap-2 border-border md:border-l md:pl-10">
              {DISTRIBUTION_KEYS.map((key) => {
                const count = summary.distribution[key] ?? 0;
                const percent = Math.round((count / distributionTotal) * 100);
                return (
                  <li key={key} className="flex items-center gap-2 sm:gap-3">
                    <span className="flex w-9 shrink-0 items-center gap-0.5 text-sm font-semibold tabular-nums text-fg">
                      {key}
                      <Star aria-hidden="true" className="size-3.5 fill-rating text-rating" strokeWidth={1.75} />
                    </span>
                    <span
                      className="h-1.5 flex-1 overflow-hidden rounded-pill bg-muted"
                      role="img"
                      aria-label={`${key} star: ${formatCount(count)} reviews, ${percent}%`}
                    >
                      <span
                        className="block h-full rounded-pill bg-rating transition-[width] duration-[var(--dur-slower)] ease-[var(--ease-out-quart)] motion-reduce:transition-none"
                        style={{ width: barsVisible ? `${percent}%` : "0%" }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-fg">
                      {percent}%
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {/* ── Star filter chips (off by default — §2.10) ───────────────── */}
        {filterable ? (
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter reviews by rating">
            <button
              type="button"
              onClick={() => setStarFilter(null)}
              aria-pressed={starFilter === null}
              className={cn(
                "inline-flex h-11 min-h-11 items-center rounded-pill border px-4 text-sm font-semibold transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                starFilter === null
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border-strong bg-surface text-fg hover:border-primary hover:text-primary",
              )}
            >
              All reviews
            </button>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setStarFilter(star)}
                aria-pressed={starFilter === star}
                className={cn(
                  "inline-flex h-11 min-h-11 items-center gap-1 rounded-pill border px-4 text-sm font-semibold tabular-nums transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                  starFilter === star
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border-strong bg-surface text-fg hover:border-primary hover:text-primary",
                )}
              >
                {star}
                <Star aria-hidden="true" className="size-3.5 fill-current" strokeWidth={1.75} />
                <span className="sr-only">star reviews</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* ── Review cards ─────────────────────────────────────────────── */}
        {visible.length === 0 ? (
          <p className={cn("mt-8 text-center text-sm", BODY_TONE[background])}>
            No reviews match this rating yet.
          </p>
        ) : isCarousel ? (
          <ul className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 -mx-[var(--space-gutter)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mt-10">
            {visible.map((review) => (
              <li key={review.id} className="w-[85%] shrink-0 snap-start sm:w-[46%] lg:w-[31%]">
                <ReviewCard review={review} showPhotos={showPhotos} />
              </li>
            ))}
          </ul>
        ) : (
          <div
            className={cn(
              "mt-8 lg:mt-10",
              layout === "masonry" ? MASONRY_COLUMNS[columns] : GRID_COLUMNS[columns],
            )}
          >
            {visible.map((review) => (
              <ReviewCard key={review.id} review={review} showPhotos={showPhotos} />
            ))}
          </div>
        )}

        {/* ── Load more — a real button, never infinite scroll (§2.10) ─── */}
        {remaining > 0 ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + initialCount)}
              className="inline-flex h-12 min-h-12 w-full items-center justify-center rounded-[var(--radius-cta)] border-2 border-border-strong bg-surface px-6 font-heading text-base font-bold tracking-tight text-fg-strong shadow-xs transition-[background-color,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] hover:border-primary hover:bg-surface-sunken hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] sm:w-auto"
            >
              Show more reviews ({formatCount(remaining)})
            </button>
          </div>
        ) : null}

        {/* ── Post-reviews CTA back to the offer ───────────────────────── */}
        {cta ? (
          <div className="mt-8 flex flex-col items-center gap-1.5">
            <a
              href={ctaHref(cta.action)}
              target={cta.action.kind === "url" ? cta.action.target : undefined}
              rel={
                cta.action.kind === "url" && cta.action.target === "_blank"
                  ? (cta.action.rel ?? "noopener noreferrer")
                  : undefined
              }
              data-cta-kind={cta.action.kind}
              className="inline-flex h-14 min-h-14 w-full items-center justify-center gap-2.5 rounded-[var(--radius-cta)] bg-primary px-8 font-heading text-lg font-bold tracking-tight whitespace-nowrap text-on-primary shadow-cta transition-[background-color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] hover:bg-primary-hover hover:shadow-cta-hover hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:translate-y-0 active:scale-[0.98] active:bg-primary-active sm:w-auto"
            >
              {cta.label}
            </a>
            {cta.sublabel ? (
              <span className={cn("text-sm", BODY_TONE[background])}>{cta.sublabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Puck editor config — marketers edit this block through these fields.
   Colours and every enumerated choice are `select`; there is no free-text colour
   input anywhere in the registry (DESIGN-SYSTEM §2.4b).
   ──────────────────────────────────────────────────────────────────────────── */

const TONE_OPTIONS = [
  { label: "Light", value: "light" },
  { label: "Neutral (tinted)", value: "neutral" },
  { label: "Dark", value: "dark" },
  { label: "Brand", value: "brand" },
  { label: "Accent", value: "accent" },
  { label: "Success", value: "success" },
  { label: "Warning", value: "warning" },
  { label: "Danger", value: "danger" },
];

const BOOL_OPTIONS = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

export const reviewWallPuckConfig: Omit<ComponentConfig<ReviewWallProps>, "render"> = {
  label: "Review Wall",
  fields: {
    heading: { type: "text", label: "Heading" },
    summary: {
      type: "object",
      label: "Aggregate rating",
      objectFields: {
        value: { type: "number", label: "Average rating (0–5)", min: 0, max: 5, step: 0.1 },
        count: { type: "number", label: "Total reviews", min: 0 },
        label: { type: "text", label: "Summary line" },
        sourceBadge: { type: "text", label: "Source badge (e.g. Verified by Judge.me)" },
        distribution: {
          type: "object",
          label: "Star distribution (review counts)",
          objectFields: {
            "5": { type: "number", label: "5 star", min: 0 },
            "4": { type: "number", label: "4 star", min: 0 },
            "3": { type: "number", label: "3 star", min: 0 },
            "2": { type: "number", label: "2 star", min: 0 },
            "1": { type: "number", label: "1 star", min: 0 },
          },
        },
      },
    },
    showDistribution: { type: "radio", label: "Show distribution bars", options: BOOL_OPTIONS },
    reviews: {
      type: "array",
      label: "Reviews",
      min: 3,
      max: 24,
      getItemSummary: (item: Review) => item?.name ?? "Review",
      arrayFields: {
        id: { type: "text", label: "ID (stable — do not reuse)" },
        name: { type: "text", label: "Name (e.g. Priya S.)" },
        location: { type: "text", label: "Location (e.g. Pune, Maharashtra)" },
        rating: { type: "number", label: "Rating (1–5)", min: 1, max: 5, step: 1 },
        date: { type: "text", label: "Date (YYYY-MM-DD)" },
        title: { type: "text", label: "Review title" },
        body: { type: "textarea", label: "Review body" },
        variantPurchased: { type: "text", label: "Variant purchased" },
        helpfulCount: { type: "number", label: "Helpful votes", min: 0 },
        verified: { type: "radio", label: "Verified buyer", options: BOOL_OPTIONS },
        photos: {
          type: "array",
          label: "Customer photos",
          max: 3,
          getItemSummary: (photo: ImageRef) => photo?.alt ?? "Photo",
          arrayFields: {
            src: { type: "text", label: "Image URL" },
            alt: { type: "text", label: "Alt text (required)" },
            focal: {
              type: "select",
              label: "Focal point",
              options: [
                { label: "Center", value: "center" },
                { label: "Top", value: "top" },
                { label: "Bottom", value: "bottom" },
                { label: "Left", value: "left" },
                { label: "Right", value: "right" },
              ],
            },
          },
        },
      },
    },
    layout: {
      type: "select",
      label: "Layout",
      options: [
        { label: "Grid", value: "grid" },
        { label: "Masonry", value: "masonry" },
        { label: "Carousel", value: "carousel" },
      ],
    },
    columns: {
      type: "select",
      label: "Desktop columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
      ],
    },
    initialCount: { type: "number", label: "Reviews before ‘Show more’", min: 1, max: 24 },
    sortDefault: {
      type: "select",
      label: "Default sort",
      options: [
        { label: "Most helpful", value: "helpful" },
        { label: "Most recent", value: "recent" },
        { label: "Highest rated", value: "rating-desc" },
      ],
    },
    filterable: { type: "radio", label: "Star filter chips", options: BOOL_OPTIONS },
    showPhotos: { type: "radio", label: "Show customer photos", options: BOOL_OPTIONS },
    cta: {
      type: "object",
      label: "CTA after reviews",
      objectFields: {
        label: { type: "text", label: "Button label" },
        sublabel: { type: "text", label: "Sub-label" },
        action: {
          type: "object",
          label: "Destination",
          objectFields: {
            kind: {
              type: "select",
              label: "Type",
              options: [
                { label: "Link / anchor", value: "url" },
                { label: "WhatsApp", value: "whatsapp" },
                { label: "Shopify", value: "shopify" },
              ],
            },
            href: { type: "text", label: "URL or #anchor" },
          },
        },
      },
    },
    background: { type: "select", label: "Section background", options: TONE_OPTIONS },
    /* Puck's mapped field type cannot express nullable objects or discriminated
       unions, so the `cta` / `summary.source` shapes are asserted here. The JSON
       itself stays exactly as the Zod schema defines it. */
  } as unknown as Fields<ReviewWallProps>,
  defaultProps: {
    heading: "What our customers say",
    summary: {
      value: 4.6,
      count: 2841,
      distribution: { "5": 1980, "4": 612, "3": 168, "2": 51, "1": 30 },
      label: "Based on 2,841 verified purchases",
    },
    showDistribution: true,
    reviews: [
      {
        id: "rev_1",
        name: "Priya S.",
        location: "Pune, Maharashtra",
        rating: 5,
        date: "2026-06-14",
        title: "Exactly as described",
        body: "Six weeks in and the difference is clearly visible. Delivery was quick and the packaging was sealed properly. Would happily order again.",
        verified: true,
        photos: [],
        helpfulCount: 214,
      },
      {
        id: "rev_2",
        name: "Rakesh M.",
        location: "Bengaluru, Karnataka",
        rating: 5,
        date: "2026-06-02",
        body: "Bought it for my wife and ended up using it myself. COD worked without any trouble and it reached me in three days.",
        verified: true,
        photos: [],
        helpfulCount: 96,
      },
      {
        id: "rev_3",
        name: "Fathima K.",
        location: "Kochi, Kerala",
        rating: 4,
        date: "2026-05-28",
        title: "Good, but slow",
        body: "Results showed up in about ten days, slower than I hoped, but the quality is genuinely better than what I was using before.",
        verified: true,
        photos: [],
        helpfulCount: 61,
      },
    ],
    layout: "grid",
    columns: 3,
    initialCount: 6,
    sortDefault: "helpful",
    filterable: false,
    showPhotos: true,
    cta: null,
    background: "light",
  },
};
