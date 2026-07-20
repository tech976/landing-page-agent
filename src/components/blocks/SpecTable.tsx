/**
 * BLOCK 9 — `spec-table`                   BLOCK-CATALOG §2.9 · DESIGN-SYSTEM §4, §6
 *
 * Grouped product specifications. Removes the last factual objections without cluttering
 * the hero, and cuts WhatsApp support load.
 *
 * Server Component — `collapsibleGroups` uses native `<details>`, so the accordion works
 * with zero JavaScript and stays keyboard accessible.
 *
 * §2.9 mobile rule: NEVER a horizontally scrolling table. `two-column` collapses to stacked
 * label-over-value pairs.
 */

import type { ComponentConfig } from "@measured/puck";
import {
  Award,
  Banknote,
  Check,
  ChevronDown,
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
  IconName,
  ImageRef,
  SpecGroup,
  SpecRow,
  SpecTableProps,
  ToneToken,
} from "@/lib/schema/page";
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

const FOCAL: Record<ImageRef["focal"], string> = {
  center: "object-center",
  top: "object-top",
  bottom: "object-bottom",
  left: "object-left",
  right: "object-right",
};

/* ────────────────────────────────────────────────────────────────────────────
   Rows
   ──────────────────────────────────────────────────────────────────────────── */

function Row({
  row,
  index,
  striped,
  layout,
}: {
  row: SpecRow;
  index: number;
  striped: boolean;
  layout: SpecTableProps["layout"];
}) {
  const RowIcon = row.icon ? ICONS[row.icon] : null;
  const zebra = striped && index % 2 === 1;

  if (layout === "cards") {
    return (
      <div
        className={cn(
          "flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4",
          row.highlight && "border-border-strong",
        )}
      >
        <dt className="flex items-center gap-2 font-body text-xs font-semibold uppercase tracking-widest text-muted-fg">
          {RowIcon ? <RowIcon aria-hidden="true" className="size-4 text-primary" /> : null}
          <span title={row.tooltip} className={cn(row.tooltip && "underline decoration-dotted")}>
            {row.label}
          </span>
        </dt>
        <dd
          className={cn(
            "font-body text-sm sm:text-base leading-relaxed text-pretty",
            row.highlight ? "font-semibold text-fg-strong" : "text-fg",
          )}
        >
          {row.value}
        </dd>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1 px-3 py-3 sm:px-4",
        /* Desktop two-column: fixed label rail, free-wrapping value. Mobile stays stacked. */
        layout === "two-column" &&
          "sm:grid sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-baseline sm:gap-4",
        zebra && "bg-surface-sunken",
        row.highlight && "bg-primary-soft",
      )}
    >
      <dt
        className={cn(
          "flex items-center gap-2 font-body text-xs uppercase tracking-widest text-muted-fg",
          "sm:text-sm sm:normal-case sm:tracking-normal",
          row.highlight && "text-fg-strong",
        )}
      >
        {RowIcon ? <RowIcon aria-hidden="true" className="size-4 shrink-0 text-primary" /> : null}
        <span title={row.tooltip} className={cn(row.tooltip && "underline decoration-dotted")}>
          {row.label}
        </span>
      </dt>
      <dd
        className={cn(
          "font-body text-sm sm:text-base leading-relaxed text-pretty",
          row.highlight ? "font-semibold text-fg-strong" : "text-fg",
        )}
      >
        {row.value}
      </dd>
    </div>
  );
}

