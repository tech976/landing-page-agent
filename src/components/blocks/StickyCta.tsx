"use client";

/**
 * FIXTURE 13 — `sticky-cta`                BLOCK-CATALOG §3.1 · DESIGN-SYSTEM §5.5, §6.5
 *
 * A bar pinned to the bottom of the viewport carrying price and the primary CTA. Mobile-only
 * by default. Worth a 10–25% relative lift on its own — it removes the "scroll back up to
 * buy" tax on the 67%+ of Indian traffic that is mobile.
 *
 * Client Component: genuine interactivity — scroll/intersection triggers, footer avoidance,
 * and mirroring the hero's variant selection.
 *
 * Hard requirements implemented here:
 *  - `pb-[max(0.75rem,env(safe-area-inset-bottom))]` — iOS home-indicator overlap is the #1
 *    sticky-CTA bug (DESIGN-SYSTEM §5.5).
 *  - The bar's own height is written to `document.body` as bottom padding while it is
 *    mounted, so it can never cover the last row of the footer (§3.1).
 *  - One entrance transition only — never an animation on every scroll tick (§3.1).
 *  - `z-50`, below modals/lightboxes (§6.5).
 */

import { useCallback, useEffect, useRef, useState } from "react";

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
import type { ComponentConfig } from "@measured/puck";

