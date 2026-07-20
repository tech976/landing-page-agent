"use client";

/**
 * FIXTURE 14 — `social-proof-popup`        BLOCK-CATALOG §3.2 · DESIGN-SYSTEM §6.5, §7
 *
 * Recent-purchase toasts on a timed rotation: "Rohan from Jaipur just ordered Pack of 2".
 *
 * Client Component: timed rotation, dismissal, session cap.
 *
 * GOVERNANCE — the single most important rule in this file:
 *   If the events array is empty, or the data source is absent, this component renders
 *   NOTHING. It never fabricates a name, a city, a product or a time. Every rendered toast
 *   is a datum that already existed in the page JSON (or in the source's declared fallback).
 *   `mode: "simulated"` additionally renders its mandatory disclosure.
 *
 * Layout rules:
 *   - Never bottom-anchored on mobile by default — that space belongs to `sticky-cta`.
 *     If a marketer explicitly picks `mobilePosition: "bottom"`, the toast is lifted clear of
 *     the sticky bar (and of the iOS home indicator) so the two can never overlap.
 *   - `z-40`, i.e. below the sticky CTA bar (§6.5).
 *   - Slide-in is `motion-safe:` only; reduced motion gets a plain fade (§7).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Check, X } from "lucide-react";
import type { ComponentConfig } from "@measured/puck";

import type {
  CheckoutAction,
  PopupEvent,
  PopupSource,
  SocialProofPopupProps,
} from "@/lib/schema/page";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "lp:social-proof-popup:dismissed";

/* ────────────────────────────────────────────────────────────────────────────
   Data — resolve, never invent
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Returns the events this component is allowed to display.
 * Remote modes render their declared `fallback` (the schema makes it mandatory) — the live
 * fetch belongs to the server/ISR layer, and a client that cannot resolve real orders must
 * not guess.
 */
function eventsFromSource(source: PopupSource | null | undefined): PopupEvent[] {
  if (!source) return [];
  switch (source.mode) {
    case "static":
    case "simulated":
      return source.events ?? [];
    case "orders-api":
    case "shopify-orders":
      return source.fallback ?? [];
    default:
      return [];
  }
}

