"use client";

/**
 * BLOCK 12 — faq-accordion                                  BLOCK-CATALOG §2.12
 *
 * Objection-killing Q&A with optional category tabs and a trailing support CTA.
 *
 * Accessibility: a button + `aria-expanded` + `aria-controls` pattern (not
 * details/summary) because `allowMultipleOpen: false` needs controlled state and
 * because the smooth height animation must be interruptible.
 *
 * Height animation uses the `grid-template-rows: 0fr → 1fr` technique: it animates
 * to *content height* with no JS measurement and no scroll jump, and it degrades to
 * an instant open under `prefers-reduced-motion`.
 */

import { useMemo, useState } from "react";
import { ChevronDown, Headphones, MessageCircle, Smartphone } from "lucide-react";
import type { ComponentConfig, Fields } from "@measured/puck";

import type {
  CheckoutAction,
  FaqAccordionProps,
  FaqGroup,
  FaqItem,
  IconName,
  ToneToken,
} from "@/lib/schema/page";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
   Static token lookups — never `bg-${token}`.
   ──────────────────────────────────────────────────────────────────────────── */

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

/** Only icons the support panel realistically uses; everything else falls back. */
const SUPPORT_ICONS: Partial<Record<IconName, typeof Headphones>> = {
  headphones: Headphones,
  smartphone: Smartphone,
};

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────────── */

function ctaHref(action: CheckoutAction): string {
  switch (action.kind) {
    case "url":
      return action.href;
    case "whatsapp":
      return `https://wa.me/${action.phone}?text=${encodeURIComponent(action.messageTemplate)}`;
    case "shopify":
      return action.variantId
        ? `/cart/${action.variantId}:${action.quantity ?? 1}`
        : `/products/${action.productId}`;
    case "form":
      return `#${action.formId}`;
  }
}

/** `\n\n` paragraph breaks. Answers are plain text — never HTML (§2.12). */
function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
}

/**
 * FAQPage structured data. `</` is escaped so an answer can never break out of the
 * script tag — the only safe way to inline JSON-LD.
 */
function faqJsonLd(items: FaqItem[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }).replace(/</g, "\\u003c");
}

/* ────────────────────────────────────────────────────────────────────────────
   Block
   ──────────────────────────────────────────────────────────────────────────── */

