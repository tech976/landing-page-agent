/**
 * BLOCK 6 — `collection-grid`              BLOCK-CATALOG §2.6 · DESIGN-SYSTEM §6.3, §8.1
 *
 * Responsive catalogue grid: 2-up on mobile (never 1-up — Indian shoppers scan density),
 * up to 4-up on desktop. Image, name, price with compare-at strikethrough, optional badge,
 * optional rating, sold-out state, and a desktop hover lift.
 *
 * Server Component. `mobileLayout: "carousel"` is a pure CSS scroll-snap scroller — no JS.
 */

import type { ComponentConfig } from "@measured/puck";
import { Star } from "lucide-react";

import type {
  CheckoutAction,
  CollectionGridProps,
  CollectionItem,
  CtaSpec,
  ImageRef,
  ToneToken,
} from "@/lib/schema/page";
import { cn, discountPercent, formatMoney } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Token lookups — static maps only (DESIGN-SYSTEM §2.4)
   ──────────────────────────────────────────────────────────────────────────── */

const SECTION_TONE: Record<ToneToken, string> = {
  brand: "bg-primary-soft",
  accent: "bg-accent-soft",
  neutral: "bg-surface-sunken",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  dark: "bg-surface-invert text-on-invert",
  light: "bg-surface",
};

const BADGE_TONE: Record<ToneToken, string> = {
  brand: "bg-primary text-on-primary",
  accent: "bg-accent text-on-accent",
  neutral: "bg-muted text-fg-strong",
  success: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  danger: "bg-discount text-discount-fg",
  dark: "bg-surface-invert text-on-invert",
  light: "bg-surface text-fg-strong border border-border",
};

const ASPECT: Record<CollectionGridProps["aspectRatio"], string> = {
  "1:1": "aspect-product",
  "4:5": "aspect-hero",
  "3:4": "aspect-persona",
};

const MOBILE_COLS: Record<1 | 2, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
};

const DESKTOP_COLS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-3 lg:grid-cols-4",
};

const FOCAL: Record<ImageRef["focal"], string> = {
  center: "object-center",
  top: "object-top",
  bottom: "object-bottom",
  left: "object-left",
  right: "object-right",
};

const CTA_BASE =
  "inline-flex items-center justify-center gap-2 shrink-0 font-heading font-bold tracking-tight " +
  "text-center whitespace-nowrap select-none cursor-pointer touch-manipulation " +
  "rounded-[var(--radius-cta,var(--radius-lg))] " +
  "transition-[background-color,box-shadow,transform,border-color] " +
  "duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-surface " +
  "active:duration-[var(--dur-instant)]";

const CTA_VARIANT: Record<NonNullable<CtaSpec["variant"]>, string> = {
  solid:
    "bg-primary text-on-primary shadow-cta hover:bg-primary-hover hover:shadow-cta-hover " +
    "hover:-translate-y-0.5 active:bg-primary-active active:translate-y-0 active:scale-[0.98]",
  outline:
    "bg-surface text-fg-strong border-2 border-border-strong shadow-xs " +
    "hover:bg-surface-sunken hover:border-primary hover:text-primary active:bg-muted active:scale-[0.98]",
  ghost:
    "bg-transparent text-primary border-2 border-transparent " +
    "hover:bg-primary-soft hover:text-primary-hover active:bg-primary-soft active:scale-[0.98]",
};

function resolveHref(action: CheckoutAction): string {
  switch (action.kind) {
    case "url":
      return action.href;
    case "whatsapp":
      return `https://wa.me/${action.phone}?text=${encodeURIComponent(action.messageTemplate)}`;
    case "shopify": {
      const variant = action.variantId ?? action.productId;
      const discount = action.discountCode
        ? `?discount=${encodeURIComponent(action.discountCode)}`
        : "";
      return `/cart/${variant}:${action.quantity ?? 1}${discount}`;
    }
    case "form":
      return `#form-${action.formId}`;
  }
}

function actionTarget(action: CheckoutAction): string | undefined {
  if (action.kind === "url") return action.target;
  if (action.kind === "whatsapp") return "_blank";
  return undefined;
}

