"use client";

/**
 * BLOCK 1 — announcement-bar                              BLOCK-CATALOG §2.1
 *
 * The message-match handshake. Confirms the ad's promise within 300ms of paint,
 * above everything else on the page.
 *
 * "use client" justification: the countdown ticks every second and resolves its end
 * timestamp from localStorage (rolling-window) / IST wall-clock (daily-reset), and the
 * dismiss state is persisted for 24h. Both genuinely require the client. The bar is
 * ~40 lines of DOM and still server-renders its text, so the message-match copy is in
 * the initial HTML and paints before hydration.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  AnnouncementBarProps,
  CheckoutAction,
  CountdownConfig,
  IconName,
  ToneToken,
} from "@/lib/schema/page";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Local lookups — static maps only. Never `bg-${token}`; the Tailwind scanner
   cannot see interpolated class names. DESIGN-SYSTEM §2.4.
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

/** Solid fills — the bar is always a colour-blocked strip. */
const TONE_BAR: Record<ToneToken, string> = {
  brand: "bg-primary text-on-primary",
  accent: "bg-accent text-on-accent",
  neutral: "bg-muted text-fg-strong",
  success: "bg-success text-white",
  warning: "bg-warning text-warning-fg",
  danger: "bg-discount text-discount-fg",
  dark: "bg-surface-invert text-on-invert",
  light: "bg-surface-sunken text-fg-strong",
};

const DISMISS_KEY = "la:announcement-bar:dismissed-at";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

/* ────────────────────────────────────────────────────────────────────────────
   Countdown — always computed from an ABSOLUTE end timestamp so a refresh never
   resets it. BLOCK-CATALOG §2.1.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Whether a config can produce an end instant at all. Checked during render, so an
 * unusable countdown never needs an effect to discover that it is unusable.
 */
function isCountdownResolvable(config: CountdownConfig): boolean {
  if (config.mode === "fixed-deadline") {
    return Boolean(config.deadline) && !Number.isNaN(Date.parse(config.deadline!));
  }
  if (config.mode === "rolling-window") return Boolean(config.windowMinutes);
  return true; // daily-reset — resetAtHour defaults to 0
}

/** Resolves the countdown's absolute end instant (ms epoch), or null if unresolvable. */
function resolveEndTimestamp(config: CountdownConfig, storageKey: string): number | null {
  const now = Date.now();

  if (config.mode === "fixed-deadline") {
    if (!config.deadline) return null;
    const parsed = Date.parse(config.deadline);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (config.mode === "rolling-window") {
    if (!config.windowMinutes) return null;
    const key = `la:countdown:${storageKey}`;
    let stored = Number.NaN;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) stored = Number.parseInt(raw, 10);
    } catch {
      /* private mode / storage disabled — fall through to a fresh window */
    }
    // Keep an existing window unless it has lapsed AND we are allowed to restart.
    const lapsed = Number.isFinite(stored) && stored <= now;
    if (Number.isFinite(stored) && !(lapsed && config.expiredBehaviour === "restart")) {
      return stored;
    }
    const end = now + config.windowMinutes * 60_000;
    try {
      window.localStorage.setItem(key, String(end));
    } catch {
      /* non-persistent window — still counts down for this pageview */
    }
    return end;
  }

  // daily-reset — next occurrence of `resetAtHour` in IST, expressed in UTC epoch ms.
  const hour = config.resetAtHour ?? 0;
  const nowIst = now + IST_OFFSET_MS;
  const ist = new Date(nowIst);
  const istMidnight = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  let endIst = istMidnight + hour * 3_600_000;
  if (endIst <= nowIst) endIst += 86_400_000;
  return endIst - IST_OFFSET_MS;
}

type CountdownState =
  | { status: "pending" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "running"; days: number; hours: number; minutes: number; seconds: number };

/**
 * Ticks once per second off an absolute end timestamp. Returns "pending" until the
 * client has mounted, so the server and first client render always agree.
 */
