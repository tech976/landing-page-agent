/**
 * Landing Agent — Page JSON ⇄ Puck Data adapter.
 *
 * Contract source: docs/BLOCK-CATALOG.md §0.1 (architectural contract, addressing rule)
 *                  src/lib/schema/page.ts  (PageSchema — the canonical document)
 *
 * THIS IS THE HINGE OF THE WHOLE SYSTEM.
 *
 *   Anthropic SDK ──(JSON)──▶ Zod ──▶ page.json ──▶ [pageToPuckData] ──▶ Puck canvas
 *                                        ▲                                    │
 *                                        └──── [puckDataToPage] ◀─────────────┘
 *
 * Both directions must be lossless. A page that goes out to Puck and comes straight
 * back with zero edits must be `deepEqual` to the page that went in — same block ids,
 * same order, same props, same envelope flags, same everything outside `blocks`.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * THE ID MAPPING — read this before changing anything below
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Our canonical block instance and Puck's ComponentData are shaped differently:
 *
 *   ours:  { id, type, props: {...}, hidden, notes? }
 *   puck:  { type, props: { id, ...everythingElse } }     // Puck's `WithId<Props>`
 *
 * Puck requires a unique `id` STRING INSIDE `props` on every ComponentData. It uses
 * that id as the React key, the selection key, the drag key and the undo/redo key.
 * It is the only field Puck itself guarantees to preserve across every canvas
 * operation — reorder, duplicate-neighbour, sidebar edit, undo, redo.
 *
 * So the mapping is deliberately the identity mapping on that field:
 *
 *              block.id  ⟷  componentData.props.id
 *
 * We do NOT mint a side table, a WeakMap, or an index→id lookup. There is nothing to
 * fall out of sync, because Puck is already storing our id for us, in the one slot it
 * promises never to lose. Drag a block from position 2 to position 9 and its
 * `props.id` rides along untouched; `puckDataToPage` reads it back verbatim. This is
 * what satisfies the non-negotiable addressing rule in BLOCK-CATALOG §0.1: blocks are
 * addressed by id, never by array index, on both sides of the boundary.
 *
 * Corollaries that MUST hold for the mapping to stay safe:
 *
 *   1. No block props schema may declare a top-level prop literally named `id`.
 *      (Verified against all 12 schemas in src/lib/schema/page.ts — none do. Nested
 *      ids — offers[].id, reviews[].id, pillars[].id — live inside arrays/objects and
 *      travel through as opaque prop data, untouched.) `assertNoIdCollision` below
 *      shouts in dev if a future schema ever breaks this.
 *
 *   2. `type` is the identity mapping too: our block type ids ("hero-product") ARE the
 *      Puck component names. See src/lib/puck/config.tsx. No PascalCase translation,
 *      no lookup table, nothing to drift.
 *
 *   3. Blocks created by a marketer dragging from the Puck sidebar arrive with an id
 *      Puck generated ("hero-product-f47ac10b-58cc-4372-a567-0e02b2c3d479", 50 chars —
 *      comfortably inside IdSchema's 64-char cap). We accept it as-is rather than
 *      re-minting, so the id the marketer's canvas has been using is the id that hits
 *      disk, and any AI edit op issued against it in the same session still resolves.
 *
 * The envelope fields `hidden` and `notes` have nowhere to live in ComponentData, so
 * they are carried as reserved, underscore-prefixed props and stripped on the way
 * back. They are namespaced (`_lp*`) so they can never collide with a real block prop.
 */

import type { ComponentData, Data } from "@measured/puck";

import { BLOCK_TYPES, type Block, type BlockType, type FaqItem, type Page } from "@/lib/schema/page";

/* ────────────────────────────────────────────────────────────────────────────
   Reserved prop keys
   ──────────────────────────────────────────────────────────────────────────── */

/** Puck's own required prop. Holds `block.id` verbatim. See the id-mapping note. */
export const PUCK_ID_PROP = "id" as const;

/** Carries `block.hidden` through the canvas. */
export const PUCK_HIDDEN_PROP = "_lpHidden" as const;

/** Carries `block.notes` through the canvas. */
export const PUCK_NOTES_PROP = "_lpNotes" as const;

/**
 * Everything that must be stripped before props are handed back to the page schema.
 * `puck` and `editMode` are injected by Puck at render time only — they should never
 * appear in serialised Data, but we strip them defensively so a stray one can never
 * reach Zod.
 */
const RESERVED_PROPS = new Set<string>([
  PUCK_ID_PROP,
  PUCK_HIDDEN_PROP,
  PUCK_NOTES_PROP,
  "puck",
  "editMode",
]);

const BLOCK_TYPE_SET: ReadonlySet<string> = new Set(BLOCK_TYPES);

