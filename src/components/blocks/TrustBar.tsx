/**
 * FIXTURE 15 — `trust-bar`                 BLOCK-CATALOG §3.3 · DESIGN-SYSTEM §6, §8.1
 *
 * A slim row of trust badges plus an optional payment-method row. Sits above the footer
 * and/or under the hero, at the exact moment of transaction anxiety. In India, visible
 * UPI/COD marks and an authenticity guarantee measurably reduce checkout drop-off.
 *
 * Server Component. `placement` is honoured by the page renderer, which decides where to
 * mount this fixture; the component itself just draws the bar.
 *
 * §3.3 mobile: 4 badges → 2×2, 6 → 3×2, more than 6 → horizontal snap strip.
 * Total fixture height stays ≤ 140px on mobile.
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

import type { IconName, PaymentLogo, ToneToken, TrustBarProps } from "@/lib/schema/page";
import { PAYMENT_LOGOS } from "@/lib/schema/page";
import { cn } from "@/lib/utils";

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

const BAR_TONE: Record<ToneToken, string> = {
  brand: "bg-primary-soft",
  accent: "bg-accent-soft",
  neutral: "bg-surface-sunken",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  dark: "bg-surface-invert text-on-invert",
  light: "bg-surface",
};

/** Payment marks render as wordmarks — no third-party logo assets are bundled. */
const PAYMENT_LABELS: Record<PaymentLogo, string> = {
  upi: "UPI",
  gpay: "GPay",
  phonepe: "PhonePe",
  paytm: "Paytm",
  visa: "VISA",
  mastercard: "Mastercard",
  rupay: "RuPay",
  amex: "Amex",
  netbanking: "Net Banking",
  cod: "Cash on Delivery",
  razorpay: "Razorpay",
};

