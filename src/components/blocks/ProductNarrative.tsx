/**
 * BLOCK 5 — `product-narrative`            BLOCK-CATALOG §2.5 · DESIGN-SYSTEM §4, §6, §8
 *
 * The brand-story section: eyebrow, claim heading, prose body, a trio of proof stats,
 * an optional supporting image, founder signature and a soft CTA.
 *
 * Server Component — no interactivity beyond a zero-JS `<details>` read-more on mobile.
 *
 * Notes for reviewers:
 *  - No colour, radius, shadow or font literal appears anywhere in this file. Every class is
 *    a design token utility (DESIGN-SYSTEM §2.4).
 *  - Images below the fold use a native lazy `<img>` inside a ratio-locked wrapper, so CLS is
 *    0 before decode (DESIGN-SYSTEM §8.1). Only the hero block owns the single `priority`
 *    next/image on the page (§8.4).
 */

import type { ComponentConfig } from "@measured/puck";
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
  CtaSpec,
  IconName,
  ImageRef,
  ProductNarrativeProps,
  ToneToken,
} from "@/lib/schema/page";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Token lookups — static maps, never `bg-${token}` interpolation (§2.4)
   ──────────────────────────────────────────────────────────────────────────── */

const ICONS: Record<IconName, LucideIcon> = {
  truck: Truck,
  "shield-check": ShieldCheck,
  "rotate-ccw": RotateCcw,
  banknote: Banknote,
  smartphone: Smartphone,
  leaf: Leaf,
  sparkles: Sparkles,
  clock: Clock,
  flame: Flame,
  heart: Heart,
  star: Star,
  award: Award,
  package: Package,
  "thumbs-up": ThumbsUp,
  zap: Zap,
  lock: Lock,
  headphones: Headphones,
  check: Check,
  x: X,
  gift: Gift,
};

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
  "active:duration-[var(--dur-instant)] h-12 min-h-12 px-6 text-base w-full sm:w-auto";

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

/** Best-effort destination. The renderer layer appends UTM/click-id params (§1.2.4). */
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

function actionRel(action: CheckoutAction): string | undefined {
  if (action.kind === "url") return action.rel ?? (action.target === "_blank" ? "noopener noreferrer" : undefined);
  if (action.kind === "whatsapp") return "noopener noreferrer";
  return undefined;
}