function actionRel(action: CheckoutAction): string | undefined {
  if (action.kind === "url")
    return action.rel ?? (action.target === "_blank" ? "noopener noreferrer" : undefined);
  if (action.kind === "whatsapp") return "noopener noreferrer";
  return undefined;
}

/* ────────────────────────────────────────────────────────────────────────────
   Card
   ──────────────────────────────────────────────────────────────────────────── */

interface CardProps {
  item: CollectionItem;
  aspectRatio: CollectionGridProps["aspectRatio"];
  showPrice: boolean;
  showCompareAt: boolean;
  cardCta: CollectionGridProps["cardCta"];
  cardCtaLabel: string;
}

function ProductCard({
  item,
  aspectRatio,
  showPrice,
  showCompareAt,
  cardCta,
  cardCtaLabel,
}: CardProps) {
  const linkable = cardCta === "whole-card" && !item.soldOut;
  const percentOff =
    item.compareAtPrice != null
      ? discountPercent(item.price.amount, item.compareAtPrice.amount)
      : 0;

  const inner = (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-surface-sunken",
          ASPECT[aspectRatio],
        )}
        style={item.image.dominant ? { backgroundColor: item.image.dominant } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image.src}
          alt={item.image.alt}
          width={item.image.width}
          height={item.image.height}
          loading="lazy"
          decoding="async"
          className={cn(
            "size-full object-contain p-3 sm:p-4",
            FOCAL[item.image.focal],
            "transition-transform duration-[var(--dur-base)] ease-[var(--ease-out-soft)]",
            "motion-safe:sm:group-hover:scale-[1.03]",
            item.soldOut && "opacity-60",
          )}
        />

        {item.badge ? (
          <span
            className={cn(
              "absolute left-2 top-2 rounded-pill px-2 py-1",
              "font-heading text-xs font-bold tracking-wide",
              BADGE_TONE[item.badgeTone ?? "danger"],
            )}
          >
            {item.badge}
          </span>
        ) : null}

        {item.soldOut ? (
          <span
            className={cn(
              "absolute inset-x-2 bottom-2 rounded-md bg-surface-invert px-2 py-1",
              "text-center font-heading text-xs font-bold uppercase tracking-wider text-on-invert",
            )}
          >
            Sold out
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <h3 className="font-heading text-base sm:text-xl font-bold tracking-tight text-fg-strong line-clamp-2">
          {item.name}
        </h3>

        {item.subtitle ? (
          <p className="font-body text-xs sm:text-sm leading-normal text-muted-fg line-clamp-2">
            {item.subtitle}
          </p>
        ) : null}

        {item.rating ? (
          <p className="flex items-center gap-1 font-body text-xs text-muted-fg">
            <Star aria-hidden="true" className="size-3.5 fill-rating text-rating" />
            <span className="font-semibold tabular-nums text-fg">{item.rating.value.toFixed(1)}</span>
            <span className="tabular-nums">({item.rating.count.toLocaleString("en-IN")})</span>
          </p>
        ) : null}

        {showPrice ? (
          /* §2.6 mobile: price and compare-at share ONE line, never wrap to a second row. */
          <p className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-0 pt-1">
            <span className="font-heading text-base sm:text-lg font-extrabold tracking-tight tabular-nums text-price">
              {formatMoney(item.price)}
            </span>
            {showCompareAt && item.compareAtPrice ? (
              <>
                <span className="font-body text-xs sm:text-sm font-medium tabular-nums line-through text-price-strike">
                  {formatMoney(item.compareAtPrice)}
                </span>
                {percentOff > 0 ? (
                  <span className="font-heading text-xs font-bold tabular-nums text-savings">
                    {percentOff}% off
                  </span>
                ) : null}
              </>
            ) : null}
          </p>
        ) : null}

        {cardCta === "button" ? (
          item.soldOut ? (
            <span
              className={cn(
                CTA_BASE,
                "mt-3 h-11 min-h-11 w-full px-4 text-sm",
                "bg-muted text-muted-fg pointer-events-none",
              )}
              aria-disabled="true"
            >
              Sold out
            </span>
          ) : (
            <a
              href={resolveHref(item.action)}
              target={actionTarget(item.action)}
              rel={actionRel(item.action)}
              data-action-kind={item.action.kind}
              className={cn(CTA_BASE, CTA_VARIANT.outline, "mt-3 h-11 min-h-11 w-full px-4 text-sm")}
            >
              {cardCtaLabel}
              <span className="sr-only"> — {item.name}</span>
            </a>
          )
        ) : null}
      </div>
    </>
  );

  const cardClasses = cn(
    "group relative flex h-full flex-col overflow-hidden rounded-xl",
    "bg-surface-raised border border-border shadow-card",
    "transition-[transform,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out-soft)]",
    linkable &&
      "motion-safe:sm:hover:-translate-y-1 sm:hover:shadow-lg sm:hover:border-border-strong " +
        "focus-within:ring-4 focus-within:ring-ring/60",
    item.soldOut && "opacity-90",
  );

  if (linkable) {
    return (
      <a
        href={resolveHref(item.action)}
        target={actionTarget(item.action)}
        rel={actionRel(item.action)}
        data-action-kind={item.action.kind}
        aria-label={item.name}
        className={cn(cardClasses, "cursor-pointer focus-visible:outline-none")}
      >
        {inner}
      </a>
    );
  }

  return <article className={cardClasses}>{inner}</article>;
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function CollectionGrid({
  heading,
  subheading,
  items,
  columns,
  mobileColumns,
  mobileLayout,
  aspectRatio,
  showPrice,
  showCompareAt,
  cardCta,
  cardCtaLabel,
  viewAll,
  background,
}: CollectionGridProps) {
  const isCarousel = mobileLayout === "carousel";

  /* Carousel and grid share one markup tree: a flex scroll-snap strip below `sm`,
     a real CSS grid from `sm` up. */
  const listClasses = isCarousel
    ? cn(
        "flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-[var(--space-gutter)]",
        "px-[var(--space-gutter)] -mx-[var(--space-gutter)] pb-2",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:mx-0 sm:grid sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:gap-6",
        DESKTOP_COLS[columns],
      )
    : cn("grid gap-3 sm:gap-5 lg:gap-6", MOBILE_COLS[mobileColumns], DESKTOP_COLS[columns]);

  const itemClasses = isCarousel
    ? "snap-start shrink-0 w-[62vw] xs:w-[56vw] sm:w-auto sm:shrink"
    : "";

  return (
    <section
      data-block="collection-grid"
      className={cn("py-[var(--space-section)]", SECTION_TONE[background])}
    >
      <div className="mx-auto w-full max-w-[var(--container-wide)] px-[var(--space-gutter)]">
        {heading || subheading ? (
          <header className="mx-auto mb-8 flex max-w-[var(--container-narrow)] flex-col gap-3 text-center sm:mb-12 sm:gap-4">
            {heading ? (
              <h2 className="font-heading text-3xl sm:text-4xl font-[weight:var(--font-weight-heading)] tracking-tight text-fg-strong text-balance">
                {heading}
              </h2>
            ) : null}
            {subheading ? (
              <p className="font-body text-base sm:text-lg leading-relaxed text-muted-fg text-pretty">
                {subheading}
              </p>
            ) : null}
          </header>
        ) : null}

        <ul className={cn("list-none", listClasses)}>
          {items.map((item) => (
            <li key={item.id} className={itemClasses}>
              <ProductCard
                item={item}
                aspectRatio={aspectRatio}
                showPrice={showPrice}
                showCompareAt={showCompareAt}
                cardCta={cardCta}
                cardCtaLabel={cardCtaLabel}
              />
            </li>
          ))}
        </ul>

        {viewAll ? (
          <div className="mt-8 flex justify-center sm:mt-10">
            <a
              href={resolveHref(viewAll.action)}
              target={actionTarget(viewAll.action)}
              rel={actionRel(viewAll.action)}
              data-action-kind={viewAll.action.kind}
              className={cn(
                CTA_BASE,
                CTA_VARIANT[viewAll.variant ?? "outline"],
                "h-12 min-h-12 w-full px-6 text-base sm:w-auto",
              )}
            >
              {viewAll.label}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Puck editor config
   ──────────────────────────────────────────────────────────────────────────── */

type PuckBlockConfig = Omit<ComponentConfig, "render">;

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

export const collectionGridPuckConfig: PuckBlockConfig = {
  label: "Collection grid",
  fields: {
    heading: { type: "text", label: "Heading" },
    subheading: { type: "text", label: "Subheading" },
    items: {
      type: "array",
      label: "Products (2–12)",
      min: 2,
      max: 12,
      getItemSummary: (item: { name?: string }) => item?.name || "Product",
      defaultItemProps: {
        id: "item_new",
        image: { src: "", alt: "", focal: "center" },
        name: "New product",
        price: { amount: 49900, currency: "INR" },
        soldOut: false,
        action: { kind: "url", href: "/products/new", target: "_self" },
      },
      arrayFields: {
        name: { type: "text", label: "Name (max 48 chars)" },
        subtitle: { type: "text", label: "Subtitle" },
        image: {
          type: "object",
          label: "Image",
          objectFields: {
            src: { type: "text", label: "Image URL or /public path" },
            alt: { type: "text", label: "Alt text (required)" },
          },
        },
        price: {
          type: "object",
          label: "Price",
          objectFields: {
            amount: { type: "number", label: "Amount in paise (49900 = ₹499)", min: 0 },
          },
        },
        compareAtPrice: {
          type: "object",
          label: "Compare-at price (MRP)",
          objectFields: {
            amount: { type: "number", label: "Amount in paise", min: 0 },
          },
        },
        badge: { type: "text", label: "Badge (max 16 chars)" },
        badgeTone: { type: "select", label: "Badge tone", options: TONE_OPTIONS },
        soldOut: {
          type: "radio",
          label: "Sold out",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
    },
    columns: {
      type: "select",
      label: "Desktop columns",
      options: [
        { label: "2", value: 2 },
        { label: "3", value: 3 },
        { label: "4", value: 4 },
      ],
    },
    mobileColumns: {
      type: "radio",
      label: "Mobile columns",
      options: [
        { label: "1", value: 1 },
        { label: "2 (recommended)", value: 2 },
      ],
    },
    mobileLayout: {
      type: "radio",
      label: "Mobile layout",
      options: [
        { label: "Carousel", value: "carousel" },
        { label: "Grid", value: "grid" },
      ],
    },
    aspectRatio: {
      type: "select",
      label: "Image ratio",
      options: [
        { label: "Square (1:1)", value: "1:1" },
        { label: "Portrait (4:5)", value: "4:5" },
        { label: "Portrait (3:4)", value: "3:4" },
      ],
    },
    showPrice: {
      type: "radio",
      label: "Show price",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    showCompareAt: {
      type: "radio",
      label: "Show struck-through MRP",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    cardCta: {
      type: "select",
      label: "Card action",
      options: [
        { label: "Whole card is a link", value: "whole-card" },
        { label: "Button", value: "button" },
        { label: "None", value: "none" },
      ],
    },
    cardCtaLabel: { type: "text", label: "Button label" },
    viewAll: {
      type: "object",
      label: "View-all link",
      objectFields: {
        label: { type: "text", label: "Label" },
        variant: {
          type: "select",
          label: "Style",
          options: [
            { label: "Outline", value: "outline" },
            { label: "Solid", value: "solid" },
            { label: "Ghost", value: "ghost" },
          ],
        },
      },
    },
    background: { type: "select", label: "Section background", options: TONE_OPTIONS },
  },
  defaultProps: {
    heading: "Explore the full range",
    items: [],
    columns: 4,
    mobileColumns: 2,
    mobileLayout: "carousel",
    aspectRatio: "1:1",
    showPrice: true,
    showCompareAt: true,
    cardCta: "whole-card",
    cardCtaLabel: "View",
    viewAll: null,
    background: "light",
  },
};
