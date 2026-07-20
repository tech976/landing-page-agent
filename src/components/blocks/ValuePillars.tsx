/**
 * BLOCK 8 — value-pillars                                    BLOCK-CATALOG §2.8
 *
 * 3–6 icon- or number-led value propositions. The block a visitor reads in four
 * seconds while deciding whether to keep scrolling.
 *
 * MOBILE (§2.8): a 2/3-column set collapses to a single column with the icon
 * inline-left and the text to its right — ~40% shorter than icon-above-text and
 * still scannable. A 4-column set collapses to 2×2 with the icon above.
 * Descriptions clamp at 3 lines with no expander: if the copy doesn't fit, the
 * copy is wrong.
 *
 * Server Component — nothing here is interactive.
 */

import Image from "next/image";
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
} from "lucide-react";
import type { ComponentConfig, Fields } from "@measured/puck";

import type { IconName, Pillar, ToneToken, ValuePillarsProps } from "@/lib/schema/page";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Static token lookups — never `bg-${token}`, never a colour literal.
   ──────────────────────────────────────────────────────────────────────────── */

const ICONS: Record<IconName, typeof Truck> = {
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

const SUB_TONE: Record<ToneToken, string> = {
  light: "text-muted-fg",
  neutral: "text-muted-fg",
  dark: "text-on-invert",
  brand: "text-muted-fg",
  accent: "text-muted-fg",
  success: "text-muted-fg",
  warning: "text-muted-fg",
  danger: "text-muted-fg",
};

/** Per-pillar icon tint. Foreground colour only — the chip fill is derived below. */
const ICON_TONE: Record<ToneToken, string> = {
  brand: "text-primary",
  accent: "text-accent",
  neutral: "text-fg-strong",
  success: "text-success-fg",
  warning: "text-warning-fg",
  danger: "text-danger-fg",
  dark: "text-fg-strong",
  light: "text-primary",
};

const ICON_CHIP_TONE: Record<ToneToken, string> = {
  brand: "bg-primary-soft",
  accent: "bg-accent-soft",
  neutral: "bg-muted",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  dark: "bg-muted",
  light: "bg-primary-soft",
};

const ICON_SHAPE: Record<ValuePillarsProps["iconStyle"], string> = {
  circle: "rounded-full",
  square: "rounded-lg",
  plain: "",
  none: "",
};

/**
 * Column maps. A 4-up set is 2×2 on mobile with the icon above; 2/3-up sets are a
 * single column on mobile with the icon inline-left.
 */
const GRID_COLUMNS: Record<2 | 3 | 4, string> = {
  2: "grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:gap-8",
  3: "grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8",
  4: "grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-8",
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI"] as const;

function numberLabel(index: number, numbering: ValuePillarsProps["numbering"]): string | null {
  if (numbering === "none") return null;
  if (numbering === "roman") return ROMAN[index] ?? String(index + 1);
  return String(index + 1).padStart(2, "0");
}

/* ────────────────────────────────────────────────────────────────────────────
   Block
   ──────────────────────────────────────────────────────────────────────────── */

function PillarItem({
  pillar,
  index,
  numbering,
  iconStyle,
  align,
  stacked,
  divider,
}: {
  pillar: Pillar;
  index: number;
  numbering: ValuePillarsProps["numbering"];
  iconStyle: ValuePillarsProps["iconStyle"];
  align: ValuePillarsProps["align"];
  /** true = 4-column set: icon above the text at every breakpoint. */
  stacked: boolean;
  divider: boolean;
}) {
  const Icon = ICONS[pillar.icon];
  const tone = pillar.tone ?? "brand";
  const badge = numberLabel(index, numbering);
  const showIcon = iconStyle !== "none";
  const chipped = iconStyle === "circle" || iconStyle === "square";

  return (
    <li
      className={cn(
        "flex gap-4",
        stacked ? "flex-col items-center text-center" : "flex-row items-start sm:flex-col",
        !stacked && align === "center" && "sm:items-center sm:text-center",
        !stacked && align === "left" && "sm:items-start sm:text-left",
        stacked && align === "left" && "lg:items-start lg:text-left",
        divider &&
          "border-border pb-5 not-last:border-b sm:pb-0 sm:not-last:border-b-0 sm:not-last:border-r sm:not-last:pr-6",
      )}
    >
      {showIcon ? (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center",
            chipped
              ? cn("size-12 sm:size-14", ICON_CHIP_TONE[tone], ICON_SHAPE[iconStyle])
              : "size-12 sm:size-14",
          )}
        >
          {pillar.image ? (
            <span className="relative block size-12 overflow-hidden rounded-lg bg-muted sm:size-14">
              <Image
                src={pillar.image.src}
                alt={pillar.image.alt}
                fill
                loading="lazy"
                decoding="async"
                sizes="56px"
                className="size-full object-contain"
              />
            </span>
          ) : (
            <Icon aria-hidden="true" className={cn("size-6 sm:size-7", ICON_TONE[tone])} strokeWidth={2} />
          )}
        </span>
      ) : null}

      <div className={cn("flex min-w-0 flex-col gap-1.5", stacked && "items-center")}>
        {badge ? (
          <span className="font-heading text-xs font-extrabold tracking-widest tabular-nums text-primary">
            {badge}
          </span>
        ) : null}
        <h3 className="font-heading text-lg font-bold tracking-tight text-balance text-fg-strong">
          {pillar.title}
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-pretty text-muted-fg sm:text-base">
          {pillar.description}
        </p>
      </div>
    </li>
  );
}