function useCountdown(config: CountdownConfig | null, storageKey: string): CountdownState {
  const configKey = useMemo(() => (config ? JSON.stringify(config) : ""), [config]);
  const usable = config !== null && isCountdownResolvable(config);
  const [state, setState] = useState<CountdownState>({ status: "pending" });

  useEffect(() => {
    if (!config || !usable) return;

    let end = resolveEndTimestamp(config, storageKey);
    if (end === null) return;

    const tick = () => {
      let remaining = end! - Date.now();

      if (remaining <= 0) {
        if (config.expiredBehaviour === "restart" && config.mode !== "fixed-deadline") {
          const next = resolveEndTimestamp(config, storageKey);
          if (next !== null && next > Date.now()) {
            end = next;
            remaining = end - Date.now();
          }
        }
        if (remaining <= 0) {
          setState({ status: "expired" });
          return;
        }
      }

      const totalSeconds = Math.floor(remaining / 1000);
      setState({
        status: "running",
        days: Math.floor(totalSeconds / 86_400),
        hours: Math.floor((totalSeconds % 86_400) / 3_600),
        minutes: Math.floor((totalSeconds % 3_600) / 60),
        seconds: totalSeconds % 60,
      });
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
    // configKey is the stable value identity of `config`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, storageKey, usable]);

  return usable ? state : { status: "invalid" };
}

const pad = (n: number) => String(n).padStart(2, "0");

function CountdownReadout({
  config,
  storageKey,
}: {
  config: CountdownConfig;
  storageKey: string;
}) {
  const state = useCountdown(config, storageKey);
  const labels = config.labels ?? { d: "d", h: "h", m: "m", s: "s" };

  if (state.status === "invalid") return null;

  if (state.status === "expired") {
    if (config.expiredBehaviour === "hide") return null;
    return (
      <span className="font-heading text-xs font-bold tracking-wide sm:text-sm">
        {config.expiredText ?? "Offer ended"}
      </span>
    );
  }

  // Reserve the digits' footprint before hydration so the bar height never shifts.
  if (state.status === "pending") {
    return (
      <span
        aria-hidden="true"
        className="font-heading text-xs font-bold tabular-nums opacity-0 sm:text-sm"
      >
        00:00:00
      </span>
    );
  }

  const { days, hours, minutes, seconds } = state;
  // Mobile drops the day segment and folds it into hours (BLOCK-CATALOG §2.1).
  const totalHours = days * 24 + hours;
  const compact =
    totalHours > 0
      ? `${pad(totalHours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;
  const full =
    (days > 0 ? `${days}${labels.d} ` : "") +
    `${pad(hours)}${labels.h} ${pad(minutes)}${labels.m} ${pad(seconds)}${labels.s}`;

  return (
    <span
      className="font-heading text-xs font-bold tabular-nums sm:text-sm"
      role="timer"
      aria-live="off"
    >
      <span className="sm:hidden">{compact}</span>
      <span className="hidden sm:inline">{full}</span>
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Copy helpers
   ──────────────────────────────────────────────────────────────────────────── */

/** Bolds the first case-insensitive occurrence of `emphasis` inside `text`. */
function withEmphasis(text: string, emphasis?: string) {
  if (!emphasis) return text;
  const at = text.toLowerCase().indexOf(emphasis.toLowerCase());
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <strong className="font-heading font-extrabold">
        {text.slice(at, at + emphasis.length)}
      </strong>
      {text.slice(at + emphasis.length)}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Dismissal — a genuine external store (localStorage), read with
   useSyncExternalStore so the server snapshot is always "not dismissed" and the
   client corrects itself during hydration without an effect or a second render pass.
   ──────────────────────────────────────────────────────────────────────────── */

const dismissListeners = new Set<() => void>();
/** Fallback when storage is unavailable (private mode) — hides for this pageview. */
let sessionDismissed = false;

function subscribeToDismissal(onChange: () => void): () => void {
  dismissListeners.add(onChange);
  // `storage` covers other tabs; the local Set covers this one.
  window.addEventListener("storage", onChange);
  return () => {
    dismissListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readDismissed(): boolean {
  if (sessionDismissed) return true;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const at = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(at) && Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  sessionDismissed = true;
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage unavailable — the listener below still hides it for this pageview */
  }
  for (const listener of dismissListeners) listener();
}

/** BLOCK-CATALOG §1 — every CTA resolves through the shared CheckoutAction model. */
function resolveHref(action: CheckoutAction): string {
  switch (action.kind) {
    case "url":
      return action.href;
    case "whatsapp":
      return `https://wa.me/${action.phone}?text=${encodeURIComponent(action.messageTemplate)}`;
    case "shopify":
      return action.mode === "cart"
        ? `/cart/add?id=${action.variantId ?? action.productId}&quantity=${action.quantity}`
        : `/cart/${action.variantId ?? action.productId}:${action.quantity}${
            action.discountCode ? `?discount=${action.discountCode}` : ""
          }`;
    case "form":
      return `#form-${action.formId}`;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function AnnouncementBar({
  text,
  mobileText,
  emphasis,
  tone,
  icon,
  link,
  dismissible,
  sticky,
  countdown,
  marquee,
}: AnnouncementBarProps) {
  const dismissed = useSyncExternalStore(
    subscribeToDismissal,
    readDismissed,
    () => false, // server snapshot: always render the bar, then correct on hydration
  );

  if (dismissible && dismissed) return null;

  const Icon = icon ? ICONS[icon] : null;
  const short = mobileText ?? text;

  const message = (
    <span className="min-w-0 truncate text-xs font-medium sm:text-sm">
      <span className="sm:hidden">{withEmphasis(short, emphasis)}</span>
      <span className="hidden sm:inline">{withEmphasis(text, emphasis)}</span>
    </span>
  );

  const inner = (
    <span
      className={cn(
        "mx-auto flex w-full max-w-[var(--container-page)] items-center justify-center gap-2",
        "px-[var(--space-gutter)] py-2 sm:gap-3",
        dismissible && "pr-12",
      )}
    >
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" strokeWidth={2.25} /> : null}

      {marquee ? (
        // Two copies so the -50% translate loops seamlessly. `.marquee-track` is
        // force-stopped by the global reduced-motion rule (DESIGN-SYSTEM §7).
        <span className="relative flex min-w-0 flex-1 overflow-hidden">
          <span className="marquee-track flex shrink-0 gap-8 whitespace-nowrap motion-safe:animate-[var(--animate-marquee)]">
            {message}
            <span aria-hidden="true">{message}</span>
          </span>
        </span>
      ) : (
        message
      )}

      {countdown ? (
        <CountdownReadout config={countdown} storageKey={`${text.slice(0, 24)}`} />
      ) : null}
    </span>
  );

  return (
    <div
      role="region"
      aria-label="Store announcement"
      className={cn(
        "relative isolate w-full min-h-9",
        TONE_BAR[tone],
        sticky && "sticky top-0 z-20",
      )}
    >
      {link ? (
        <a
          href={resolveHref(link)}
          target={link.kind === "url" ? link.target : "_blank"}
          rel={
            link.kind === "url"
              ? link.rel ?? (link.target === "_blank" ? "noopener noreferrer" : undefined)
              : "noopener noreferrer"
          }
          data-cta-slot="announcement"
          className="flex min-h-9 w-full items-center transition-opacity duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-inset"
        >
          {inner}
        </a>
      ) : (
        <div className="flex min-h-9 w-full items-center">{inner}</div>
      )}

      {dismissible ? (
        <button
          type="button"
          onClick={markDismissed}
          aria-label="Dismiss announcement"
          // 44px target on a 36px bar — absolute, so it never inflates bar height.
          className="absolute right-1 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-current opacity-80 transition-opacity duration-[var(--dur-fast)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60"
        >
          <X className="size-4" aria-hidden="true" strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   PUCK EDITOR CONFIG
   ──────────────────────────────────────────────────────────────────────────── */

const TONE_OPTIONS = [
  { label: "Dark", value: "dark" },
  { label: "Brand", value: "brand" },
  { label: "Accent", value: "accent" },
  { label: "Neutral", value: "neutral" },
  { label: "Success", value: "success" },
  { label: "Warning", value: "warning" },
  { label: "Danger", value: "danger" },
  { label: "Light", value: "light" },
];

const ICON_OPTIONS = [
  { label: "— none —", value: undefined },
  ...(Object.keys(ICONS) as IconName[]).map((name) => ({ label: name, value: name })),
];

const BOOL_OPTIONS = [
  { label: "No", value: false },
  { label: "Yes", value: true },
];

/**
 * Puck's `Field<T>` collapses a discriminated union (CheckoutAction) or a nullable
 * object to its *common* keys, so a usable editor for one cannot be expressed
 * structurally. These two builders are the single, documented place we bridge that
 * gap. Everything else is fully typed.
 */
function checkoutActionField<T>(label: string): Field<T> {
  return {
    type: "object",
    label,
    objectFields: {
      kind: {
        type: "select",
        label: "Destination type",
        options: [
          { label: "Link / anchor", value: "url" },
          { label: "Shopify checkout", value: "shopify" },
          { label: "WhatsApp order", value: "whatsapp" },
          { label: "Lead form", value: "form" },
        ],
      },
      href: { type: "text", label: "URL or #anchor (link only)" },
      target: {
        type: "select",
        label: "Open in (link only)",
        options: [
          { label: "Same tab", value: "_self" },
          { label: "New tab", value: "_blank" },
        ],
      },
      productId: { type: "text", label: "Shopify product id" },
      variantId: { type: "text", label: "Shopify variant id" },
      discountCode: { type: "text", label: "Discount code" },
      phone: { type: "text", label: "WhatsApp number (919876543210)" },
      messageTemplate: { type: "textarea", label: "WhatsApp prefilled message" },
      formId: { type: "text", label: "Form id" },
    },
  } as unknown as Field<T>;
}

function countdownField<T>(label: string): Field<T> {
  return {
    type: "object",
    label,
    objectFields: {
      mode: {
        type: "select",
        label: "Countdown type",
        options: [
          { label: "Fixed deadline", value: "fixed-deadline" },
          { label: "Rolling window (per visitor)", value: "rolling-window" },
          { label: "Daily reset (IST)", value: "daily-reset" },
        ],
      },
      deadline: { type: "text", label: "Deadline — ISO 8601 with offset" },
      windowMinutes: { type: "number", label: "Window (minutes)", min: 1 },
      resetAtHour: { type: "number", label: "Reset at hour (0–23 IST)", min: 0, max: 23 },
      expiredBehaviour: {
        type: "select",
        label: "When it expires",
        options: [
          { label: "Hide the countdown", value: "hide" },
          { label: "Show expired text", value: "show-expired-text" },
          { label: "Restart", value: "restart" },
        ],
      },
      expiredText: { type: "text", label: "Expired text" },
    },
  } as unknown as Field<T>;
}

export const announcementBarPuckConfig: Omit<
  ComponentConfig<AnnouncementBarProps>,
  "render"
> = {
  label: "Announcement bar",
  fields: {
    text: { type: "text", label: "Offer line (max 70 chars)" },
    mobileText: { type: "text", label: "Short version for mobile (max 48)" },
    emphasis: { type: "text", label: "Words to bold (must appear in the offer line)" },
    tone: { type: "select", label: "Background tone", options: TONE_OPTIONS },
    icon: { type: "select", label: "Leading icon", options: ICON_OPTIONS },
    link: checkoutActionField<AnnouncementBarProps["link"]>("Tap destination"),
    dismissible: { type: "radio", label: "Dismissible (× button)", options: BOOL_OPTIONS },
    sticky: { type: "radio", label: "Stick to top on scroll", options: BOOL_OPTIONS },
    countdown: countdownField<AnnouncementBarProps["countdown"]>("Countdown"),
    marquee: { type: "radio", label: "Scroll text (marquee)", options: BOOL_OPTIONS },
  },
  defaultProps: {
    text: "MONSOON SALE — Flat 40% OFF + Free shipping across India",
    mobileText: "FLAT 40% OFF + Free shipping",
    emphasis: "Flat 40% OFF",
    tone: "dark",
    icon: "sparkles",
    link: { kind: "url", href: "#offer-stack", target: "_self" },
    dismissible: false,
    sticky: false,
    countdown: null,
    marquee: false,
  },
};
