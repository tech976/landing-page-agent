/**
 * Landing Agent — THE BLOCK REGISTRY.
 *
 * Contract source: docs/BLOCK-CATALOG.md §2 (the 12 flow blocks), §3 (the 3 fixtures)
 *                  src/lib/schema/page.ts   (the authoritative block type union)
 *
 * This is the single seam between the block files and everything that consumes them.
 * Two hosts render these components and neither may hand-maintain an import list:
 *
 *   src/components/PageRenderer.tsx   production render path (no Puck, zero editor JS)
 *   src/lib/puck/config.tsx           editor canvas (Puck field configs + render wrap)
 *
 * WHY THE MAPS ARE TYPED THE WAY THEY ARE
 * `blockComponents` is keyed by the schema's `BlockType` union and each value is
 * constrained to `ComponentType<PropsFor<K>>`. That is deliberate and load-bearing:
 * it makes the compiler prove that every block component accepts exactly the props
 * its Zod schema produces. If a block author drifts from the schema, this file fails
 * to compile — the drift cannot reach the renderer or the LLM tool definition.
 *
 * `blockPuckConfigs` is held loosely (`AnyPuckBlockConfig`). Each block file types its
 * own config over its own Zod-inferred props; pinning one generic across all fifteen
 * would force every author to satisfy this module's view of their props for no runtime
 * gain. The runtime contract — `label`, `fields`, `defaultProps` — is what matters.
 *
 * NAMING CONVENTION every block file follows:
 *   export default function <PascalName>(props: <PascalName>Props)
 *   export const <camelName>PuckConfig: Omit<ComponentConfig<…>, "render">
 *
 * FIXTURES are exported separately. sticky-cta, social-proof-popup and trust-bar are
 * singletons on `page.fixtures`, NOT members of `page.blocks[]` — keeping them out of
 * `blockComponents` is what stops a marketer dragging a second sticky bar onto a page.
 */

import type { ComponentType } from "react";

import type { BlockType, PropsFor } from "@/lib/schema/page";
import { BLOCK_TYPES } from "@/lib/schema/page";

/* ── The 12 flow blocks ──────────────────────────────────────────────────── */

import AnnouncementBar, { announcementBarPuckConfig } from "./AnnouncementBar";
import HeroProduct, { heroProductPuckConfig } from "./HeroProduct";
import UrgencyStrip, { urgencyStripPuckConfig } from "./UrgencyStrip";
import OfferStack, { offerStackPuckConfig } from "./OfferStack";
import ProductNarrative, { productNarrativePuckConfig } from "./ProductNarrative";
import CollectionGrid, { collectionGridPuckConfig } from "./CollectionGrid";
import PersonaCards, { personaCardsPuckConfig } from "./PersonaCards";
import ValuePillars, { valuePillarsPuckConfig } from "./ValuePillars";
import SpecTable, { specTablePuckConfig } from "./SpecTable";
import ReviewWall, { reviewWallPuckConfig } from "./ReviewWall";
import ComparisonTable, { comparisonTablePuckConfig } from "./ComparisonTable";
import FaqAccordion, { faqAccordionPuckConfig } from "./FaqAccordion";

/* ── The 3 page fixtures (singletons) ────────────────────────────────────── */

import StickyCta, { stickyCtaPuckConfig } from "./StickyCta";
import SocialProofPopup, { socialProofPopupPuckConfig } from "./SocialProofPopup";
import TrustBar, { trustBarPuckConfig } from "./TrustBar";

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

/** Re-exported so consumers can depend on the registry alone. Derived from the schema. */
export type { BlockType } from "@/lib/schema/page";

/** The three fixture component names, mirroring the keys of `page.fixtures`. */
export type FixtureName = "sticky-cta" | "social-proof-popup" | "trust-bar";

/** Everything Puck knows how to render: the 12 draggable blocks plus the 3 fixtures. */
export type PuckComponentName = BlockType | FixtureName;

/**
 * A block file's `<name>PuckConfig` export: `Omit<ComponentConfig<Props>, "render">`.
 * `render` is deliberately absent — src/lib/puck/config.tsx assembles it from the
 * default-exported component so the editor and production render the same tree.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPuckBlockConfig = Record<string, any>;

/** A block component whose props are its own Zod-inferred type. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyBlockComponent = ComponentType<any>;

/**
 * Schema-checked component map. Each entry must accept the exact props its block's
 * Zod schema infers — this is where component/schema drift becomes a compile error.
 */
