"use client";

/**
 * BLOCK 3 — urgency-strip                                 BLOCK-CATALOG §2.3
 *
 * The highest-leverage block for cold traffic and the easiest one to get sued over.
 * Hence the hard rule this file enforces at render time, not just in the schema:
 *
 *   NO SIGNAL EVER INVENTS A NUMBER.
 *
 * Every numeric signal is driven by its `DataSource` descriptor. If the descriptor is
 * missing, unresolvable, or explicitly says "hide when stale", the sub-element returns
 * `null` — it never falls back to a plausible-looking figure. If every signal resolves
 * to nothing, the whole strip renders nothing rather than an empty bar.
 *
 * "use client" justification: a real per-second countdown, count-up animation gated on
 * an IntersectionObserver, the simulated-source drift walk, and the mobile ticker
 * rotation. All four are inherently client-side.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ComponentConfig, Field } from "@measured/puck";
import {
  Award,
  Banknote,
  Check,
  Clock,
  Eye,
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
  CountdownConfig,
  DataSource,
  IconName,
  ToneToken,
  UrgencySignal,
  UrgencyStripProps,
} from "@/lib/schema/page";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Static lookups
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

const DEFAULT_ICON: Record<UrgencySignal["kind"], LucideIcon> = {
  "units-sold": Flame,
  "people-viewing": Eye,
  "stock-remaining": Package,
  countdown: Clock,
  custom: Sparkles,
};

const TONE_STRIP: Record<ToneToken, string> = {
  brand: "bg-primary text-on-primary",
  accent: "bg-accent text-on-accent",
  neutral: "bg-surface-sunken text-fg",
  success: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  danger: "bg-danger-soft text-danger-fg",
  dark: "bg-surface-invert text-on-invert",
  light: "bg-surface text-fg",
};

const IST_OFFSET_MS = 330 * 60 * 1000;

/* ════════════════════════════════════════════════════════════════════════════
   DATA SOURCE RESOLUTION
   The renderer resolves live bindings server-side before paint; this block only
   ever sees the descriptor. For `api` / `shopify-inventory` / `analytics` the
   mandatory `fallback` is what paints (§2.3 rule 4) — never a spinner, never a 0,
   and never a number this component made up.
   ════════════════════════════════════════════════════════════════════════════ */

/** FNV-1a — so a `simulated` source renders identically on the server and client. */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededValue(min: number, max: number, seed: string): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  const t = (hashString(seed) % 1000) / 999;
  return Math.round(low + t * (high - low));
}

/** Returns the number to display, or null when the source yields nothing usable. */
function resolveSource(source: DataSource | undefined, seedKey: string): number | null {
  if (!source) return null;

  switch (source.mode) {
    case "static":
      return Number.isFinite(source.value) ? source.value : null;

    case "api":
      // We have no live read here. "hide-signal" means exactly that: hide.
      if (source.staleBehaviour === "hide-signal") return null;
      return Number.isFinite(source.fallback) ? source.fallback : null;

    case "shopify-inventory":
    case "analytics":
      return Number.isFinite(source.fallback) ? source.fallback : null;

    case "simulated":
      if (!Number.isFinite(source.min) || !Number.isFinite(source.max)) return null;
      return seededValue(source.min, source.max, source.seed ?? seedKey);
  }
}

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

/** True when a signal has something real to show. Drives whole-strip suppression. */
function isRenderable(signal: UrgencySignal, index: number): boolean {
  if (signal.kind === "countdown") return isCountdownResolvable(signal.config);

  const value = resolveSource(signal.source, `${signal.kind}:${index}`);
  if (value === null) return false;

  // §2.3 rule 4 — the strip never paints a 0. Stock is the exception: it clamps up
  // to its critical floor rather than announcing "0 left" next to a Buy button.
  if (signal.kind === "units-sold" && value <= 0) return false;

  if (signal.kind === "people-viewing") {
    // "1 person viewing" is anti-social-proof. Below the floor we say nothing at
    // all rather than round a real 2 up to a fake 6.
    return value >= signal.minDisplay;
  }
  if (signal.kind === "custom") return signal.value.trim().length > 0;
  return true;
}

