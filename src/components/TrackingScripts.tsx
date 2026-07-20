"use client";

import { useEffect } from "react";

/**
 * Landing Agent — click-id & UTM attribution capture.
 *
 * Mount this once per rendered landing page. On mount it:
 *   1. reads gclid / gbraid / wbraid / fbclid and every utm_* param off the URL,
 *   2. persists them to localStorage (first-touch preserved, last-touch updated),
 *   3. writes each value into any hidden form input whose `name` matches, and
 *   4. pushes a `page_view` event onto `window.dataLayer`.
 *
 * WHY THIS EXISTS: an Indian D2C lead form is submitted minutes after the click,
 * often after the visitor has scrolled through the whole page, and sometimes on a
 * second session. If the gclid only lives in the URL, offline conversion import
 * into Google Ads breaks and the campaign cannot be optimised. Persisting it is
 * what makes the lead attributable.
 *
 * A MutationObserver keeps late-rendered forms filled — block-rendered lead forms
 * mount well after this component does.
 */

/* ────────────────────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────────────────────── */

/** Paid click identifiers. gbraid/wbraid are the iOS privacy-safe Google pair. */
export const CLICK_ID_PARAMS = ["gclid", "gbraid", "wbraid", "fbclid"] as const;

export type ClickIdParam = (typeof CLICK_ID_PARAMS)[number];

/** localStorage key holding the merged attribution record. */
export const ATTRIBUTION_STORAGE_KEY = "lp_attribution";

/** Max characters kept per value — a defence against crafted overlong URLs. */
const MAX_VALUE_LENGTH = 512;

export interface Attribution {
  /** gclid / gbraid / wbraid / fbclid, when present. */
  clickIds: Partial<Record<ClickIdParam, string>>;
  /** Every utm_* param, keys kept verbatim, e.g. `utm_source`. */
  utm: Record<string, string>;
  /** ISO timestamp of the first visit that produced attribution. */
  firstSeenAt?: string;
  /** ISO timestamp of the most recent capture. */
  lastSeenAt?: string;
  /** Path of the first landing page in this attribution window. */
  landingPage?: string;
  /** document.referrer at first touch. */
  referrer?: string;
}

const EMPTY_ATTRIBUTION: Attribution = { clickIds: {}, utm: {} };

/* ────────────────────────────────────────────────────────────────────────────
   Storage helpers — every one is SSR-safe and quota-safe.
   ──────────────────────────────────────────────────────────────────────────── */

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function sanitise(value: string): string {
  return value.trim().slice(0, MAX_VALUE_LENGTH);
}

function readStored(): Attribution {
  if (!isBrowser()) return EMPTY_ATTRIBUTION;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return EMPTY_ATTRIBUTION;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY_ATTRIBUTION;
    const record = parsed as Partial<Attribution>;
    return {
      clickIds: record.clickIds ?? {},
      utm: record.utm ?? {},
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
      landingPage: record.landingPage,
      referrer: record.referrer,
    };
  } catch {
    // Private mode, disabled storage, or corrupt JSON. Attribution is a
    // nice-to-have; it must never break the page.
    return EMPTY_ATTRIBUTION;
  }
}

function writeStored(attribution: Attribution): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    /* quota exceeded or storage blocked — ignore */
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Public helper
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Returns the stored attribution for form submission.
 *
 *   const { clickIds, utm } = getAttribution();
 *   await fetch("/api/lead", { body: JSON.stringify({ ...values, ...clickIds, ...utm }) });
 *
 * Safe to call during SSR — returns an empty record rather than throwing.
 */
export function getAttribution(): Attribution {
  return readStored();
}

/**
 * Flat `{ gclid, utm_source, ... }` map, convenient for spreading straight into a
 * form payload or a hidden-field loop.
 */
export function getAttributionFields(): Record<string, string> {
  const { clickIds, utm } = readStored();
  return { ...clickIds, ...utm };
}

/* ────────────────────────────────────────────────────────────────────────────
   Capture
   ──────────────────────────────────────────────────────────────────────────── */

function captureFromUrl(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const stored = readStored();
  const now = new Date().toISOString();

  const clickIds: Partial<Record<ClickIdParam, string>> = { ...stored.clickIds };
  let sawSomething = false;

  for (const key of CLICK_ID_PARAMS) {
    const value = params.get(key);
    if (value) {
      clickIds[key] = sanitise(value);
      sawSomething = true;
    }
  }

  const utm: Record<string, string> = { ...stored.utm };
  for (const [key, value] of params.entries()) {
    if (key.toLowerCase().startsWith("utm_") && value) {
      utm[key.toLowerCase()] = sanitise(value);
      sawSomething = true;
    }
  }

  const next: Attribution = {
    clickIds,
    utm,
    // First touch is written once and never overwritten — it is the value that
    // makes multi-session attribution possible.
    firstSeenAt: stored.firstSeenAt ?? (sawSomething ? now : undefined),
    lastSeenAt: sawSomething ? now : stored.lastSeenAt,
    landingPage:
      stored.landingPage ?? (sawSomething ? window.location.pathname : undefined),
    referrer: stored.referrer ?? (sawSomething ? document.referrer || undefined : undefined),
  };

  if (sawSomething) writeStored(next);
  return next;
}

/**
 * Writes each captured value into any hidden input with a matching `name`.
 * Only fills hidden inputs — never a visible field a human is typing into.
 */
function fillHiddenFields(fields: Record<string, string>, root: ParentNode): void {
  for (const [name, value] of Object.entries(fields)) {
    if (!value) continue;
    // Attribute selectors need escaping; utm_* and click-id names are already
    // safe identifiers, but CSS.escape guards against anything odd in the URL.
    const safeName = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(name) : name;
    const inputs = root.querySelectorAll<HTMLInputElement>(
      `input[type="hidden"][name="${safeName}"]`,
    );
    inputs.forEach((input) => {
      if (input.value !== value) input.value = value;
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export interface TrackingScriptsProps {
  /** Page id, forwarded on the page_view event for reporting joins. */
  pageId?: string;
  /** Page slug, forwarded on the page_view event. */
  pageSlug?: string;
  /** Extra key/values merged into the page_view payload. */
  eventData?: Record<string, unknown>;
}

export function TrackingScripts({ pageId, pageSlug, eventData }: TrackingScriptsProps) {
  useEffect(() => {
    const attribution = captureFromUrl();
    const fields = { ...attribution.clickIds, ...attribution.utm };

    fillHiddenFields(fields, document);

    // Lead-form blocks mount after this effect. Re-fill on DOM insertions so a
    // late form still submits with its click ids attached.
    const observer = new MutationObserver((mutations) => {
      const addedElement = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) => node.nodeType === 1),
      );
      if (addedElement) fillHiddenFields(fields, document);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
      event: "page_view",
      page_id: pageId,
      page_slug: pageSlug,
      page_path: window.location.pathname,
      page_location: window.location.href,
      page_referrer: document.referrer || undefined,
      ...attribution.clickIds,
      ...attribution.utm,
      ...eventData,
    });

    return () => observer.disconnect();
    // Runs once per mount. `eventData` is intentionally not a dependency — a new
    // object identity on every render would re-fire page_view and double-count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, pageSlug]);

  return null;
}

export default TrackingScripts;