const PAYMENT_SET = new Set<string>(PAYMENT_LOGOS);

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function TrustBar({
  enabled,
  badges,
  style,
  showLabels,
  paymentLogos,
  tone,
  bordered,
}: TrustBarProps) {
  if (!enabled || badges.length === 0) return null;

  const count = badges.length;
  const onDark = tone === "dark";
  /* More than 6 badges would wrap into a third mobile row — scroll instead. */
  const scrollOnMobile = count > 6;

  const listClasses = scrollOnMobile
    ? cn(
        "flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-[var(--space-gutter)]",
        "px-[var(--space-gutter)] -mx-[var(--space-gutter)] pb-1",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-8",
      )
    : cn("grid gap-3 sm:gap-4", count <= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-6");

  /* Defensive: only render marks that exist in the locked PaymentLogo enum. */
  const payments = paymentLogos.filter((logo): logo is PaymentLogo => PAYMENT_SET.has(logo));

  return (
    <section
      data-block="trust-bar"
      aria-label="Trust and payment information"
      className={cn(
        "py-[var(--space-section-sm)]",
        BAR_TONE[tone],
        bordered && "border-y border-border",
      )}
    >
      <div className="mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)]">
        <ul className={cn("list-none", listClasses)}>
          {badges.map((badge) => {
            const BadgeIcon = badge.icon ? ICONS[badge.icon] : null;
            const useImage = badge.image && style !== "icons";

            return (
              <li
                key={badge.id}
                title={badge.tooltip}
                className={cn(
                  "flex flex-col items-center gap-1.5 text-center",
                  scrollOnMobile && "snap-start shrink-0 w-28 sm:w-auto sm:shrink",
                )}
              >
                {useImage && badge.image ? (
                  <span className="flex h-8 w-full items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={badge.image.src}
                      alt={badge.image.alt}
                      width={badge.image.width}
                      height={badge.image.height}
                      loading="lazy"
                      decoding="async"
                      className="h-8 w-auto max-w-[7.5rem] object-contain"
                    />
                  </span>
                ) : BadgeIcon ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-full",
                      onDark ? "bg-surface-invert text-on-invert" : "bg-primary-soft text-primary",
                    )}
                  >
                    <BadgeIcon className="size-5" />
                  </span>
                ) : null}

                {showLabels ? (
                  <>
                    <span
                      className={cn(
                        "font-heading text-xs font-semibold tracking-tight line-clamp-2",
                        onDark ? "text-on-invert" : "text-fg-strong",
                      )}
                    >
                      {badge.label}
                    </span>
                    {badge.sublabel ? (
                      <span
                        className={cn(
                          "font-body text-xs leading-normal line-clamp-2",
                          onDark ? "text-on-invert" : "text-muted-fg",
                        )}
                      >
                        {badge.sublabel}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="sr-only">{badge.label}</span>
                )}
              </li>
            );
          })}
        </ul>

        {payments.length > 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 border-t border-border pt-5">
            <p
              className={cn(
                "font-body text-xs uppercase tracking-widest",
                onDark ? "text-on-invert" : "text-muted-fg",
              )}
            >
              Pay your way
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-2 list-none">
              {payments.map((logo) => (
                <li
                  key={logo}
                  className={cn(
                    "rounded-sm border border-border px-2 py-1",
                    "font-heading text-xs font-semibold tracking-wide",
                    onDark ? "bg-surface-invert text-on-invert" : "bg-surface text-muted-fg",
                  )}
                >
                  {PAYMENT_LABELS[logo]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Puck editor config — "Page fixtures" panel.
   ──────────────────────────────────────────────────────────────────────────── */

type PuckBlockConfig = Omit<ComponentConfig, "render">;

const YES_NO = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

const ICON_OPTIONS = [
  { label: "None", value: "" },
  ...(Object.keys(ICONS) as IconName[]).map((name) => ({ label: name, value: name })),
];

export const trustBarPuckConfig: PuckBlockConfig = {
  label: "Trust badge bar",
  fields: {
    enabled: { type: "radio", label: "Enabled", options: YES_NO },
    placement: {
      type: "radio",
      label: "Placement",
      options: [
        { label: "Above footer", value: "above-footer" },
        { label: "Below hero", value: "below-hero" },
        { label: "Both", value: "both" },
      ],
    },
    badges: {
      type: "array",
      label: "Badges (3–8)",
      min: 3,
      max: 8,
      getItemSummary: (item: { label?: string }) => item?.label || "Badge",
      defaultItemProps: { id: "tb_new", icon: "shield-check", label: "100% authentic" },
      arrayFields: {
        icon: { type: "select", label: "Icon", options: ICON_OPTIONS },
        label: { type: "text", label: "Label (max 24 chars)" },
        sublabel: { type: "text", label: "Sublabel (max 32 chars)" },
        tooltip: { type: "text", label: "Tooltip" },
        image: {
          type: "object",
          label: "Certification mark (overrides the icon)",
          objectFields: {
            src: { type: "text", label: "Image URL or /public path" },
            alt: { type: "text", label: "Alt text (required)" },
          },
        },
      },
    },
    style: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Mixed", value: "mixed" },
        { label: "Icons", value: "icons" },
        { label: "Logos", value: "logos" },
      ],
    },
    showLabels: { type: "radio", label: "Show labels", options: YES_NO },
    /**
     * `paymentLogos` is `PaymentLogo[]` — a list of enum strings. Puck array fields only edit
     * arrays of OBJECTS, so this is edited as one mark per line. The registry adapter splits
     * on "\n" when writing and joins on read; unknown values are dropped both by Zod and,
     * defensively, at render time.
     */
    paymentLogos: {
      type: "textarea",
      label: `Payment marks — one per line. Allowed: ${PAYMENT_LOGOS.join(", ")}`,
    },
    tone: {
      type: "select",
      label: "Bar background",
      options: [
        { label: "Neutral", value: "neutral" },
        { label: "Light", value: "light" },
        { label: "Brand", value: "brand" },
        { label: "Accent", value: "accent" },
        { label: "Success", value: "success" },
        { label: "Warning", value: "warning" },
        { label: "Danger", value: "danger" },
        { label: "Dark", value: "dark" },
      ],
    },
    bordered: { type: "radio", label: "Hairline top/bottom borders", options: YES_NO },
  },
  defaultProps: {
    enabled: true,
    placement: "above-footer",
    badges: [
      { id: "tb_ship", icon: "truck", label: "Free shipping", sublabel: "On orders above ₹499" },
      { id: "tb_cod", icon: "banknote", label: "Cash on Delivery", sublabel: "24,000+ pincodes" },
      { id: "tb_return", icon: "rotate-ccw", label: "15-day returns", sublabel: "No questions asked" },
    ],
    style: "mixed",
    showLabels: true,
    paymentLogos: [],
    tone: "neutral",
    bordered: true,
  },
};