/**
 * A simulated source with drift walks slowly after mount — never on first paint, so
 * the server and client agree. Drift is held as an *offset* rather than an absolute,
 * so a change to `base` flows through without needing to reset state in an effect.
 */
function useDrift(source: DataSource | undefined, base: number | null): number | null {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (base === null) return;
    if (!source || source.mode !== "simulated" || !source.driftPerMinute) return;

    const { driftPerMinute } = source;
    const id = window.setInterval(() => {
      const stepSize = (driftPerMinute * 30) / 60;
      setOffset((current) => current + (Math.random() < 0.5 ? -stepSize : stepSize));
    }, 30_000);

    return () => window.clearInterval(id);
  }, [source, base]);

  if (base === null) return null;
  if (!source || source.mode !== "simulated") return base;

  const low = Math.min(source.min, source.max);
  const high = Math.max(source.min, source.max);
  return Math.round(Math.min(high, Math.max(low, base + offset)));
}

/* ════════════════════════════════════════════════════════════════════════════
   NUMBER FORMATTING + COUNT-UP
   ════════════════════════════════════════════════════════════════════════════ */

const grouped = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));

/** Indian-idiomatic compaction: 12.4k · 3.4L · 1.2Cr. */
function formatSignalNumber(value: number, format: "plain" | "compact" | "plus"): string {
  const n = Math.round(value);

  if (format === "plain") return grouped(n);

  if (format === "plus") {
    if (n >= 1000) return `${grouped(Math.floor(n / 1000) * 1000)}+`;
    if (n >= 100) return `${grouped(Math.floor(n / 100) * 100)}+`;
    return `${grouped(n)}+`;
  }

  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, "");
  if (n >= 10_000_000) return `${trim(n / 10_000_000)}Cr`;
  if (n >= 100_000) return `${trim(n / 100_000)}L`;
  if (n >= 1000) return `${trim(n / 1000)}k`;
  return grouped(n);
}

/**
 * DESIGN-SYSTEM §7 — 1200ms, ease-out-quart, fires once when 15% visible, and
 * renders the final value immediately under reduced motion. The initial (SSR)
 * render is the final value, so there is no layout shift and no hydration gap.
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

function CountUp({ value, render }: { value: number; render: (n: number) => string }) {
  const reduced = usePrefersReducedMotion();
  // null = the animation has not started; render the settled value.
  const [progress, setProgress] = useState<number | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (reduced || typeof IntersectionObserver === "undefined") return;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / 1200);
          setProgress(1 - Math.pow(1 - p, 4)); // ease-out-quart
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        setProgress(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, reduced]);

  const display = reduced || progress === null ? value : value * progress;

  return (
    <span ref={ref} className="font-heading font-bold tabular-nums">
      {render(display)}
    </span>
  );
}

/** Substitutes the `{value}` token in a signal label. */
function LabelTemplate({ label, value }: { label: string; value: ReactNode }) {
  const at = label.indexOf("{value}");
  if (at < 0) {
    return (
      <>
        {value} {label}
      </>
    );
  }
  return (
    <>
      {label.slice(0, at)}
      {value}
      {label.slice(at + "{value}".length)}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COUNTDOWN — always derived from an ABSOLUTE end timestamp, so a refresh, a
   back-navigation or a restored tab all continue the same countdown.
   ════════════════════════════════════════════════════════════════════════════ */

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
      /* storage unavailable — start a fresh, non-persistent window */
    }
    const lapsed = Number.isFinite(stored) && stored <= now;
    if (Number.isFinite(stored) && !(lapsed && config.expiredBehaviour === "restart")) {
      return stored;
    }
    const end = now + config.windowMinutes * 60_000;
    try {
      window.localStorage.setItem(key, String(end));
    } catch {
      /* ignore */
    }
    return end;
  }

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