function formatTimeAgo(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** Token substitution only — an absent field collapses instead of being invented. */
function renderTemplate(template: string, event: PopupEvent): string {
  return template
    .replace(/\{name\}/g, event.name)
    .replace(/\{city\}/g, event.city)
    .replace(/\{product\}/g, event.product)
    .replace(/\{variant\}/g, event.variant ?? event.product)
    .replace(/\{quantity\}/g, event.quantity != null ? String(event.quantity) : "")
    .replace(/\{timeAgo\}/g, event.minutesAgo != null ? formatTimeAgo(event.minutesAgo) : "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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

/* ────────────────────────────────────────────────────────────────────────────
   Position maps
   ──────────────────────────────────────────────────────────────────────────── */

const DESKTOP_POSITION: Record<SocialProofPopupProps["position"], string> = {
  "bottom-left": "sm:left-4 sm:right-auto sm:bottom-4 sm:top-auto",
  "bottom-right": "sm:right-4 sm:left-auto sm:bottom-4 sm:top-auto",
  "top-right": "sm:right-4 sm:left-auto sm:top-4 sm:bottom-auto",
};

const MOBILE_POSITION: Record<SocialProofPopupProps["mobilePosition"], string> = {
  top: "left-3 right-3 top-3",
  /* Lifted clear of the 64–72px sticky CTA bar and the iOS home indicator. */
  bottom: "left-3 right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))]",
  hidden: "max-sm:hidden left-3 right-3 top-3",
};

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function SocialProofPopup({
  enabled,
  source,
  position,
  mobilePosition,
  template,
  showImage,
  showTimeAgo,
  initialDelaySeconds,
  intervalSeconds,
  displaySeconds,
  maxPerSession,
  dismissible,
  clickAction,
  disclosure,
}: SocialProofPopupProps) {
  const events = useMemo(() => eventsFromSource(source), [source]);
  const shuffle = source?.mode === "simulated" ? source.shuffle : false;

  const [order, setOrder] = useState<number[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shownCount = useRef(0);
  const shuffled = useRef(false);

  /* ── Rotation ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!enabled || dismissed || events.length === 0) return;

    let cancelled = false;
    let showTimer = 0;
    let hideTimer = 0;

    const scheduleNext = (delayMs: number) => {
      showTimer = window.setTimeout(() => {
        if (cancelled) return;

        /* Session-scoped dismissal. Read here rather than on mount so SSR and the first
           client render produce identical markup. */
        try {
          if (window.sessionStorage.getItem(DISMISS_KEY) === "1") {
            setDismissed(true);
            return;
          }
        } catch {
          /* storage blocked — treat as not dismissed */
        }

        /* Suppressed while a modal, lightbox or form overlay owns the screen (§3.2). */
        if (document.querySelector("[data-lp-overlay-open]")) {
          scheduleNext(intervalSeconds * 1000);
          return;
        }

        /* Shuffle once, off the render path — a random order during render would break
           hydration. `simulated` sources may opt into this; real order data never does. */
        if (shuffle && !shuffled.current && events.length > 1) {
          shuffled.current = true;
          const next = events.map((_, i) => i);
          for (let i = next.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [next[i], next[j]] = [next[j], next[i]];
          }
          setOrder(next);
        }

        setVisible(true);
        shownCount.current += 1;

        hideTimer = window.setTimeout(() => {
          if (cancelled) return;
          setVisible(false);
          if (shownCount.current < maxPerSession) {
            setCursor((c) => c + 1);
            scheduleNext(intervalSeconds * 1000);
          }
        }, displaySeconds * 1000);
      }, delayMs);
    };

    scheduleNext(initialDelaySeconds * 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [
    enabled,
    dismissed,
    events,
    shuffle,
    initialDelaySeconds,
    intervalSeconds,
    displaySeconds,
    maxPerSession,
  ]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage blocked — dismissal stays in-memory for this page view */
    }
  }, []);

  /* ── The governance gate: no source, no events → render nothing at all. ── */
  if (!enabled || dismissed || events.length === 0) return null;

  /* Identity order until (and unless) a shuffle lands; also guards a props edit that
     changed the event list underneath a stale order. */
  const playOrder =
    order && order.length === events.length ? order : events.map((_, i) => i);
  const event = events[playOrder[cursor % playOrder.length] ?? 0];
  if (!event) return null;

  const message = renderTemplate(template, event);
  if (!message) return null;

  const timeAgo =
    showTimeAgo && event.minutesAgo != null ? formatTimeAgo(event.minutesAgo) : null;
  const disclosureText =
    source && source.mode === "simulated" ? (disclosure ?? source.disclosure) : null;

  const content = (
    <>
      {showImage && event.image ? (
        <span
          className="relative size-10 shrink-0 overflow-hidden rounded-md bg-surface-sunken"
          style={event.image.dominant ? { backgroundColor: event.image.dominant } : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image.src}
            alt={event.image.alt}
            loading="lazy"
            decoding="async"
            className="size-full object-contain p-0.5"
          />
        </span>
      ) : null}

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-body text-sm leading-snug text-fg line-clamp-2">{message}</span>
        <span className="flex flex-wrap items-center gap-x-2 font-body text-xs leading-normal text-muted-fg">
          {timeAgo ? <span className="tabular-nums">{timeAgo}</span> : null}
          {event.verified ? (
            <span className="inline-flex items-center gap-1 text-trust">
              <Check aria-hidden="true" className="size-3" />
              Verified order
            </span>
          ) : null}
          {disclosureText ? <span title={disclosureText}>Indicative</span> : null}
        </span>
      </span>
    </>
  );

  return (
    <div
      role="status"
      aria-live="polite"
      data-social-proof-popup=""
      className={cn(
        "fixed z-40 flex items-center gap-3",
        MOBILE_POSITION[mobilePosition],
        DESKTOP_POSITION[position],
        "sm:w-[22rem] sm:max-w-[calc(100vw-2rem)]",
        "rounded-xl border border-border bg-surface-raised p-3 shadow-lg",
        "transition-opacity duration-[var(--dur-base)] ease-[var(--ease-out-soft)]",
        visible
          ? "opacity-100 motion-safe:animate-[var(--animate-toast-in)]"
          : "pointer-events-none opacity-0",
      )}
      aria-hidden={!visible}
    >
      {clickAction ? (
        <a
          href={resolveHref(clickAction)}
          data-action-kind={clickAction.kind}
          tabIndex={visible ? undefined : -1}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-md",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
          )}
        >
          {content}
        </a>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{content}</span>
      )}

      {dismissible ? (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss purchase notifications"
          tabIndex={visible ? undefined : -1}
          className={cn(
            "-mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md",
            "text-muted-fg touch-manipulation",
            "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]",
            "hover:bg-muted hover:text-fg-strong",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
          )}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Puck editor config — "Page fixtures" panel.
   The `source` sub-tree is deliberately shallow here: binding real order data is a
   governance decision, not a copy edit. Marketers edit the fallback/static event list.
   ──────────────────────────────────────────────────────────────────────────── */

type PuckBlockConfig = Omit<ComponentConfig, "render">;

const YES_NO = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

export const socialProofPopupPuckConfig: PuckBlockConfig = {
  label: "Recent-purchase popups",
  fields: {
    enabled: { type: "radio", label: "Enabled", options: YES_NO },
    source: {
      type: "object",
      label: "Data source (required — no source means no popups)",
      objectFields: {
        mode: {
          type: "select",
          label: "Mode",
          options: [
            { label: "Static list", value: "static" },
            { label: "Shopify orders", value: "shopify-orders" },
            { label: "Orders API", value: "orders-api" },
            { label: "Simulated (needs disclosure)", value: "simulated" },
          ],
        },
        anonymise: {
          type: "select",
          label: "Anonymisation (\"full\" is forbidden by the validator)",
          options: [
            { label: "First name + initial", value: "first-name-initial" },
            { label: "First name only", value: "first-name-only" },
          ],
        },
        disclosure: { type: "textarea", label: "Disclosure (required when simulated)" },
        events: {
          type: "array",
          label: "Events (static / simulated)",
          max: 20,
          getItemSummary: (item: { name?: string; city?: string }) =>
            item?.name ? `${item.name} — ${item.city ?? ""}`.trim() : "Event",
          defaultItemProps: {
            id: "ev_new",
            name: "Rohan S.",
            city: "Jaipur",
            product: "",
            verified: false,
          },
          arrayFields: {
            name: { type: "text", label: "First name + initial" },
            city: { type: "text", label: "City" },
            product: { type: "text", label: "Product (must exist on this page)" },
            variant: { type: "text", label: "Variant" },
            quantity: { type: "number", label: "Quantity", min: 1 },
            minutesAgo: { type: "number", label: "Minutes ago", min: 1 },
            verified: { type: "radio", label: "Verified order", options: YES_NO },
          },
        },
        fallback: {
          type: "array",
          label: "Fallback events (remote modes)",
          max: 20,
          getItemSummary: (item: { name?: string; city?: string }) =>
            item?.name ? `${item.name} — ${item.city ?? ""}`.trim() : "Event",
          arrayFields: {
            name: { type: "text", label: "First name + initial" },
            city: { type: "text", label: "City" },
            product: { type: "text", label: "Product" },
            variant: { type: "text", label: "Variant" },
            minutesAgo: { type: "number", label: "Minutes ago", min: 1 },
            verified: { type: "radio", label: "Verified order", options: YES_NO },
          },
        },
      },
    },
    position: {
      type: "select",
      label: "Desktop position",
      options: [
        { label: "Bottom left", value: "bottom-left" },
        { label: "Bottom right", value: "bottom-right" },
        { label: "Top right", value: "top-right" },
      ],
    },
    mobilePosition: {
      type: "radio",
      label: "Mobile position",
      options: [
        { label: "Top (recommended)", value: "top" },
        { label: "Bottom", value: "bottom" },
        { label: "Hidden on mobile", value: "hidden" },
      ],
    },
    template: {
      type: "text",
      label: "Template — {name} {city} {product} {variant} {timeAgo} {quantity}",
    },
    showImage: { type: "radio", label: "Show product thumbnail", options: YES_NO },
    showTimeAgo: { type: "radio", label: "Show \"x minutes ago\"", options: YES_NO },
    initialDelaySeconds: { type: "number", label: "First toast after (s)", min: 0, max: 120 },
    intervalSeconds: { type: "number", label: "Gap between toasts (s)", min: 10, max: 300 },
    displaySeconds: { type: "number", label: "Each toast stays (s)", min: 2, max: 30 },
    maxPerSession: { type: "number", label: "Max per session (≤6 stays credible)", min: 1, max: 12 },
    dismissible: { type: "radio", label: "Dismissible", options: YES_NO },
    clickAction: {
      type: "object",
      label: "Tap-through",
      objectFields: {
        kind: {
          type: "select",
          label: "Kind",
          options: [
            { label: "In-page link", value: "url" },
            { label: "Shopify", value: "shopify" },
            { label: "WhatsApp", value: "whatsapp" },
          ],
        },
        href: { type: "text", label: "Href / anchor (e.g. #offer-stack)" },
      },
    },
    disclosure: { type: "textarea", label: "Disclosure footnote" },
  },
  defaultProps: {
    enabled: true,
    position: "bottom-left",
    mobilePosition: "top",
    template: "{name} from {city} just ordered {product}",
    showImage: true,
    showTimeAgo: true,
    initialDelaySeconds: 8,
    intervalSeconds: 18,
    displaySeconds: 5,
    maxPerSession: 6,
    dismissible: true,
    clickAction: null,
  },
};