export default function ValuePillars({
  heading,
  subheading,
  pillars,
  numbering,
  columns,
  iconStyle,
  align,
  divider,
  background,
}: ValuePillarsProps) {
  const hasHeader = Boolean(heading || subheading);
  const stacked = columns === 4;

  return (
    <section
      className={cn("py-[var(--space-section)]", SECTION_TONE[background])}
      aria-labelledby={heading ? "value-pillars-heading" : undefined}
      aria-label={heading ? undefined : "Why choose us"}
    >
      <div className="mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)]">
        {hasHeader ? (
          <header className="mx-auto mb-10 flex max-w-[var(--container-narrow)] flex-col gap-3 text-center sm:mb-14">
            {heading ? (
              <h2
                id="value-pillars-heading"
                className={cn(
                  "font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-4xl",
                  HEADING_TONE[background],
                )}
              >
                {heading}
              </h2>
            ) : null}
            {subheading ? (
              <p className={cn("mx-auto max-w-prose text-base text-pretty sm:text-lg", SUB_TONE[background])}>
                {subheading}
              </p>
            ) : null}
          </header>
        ) : null}

        <ul className={GRID_COLUMNS[columns]}>
          {pillars.map((pillar, index) => (
            <PillarItem
              key={pillar.id}
              pillar={pillar}
              index={index}
              numbering={numbering}
              iconStyle={iconStyle}
              align={align}
              stacked={stacked}
              divider={divider}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Puck editor config
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

const ICON_OPTIONS = [
  { label: "Truck (shipping)", value: "truck" },
  { label: "Shield check (safety)", value: "shield-check" },
  { label: "Return arrow", value: "rotate-ccw" },
  { label: "Banknote (COD)", value: "banknote" },
  { label: "Phone (UPI/WhatsApp)", value: "smartphone" },
  { label: "Leaf (natural)", value: "leaf" },
  { label: "Sparkles", value: "sparkles" },
  { label: "Clock", value: "clock" },
  { label: "Flame", value: "flame" },
  { label: "Heart", value: "heart" },
  { label: "Star", value: "star" },
  { label: "Award", value: "award" },
  { label: "Package", value: "package" },
  { label: "Thumbs up", value: "thumbs-up" },
  { label: "Zap", value: "zap" },
  { label: "Lock", value: "lock" },
  { label: "Headphones", value: "headphones" },
  { label: "Check", value: "check" },
  { label: "Cross", value: "x" },
  { label: "Gift", value: "gift" },
];

const BOOL_OPTIONS = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

export const valuePillarsPuckConfig: Omit<ComponentConfig<ValuePillarsProps>, "render"> = {
  label: "Value Pillars",
  fields: {
    heading: { type: "text", label: "Heading (optional)" },
    subheading: { type: "text", label: "Sub-heading" },
    pillars: {
      type: "array",
      label: "Pillars (3–6)",
      min: 3,
      max: 6,
      getItemSummary: (item: Pillar) => item?.title ?? "Pillar",
      arrayFields: {
        id: { type: "text", label: "ID (stable — do not reuse)" },
        icon: { type: "select", label: "Icon", options: ICON_OPTIONS },
        title: { type: "text", label: "Title (benefit, not feature)" },
        description: { type: "textarea", label: "Description (30–160 chars)" },
        tone: { type: "select", label: "Icon tone", options: TONE_OPTIONS },
      },
    },
    numbering: {
      type: "select",
      label: "Numbering",
      options: [
        { label: "None (parallel benefits)", value: "none" },
        { label: "Numeric (process steps)", value: "numeric" },
        { label: "Roman", value: "roman" },
      ],
    },
    columns: {
      type: "select",
      label: "Desktop columns",
      options: [
        { label: "2 columns", value: 2 },
        { label: "3 columns", value: 3 },
        { label: "4 columns", value: 4 },
      ],
    },
    iconStyle: {
      type: "select",
      label: "Icon container",
      options: [
        { label: "Circle", value: "circle" },
        { label: "Square", value: "square" },
        { label: "Plain", value: "plain" },
        { label: "No icon", value: "none" },
      ],
    },
    align: {
      type: "radio",
      label: "Text alignment",
      options: [
        { label: "Center", value: "center" },
        { label: "Left", value: "left" },
      ],
    },
    divider: { type: "radio", label: "Rules between pillars", options: BOOL_OPTIONS },
    background: { type: "select", label: "Section background", options: TONE_OPTIONS },
    /* Pillar images are optional and nullable-shaped in the schema; they are set by
       the generator rather than hand-edited, so no field is exposed for them here. */
  } as unknown as Fields<ValuePillarsProps>,
  defaultProps: {
    heading: "Why thousands of Indian shoppers chose us",
    pillars: [
      {
        id: "pil_quality",
        icon: "sparkles",
        title: "Certified quality",
        description:
          "Every batch is lab tested and ships with a certificate number printed on the carton.",
        tone: "brand",
      },
      {
        id: "pil_clean",
        icon: "leaf",
        title: "Clean formulation",
        description:
          "No parabens, no mineral oil, no synthetic fragrance. Just what the label says, nothing else.",
        tone: "accent",
      },
      {
        id: "pil_cod",
        icon: "banknote",
        title: "COD & easy returns",
        description:
          "Pay cash on delivery anywhere in India. Not happy within 15 days? Full refund, no questions.",
        tone: "success",
      },
      {
        id: "pil_ship",
        icon: "truck",
        title: "Fast, tracked delivery",
        description:
          "Dispatched within 24 hours with a WhatsApp tracking link. 2–3 days to metros, 4–6 elsewhere.",
        tone: "brand",
      },
    ],
    numbering: "none",
    columns: 4,
    iconStyle: "circle",
    align: "center",
    divider: false,
    background: "light",
  },
};