/* ────────────────────────────────────────────────────────────────────────────
   NESTED-EDITING PoC — faq-accordion `items` ⟷ faq-item slot children

   THE ONE-LEVEL-DOWN MAPPING. The block↔ComponentData id mapping documented above
   (block.id ⟷ componentData.props.id) is mirrored exactly one level deeper for FAQ
   items, so nested editing inherits the same losslessness guarantee:

              FaqItem.id  ⟷  faqItemComponentData.props.id

   The canonical Page JSON is UNCHANGED: on disk and to the schema, faq-accordion still
   has `props.items = FaqItem[]`. Only the Puck canvas sees these as slot children —
   `pageToPuckData` expands them here and `puckDataToPage` collapses them back, in the
   same order, carrying every FaqItem field (including ones with no sidebar field, such
   as `cta`) straight through. This is deliberately faq-accordion-specific; no other
   block is touched.
   ──────────────────────────────────────────────────────────────────────────── */

const FAQ_ACCORDION_TYPE = "faq-accordion" as const;
const FAQ_ITEM_TYPE = "faq-item" as const;

/** FaqItem[] → faq-item slot children. `id` moves into Puck's reserved `props.id`. */
function faqItemsToSlot(items: readonly FaqItem[]): ComponentData[] {
  return items.map((item) => {
    const { id, ...rest } = item;
    return {
      type: FAQ_ITEM_TYPE,
      props: {
        // Every remaining FaqItem field rides through verbatim — question, answer,
        // group, and cta (which has no sidebar field) alike.
        ...deepClone(rest as Record<string, unknown>),
        [PUCK_ID_PROP]: id,
      },
    } as ComponentData;
  });
}

/** faq-item slot children → FaqItem[], preserving order and each id. */
function slotToFaqItems(slot: unknown): FaqItem[] {
  if (!Array.isArray(slot)) return [];

  const items: FaqItem[] = [];

  for (const child of slot) {
    const childProps = ((child as ComponentData | undefined)?.props ?? {}) as Record<string, unknown>;

    const id = childProps[PUCK_ID_PROP];
    if (typeof id !== "string" || id.length === 0) {
      if (isDev) {
        console.warn(
          "[puck/adapter] Dropping an faq-item slot child with no usable props.id. " +
            "Every FAQ item must carry a stable id — see the id-mapping note above.",
        );
      }
      continue;
    }

    // Everything that is not a reserved Puck/envelope prop is a FaqItem field, verbatim.
    const fields: Record<string, unknown> = {};
    for (const key of Object.keys(childProps)) {
      if (RESERVED_PROPS.has(key)) continue;
      fields[key] = deepClone(childProps[key]);
    }

    items.push({ id, ...fields } as FaqItem);
  }

  return items;
}

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────────── */

const isDev = process.env.NODE_ENV !== "production";

/**
 * Deep clone so the canvas can never mutate the page object it was seeded from (and
 * vice-versa). `structuredClone` keeps explicit `undefined` values, which a
 * JSON round-trip would silently drop — that difference is exactly the kind of thing
 * that turns a "lossless" claim into a bug report.
 */
