/**
 * Landing Agent — the Puck editor Config.
 *
 * Contract source: docs/BLOCK-CATALOG.md §2 (the 12 flow blocks), §3 (fixtures)
 *
 * The component NAMES in this config are the block TYPE IDS from the locked registry
 * ("hero-product", not "HeroProduct"). That is intentional and load-bearing: it makes
 * `Block.type ⟷ ComponentData.type` the identity mapping, so src/lib/puck/adapter.ts
 * needs no translation table that could drift. Ids Puck mints for newly dropped blocks
 * inherit that name too ("hero-product-<uuid>"), which keeps them readable in the JSON.
 *
 * Each block file under src/components/blocks/ owns two exports:
 *   - `default`                        the React component, taking clean schema props
 *   - `<camelCaseName>PuckConfig`      its Puck field definitions (fields, label,
 *                                      defaultProps) — NOT a `render`, which is
 *                                      assembled here
 *
 * Those files are authored in parallel by the block engineers; this module is written
 * against the naming convention alone and does not otherwise depend on their internals.
 *
 * FIXTURES: sticky-cta, social-proof-popup and trust-bar are page-level singletons on
 * `page.fixtures` (BLOCK-CATALOG §3), NOT members of `page.blocks[]`. They are
 * registered here so the editor can render and field-edit them, but their category is
 * `visible: false` so they never appear in the drag-and-drop component list — a
 * marketer must not be able to drag a second sticky bar onto the canvas.
 */

import type { ReactNode } from "react";

import { PUCK_HIDDEN_PROP, PUCK_NOTES_PROP } from "./adapter";

/* ────────────────────────────────────────────────────────────────────────────
   Block components + their field configs — from the registry, never hand-listed
   ──────────────────────────────────────────────────────────────────────────── */

import {
  allPuckComponents,
  allPuckConfigs,
  BLOCK_TYPE_IDS,
  FIXTURE_NAMES,
  type AnyBlockComponent,
  type AnyPuckBlockConfig,
  type PuckComponentName,
} from "@/components/blocks";

/* NESTED-EDITING PoC (faq-accordion only). These editor-only pieces are imported
   directly from the block file rather than through the registry, because faq-item is
   deliberately NOT a member of the locked block registry — it is a canvas sub-item,
   not a page-level block. See the wiring below `components`. */
import {
  FaqAccordionEditor,
  FaqItemEditor,
  faqItemPuckConfig,
} from "@/components/blocks/FaqAccordion";

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

/** @see AnyPuckBlockConfig in the registry — kept as an alias for existing callers. */
export type BlockPuckConfig = AnyPuckBlockConfig;

/** The four sidebar groupings the editor presents. */
export type PuckCategory = "Hero & Offer" | "Trust & Proof" | "Content" | "Fixtures";

export type { FixtureName as FixtureComponentName, PuckComponentName } from "@/components/blocks";

/* ────────────────────────────────────────────────────────────────────────────
   The standard render wrapper
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Bridges Puck's prop envelope to a block component's clean schema props.
 *
 * Puck hands the render function `{ ...props, id, puck, editMode }` plus our two
 * reserved envelope props. Block components are written against their Zod-inferred
 * props type and know nothing about any of that, so we strip it here.
 *
 * Hidden blocks stay VISIBLE in the editor — dimmed and outlined — rather than
 * disappearing. `hidden` is a soft-delete (BLOCK-CATALOG §0.1); a marketer who hid a
 * block by accident must be able to find it and un-hide it. PageRenderer is the one
 * that actually skips them at production render time.
 */
function makeRender(Component: AnyBlockComponent, type: PuckComponentName) {
  const RenderBlock = (puckProps: Record<string, unknown>) => {
    const {
      id,
      puck: _puck,
      editMode: _editMode,
      [PUCK_HIDDEN_PROP]: hidden,
      [PUCK_NOTES_PROP]: notes,
      ...props
    } = puckProps;

    return (
      <div
        data-lp-block-id={typeof id === "string" ? id : undefined}
        data-lp-block-type={type}
        data-lp-hidden={hidden === true ? "true" : undefined}
        title={typeof notes === "string" && notes.length > 0 ? notes : undefined}
        style={
          hidden === true
            ? { opacity: 0.4, outline: "2px dashed currentColor", outlineOffset: "-2px" }
            : undefined
        }
      >
        <Component {...props} />
      </div>
    );
  };

  RenderBlock.displayName = `PuckBlock(${type})`;
  return RenderBlock;
}

/**
 * Merges a block's exported field config with the render wrapper.
 * `defaultProps` gets `_lpHidden: false` so a freshly dropped block round-trips to a
 * schema-valid `hidden: false` without the adapter having to guess.
 */