import type {
  CheckoutAction,
  IconName,
  Money,
  StickyCtaProps,
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

/** CTA fill per tone token. */
const CTA_TONE: Record<ToneToken, string> = {
  brand:
    "bg-primary text-on-primary shadow-cta hover:bg-primary-hover active:bg-primary-active",
  accent: "bg-accent text-on-accent shadow-cta hover:bg-accent-hover",
  neutral: "bg-secondary text-on-secondary hover:bg-secondary-hover",
  success: "bg-success text-on-accent",
  warning: "bg-warning text-fg-strong",
  danger: "bg-discount text-discount-fg",
  dark: "bg-surface-invert text-on-invert",
  light: "bg-surface text-fg-strong border-2 border-border-strong",
};

/** `showOn: "mobile"` = below 768px, per BLOCK-CATALOG §3.1. */
const SHOW_ON: Record<StickyCtaProps["showOn"], string> = {
  mobile: "flex md:hidden",
  always: "flex",
  desktop: "hidden md:flex",
};

function resolveHref(action: CheckoutAction, variantOverride?: string): string {
  switch (action.kind) {
    case "url":
      return action.href;
    case "whatsapp":
      return `https://wa.me/${action.phone}?text=${encodeURIComponent(action.messageTemplate)}`;
    case "shopify": {
      const variant = variantOverride ?? action.variantId ?? action.productId;
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

/**
 * Payload of the `lp:variant-change` window event the hero dispatches when a variant or
 * quantity changes. Purely additive — the bar works fine if the event never fires.
 */
interface VariantChangeDetail {
  productName?: string;
  price?: Money;
  compareAtPrice?: Money | null;
  savingsLabel?: string;
  variantId?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function StickyCta({
  enabled,
  showOn,
  trigger,
  productName,
  image,
  price,
  compareAtPrice,
  savingsLabel,
  cta,
  secondaryIconCta,
  hideNearFooter,
  reflectVariantSelection,
  tone,
}: StickyCtaProps) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(trigger?.mode === "immediate");
  const [nearFooter, setNearFooter] = useState(false);
  const [variant, setVariant] = useState<VariantChangeDetail | null>(null);

  /* ── Trigger: when does the bar appear? (§3.1) ─────────────────────────── */
  useEffect(() => {
    if (!enabled) return;

    if (!trigger || trigger.mode === "scroll-percent") {
      const percent = trigger?.mode === "scroll-percent" ? trigger.percent : null;
      const onScroll = () => {
        if (percent === null) {
          /* No explicit trigger: appear once the hero (≈ one viewport) has been passed. */
          if (window.scrollY > window.innerHeight * 0.6) setShown(true);
          return;
        }
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 100;
        if (progress >= percent) setShown(true);
      };
      /* Evaluate once after paint, so a page restored mid-scroll shows the bar. */
      const frame = window.requestAnimationFrame(onScroll);
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("scroll", onScroll);
      };
    }

    if (trigger.mode === "immediate") {
      const timer = window.setTimeout(() => setShown(true), 0);
      return () => window.clearTimeout(timer);
    }

    if (trigger.mode === "delay") {
      const timer = window.setTimeout(() => setShown(true), trigger.seconds * 1000);
      return () => window.clearTimeout(timer);
    }

    /* after-block: appear once the referenced block has scrolled out of view above. */
    const target =
      document.getElementById(trigger.blockId) ??
      document.querySelector(`[data-block-id="${CSS.escape(trigger.blockId)}"]`);

    if (!target) {
      /* Block not on the page — fall back to the one-viewport heuristic rather than
         leaving the highest-ROI fixture invisible. */
      const onScroll = () => {
        if (window.scrollY > window.innerHeight * 0.6) setShown(true);
      };
      const frame = window.requestAnimationFrame(onScroll);
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("scroll", onScroll);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) setShown(true);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, trigger]);

  /* ── Never stack two CTAs: hide while the final CTA / footer is in view ── */
  useEffect(() => {
    if (!enabled || !hideNearFooter) return;
    const targets = document.querySelectorAll("[data-final-cta], footer");
    if (targets.length === 0) return;

    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setNearFooter(visible.size > 0);
      },
      { threshold: 0.01 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [enabled, hideNearFooter]);

  /* ── Mirror the hero's variant / quantity selection (§3.1) ──────────────── */
  useEffect(() => {
    if (!enabled || !reflectVariantSelection) return;
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<VariantChangeDetail>).detail;
      if (detail) setVariant(detail);
    };
    window.addEventListener("lp:variant-change", onChange);
    return () => window.removeEventListener("lp:variant-change", onChange);
  }, [enabled, reflectVariantSelection]);

  /* ── Reserve space so the bar can never cover footer content (§3.1) ─────── */
  const syncBodyPadding = useCallback(() => {
    const node = barRef.current;
    if (!node) return;
    const styles = window.getComputedStyle(node);
    if (styles.display === "none") {
      document.body.style.paddingBottom = "";
      return;
    }
    document.body.style.paddingBottom = `${node.offsetHeight}px`;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    syncBodyPadding();
    window.addEventListener("resize", syncBodyPadding);
    return () => {
      window.removeEventListener("resize", syncBodyPadding);
      document.body.style.paddingBottom = "";
    };
  }, [enabled, syncBodyPadding]);

  if (!enabled) return null;

  const activePrice = variant?.price ?? price;
  const activeCompareAt =
    variant?.compareAtPrice !== undefined ? variant.compareAtPrice : compareAtPrice;
  const activeName = variant?.productName ?? productName;
  const activeSavings = variant?.savingsLabel ?? savingsLabel;
  const autoSavings =
    !activeSavings && activePrice && activeCompareAt && activeCompareAt.amount > activePrice.amount
      ? `Save ${formatMoney({
          amount: activeCompareAt.amount - activePrice.amount,
          currency: "INR",
        })}`
      : activeSavings;

  const CtaIcon = cta.icon ? ICONS[cta.icon] : null;
  const SecondaryIcon = secondaryIconCta?.icon ? ICONS[secondaryIconCta.icon] : Smartphone;
  const visible = shown && !nearFooter;

  return (
    <div
      ref={barRef}
      role="region"
      aria-label="Order bar"
      aria-hidden={!visible}
      data-sticky-cta=""
      data-state={visible ? "visible" : "hidden"}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 items-center gap-3",
        SHOW_ON[showOn],
        "bg-surface/95 backdrop-blur-md border-t border-border shadow-sticky",
        "px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        /* One entrance transition only — no per-tick animation. */
        "transition-[transform,opacity] duration-[var(--dur-base)] ease-[var(--ease-out-soft)]",
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none",
      )}
    >
      {image ? (
        <span
          className="relative hidden size-11 shrink-0 overflow-hidden rounded-md bg-surface-sunken xs:block"
          style={image.dominant ? { backgroundColor: image.dominant } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            decoding="async"
            className="size-full object-contain p-1"
          />
        </span>
      ) : null}

      <div className="flex min-w-0 flex-col justify-center">
        {activeName ? (
          /* Dropped below 360px so price + CTA always fit on one line (§3.1). */
          <span className="hidden truncate font-body text-xs leading-normal text-muted-fg xs:block">
            {activeName}
          </span>
        ) : null}

        {activePrice ? (
          <span className="flex items-baseline gap-1.5">
            <span className="font-heading text-lg font-extrabold tracking-tight tabular-nums text-price">
              {formatMoney(activePrice)}
            </span>
            {activeCompareAt ? (
              <span className="font-body text-xs font-medium tabular-nums line-through text-price-strike">
                {formatMoney(activeCompareAt)}
              </span>
            ) : null}
          </span>
        ) : null}

        {autoSavings ? (
          <span className="font-heading text-xs font-bold tabular-nums text-savings">
            {autoSavings}
          </span>
        ) : null}
      </div>

      <a
        href={resolveHref(cta.action, variant?.variantId)}
        target={actionTarget(cta.action)}
        rel={actionRel(cta.action)}
        data-action-kind={cta.action.kind}
        tabIndex={visible ? undefined : -1}
        className={cn(
          // `min-w-0` is load-bearing: flex items default to `min-width:auto`, so a
          // `whitespace-nowrap` label refuses to shrink below its text width and forces
          // the fixed bar wider than the viewport (142px of body overflow at 360px).
          "ml-auto inline-flex h-14 min-h-14 basis-[55%] min-w-0 grow items-center justify-center gap-2",
          "font-heading font-bold tracking-tight text-base whitespace-nowrap",
          "select-none cursor-pointer touch-manipulation rounded-[var(--radius-cta,var(--radius-lg))]",
          "transition-[background-color,box-shadow,transform] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]",
          "active:scale-[0.98] active:duration-[var(--dur-instant)]",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          CTA_TONE[tone],
          cta.pulse && "motion-safe:animate-[var(--animate-cta-pulse)]",
          cta.shine && "lp-cta-shine",
        )}
      >
        {CtaIcon ? <CtaIcon aria-hidden="true" className="size-5" /> : null}
        <span className="flex min-w-0 flex-col items-center leading-tight">
          <span className="max-w-full truncate">{cta.label}</span>
          {cta.sublabel ? (
            <span className="max-w-full truncate font-body text-xs font-medium opacity-90">
              {cta.sublabel}
            </span>
          ) : null}
        </span>
      </a>

      {secondaryIconCta ? (
        <a
          href={resolveHref(secondaryIconCta.action, variant?.variantId)}
          target={actionTarget(secondaryIconCta.action)}
          rel={actionRel(secondaryIconCta.action)}
          data-action-kind={secondaryIconCta.action.kind}
          aria-label={secondaryIconCta.label}
          tabIndex={visible ? undefined : -1}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center p-0",
            "rounded-[var(--radius-cta,var(--radius-lg))] border-2 border-border-strong",
            "bg-surface text-fg-strong",
            "transition-[background-color,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]",
            "hover:border-primary hover:text-primary active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
          )}
        >
          <SecondaryIcon aria-hidden="true" className="size-5" />
        </a>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Puck editor config — edited in the "Page fixtures" panel, not the drag canvas.
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

export const stickyCtaPuckConfig: PuckBlockConfig = {
  label: "Sticky CTA bar",
  fields: {
    enabled: { type: "radio", label: "Enabled", options: YES_NO },
    showOn: {
      type: "radio",
      label: "Show on",
      options: [
        { label: "Mobile only (<768px)", value: "mobile" },
        { label: "All viewports", value: "always" },
        { label: "Desktop only", value: "desktop" },
      ],
    },
    trigger: {
      type: "object",
      label: "When it appears",
      objectFields: {
        mode: {
          type: "select",
          label: "Trigger",
          options: [
            { label: "After a block scrolls away", value: "after-block" },
            { label: "Immediately", value: "immediate" },
            { label: "After scroll %", value: "scroll-percent" },
            { label: "After a delay", value: "delay" },
          ],
        },
        blockId: { type: "text", label: "Block id (for \"after a block\")" },
        percent: { type: "number", label: "Scroll % (1–100)", min: 1, max: 100 },
        seconds: { type: "number", label: "Delay in seconds", min: 0, max: 120 },
      },
    },
    productName: { type: "text", label: "Product name (blank = inherit from hero)" },
    image: {
      type: "object",
      label: "Thumbnail (blank = first hero image)",
      objectFields: {
        src: { type: "text", label: "Image URL or /public path" },
        alt: { type: "text", label: "Alt text (required)" },
      },
    },
    price: {
      type: "object",
      label: "Price (blank = inherit from hero)",
      objectFields: {
        amount: { type: "number", label: "Amount in paise (89900 = ₹899)", min: 0 },
      },
    },
    compareAtPrice: {
      type: "object",
      label: "Compare-at price",
      objectFields: {
        amount: { type: "number", label: "Amount in paise", min: 0 },
      },
    },
    savingsLabel: { type: "text", label: "Savings label (blank = auto-computed)" },
    cta: {
      type: "object",
      label: "Primary CTA — must match the hero's destination",
      objectFields: {
        label: { type: "text", label: "Label" },
        sublabel: { type: "text", label: "Sublabel" },
        icon: { type: "select", label: "Icon", options: ICON_OPTIONS },
        pulse: { type: "radio", label: "Pulse (max one per viewport)", options: YES_NO },
        shine: { type: "radio", label: "Shine — gleam sweep (max one per viewport)", options: YES_NO },
      },
    },
    secondaryIconCta: {
      type: "object",
      label: "Secondary icon button (usually WhatsApp)",
      objectFields: {
        label: { type: "text", label: "Accessible label" },
        icon: { type: "select", label: "Icon", options: ICON_OPTIONS },
      },
    },
    hideNearFooter: {
      type: "radio",
      label: "Hide when the final CTA is in view",
      options: YES_NO,
    },
    reflectVariantSelection: {
      type: "radio",
      label: "Mirror hero variant selection",
      options: YES_NO,
    },
    tone: {
      type: "select",
      label: "CTA tone",
      options: [
        { label: "Brand", value: "brand" },
        { label: "Accent", value: "accent" },
        { label: "Neutral", value: "neutral" },
        { label: "Success", value: "success" },
        { label: "Warning", value: "warning" },
        { label: "Danger", value: "danger" },
        { label: "Dark", value: "dark" },
        { label: "Light", value: "light" },
      ],
    },
  },
  defaultProps: {
    enabled: true,
    showOn: "mobile",
    trigger: null,
    image: null,
    compareAtPrice: null,
    cta: {
      label: "Buy Now",
      variant: "solid",
      pulse: false,
      shine: true,
      action: { kind: "url", href: "#offer-stack", target: "_self" },
    },
    secondaryIconCta: null,
    hideNearFooter: true,
    reflectVariantSelection: true,
    tone: "brand",
  },
};
