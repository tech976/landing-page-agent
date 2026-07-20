/**
 * BLOCK 7 — `persona-cards`                BLOCK-CATALOG §2.7 · DESIGN-SYSTEM §6.3, §8.1
 *
 * Two to four buyer-persona cards. The visitor recognises themselves and is routed to the
 * right SKU instead of bouncing.
 *
 * Server Component.
 *
 * RESOLUTION RULE (§2.7): when `recommended.offerId` is present, name/price/image are owned by
 * the referenced offer-stack offer — this component renders `data-offer-ref` and shows only
 * what is actually present in props. It never invents a product name or a price.
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
  Persona,
  PersonaCardsProps,
  ToneToken,
} from "@/lib/schema/page";
import { cn, formatMoney } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Token lookups
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

const CARD_STYLE: Record<PersonaCardsProps["cardStyle"], string> = {
  outlined: "bg-surface-raised border border-border shadow-card",
  filled: "bg-surface-sunken border border-border",
  "image-top": "bg-surface-raised border border-border shadow-card",
};

const DESKTOP_COLS: Record<2 | 3 | 4, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
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
  "active:duration-[var(--dur-instant)] h-12 min-h-12 w-full px-6 text-base";

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

function PersonaCard({
  persona,
  cardStyle,
}: {
  persona: Persona;
  cardStyle: PersonaCardsProps["cardStyle"];
}) {
  const { recommended } = persona;
  const PersonaIcon = persona.icon ? ICONS[persona.icon] : null;
  const CtaIcon = recommended.cta.icon ? ICONS[recommended.cta.icon] : null;
  const showImageTop = cardStyle === "image-top" && Boolean(persona.image);
  const recImage = recommended.image;

  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl",
        CARD_STYLE[cardStyle],
        "transition-[transform,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out-soft)]",
        "motion-safe:md:hover:-translate-y-1 md:hover:shadow-lg",
      )}
    >
      {showImageTop && persona.image ? (
        <div
          className="relative overflow-hidden bg-muted aspect-persona"
          style={persona.image.dominant ? { backgroundColor: persona.image.dominant } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={persona.image.src}
            alt={persona.image.alt}
            width={persona.image.width}
            height={persona.image.height}
            loading="lazy"
            decoding="async"
            /* Faces are cropped from the top — centre-cropping decapitates people (§8.2). */
            className={cn("size-full object-cover object-top", FOCAL[persona.image.focal])}
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {!showImageTop && persona.image ? (
          <div
            className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted"
            style={persona.image.dominant ? { backgroundColor: persona.image.dominant } : undefined}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={persona.image.src}
              alt={persona.image.alt}
              loading="lazy"
              decoding="async"
              className="size-full object-cover object-top"
            />
          </div>
        ) : !showImageTop && PersonaIcon ? (
          <span
            aria-hidden="true"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
          >
            <PersonaIcon className="size-6" />
          </span>
        ) : null}

        <h3 className="font-heading text-xl font-bold tracking-tight text-fg-strong text-balance">
          {persona.title}
        </h3>

        <p className="font-body text-base leading-relaxed text-fg text-pretty">
          {persona.description}
        </p>

        {persona.matchPoints.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {persona.matchPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 font-body text-sm leading-normal text-muted-fg">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* Recommendation footer — pinned to the bottom so cards align on desktop. */}
        <div
          className="mt-auto flex flex-col gap-3 rounded-lg border border-border bg-surface-sunken p-3 sm:p-4"
          data-offer-ref={recommended.offerId}
        >
          {recommended.productName || recImage || recommended.price ? (
            <div className="flex items-center gap-3">
              {recImage ? (
                <span
                  className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted"
                  style={recImage.dominant ? { backgroundColor: recImage.dominant } : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={recImage.src}
                    alt={recImage.alt}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-contain p-1"
                  />
                </span>
              ) : null}
              <span className="flex min-w-0 flex-col">
                {recommended.productName ? (
                  <span className="truncate font-heading text-sm font-semibold tracking-tight text-fg-strong">
                    {recommended.productName}
                  </span>
                ) : null}
                {recommended.price ? (
                  <span className="font-heading text-lg font-extrabold tracking-tight tabular-nums text-price">
                    {formatMoney(recommended.price)}
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}

          {recommended.reason ? (
            <p className="font-body text-xs leading-normal text-muted-fg text-pretty">
              {recommended.reason}
            </p>
          ) : null}

          <a
            href={resolveHref(recommended.cta.action)}
            target={actionTarget(recommended.cta.action)}
            rel={actionRel(recommended.cta.action)}
            data-action-kind={recommended.cta.action.kind}
            className={cn(CTA_BASE, CTA_VARIANT[recommended.cta.variant ?? "solid"])}
          >
            {CtaIcon ? <CtaIcon aria-hidden="true" className="size-5" /> : null}
            <span>{recommended.cta.label}</span>
          </a>

          {recommended.cta.sublabel ? (
            <p className="text-center font-body text-xs leading-normal text-muted-fg">
              {recommended.cta.sublabel}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function PersonaCards({
  heading,
  subheading,
  personas,
  columns,
  cardStyle,
  background,
}: PersonaCardsProps) {
  const cols = (columns ?? (personas.length as 2 | 3 | 4)) as 2 | 3 | 4;
  /* §2.7 mobile: 4 personas stacked is a ~2000px wall — switch to a snap carousel. */
  const mobileCarousel = personas.length >= 4;

  const listClasses = mobileCarousel
    ? cn(
        "flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-[var(--space-gutter)]",
        "px-[var(--space-gutter)] -mx-[var(--space-gutter)] pb-2",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "md:mx-0 md:grid md:gap-8 md:overflow-visible md:px-0 md:pb-0",
        DESKTOP_COLS[cols],
      )
    : cn("grid grid-cols-1 gap-6 md:gap-8", DESKTOP_COLS[cols]);

  return (
    <section
      data-block="persona-cards"
      className={cn("py-[var(--space-section)]", SECTION_TONE[background])}
    >
      <div className="mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)]">
        {heading || subheading ? (
          <header className="mx-auto mb-10 flex max-w-[var(--container-narrow)] flex-col gap-3 text-center sm:mb-14 sm:gap-4">
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
          {personas.map((persona) => (
            <li
              key={persona.id}
              className={cn(
                mobileCarousel && "snap-start shrink-0 w-[82vw] xs:w-[74vw] md:w-auto md:shrink",
              )}
            >
              <PersonaCard persona={persona} cardStyle={cardStyle} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Puck editor config
   ──────────────────────────────────────────────────────────────────────────── */

type PuckBlockConfig = Omit<ComponentConfig, "render">;

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
  { label: "None", value: "" },
  ...(Object.keys(ICONS) as IconName[]).map((name) => ({ label: name, value: name })),
];

export const personaCardsPuckConfig: PuckBlockConfig = {
  label: "Persona cards",
  fields: {
    heading: { type: "text", label: "Heading" },
    subheading: { type: "text", label: "Subheading" },
    personas: {
      type: "array",
      label: "Personas (2–4)",
      min: 2,
      max: 4,
      getItemSummary: (item: { title?: string }) => item?.title || "Persona",
      defaultItemProps: {
        id: "per_new",
        title: "You're new to this category",
        description:
          "Describe the pain in the customer's own words before you name the fix. Two sentences is usually enough.",
        matchPoints: [],
        recommended: {
          cta: {
            label: "See the pack",
            variant: "solid",
            pulse: false,
            action: { kind: "url", href: "#offer-stack", target: "_self" },
          },
        },
      },
      arrayFields: {
        title: { type: "text", label: "Title — second person, max 52 chars" },
        description: { type: "textarea", label: "Description (40–220 chars)" },
        icon: { type: "select", label: "Icon (used when no image)", options: ICON_OPTIONS },
        image: {
          type: "object",
          label: "Image",
          objectFields: {
            src: { type: "text", label: "Image URL or /public path" },
            alt: { type: "text", label: "Alt text (required)" },
          },
        },
        /**
         * `matchPoints` is `string[]`. Puck array fields only edit arrays of OBJECTS, so a
         * plain string list is edited as one line per point. The registry adapter joins with
         * "\n" on read and splits on "\n" on write — bijective for single-line strings, so the
         * JSON round-trip stays lossless.
         */
        matchPoints: {
          type: "textarea",
          label: "\"This is you if…\" points — one per line, max 4",
        },
        recommended: {
          type: "object",
          label: "Recommendation",
          objectFields: {
            offerId: { type: "text", label: "Offer id from the offer stack (preferred)" },
            productName: { type: "text", label: "Product name (only when no offer id)" },
            reason: { type: "text", label: "Reason (max 60 chars)" },
          },
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
    cardStyle: {
      type: "radio",
      label: "Card style",
      options: [
        { label: "Outlined", value: "outlined" },
        { label: "Filled", value: "filled" },
        { label: "Image top", value: "image-top" },
      ],
    },
    background: { type: "select", label: "Section background", options: TONE_OPTIONS },
  },
  defaultProps: {
    heading: "Which one is right for you?",
    personas: [],
    cardStyle: "outlined",
    background: "neutral",
  },
};