function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Guards corollary 1 of the id mapping. Dev-only; never throws in production. */
function assertNoIdCollision(block: Block): void {
  if (!isDev) return;
  if (Object.prototype.hasOwnProperty.call(block.props, PUCK_ID_PROP)) {
    console.error(
      `[puck/adapter] Block type "${block.type}" declares a top-level prop named ` +
        `"id". That collides with Puck's reserved id prop and BREAKS the lossless ` +
        `round-trip. Rename the prop in src/lib/schema/page.ts.`,
    );
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Page  ──▶  Puck
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Converts one canonical block instance into a Puck ComponentData.
 *
 * `id` is written AFTER the props spread so Puck's contract (a unique string id on
 * every item) can never be broken by block data, even if corollary 1 is one day
 * violated. `notes` is only written when it is actually present — adding
 * `notes: undefined` would make the return trip produce `{ notes: undefined }`, which
 * fails a strict deep-equal against a page that simply never had the key.
 */
export function blockToComponentData(block: Block): ComponentData {
  assertNoIdCollision(block);

  const props: Record<string, unknown> = {
    ...deepClone(block.props as Record<string, unknown>),
    [PUCK_ID_PROP]: block.id,
    [PUCK_HIDDEN_PROP]: block.hidden,
  };

  if (block.notes !== undefined) {
    props[PUCK_NOTES_PROP] = block.notes;
  }

  // NESTED-EDITING PoC: expand faq-accordion's items (FaqItem[]) into faq-item slot
  // children so each Q&A is individually clickable on the canvas. All other blocks are
  // untouched; the `items` from the props spread above is replaced in place.
  if (block.type === FAQ_ACCORDION_TYPE) {
    const items = (block.props as { items?: FaqItem[] }).items ?? [];
    props.items = faqItemsToSlot(items);
  }

  return { type: block.type, props } as ComponentData;
}

/**
 * Canonical Page JSON → Puck Data.
 *
 * `page.blocks` becomes `data.content`, in the same order. Everything else on the
 * page — meta, theme, fixtures, tracking, status, timestamps — is NOT represented in
 * Puck Data at all; it is carried by the `base` page handed to `puckDataToPage` on the
 * way back. Fixtures deliberately never enter `content`: BLOCK-CATALOG §3 requires
 * they be singletons that cannot be drag-reordered.
 *
 * `root.props` carries the page identity so the editor chrome can label the canvas.
 * Only `title` is round-tripped back (it is the one root field the editor exposes);
 * `pageId` and `slug` ride along read-only for display and are re-derived from `base`.
 */
export function pageToPuckData(page: Page): Data {
  return {
    root: {
      props: {
        title: page.title,
        pageId: page.id,
        slug: page.slug,
      },
    },
    content: page.blocks.map(blockToComponentData),
    zones: {},
  } as Data;
}

/* ────────────────────────────────────────────────────────────────────────────
   Puck  ──▶  Page
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Converts one Puck ComponentData back into a canonical block instance.
 *
 * Returns `null` for any component whose type is not in the locked registry — an
 * unknown type cannot be represented in `PageSchema`, and silently coercing it would
 * corrupt the document. Dropping it (loudly, in dev) is the safe failure mode.
 */
export function componentDataToBlock(item: ComponentData): Block | null {
  const type = item?.type as BlockType | undefined;

  if (!type || !BLOCK_TYPE_SET.has(type)) {
    if (isDev) {
      console.warn(
        `[puck/adapter] Dropping component of unknown type "${String(type)}". ` +
          `Only the 12 registry block types can be stored on a Page.`,
      );
    }
    return null;
  }

  const rawProps = (item.props ?? {}) as Record<string, unknown>;

  const id = rawProps[PUCK_ID_PROP];
  if (typeof id !== "string" || id.length === 0) {
    if (isDev) {
      console.warn(
        `[puck/adapter] Dropping "${type}" component with no usable props.id. ` +
          `Every block must carry a stable id — see BLOCK-CATALOG §0.1.`,
      );
    }
    return null;
  }

  // Everything that is not reserved is block props, verbatim.
  const props: Record<string, unknown> = {};
  for (const key of Object.keys(rawProps)) {
    if (RESERVED_PROPS.has(key)) continue;
    props[key] = deepClone(rawProps[key]);
  }

  // NESTED-EDITING PoC: collapse faq-item slot children back into items: FaqItem[],
  // preserving order and every item's id (and non-editable fields like `cta`). This
  // overwrites the raw slot array that the loop above copied. Other blocks are untouched.
  if (type === FAQ_ACCORDION_TYPE) {
    props.items = slotToFaqItems(rawProps.items);
  }

  const block: Record<string, unknown> = {
    id,
    type,
    props,
    // `hidden` has a Zod default of false and is therefore always present on a parsed
    // Page. Blocks a marketer just dragged in have no `_lpHidden` yet → false.
    hidden: rawProps[PUCK_HIDDEN_PROP] === true,
  };

  const notes = rawProps[PUCK_NOTES_PROP];
  if (typeof notes === "string") {
    block.notes = notes;
  }

  return block as Block;
}

/**
 * Puck Data → canonical Page JSON.
 *
 * `base` is the page the canvas was seeded from. It supplies every field Puck does not
 * model (meta, theme, fixtures, tracking, status, createdAt, id, slug), so the return
 * trip is additive: we replace `blocks`, take `title` from the root field, and leave
 * the rest of the document exactly as it was.
 *
 * Deliberately does NOT touch `updatedAt`. Stamping a timestamp here would make an
 * edit-free round-trip non-identical, which would defeat the losslessness test. The
 * store/API layer owns that stamp, and Zod validation is the caller's job — this
 * function is a pure shape translation.
 */
export function puckDataToPage(data: Data, base: Page): Page {
  const blocks: Block[] = [];

  for (const item of data?.content ?? []) {
    const block = componentDataToBlock(item as ComponentData);
    if (block) blocks.push(block);
  }

  const rootProps = ((data?.root as { props?: Record<string, unknown> } | undefined)?.props ??
    {}) as Record<string, unknown>;
  const rootTitle = rootProps.title;

  return {
    ...base,
    title: typeof rootTitle === "string" && rootTitle.trim().length > 0 ? rootTitle : base.title,
    blocks,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Round-trip self-check (dev / test utility)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Returns true when `page` survives a page → puck → page round-trip unchanged.
 * Intended for tests and for a dev-mode assertion when the editor boots, so a schema
 * change that quietly breaks losslessness is caught at the boundary rather than three
 * AI edit passes later.
 */
export function isLosslessRoundTrip(page: Page): boolean {
  const returned = puckDataToPage(pageToPuckData(page), page);
  return JSON.stringify(sortKeysDeep(returned)) === JSON.stringify(sortKeysDeep(page));
}

/** Stable key ordering so the comparison above is order-insensitive but value-strict. */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      out[key] = sortKeysDeep(source[key]);
    }
    return out;
  }
  return value;
}