export default function FaqAccordion({
  heading,
  subheading,
  items,
  layout,
  defaultOpen,
  allowMultipleOpen,
  groups,
  supportCta,
  emitJsonLd,
  background,
}: FaqAccordionProps) {
  const [openIds, setOpenIds] = useState<string[]>(() => {
    const seeded = defaultOpen.filter((id) => items.some((item) => item.id === id));
    if (seeded.length > 0) return allowMultipleOpen ? seeded : seeded.slice(0, 1);
    /* The first item is always open — it teaches the interaction. §2.12 */
    return items.length > 0 ? [items[0].id] : [];
  });
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const tabs = groups && groups.length > 0 ? groups : null;

  const visibleItems = useMemo(
    () => (activeGroup === null ? items : items.filter((item) => item.group === activeGroup)),
    [items, activeGroup],
  );

  const toggle = (id: string) => {
    setOpenIds((current) => {
      const isOpen = current.includes(id);
      if (isOpen) return current.filter((openId) => openId !== id);
      return allowMultipleOpen ? [...current, id] : [id];
    });
  };

  const SupportIcon = supportCta ? (SUPPORT_ICONS[supportCta.icon] ?? MessageCircle) : null;

  return (
    <section
      className={cn("py-[var(--space-section)]", SECTION_TONE[background])}
      aria-labelledby="faq-heading"
    >
      <div
        className={cn(
          "mx-auto w-full px-[var(--space-gutter)]",
          layout === "two-column"
            ? "max-w-[var(--container-page)]"
            : "max-w-[var(--container-prose)]",
        )}
      >
        <header className="flex flex-col gap-3 text-center">
          <h2
            id="faq-heading"
            className={cn(
              "font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-4xl",
              HEADING_TONE[background],
            )}
          >
            {heading}
          </h2>
          {subheading ? (
            <p className={cn("mx-auto max-w-prose text-base text-pretty sm:text-lg", SUB_TONE[background])}>
              {subheading}
            </p>
          ) : null}
        </header>

        {/* ── Category tabs ────────────────────────────────────────────── */}
        {tabs ? (
          <div
            className="mt-6 flex flex-wrap justify-center gap-2"
            role="group"
            aria-label="Filter questions by category"
          >
            <button
              type="button"
              onClick={() => setActiveGroup(null)}
              aria-pressed={activeGroup === null}
              className={cn(
                "inline-flex h-11 min-h-11 items-center rounded-pill border px-4 text-sm font-semibold transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                activeGroup === null
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border-strong bg-surface text-fg hover:border-primary hover:text-primary",
              )}
            >
              All
            </button>
            {tabs.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group.id)}
                aria-pressed={activeGroup === group.id}
                className={cn(
                  "inline-flex h-11 min-h-11 items-center rounded-pill border px-4 text-sm font-semibold transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                  activeGroup === group.id
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border-strong bg-surface text-fg hover:border-primary hover:text-primary",
                )}
              >
                {group.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* ── Accordion. Mobile is always single column. ───────────────── */}
        <ul
          className={cn(
            "mt-8 flex flex-col gap-3",
            layout === "two-column" && "md:grid md:grid-cols-2 md:items-start md:gap-4",
          )}
        >
          {visibleItems.map((item) => {
            const isOpen = openIds.includes(item.id);
            const panelId = `faq-panel-${item.id}`;
            const buttonId = `faq-button-${item.id}`;

            return (
              <li
                key={item.id}
                className={cn(
                  "overflow-hidden rounded-xl border bg-surface-raised transition-[border-color,box-shadow] duration-[var(--dur-fast)]",
                  isOpen ? "border-primary shadow-card" : "border-border",
                )}
              >
                <h3>
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(item.id)}
                    className="flex min-h-[3.25rem] w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-heading text-base font-bold tracking-tight text-fg-strong transition-colors duration-[var(--dur-fast)] hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/60 sm:px-5 sm:text-lg"
                  >
                    <span className="line-clamp-2 text-pretty sm:line-clamp-none">{item.question}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "size-5 shrink-0 text-muted-fg transition-transform duration-[var(--dur-base)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                        isOpen && "rotate-180 text-primary",
                      )}
                    />
                  </button>
                </h3>

                {/* 0fr → 1fr animates to natural content height, no JS measuring. */}
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  /* `inert` (not `hidden`) — display:none would kill the height
                     animation, but collapsed content must still leave the tab order. */
                  inert={!isOpen}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-[var(--dur-base)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
                      {paragraphs(item.answer).map((paragraph, index) => (
                        <p key={index} className="text-base leading-relaxed text-pretty text-fg">
                          {paragraph}
                        </p>
                      ))}

                      {item.cta ? (
                        <a
                          href={ctaHref(item.cta.action)}
                          target={item.cta.action.kind === "url" ? item.cta.action.target : undefined}
                          rel={
                            item.cta.action.kind === "url" && item.cta.action.target === "_blank"
                              ? (item.cta.action.rel ?? "noopener noreferrer")
                              : undefined
                          }
                          data-cta-kind={item.cta.action.kind}
                          className="inline-flex h-11 min-h-11 w-fit items-center gap-2 rounded-[var(--radius-cta)] border-2 border-transparent px-4 font-heading text-sm font-bold tracking-tight text-primary transition-colors duration-[var(--dur-fast)] hover:bg-primary-soft hover:text-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 active:scale-[0.98]"
                        >
                          {item.cta.label}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* ── Support CTA ──────────────────────────────────────────────── */}
        {supportCta && SupportIcon ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-border bg-surface-sunken p-5 text-center sm:flex-row sm:justify-between sm:p-6 sm:text-left">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                <SupportIcon aria-hidden="true" className="size-6 text-primary" />
              </span>
              <div>
                <p className="font-heading text-lg font-bold tracking-tight text-fg-strong">
                  {supportCta.heading}
                </p>
                {supportCta.body ? (
                  <p className="mt-1 max-w-prose text-sm text-pretty text-muted-fg">{supportCta.body}</p>
                ) : null}
              </div>
            </div>

            <a
              href={ctaHref(supportCta.cta.action)}
              target={supportCta.cta.action.kind === "url" ? supportCta.cta.action.target : undefined}
              rel={
                supportCta.cta.action.kind === "url" && supportCta.cta.action.target === "_blank"
                  ? (supportCta.cta.action.rel ?? "noopener noreferrer")
                  : undefined
              }
              data-cta-kind={supportCta.cta.action.kind}
              className={cn(
                "inline-flex h-12 min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-[var(--radius-cta)] px-6 font-heading text-base font-bold tracking-tight whitespace-nowrap shadow-cta transition-[background-color,box-shadow,transform,filter] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:shadow-cta-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:translate-y-0 active:scale-[0.98] sm:w-auto",
                supportCta.cta.action.kind === "whatsapp"
                  ? "bg-whatsapp text-on-primary hover:brightness-105"
                  : "bg-primary text-on-primary hover:bg-primary-hover",
              )}
            >
              <Smartphone aria-hidden="true" className="size-5" />
              {supportCta.cta.label}
            </a>
          </div>
        ) : null}
      </div>

      {emitJsonLd && items.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqJsonLd(items) }}
        />
      ) : null}
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

const BOOL_OPTIONS = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

export const faqAccordionPuckConfig: Omit<ComponentConfig<FaqAccordionProps>, "render"> = {
  label: "FAQ Accordion",
  fields: {
    heading: { type: "text", label: "Heading" },
    subheading: { type: "text", label: "Sub-heading" },
    items: {
      type: "array",
      label: "Questions (4–15)",
      min: 4,
      max: 15,
      getItemSummary: (item: FaqItem) => item?.question ?? "Question",
      arrayFields: {
        id: { type: "text", label: "ID (stable — do not reuse)" },
        question: { type: "text", label: "Question (customer's words)" },
        answer: { type: "textarea", label: "Answer (blank line = new paragraph)" },
        group: { type: "text", label: "Category ID (optional)" },
      },
    },
    layout: {
      type: "select",
      label: "Desktop layout",
      options: [
        { label: "Single column (recommended)", value: "single-column" },
        { label: "Two column", value: "two-column" },
      ],
    },
    allowMultipleOpen: {
      type: "radio",
      label: "Allow several answers open at once",
      options: BOOL_OPTIONS,
    },
    groups: {
      type: "array",
      label: "Category tabs",
      max: 6,
      getItemSummary: (group: FaqGroup) => group?.label ?? "Category",
      arrayFields: {
        id: { type: "text", label: "Category ID" },
        label: { type: "text", label: "Tab label" },
      },
    },
    supportCta: {
      type: "object",
      label: "Support panel",
      objectFields: {
        heading: { type: "text", label: "Heading" },
        body: { type: "textarea", label: "Body" },
        icon: {
          type: "select",
          label: "Icon",
          options: [
            { label: "Headphones", value: "headphones" },
            { label: "Phone", value: "smartphone" },
          ],
        },
        cta: {
          type: "object",
          label: "Button",
          objectFields: {
            label: { type: "text", label: "Button label" },
            sublabel: { type: "text", label: "Sub-label" },
          },
        },
      },
    },
    emitJsonLd: { type: "radio", label: "Emit FAQ structured data", options: BOOL_OPTIONS },
    background: { type: "select", label: "Section background", options: TONE_OPTIONS },
    /* `defaultOpen` is a plain string[] of item ids and `supportCta` is nullable —
       neither is expressible in Puck's mapped field type. `defaultOpen` is therefore
       system-managed (hidden from the field list) and round-trips untouched. */
    defaultOpen: { type: "text", label: "Open on load (system-managed)", visible: false },
  } as unknown as Fields<FaqAccordionProps>,
  defaultProps: {
    heading: "Frequently asked questions",
    items: [
      {
        id: "faq_cod",
        question: "Is Cash on Delivery available?",
        answer:
          "Yes. COD is available on 24,000+ pincodes across India at no extra charge. You pay the delivery partner in cash or by UPI when the parcel arrives.",
      },
      {
        id: "faq_ship",
        question: "How long will delivery take to my city?",
        answer:
          "Metro cities get delivery in 2–3 working days. Tier 2 and 3 cities take 4–6 working days. You'll get a tracking link on WhatsApp within 24 hours of ordering.",
      },
      {
        id: "faq_returns",
        question: "What if it doesn't work for me?",
        answer:
          "Return it within 15 days for a full refund, even if the pack is opened. Message us on WhatsApp, we arrange a free pickup, and the refund reaches your account within 5 working days.",
      },
      {
        id: "faq_gst",
        question: "Is the price inclusive of GST and shipping?",
        answer:
          "Yes. The price you see is the final price you pay — GST included. Shipping is free on all orders above ₹499.",
      },
    ],
    layout: "single-column",
    defaultOpen: ["faq_cod"],
    allowMultipleOpen: true,
    groups: null,
    supportCta: null,
    emitJsonLd: true,
    background: "light",
  },
};
