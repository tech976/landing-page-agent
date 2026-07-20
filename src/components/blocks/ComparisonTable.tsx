/**
 * BLOCK 11 — comparison-table                               BLOCK-CATALOG §2.11
 *
 * Feature matrix: "us" against 1–3 alternative categories, ending in a highlighted
 * price row and a CTA row.
 *
 * MOBILE CONTRACT (the hard part): at 360px the table scrolls horizontally *inside
 * its own container* with the feature-label column pinned. The page body never
 * scrolls horizontally — the scroller is `overflow-x-auto` and the section itself is
 * `overflow-hidden`. A visible swipe affordance is shown below `sm`.
 *
 * Server Component: nothing here needs state — sticky columns and scrolling are CSS.
 */

import Image from "next/image";
import { Check, Minus, Star, X } from "lucide-react";
import type { ComponentConfig, Fields } from "@measured/puck";

import type {
  CheckoutAction,
  ComparisonCell,
  ComparisonColumn,
  ComparisonRow,
  ComparisonTableProps,
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

/** Check / cross glyphs carry an explicit accessible name — §2.11. */
function CellValue({ cell }: { cell: ComparisonCell }) {
  switch (cell.type) {
    case "check":
      return (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-success-soft">
          <Check aria-hidden="true" className="size-4 text-success-fg" strokeWidth={3} />
          <span className="sr-only">Included</span>
        </span>
      );
    case "cross":
      return (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted">
          <X aria-hidden="true" className="size-4 text-muted-fg" strokeWidth={3} />
          <span className="sr-only">Not included</span>
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-warning-soft">
          <Minus aria-hidden="true" className="size-4 text-warning-fg" strokeWidth={3} />
          <span className="sr-only">Partially included</span>
        </span>
      );
    case "rating":
      return (
        <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-fg-strong">
          <Star aria-hidden="true" className="size-4 fill-rating text-rating" strokeWidth={1.75} />
          {cell.value.toFixed(1)}
          <span className="sr-only">out of 5</span>
        </span>
      );
    case "text":
      return <span className="text-sm text-pretty text-fg">{cell.value}</span>;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Block
   ──────────────────────────────────────────────────────────────────────────── */

export default function ComparisonTable({
  heading,
  subheading,
  columns,
  rows,
  priceRow,
  ctaRow,
  highlightUs,
  stickyFirstColumn,
  background,
  disclaimer,
}: ComparisonTableProps) {
  const usIndex = columns.findIndex((column) => column.isUs);
  const hasCtas = ctaRow && columns.some((column) => column.cta);

  /** Applied to every cell in the "us" column so the highlight runs top to bottom. */
  const usCell = (index: number) =>
    highlightUs && index === usIndex ? "bg-primary-soft" : "";

  /* Pinned label column. `bg-surface-raised` is mandatory — a transparent sticky
     cell lets the scrolling content read through it. */
  const labelCellBase = cn(
    "z-10 w-[42%] min-w-[8.5rem] max-w-[14rem] bg-surface-raised px-3 py-3 text-left align-middle sm:w-[34%] sm:min-w-[13rem] sm:px-4",
    stickyFirstColumn && "sticky left-0",
  );

  return (
    <section
      className={cn("overflow-hidden py-[var(--space-section)]", SECTION_TONE[background])}
      aria-labelledby="comparison-heading"
    >
      <div className="mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)]">
        <header className="mx-auto flex max-w-[var(--container-narrow)] flex-col gap-3 text-center">
          <h2
            id="comparison-heading"
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

        <p className={cn("mt-6 text-center text-xs sm:hidden", SUB_TONE[background])} aria-hidden="true">
          Swipe the table sideways to compare →
        </p>

        {/* The ONLY horizontally scrollable element on the page.
            `contain-paint` is load-bearing and must not be removed: on mobile, an
            overflowing table propagates its width to the layout viewport (and therefore
            to documentElement.scrollWidth) even through an `overflow:hidden` ancestor,
            which gave the whole page 142px of horizontal body scroll at 360px.
            Paint containment isolates the scroller so the overflow stays inside it.
            Regression-tested by scripts/check-mobile-overflow.mjs. */}
        <div
          className="mt-3 overflow-x-auto overscroll-x-contain contain-paint rounded-xl border border-border bg-surface-raised shadow-card sm:mt-8 [scrollbar-width:thin]"
          tabIndex={0}
          role="region"
          aria-label={`${heading} — scrollable comparison table`}
        >
          <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-left">
            <caption className="sr-only">
              {heading}
              {subheading ? ` — ${subheading}` : ""}
            </caption>

            <thead>
              <tr>
                <th scope="col" className={cn(labelCellBase, "border-b border-border")}>
                  <span className="text-xs font-semibold tracking-widest text-muted-fg uppercase">
                    Compare
                  </span>
                </th>
                {columns.map((column, index) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      "min-w-[7.5rem] border-b border-border px-3 py-3 text-center align-bottom sm:min-w-[9rem] sm:px-4",
                      usCell(index),
                      highlightUs && index === usIndex && "rounded-t-lg",
                    )}
                  >
                    <span className="flex flex-col items-center gap-1.5">
                      {column.logo ? (
                        <span className="relative block aspect-logo h-7 w-20 overflow-hidden">
                          <Image
                            src={column.logo.src}
                            alt={column.logo.alt}
                            fill
                            loading="lazy"
                            decoding="async"
                            sizes="80px"
                            className="size-full object-contain"
                          />
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "font-heading text-sm leading-tight font-bold tracking-tight text-balance sm:text-base",
                          highlightUs && index === usIndex ? "text-primary" : "text-fg-strong",
                        )}
                      >
                        {column.label}
                      </span>
                      {column.sublabel ? (
                        <span className="text-xs leading-tight text-muted-fg">{column.sublabel}</span>
                      ) : null}
                      {highlightUs && index === usIndex ? (
                        <span className="rounded-pill bg-primary px-2 py-0.5 text-xs font-bold text-on-primary">
                          This is us
                        </span>
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className={rowIndex % 2 === 1 ? "bg-surface-sunken" : undefined}>
                  <th
                    scope="row"
                    className={cn(
                      labelCellBase,
                      "border-b border-border font-body text-sm font-semibold text-pretty text-fg",
                      rowIndex % 2 === 1 && "bg-surface-sunken",
                    )}
                  >
                    {row.label}
                    {row.tooltip ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted-fg">
                        {row.tooltip}
                      </span>
                    ) : null}
                  </th>
                  {columns.map((column, index) => {
                    const cell = row.cells[index];
                    return (
                      <td
                        key={column.id}
                        className={cn(
                          "border-b border-border px-3 py-3 text-center align-middle sm:px-4",
                          usCell(index),
                        )}
                      >
                        {cell ? <CellValue cell={cell} /> : <span className="sr-only">No data</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Highlighted price row — the close of the argument. */}
              {priceRow ? (
                <tr>
                  <th
                    scope="row"
                    className={cn(
                      labelCellBase,
                      "border-t-2 border-b border-border-strong bg-muted font-heading text-sm font-extrabold tracking-tight text-fg-strong",
                    )}
                  >
                    {priceRow.label}
                    {priceRow.note ? (
                      <span className="mt-0.5 block font-body text-xs font-normal text-muted-fg">
                        {priceRow.note}
                      </span>
                    ) : null}
                  </th>
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      className={cn(
                        "border-t-2 border-b border-border-strong bg-muted px-3 py-4 text-center align-middle",
                        highlightUs && index === usIndex && "bg-primary-soft",
                      )}
                    >
                      <span
                        className={cn(
                          "font-heading text-base font-extrabold tracking-tight tabular-nums text-balance sm:text-lg",
                          highlightUs && index === usIndex ? "text-primary" : "text-fg-strong",
                        )}
                      >
                        {priceRow.values[index] ?? "—"}
                      </span>
                    </td>
                  ))}
                </tr>
              ) : null}

              {/* CTA row — usually only the "us" column carries a button. */}
              {hasCtas ? (
                <tr>
                  <th scope="row" className={cn(labelCellBase, "align-middle")}>
                    <span className="sr-only">Buy</span>
                  </th>
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      className={cn("px-3 py-4 text-center align-middle sm:px-4", usCell(index), highlightUs && index === usIndex && "rounded-b-lg")}
                    >
                      {column.cta ? (
                        <a
                          href={ctaHref(column.cta.action)}
                          target={column.cta.action.kind === "url" ? column.cta.action.target : undefined}
                          rel={
                            column.cta.action.kind === "url" && column.cta.action.target === "_blank"
                              ? (column.cta.action.rel ?? "noopener noreferrer")
                              : undefined
                          }
                          data-cta-kind={column.cta.action.kind}
                          className={cn(
                            "inline-flex h-11 min-h-11 w-full items-center justify-center rounded-[var(--radius-cta)] px-4 text-center font-heading text-sm font-bold tracking-tight transition-[background-color,box-shadow,transform,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]",
                            index === usIndex
                              ? "bg-primary text-on-primary shadow-cta hover:bg-primary-hover hover:shadow-cta-hover"
                              : "border-2 border-border-strong bg-surface text-fg-strong hover:border-primary hover:text-primary",
                          )}
                        >
                          {column.cta.label}
                        </a>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {disclaimer ? (
          <p className={cn("mt-4 text-center text-xs text-pretty", SUB_TONE[background])}>{disclaimer}</p>
        ) : null}
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

const BOOL_OPTIONS = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

export const comparisonTablePuckConfig: Omit<
  ComponentConfig<ComparisonTableProps>,
  "render"
> = {
  label: "Comparison Table",
  fields: {
    heading: { type: "text", label: "Heading" },
    subheading: { type: "text", label: "Sub-heading" },
    columns: {
      type: "array",
      label: "Columns (2–4 · exactly one is ‘us’)",
      min: 2,
      max: 4,
      getItemSummary: (item: ComparisonColumn) => item?.label ?? "Column",
      arrayFields: {
        id: { type: "text", label: "ID (stable)" },
        label: { type: "text", label: "Column label" },
        sublabel: { type: "text", label: "Sub-label" },
        isUs: { type: "radio", label: "This is our column", options: BOOL_OPTIONS },
      },
    },
    rows: {
      type: "array",
      label: "Feature rows (3–12)",
      min: 3,
      max: 12,
      getItemSummary: (item: ComparisonRow) => item?.label ?? "Row",
      arrayFields: {
        id: { type: "text", label: "ID (stable)" },
        label: { type: "text", label: "Feature" },
        tooltip: { type: "text", label: "Explainer" },
        cells: {
          type: "array",
          label: "Cells (one per column, in order)",
          min: 2,
          max: 4,
          arrayFields: {
            type: {
              type: "select",
              label: "Cell type",
              options: [
                { label: "✔ Included", value: "check" },
                { label: "✘ Not included", value: "cross" },
                { label: "~ Partial", value: "partial" },
                { label: "Text", value: "text" },
                { label: "Rating", value: "rating" },
              ],
            },
            value: { type: "text", label: "Value (text / rating cells only)" },
          },
        },
      },
    },
    priceRow: {
      type: "object",
      label: "Price row",
      objectFields: {
        label: { type: "text", label: "Row label" },
        note: { type: "text", label: "Note (e.g. per 30ml)" },
        values: {
          type: "array",
          label: "Prices (one per column, in order)",
          min: 2,
          max: 4,
          arrayFields: { value: { type: "text", label: "Price text" } },
        },
      },
    },
    ctaRow: { type: "radio", label: "Show CTA row", options: BOOL_OPTIONS },
    highlightUs: { type: "radio", label: "Highlight our column", options: BOOL_OPTIONS },
    stickyFirstColumn: {
      type: "radio",
      label: "Pin the feature column when scrolling",
      options: BOOL_OPTIONS,
    },
    background: { type: "select", label: "Section background", options: TONE_OPTIONS },
    disclaimer: { type: "textarea", label: "Disclaimer" },
    /* Cells are a discriminated union and `priceRow` is nullable — neither is
       expressible in Puck's mapped field type, so the field map is asserted. The
       stored JSON still conforms exactly to the Zod schema. */
  } as unknown as Fields<ComparisonTableProps>,
  defaultProps: {
    heading: "How we compare",
    subheading: "Why paying once beats paying every month",
    columns: [
      {
        id: "col_us",
        label: "Our product",
        sublabel: "Direct from us",
        isUs: true,
      },
      { id: "col_market", label: "Ordinary market options", sublabel: "₹300–600 range", isUs: false },
      { id: "col_salon", label: "Salon treatments", sublabel: "Per-session clinics", isUs: false },
    ],
    rows: [
      {
        id: "row_quality",
        label: "Certified, traceable ingredients",
        cells: [{ type: "check" }, { type: "cross" }, { type: "partial" }],
      },
      {
        id: "row_cod",
        label: "Cash on delivery",
        cells: [{ type: "check" }, { type: "partial" }, { type: "cross" }],
      },
      {
        id: "row_refund",
        label: "15-day money-back guarantee",
        cells: [{ type: "check" }, { type: "cross" }, { type: "cross" }],
      },
      {
        id: "row_time",
        label: "Time to first results",
        cells: [
          { type: "text", value: "7–10 days" },
          { type: "text", value: "Rarely visible" },
          { type: "text", value: "1–2 sessions" },
        ],
      },
    ],
    priceRow: {
      label: "What you pay",
      values: ["₹899 for 60 days", "₹300–600 for 30 days", "₹3,000+ per session"],
      note: "Prices inclusive of taxes",
    },
    ctaRow: true,
    highlightUs: true,
    stickyFirstColumn: true,
    background: "neutral",
  },
};