function useCountdown(config: CountdownConfig, storageKey: string): CountdownState {
  const configKey = useMemo(() => JSON.stringify(config), [config]);
  const usable = isCountdownResolvable(config);
  const [state, setState] = useState<CountdownState>({ status: "pending" });

  useEffect(() => {
    if (!usable) return;

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

      const total = Math.floor(remaining / 1000);
      setState({
        status: "running",
        days: Math.floor(total / 86_400),
        hours: Math.floor((total % 86_400) / 3_600),
        minutes: Math.floor((total % 3_600) / 60),
        seconds: total % 60,
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

/* ════════════════════════════════════════════════════════════════════════════
   SIGNAL SUB-ELEMENTS — one per kind. Each returns null when it has no data.
   ════════════════════════════════════════════════════════════════════════════ */

function SignalShell({
  icon,
  live,
  animate,
  children,
}: {
  icon: LucideIcon;
  live?: boolean;
  animate: boolean;
  children: ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="relative flex shrink-0 items-center">
        <Icon className="size-4" aria-hidden="true" strokeWidth={2.25} />
        {live && animate ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 size-1.5 rounded-[var(--radius-pill)] bg-urgency motion-safe:animate-pulse"
          />
        ) : null}
      </span>
      <span className="min-w-0 text-xs leading-snug sm:text-sm">{children}</span>
    </div>
  );
}

function UnitsSoldSignal({
  signal,
  animate,
  seedKey,
}: {
  signal: Extract<UrgencySignal, { kind: "units-sold" }>;
  animate: boolean;
  seedKey: string;
}) {
  const value = resolveSource(signal.source, seedKey);
  if (value === null || value <= 0) return null;

  const Icon = signal.icon ? ICONS[signal.icon] : DEFAULT_ICON["units-sold"];
  return (
    <SignalShell icon={Icon} animate={animate}>
      <LabelTemplate
        label={signal.label}
        value={<CountUp value={value} render={(n) => formatSignalNumber(n, signal.format)} />}
      />
    </SignalShell>
  );
}

function PeopleViewingSignal({
  signal,
  animate,
  seedKey,
}: {
  signal: Extract<UrgencySignal, { kind: "people-viewing" }>;
  animate: boolean;
  seedKey: string;
}) {
  const base = resolveSource(signal.source, seedKey);
  const value = useDrift(signal.source, base);

  // Suppressed, not inflated: below minDisplay we show nothing at all.
  if (value === null || value < signal.minDisplay) return null;

  const Icon = signal.icon ? ICONS[signal.icon] : DEFAULT_ICON["people-viewing"];
  return (
    <SignalShell icon={Icon} animate={animate} live>
      <LabelTemplate
        label={signal.label}
        value={<CountUp value={value} render={(n) => grouped(n)} />}
      />
    </SignalShell>
  );
}

function StockRemainingSignal({
  signal,
  animate,
  seedKey,
}: {
  signal: Extract<UrgencySignal, { kind: "stock-remaining" }>;
  animate: boolean;
  seedKey: string;
}) {
  const resolved = resolveSource(signal.source, seedKey);
  if (resolved === null) return null;

  // Clamped, per schema: "0 left" next to a Buy button is a guaranteed bounce.
  const value = Math.max(signal.stockCriticalFloor, Math.round(resolved));
  const pct = Math.max(4, Math.min(100, (value / signal.barMax) * 100));
  const Icon = signal.icon ? ICONS[signal.icon] : DEFAULT_ICON["stock-remaining"];

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <SignalShell icon={Icon} animate={animate} live>
        <LabelTemplate
          label={signal.label}
          value={<CountUp value={value} render={(n) => grouped(n)} />}
        />
      </SignalShell>
      {signal.showBar ? (
        <div
          className="h-1.5 w-full overflow-hidden rounded-[var(--radius-pill)] bg-current/15"
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={signal.barMax}
          aria-label="Stock remaining"
        >
          <div
            className="h-full rounded-[var(--radius-pill)] bg-urgency transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out-soft)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function CountdownSignal({
  signal,
  animate,
  seedKey,
}: {
  signal: Extract<UrgencySignal, { kind: "countdown" }>;
  animate: boolean;
  seedKey: string;
}) {
  const state = useCountdown(signal.config, seedKey);
  const Icon = signal.icon ? ICONS[signal.icon] : DEFAULT_ICON.countdown;

  if (state.status === "invalid") return null;

  if (state.status === "expired") {
    if (signal.config.expiredBehaviour === "hide") return null;
    return (
      <SignalShell icon={Icon} animate={animate}>
        {signal.config.expiredText ?? "Offer ended"}
      </SignalShell>
    );
  }

  const readout =
    state.status === "pending" ? (
      // Placeholder holds the digits' width so the strip height is stable pre-hydration.
      <span className="font-heading font-bold tabular-nums opacity-0">00:00:00</span>
    ) : (
      <span className="font-heading font-bold tabular-nums" role="timer" aria-live="off">
        {state.days > 0 ? `${state.days}${signal.config.labels?.d ?? "d"} ` : ""}
        {pad(state.hours)}:{pad(state.minutes)}:{pad(state.seconds)}
      </span>
    );

  return (
    <SignalShell icon={Icon} animate={animate} live>
      <LabelTemplate label={signal.label} value={readout} />
    </SignalShell>
  );
}

function CustomSignal({
  signal,
  animate,
  seedKey,
}: {
  signal: Extract<UrgencySignal, { kind: "custom" }>;
  animate: boolean;
  seedKey: string;
}) {
  // The string is the display; the source is its attestation. No source, no signal.
  if (resolveSource(signal.source, seedKey) === null) return null;
  if (!signal.value.trim()) return null;

  const Icon = signal.icon ? ICONS[signal.icon] : DEFAULT_ICON.custom;
  return (
    <SignalShell icon={Icon} animate={animate}>
      <LabelTemplate
        label={signal.label}
        value={<span className="font-heading font-bold tabular-nums">{signal.value}</span>}
      />
    </SignalShell>
  );
}

function Signal({
  signal,
  animate,
  seedKey,
}: {
  signal: UrgencySignal;
  animate: boolean;
  seedKey: string;
}) {
  switch (signal.kind) {
    case "units-sold":
      return <UnitsSoldSignal signal={signal} animate={animate} seedKey={seedKey} />;
    case "people-viewing":
      return <PeopleViewingSignal signal={signal} animate={animate} seedKey={seedKey} />;
    case "stock-remaining":
      return <StockRemainingSignal signal={signal} animate={animate} seedKey={seedKey} />;
    case "countdown":
      return <CountdownSignal signal={signal} animate={animate} seedKey={seedKey} />;
    case "custom":
      return <CustomSignal signal={signal} animate={animate} seedKey={seedKey} />;
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════════════════════════ */

export default function UrgencyStrip({
  signals,
  layout,
  tone,
  dividers,
  animate,
  disclosureText,
  sticky,
}: UrgencyStripProps) {
  const visible = useMemo(
    () => signals.map((signal, index) => ({ signal, index })).filter((s) => isRenderable(s.signal, s.index)),
    [signals],
  );

  // Ticker: one signal at a time on mobile (BLOCK-CATALOG §2.3), all of them at lg.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (layout !== "ticker" || visible.length < 2) return;
    const id = window.setInterval(() => setTick((t) => (t + 1) % visible.length), 4000);
    return () => window.clearInterval(id);
  }, [layout, visible.length]);

  if (visible.length === 0) return null;

  const disclosures = [
    disclosureText,
    ...visible.map(({ signal }) =>
      signal.kind !== "countdown" && signal.source.mode === "simulated"
        ? signal.source.disclosure
        : null,
    ),
  ].filter((d): d is string => Boolean(d));
  const disclosure = Array.from(new Set(disclosures)).join(" · ");

  const listClass =
    layout === "grid"
      ? "grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4"
      : layout === "ticker"
        ? "flex flex-col lg:flex-row lg:flex-wrap lg:items-center lg:justify-center lg:gap-x-6 lg:gap-y-2"
        : "grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-6 sm:gap-y-2";

  return (
    <section
      aria-label="Live offer status"
      className={cn(
        "w-full border-y border-current/10",
        TONE_STRIP[tone],
        sticky && "sticky top-0 z-20",
      )}
    >
      <div className="mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)] py-2.5 sm:py-3">
        <div className={listClass}>
          {visible.map(({ signal, index }, position) => (
            <div
              key={`${signal.kind}-${index}`}
              className={cn(
                "min-w-0",
                // A lone third signal in a 2-col mobile grid spans the full width.
                visible.length === 3 && position === 2 && "col-span-2 sm:col-span-1",
                dividers &&
                  position > 0 &&
                  "sm:border-l sm:border-current/20 sm:pl-6",
                layout === "ticker" && position !== tick && "hidden lg:block",
              )}
            >
              <Signal signal={signal} animate={animate} seedKey={`${signal.kind}:${index}`} />
            </div>
          ))}
        </div>

        {disclosure ? (
          <p className="mt-2 text-center text-xs opacity-70">{disclosure}</p>
        ) : null}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   PUCK EDITOR CONFIG
   ──────────────────────────────────────────────────────────────────────────── */

const TONE_OPTIONS = [
  { label: "Warning", value: "warning" },
  { label: "Danger", value: "danger" },
  { label: "Neutral", value: "neutral" },
  { label: "Success", value: "success" },
  { label: "Brand", value: "brand" },
  { label: "Accent", value: "accent" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

const ICON_OPTIONS = [
  { label: "— default for this signal —", value: undefined },
  ...(Object.keys(ICONS) as IconName[]).map((name) => ({ label: name, value: name })),
];

const BOOL_OPTIONS = [
  { label: "No", value: false },
  { label: "Yes", value: true },
];

/**
 * `UrgencySignal` is a discriminated union and `DataSource` is a nested one, so
 * Puck's `Field<T>` narrows both to their common keys and no structural editor can
 * be written. This one cast is the documented bridge; everything else is typed.
 */
function signalsField<T>(label: string): Field<T> {
  return {
    type: "array",
    label,
    min: 1,
    max: 4,
    getItemSummary: (item: UrgencySignal) => item.label || item.kind,
    arrayFields: {
      kind: {
        type: "select",
        label: "Signal type",
        options: [
          { label: "Units sold", value: "units-sold" },
          { label: "People viewing", value: "people-viewing" },
          { label: "Stock remaining", value: "stock-remaining" },
          { label: "Countdown", value: "countdown" },
          { label: "Custom", value: "custom" },
        ],
      },
      label: { type: "text", label: "Label — use {value} where the number goes" },
      icon: { type: "select", label: "Icon", options: ICON_OPTIONS },
      value: { type: "text", label: "Displayed text (custom signals only)" },
      period: { type: "text", label: 'Window label, e.g. "24 hours" (units sold)' },
      format: {
        type: "select",
        label: "Number format (units sold)",
        options: [
          { label: "Compact — 12.4k", value: "compact" },
          { label: "Plus — 12,000+", value: "plus" },
          { label: "Plain — 12,431", value: "plain" },
        ],
      },
      minDisplay: {
        type: "number",
        label: "Hide below this count (people viewing)",
        min: 1,
      },
      stockCriticalFloor: { type: "number", label: "Never show below (stock)", min: 1 },
      showBar: { type: "radio", label: "Show depletion bar (stock)", options: BOOL_OPTIONS },
      barMax: { type: "number", label: "Depletion bar maximum (stock)", min: 1 },
      source: {
        type: "object",
        label: "Where the number comes from",
        objectFields: {
          mode: {
            type: "select",
            label: "Source",
            options: [
              { label: "Static (human-confirmed)", value: "static" },
              { label: "API endpoint", value: "api" },
              { label: "Shopify inventory", value: "shopify-inventory" },
              { label: "Analytics", value: "analytics" },
              { label: "Simulated (requires disclosure)", value: "simulated" },
            ],
          },
          value: { type: "number", label: "Static value" },
          verified: { type: "radio", label: "Human-verified", options: BOOL_OPTIONS },
          endpoint: { type: "text", label: "API endpoint" },
          jsonPath: { type: "text", label: "JSON path to the number" },
          refreshSeconds: { type: "number", label: "Refresh (seconds)", min: 1 },
          staleBehaviour: {
            type: "select",
            label: "When the API is stale",
            options: [
              { label: "Show the fallback", value: "show-fallback" },
              { label: "Hide the signal", value: "hide-signal" },
            ],
          },
          productId: { type: "text", label: "Shopify product id" },
          variantId: { type: "text", label: "Shopify variant id" },
          metric: {
            type: "select",
            label: "Analytics metric",
            options: [
              { label: "Active visitors", value: "active_visitors" },
              { label: "Units sold", value: "units_sold" },
              { label: "Add to cart", value: "add_to_cart" },
              { label: "Orders", value: "orders" },
            ],
          },
          windowMinutes: { type: "number", label: "Analytics window (minutes)", min: 1 },
          fallback: { type: "number", label: "Fallback (required for live sources)" },
          min: { type: "number", label: "Simulated minimum" },
          max: { type: "number", label: "Simulated maximum" },
          driftPerMinute: { type: "number", label: "Simulated drift per minute" },
          seed: { type: "text", label: "Simulated seed" },
          disclosure: { type: "textarea", label: "Disclosure (required if simulated)" },
        },
      },
      config: {
        type: "object",
        label: "Countdown settings",
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
          resetAtHour: { type: "number", label: "Reset hour (0–23 IST)", min: 0, max: 23 },
          expiredBehaviour: {
            type: "select",
            label: "When it expires",
            options: [
              { label: "Hide", value: "hide" },
              { label: "Show expired text", value: "show-expired-text" },
              { label: "Restart", value: "restart" },
            ],
          },
          expiredText: { type: "text", label: "Expired text" },
        },
      },
    },
  } as unknown as Field<T>;
}

export const urgencyStripPuckConfig: Omit<ComponentConfig<UrgencyStripProps>, "render"> = {
  label: "Urgency strip",
  fields: {
    signals: signalsField<UrgencyStripProps["signals"]>("Signals (1–4)"),
    layout: {
      type: "select",
      label: "Layout",
      options: [
        { label: "Row", value: "row" },
        { label: "Grid", value: "grid" },
        { label: "Ticker (rotates on mobile)", value: "ticker" },
      ],
    },
    tone: { type: "select", label: "Strip tone", options: TONE_OPTIONS },
    dividers: { type: "radio", label: "Dividers between signals", options: BOOL_OPTIONS },
    animate: { type: "radio", label: "Pulse dot on live signals", options: BOOL_OPTIONS },
    disclosureText: {
      type: "textarea",
      label: "Disclosure footnote (required if any signal is simulated)",
    },
    sticky: { type: "radio", label: "Stick under the header", options: BOOL_OPTIONS },
  },
  defaultProps: {
    // A countdown is the only signal that asserts nothing about the business, so it
    // is the one safe default. Numeric signals are opt-in and must be bound to a
    // source by a human before they will render at all.
    signals: [
      {
        kind: "countdown",
        label: "Offer ends in {value}",
        icon: "clock",
        config: { mode: "daily-reset", resetAtHour: 23, expiredBehaviour: "restart" },
      },
    ],
    layout: "row",
    tone: "warning",
    dividers: true,
    animate: true,
    sticky: false,
  },
};