function defineBlock(
  type: PuckComponentName,
  Component: AnyBlockComponent,
  blockConfig: BlockPuckConfig | undefined,
) {
  const config: BlockPuckConfig = blockConfig ?? {};

  return {
    label: config.label,
    ...config,
    fields: config.fields ?? {},
    defaultProps: {
      ...(config.defaultProps ?? {}),
      [PUCK_HIDDEN_PROP]: false,
    },
    render: config.render ?? makeRender(Component, type),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   Category assignment — BLOCK-CATALOG §4 conversion roles
   ──────────────────────────────────────────────────────────────────────────── */

export const CATEGORY_COMPONENTS: Record<PuckCategory, PuckComponentName[]> = {
  /* Confirm the promise, make the offer. */
  "Hero & Offer": ["announcement-bar", "hero-product", "urgency-strip", "offer-stack"],
  /* Prove it. */
  "Trust & Proof": ["value-pillars", "review-wall", "comparison-table"],
  /* Persuade, inform, remove friction. */
  Content: [
    "product-narrative",
    "persona-cards",
    "spec-table",
    "faq-accordion",
    "collection-grid",
  ],
  /* Page-level singletons — registered, but not draggable. */
  Fixtures: ["sticky-cta", "social-proof-popup", "trust-bar"],
};

/* ────────────────────────────────────────────────────────────────────────────
   The config
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Built by walking the registry — the 12 flow blocks plus the 3 fixtures. Nothing is
 * enumerated by hand here, so a block added to the schema and the registry appears in
 * the editor automatically; the only manual step left is deciding its sidebar
 * category below, which `CATEGORY_COMPONENTS` makes the compiler ask for.
 */
const components = Object.fromEntries(
  ([...BLOCK_TYPE_IDS, ...FIXTURE_NAMES] as PuckComponentName[]).map((name) => [
    name,
    defineBlock(
      name,
      allPuckComponents[name] as AnyBlockComponent,
      allPuckConfigs[name],
    ),
  ]),
) as Record<PuckComponentName, ReturnType<typeof defineBlock>>;

/* ════════════════════════════════════════════════════════════════════════════════
   NESTED-EDITING PoC — faq-accordion only
   ════════════════════════════════════════════════════════════════════════════════
   Two surgical overrides on top of the auto-assembled `components` map:

   1. faq-accordion uses a SLOT-AWARE editor render (FaqAccordionEditor) instead of the
      production component. The production FaqAccordion takes `items: FaqItem[]`; in the
      editor, `items` is a Puck slot injected as a component, so it needs a render that
      outputs `<Items />`. Routed through `defineBlock` so it keeps the standard block
      envelope wrapper (hidden/notes handling, data-lp-block-id).

   2. faq-item is registered as a first-class Puck component so it can live inside the
      slot with its own selectable sidebar fields. It is NOT wrapped by `defineBlock`
      (no `_lpHidden` envelope — a sub-item is not a soft-deletable Block) and its render
      keeps Puck's injected `props.id`, which FaqItemEditor surfaces for the DOM.

   Nothing here generalises to other blocks — it is intentionally faq-accordion-specific.
   ──────────────────────────────────────────────────────────────────────────────── */
const componentsWithNesting = {
  ...components,
  "faq-accordion": defineBlock("faq-accordion", FaqAccordionEditor, allPuckConfigs["faq-accordion"]),
  "faq-item": {
    label: faqItemPuckConfig.label,
    fields: faqItemPuckConfig.fields,
    defaultProps: faqItemPuckConfig.defaultProps,
    render: FaqItemEditor,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as Record<string, any>;

/**
 * The Puck Config.
 *
 * Typed loosely at the boundary and cast once: the components map is built from 15
 * independently-authored field configs whose prop types are their own Zod-inferred
 * shapes, and Puck's `Config` generic cannot infer across that seam without every
 * block file re-declaring its props here. The runtime shape is exact — the cast buys
 * ergonomics for the block authors, not correctness.
 */
export const puckConfig = {
  categories: {
    "Hero & Offer": {
      title: "Hero & Offer",
      components: CATEGORY_COMPONENTS["Hero & Offer"],
      defaultExpanded: true,
    },
    "Trust & Proof": {
      title: "Trust & Proof",
      components: CATEGORY_COMPONENTS["Trust & Proof"],
      defaultExpanded: true,
    },
    Content: {
      title: "Content",
      components: CATEGORY_COMPONENTS.Content,
      defaultExpanded: true,
    },
    Fixtures: {
      title: "Page fixtures",
      components: CATEGORY_COMPONENTS.Fixtures,
      // Singletons on `page.fixtures` — must never be drag-reorderable. §3.
      visible: false,
    },
    /* NESTED-EDITING PoC: faq-item is added ONLY inside an faq-accordion slot, never
       dragged onto the page root. A component in no category would surface in Puck's
       default "Other" drawer section, so — exactly as the fixtures do above — it is
       parked in a `visible: false` category to keep it out of the drawer. */
    "Nested items": {
      title: "Nested items",
      components: ["faq-item"],
      visible: false,
    },
  },

  components: componentsWithNesting,

  /**
   * Root fields. Only `title` is editable and round-tripped by the adapter; `pageId`
   * and `slug` ride in root.props read-only so the chrome can display them.
   */
  root: {
    fields: {
      title: { type: "text", label: "Page title" },
    },
    render: ({ children }: { children?: ReactNode }) => <>{children}</>,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

export default puckConfig;