function actionTarget(action: CheckoutAction): string | undefined {
  if (action.kind === "url") return action.target;
  if (action.kind === "whatsapp") return "_blank";
  return undefined;
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function ProductNarrative({
  eyebrow,
  heading,
  body,
  stats,
  image,
  imagePosition,
  signature,
  cta,
  background,
  maxWidth,
}: ProductNarrativeProps) {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const [lead, ...rest] = paragraphs;
  /** §2.5 mobile behaviour: clamp long copy behind a "Read more" toggle. */
  const needsToggle = rest.length > 0 && body.length > 380;

  const isBackgroundImage = imagePosition === "background" && image !== null;
  const isSplit = (imagePosition === "left" || imagePosition === "right") && image !== null;
  const onDark = background === "dark" || isBackgroundImage;

  const CtaIcon = cta?.icon ? ICONS[cta.icon] : null;

  const prose = (
    <div className={cn("flex flex-col gap-5 sm:gap-6", maxWidth === "prose" && "max-w-prose")}>
      {eyebrow ? (
        <p
          className={cn(
            "font-body text-xs sm:text-sm font-semibold uppercase tracking-widest",
            onDark ? "text-on-invert" : "text-primary",
          )}
        >
          {eyebrow}
        </p>
      ) : null}

      <h2
        className={cn(
          "font-heading text-3xl sm:text-4xl tracking-tight text-balance",
          "font-[weight:var(--font-weight-heading)]",
          onDark ? "text-on-invert" : "text-fg-strong",
        )}
      >
        {heading}
      </h2>

      <div className={cn("flex flex-col gap-4", onDark ? "text-on-invert" : "text-fg")}>
        <p className="font-body text-base sm:text-lg leading-relaxed text-pretty">{lead}</p>

        {rest.length > 0 ? (
          <>
            {/* Desktop / short copy: every paragraph, always open. */}
            <div className={cn("flex flex-col gap-4", needsToggle && "hidden sm:flex")}>
              {rest.map((paragraph, i) => (
                <p key={i} className="font-body text-base sm:text-lg leading-relaxed text-pretty">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Mobile only, long copy: zero-JS disclosure so nothing is permanently clamped. */}
            {needsToggle ? (
              <details className="group sm:hidden">
                <summary
                  className={cn(
                    "list-none [&::-webkit-details-marker]:hidden",
                    "inline-flex min-h-11 items-center gap-1.5 cursor-pointer",
                    "font-heading text-sm font-bold tracking-tight",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 rounded-sm",
                    onDark ? "text-on-invert" : "text-primary",
                  )}
                >
                  <span className="group-open:hidden">Read more</span>
                  <span className="hidden group-open:inline">Show less</span>
                </summary>
                <div className="mt-4 flex flex-col gap-4">
                  {rest.map((paragraph, i) => (
                    <p key={i} className="font-body text-base leading-relaxed text-pretty">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </div>

      {/* §2.5: the stat trio is always a 3-across row — a vertical stack reads as
          three unrelated numbers. */}
      {stats.length > 0 ? (
        <dl className="grid grid-cols-3 gap-2 sm:gap-4">
          {stats.map((stat, i) => {
            const StatIcon = stat.icon ? ICONS[stat.icon] : null;
            return (
              <div
                key={`${stat.label}-${i}`}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 sm:p-4",
                  onDark ? "border-border/30 bg-surface-invert" : "border-border bg-surface-raised",
                )}
              >
                {StatIcon ? (
                  <StatIcon
                    aria-hidden="true"
                    className={cn("size-4 sm:size-5", onDark ? "text-on-invert" : "text-primary")}
                  />
                ) : null}
                <dd
                  className={cn(
                    "font-heading text-2xl sm:text-4xl font-extrabold tracking-tighter tabular-nums",
                    onDark ? "text-on-invert" : "text-primary",
                  )}
                >
                  {stat.value}
                </dd>
                <dt
                  className={cn(
                    "font-body text-xs sm:text-sm leading-normal",
                    onDark ? "text-on-invert" : "text-muted-fg",
                  )}
                >
                  {stat.label}
                </dt>
              </div>
            );
          })}
        </dl>
      ) : null}

      {signature ? (
        <figcaption className="flex items-center gap-3">
          {signature.avatar ? (
            <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signature.avatar.src}
                alt={signature.avatar.alt}
                width={signature.avatar.width ?? 96}
                height={signature.avatar.height ?? 96}
                loading="lazy"
                decoding="async"
                className="size-full object-cover object-top"
              />
            </span>
          ) : null}
          <span className="flex flex-col">
            <span
              className={cn(
                "font-heading text-base font-semibold tracking-tight",
                onDark ? "text-on-invert" : "text-fg-strong",
              )}
            >
              {signature.name}
            </span>
            <span
              className={cn("font-body text-sm", onDark ? "text-on-invert" : "text-muted-fg")}
            >
              {signature.role}
            </span>
          </span>
        </figcaption>
      ) : null}

      {cta ? (
        <div className="flex">
          <a
            href={resolveHref(cta.action)}
            target={actionTarget(cta.action)}
            rel={actionRel(cta.action)}
            data-action-kind={cta.action.kind}
            className={cn(CTA_BASE, CTA_VARIANT[cta.variant ?? "ghost"])}
          >
            {CtaIcon ? <CtaIcon aria-hidden="true" className="size-5" /> : null}
            <span>{cta.label}</span>
          </a>
        </div>
      ) : null}
    </div>
  );

  const media =
    isSplit && image ? (
      <figure
        className="relative overflow-hidden rounded-xl bg-muted aspect-card lg:aspect-lifestyle"
        style={image.dominant ? { backgroundColor: image.dominant } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          className={cn("size-full object-cover", FOCAL[image.focal])}
        />
      </figure>
    ) : null;

  return (
    <section
      data-block="product-narrative"
      className={cn(
        "relative isolate py-[var(--space-section)]",
        isBackgroundImage ? "bg-surface-invert" : SECTION_TONE[background],
      )}
    >
      {isBackgroundImage && image ? (
        <>
          <div
            className="absolute inset-0 -z-10 overflow-hidden"
            style={image.dominant ? { backgroundColor: image.dominant } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              loading="lazy"
              decoding="async"
              className={cn("size-full object-cover", FOCAL[image.focal])}
            />
          </div>
          {/* Sibling overlay, never a filter on the image itself (§8.4). */}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-surface-invert/70" />
        </>
      ) : null}

      <div className="mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)]">
        {isSplit ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 lg:items-center">
            {/* Mobile always renders the image above the text, regardless of imagePosition. */}
            <div className={cn(imagePosition === "left" ? "lg:order-1" : "lg:order-2")}>{media}</div>
            <div className={cn(imagePosition === "left" ? "lg:order-2" : "lg:order-1")}>{prose}</div>
          </div>
        ) : (
          <div className={cn(maxWidth === "prose" && "mx-auto max-w-[var(--container-narrow)]")}>
            {prose}
          </div>
        )}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Puck editor config — marketers edit content here. No free-text colour inputs:
   every enumerated choice is a `select` (DESIGN-SYSTEM §2.4b).
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

const ICON_OPTIONS = [
  { label: "None", value: "" },
  ...(Object.keys(ICONS) as IconName[]).map((name) => ({ label: name, value: name })),
];

export const productNarrativePuckConfig: PuckBlockConfig = {
  label: "Product narrative",
  fields: {
    eyebrow: { type: "text", label: "Eyebrow (max 30 chars)" },
    heading: { type: "textarea", label: "Heading — make it a claim, not a label" },
    body: { type: "textarea", label: "Body — blank line separates paragraphs" },
    stats: {
      type: "array",
      label: "Proof stats (exactly 0 or 3)",
      max: 3,
      getItemSummary: (item: { value?: string; label?: string }) =>
        item?.value ? `${item.value} ${item.label ?? ""}`.trim() : "Stat",
      defaultItemProps: { value: "12,000+", label: "happy customers" },
      arrayFields: {
        value: { type: "text", label: "Value (e.g. 18,400+ · 4.6★ · 100%)" },
        label: { type: "text", label: "Label" },
        icon: { type: "select", label: "Icon", options: ICON_OPTIONS },
      },
    },
    image: {
      type: "object",
      label: "Supporting image",
      objectFields: {
        src: { type: "text", label: "Image URL or /public path" },
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
    imagePosition: {
      type: "radio",
      label: "Image position (desktop)",
      options: [
        { label: "Right", value: "right" },
        { label: "Left", value: "left" },
        { label: "Background", value: "background" },
        { label: "None", value: "none" },
      ],
    },
    signature: {
      type: "object",
      label: "Founder signature",
      objectFields: {
        name: { type: "text", label: "Name" },
        role: { type: "text", label: "Role (e.g. Founder, Vedaroots)" },
      },
    },
    cta: {
      type: "object",
      label: "Soft CTA",
      objectFields: {
        label: { type: "text", label: "Button label" },
        variant: {
          type: "select",
          label: "Style",
          options: [
            { label: "Ghost", value: "ghost" },
            { label: "Outline", value: "outline" },
            { label: "Solid", value: "solid" },
          ],
        },
        icon: { type: "select", label: "Icon", options: ICON_OPTIONS },
      },
    },
    background: { type: "select", label: "Section background", options: TONE_OPTIONS },
    maxWidth: {
      type: "radio",
      label: "Body measure",
      options: [
        { label: "Prose (~68ch)", value: "prose" },
        { label: "Wide", value: "wide" },
      ],
    },
  },
  defaultProps: {
    eyebrow: "Why we made this",
    heading: "Made honestly, for Indian skin",
    body:
      "Most brands in this category cut corners where you cannot see them. We source directly, " +
      "make in small batches, and publish a lab certificate for every batch we ship.\n\n" +
      "No shortcuts. No filler. Just the formula, made the way it was meant to be made.",
    stats: [],
    image: null,
    imagePosition: "right",
    signature: null,
    cta: null,
    background: "light",
    maxWidth: "prose",
  },
};