function GroupRows({
  group,
  striped,
  layout,
}: {
  group: SpecGroup;
  striped: boolean;
  layout: SpecTableProps["layout"];
}) {
  return (
    <dl
      className={cn(
        layout === "cards"
          ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          : "divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-raised",
      )}
    >
      {group.rows.map((row, i) => (
        <Row key={row.id} row={row} index={i} striped={striped} layout={layout} />
      ))}
    </dl>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function SpecTable({
  heading,
  subheading,
  groups,
  layout,
  striped,
  collapsibleGroups,
  image,
  footnote,
  background,
}: SpecTableProps) {
  const body = (
    <div className="flex flex-col gap-6 sm:gap-8">
      {groups.map((group, groupIndex) => {
        const rows = <GroupRows group={group} striped={striped} layout={layout} />;

        if (collapsibleGroups && group.title) {
          return (
            /* First group expanded, the rest collapsed (§2.9). */
            <details
              key={group.id}
              open={groupIndex === 0}
              className="group overflow-hidden rounded-lg border border-border bg-surface-raised"
            >
              <summary
                className={cn(
                  "list-none [&::-webkit-details-marker]:hidden",
                  "flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3",
                  "font-heading text-lg font-semibold tracking-tight text-fg-strong",
                  "hover:bg-surface-sunken",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                )}
              >
                <span>{group.title}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-5 shrink-0 text-muted-fg transition-transform",
                    "duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]",
                    "group-open:rotate-180",
                  )}
                />
              </summary>
              <div className="border-t border-border p-2 sm:p-3">{rows}</div>
            </details>
          );
        }

        return (
          <div key={group.id} className="flex flex-col gap-3">
            {group.title ? (
              <h3 className="font-heading text-lg font-semibold tracking-tight text-fg-strong">
                {group.title}
              </h3>
            ) : null}
            {rows}
          </div>
        );
      })}

      {footnote ? (
        <p className="font-body text-xs leading-normal text-muted-fg text-pretty">{footnote}</p>
      ) : null}
    </div>
  );

  return (
    <section
      data-block="spec-table"
      className={cn("py-[var(--space-section)]", SECTION_TONE[background])}
    >
      <div className="mx-auto w-full max-w-[var(--container-page)] px-[var(--space-gutter)]">
        {heading || subheading ? (
          <header className="mx-auto mb-8 flex max-w-[var(--container-narrow)] flex-col gap-3 text-center sm:mb-12 sm:gap-4">
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

        {image ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-12 lg:items-start">
            <figure
              className="relative overflow-hidden rounded-xl bg-surface-sunken aspect-card lg:sticky lg:top-6"
              style={image.dominant ? { backgroundColor: image.dominant } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                loading="lazy"
                decoding="async"
                className={cn("size-full object-contain p-4 sm:p-6", FOCAL[image.focal])}
              />
            </figure>
            {body}
          </div>
        ) : (
          <div
            className={cn(
              layout === "single-column" && "mx-auto max-w-[var(--container-narrow)]",
            )}
          >
            {body}
          </div>
        )}
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

const YES_NO = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

export const specTablePuckConfig: PuckBlockConfig = {
  label: "Spec table",
  fields: {
    heading: { type: "text", label: "Heading" },
    subheading: { type: "text", label: "Subheading" },
    groups: {
      type: "array",
      label: "Spec groups (1–4)",
      min: 1,
      max: 4,
      getItemSummary: (item: { title?: string }) => item?.title || "Ungrouped specs",
      defaultItemProps: {
        id: "grp_new",
        title: "The basics",
        rows: [{ id: "row_new", label: "Net volume", value: "30 ml", highlight: false }],
      },
      arrayFields: {
        title: { type: "text", label: "Group title (leave blank for an ungrouped table)" },
        rows: {
          type: "array",
          label: "Rows (1–20)",
          min: 1,
          max: 20,
          getItemSummary: (row: { label?: string }) => row?.label || "Spec",
          defaultItemProps: { id: "row_new", label: "Label", value: "Value", highlight: false },
          arrayFields: {
            label: { type: "text", label: "Label (max 40 chars)" },
            value: { type: "textarea", label: "Value — include units exactly, e.g. \"30 ml\"" },
            icon: { type: "select", label: "Icon", options: ICON_OPTIONS },
            highlight: { type: "radio", label: "Highlight this row", options: YES_NO },
            tooltip: { type: "text", label: "Tooltip" },
          },
        },
      },
    },
    layout: {
      type: "radio",
      label: "Desktop layout",
      options: [
        { label: "Two column", value: "two-column" },
        { label: "Single column", value: "single-column" },
        { label: "Cards", value: "cards" },
      ],
    },
    striped: { type: "radio", label: "Zebra striping", options: YES_NO },
    collapsibleGroups: {
      type: "radio",
      label: "Collapsible groups (recommended above 12 rows)",
      options: YES_NO,
    },
    image: {
      type: "object",
      label: "Supporting image",
      objectFields: {
        src: { type: "text", label: "Image URL or /public path" },
        alt: { type: "text", label: "Alt text (required)" },
      },
    },
    footnote: { type: "textarea", label: "Footnote" },
    background: { type: "select", label: "Section background", options: TONE_OPTIONS },
  },
  defaultProps: {
    heading: "Product details",
    groups: [
      {
        id: "grp_basics",
        title: "The basics",
        rows: [{ id: "row_vol", label: "Net volume", value: "30 ml", highlight: true }],
      },
    ],
    layout: "two-column",
    striped: true,
    collapsibleGroups: false,
    image: null,
    background: "neutral",
  },
};