export type BlockComponentMap = {
  [K in BlockType]: ComponentType<PropsFor<K>>;
};

/* ────────────────────────────────────────────────────────────────────────────
   The registry
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Block type id → React component. Keys are exhaustive over `BlockType`: adding a
 * block to the schema union without adding it here is a compile error, and vice versa.
 */
export const blockComponents: BlockComponentMap = {
  "announcement-bar": AnnouncementBar,
  "hero-product": HeroProduct,
  "urgency-strip": UrgencyStrip,
  "offer-stack": OfferStack,
  "product-narrative": ProductNarrative,
  "collection-grid": CollectionGrid,
  "persona-cards": PersonaCards,
  "value-pillars": ValuePillars,
  "spec-table": SpecTable,
  "review-wall": ReviewWall,
  "comparison-table": ComparisonTable,
  "faq-accordion": FaqAccordion,
};

/** Block type id → its Puck field config (no `render`; config.tsx supplies that). */
export const blockPuckConfigs: Record<BlockType, AnyPuckBlockConfig> = {
  "announcement-bar": announcementBarPuckConfig,
  "hero-product": heroProductPuckConfig,
  "urgency-strip": urgencyStripPuckConfig,
  "offer-stack": offerStackPuckConfig,
  "product-narrative": productNarrativePuckConfig,
  "collection-grid": collectionGridPuckConfig,
  "persona-cards": personaCardsPuckConfig,
  "value-pillars": valuePillarsPuckConfig,
  "spec-table": specTablePuckConfig,
  "review-wall": reviewWallPuckConfig,
  "comparison-table": comparisonTablePuckConfig,
  "faq-accordion": faqAccordionPuckConfig,
};

/* ── Fixtures ────────────────────────────────────────────────────────────── */

/** Fixture name → React component. Kept out of `blockComponents` on purpose. */
export const fixtureComponents: Record<FixtureName, AnyBlockComponent> = {
  "sticky-cta": StickyCta,
  "social-proof-popup": SocialProofPopup,
  "trust-bar": TrustBar,
};

/** Fixture name → its Puck field config. */
export const fixturePuckConfigs: Record<FixtureName, AnyPuckBlockConfig> = {
  "sticky-cta": stickyCtaPuckConfig,
  "social-proof-popup": socialProofPopupPuckConfig,
  "trust-bar": trustBarPuckConfig,
};

/**
 * `page.fixtures` key → Puck component name. The schema keys the fixtures object in
 * camelCase; Puck and the block catalog use kebab-case ids. This is the only place
 * that translation is allowed to live.
 */
export const FIXTURE_KEY_TO_NAME = {
  stickyCta: "sticky-cta",
  socialProofPopup: "social-proof-popup",
  trustBar: "trust-bar",
} as const satisfies Record<string, FixtureName>;

/* ── Combined view, for hosts that render blocks and fixtures alike (Puck) ── */

/** Every renderable component, blocks and fixtures together, keyed by Puck name. */
export const allPuckComponents: Record<PuckComponentName, AnyBlockComponent> = {
  ...blockComponents,
  ...fixtureComponents,
};

/** Every Puck field config, blocks and fixtures together. */
export const allPuckConfigs: Record<PuckComponentName, AnyPuckBlockConfig> = {
  ...blockPuckConfigs,
  ...fixturePuckConfigs,
};

/** The 12 flow block ids in BLOCK-CATALOG §2 declaration order. Re-exported for hosts. */
export const BLOCK_TYPE_IDS = BLOCK_TYPES;

/** The 3 fixture ids. */
export const FIXTURE_NAMES = [
  "sticky-cta",
  "social-proof-popup",
  "trust-bar",
] as const satisfies readonly FixtureName[];

/** Runtime guard — useful when reading page JSON that may predate a registry change. */
export function isBlockType(value: string): value is BlockType {
  return Object.prototype.hasOwnProperty.call(blockComponents, value);
}

/* ── Named re-exports, so callers never reach past the registry ──────────── */

export {
  AnnouncementBar,
  HeroProduct,
  UrgencyStrip,
  OfferStack,
  ProductNarrative,
  CollectionGrid,
  PersonaCards,
  ValuePillars,
  SpecTable,
  ReviewWall,
  ComparisonTable,
  FaqAccordion,
  StickyCta,
  SocialProofPopup,
  TrustBar,
};
