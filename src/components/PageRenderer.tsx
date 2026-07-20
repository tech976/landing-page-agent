/**
 * Landing Agent — production page renderer.
 *
 * Contract source: docs/BLOCK-CATALOG.md §2 (blocks), §3 (fixtures), §4 (page order)
 *                  docs/DESIGN-SYSTEM.md §2.3 (theme → scoped CSS variables)
 *
 * This is the PRODUCTION render path, not the editor path. Puck is not imported here
 * and must never be: the published page ships zero editor JavaScript. The editor
 * canvas renders the same block components through src/lib/puck/config.tsx instead —
 * same components, same JSON, two hosts.
 *
 * Responsibilities, in order:
 *   1. Apply the brand theme as scoped CSS custom properties on a wrapper element.
 *   2. Map over `page.blocks` and render each by `type` via a lookup, skipping
 *      soft-deleted (`hidden`) blocks.
 *   3. Render the three page-level fixtures, honouring `trustBar.placement`.
 *
 * Server-renderable: no "use client" here. Individual blocks and fixtures that need
 * interactivity declare their own client boundary.
 */

import type { Block, BlockType, Page } from "@/lib/schema/page";
import { themeRootAttributes, themeToCssVars } from "@/lib/theme";

/**
 * Blocks and fixtures come from the registry, never from a hand-written import list —
 * see src/components/blocks/index.ts. The editor host (src/lib/puck/config.tsx) reads
 * the same registry, which is what keeps the two render paths from drifting apart.
 */
import {
  blockComponents,
  type AnyBlockComponent,
  StickyCta,
  SocialProofPopup,
  TrustBar,
} from "@/components/blocks";

const isDev = process.env.NODE_ENV !== "production";

/* ────────────────────────────────────────────────────────────────────────────
   Single block
   ──────────────────────────────────────────────────────────────────────────── */

function RenderBlock({ block }: { block: Block }) {
  // Soft-delete: the block stays in the JSON (so an AI edit pass can restore it by id)
  // but never reaches the visitor. BLOCK-CATALOG §0.1.
  if (block.hidden) return null;

  const Component = blockComponents[block.type as BlockType] as AnyBlockComponent | undefined;

  if (!Component) {
    // An unknown type means the page JSON references a block outside the locked
    // registry — a schema/registry drift, not a visitor-facing problem. Render nothing
    // rather than throwing: one bad block must never take down a live paid landing
    // page mid-campaign.
    if (isDev) {
      console.warn(
        `[PageRenderer] Unknown block type "${block.type}" (id: "${block.id}"). ` +
          `Rendering nothing. Every type must exist in the locked registry — see ` +
          `docs/BLOCK-CATALOG.md §2.`,
      );
    }
    return null;
  }

  return (
    <div id={block.id} data-lp-block-id={block.id} data-lp-block-type={block.type}>
      <Component {...block.props} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────────────────────── */

export interface PageRendererProps {
  page: Page;
  /** Extra classes on the theme wrapper. */
  className?: string;
}

export default function PageRenderer({ page, className }: PageRendererProps) {
  const { blocks, fixtures, theme } = page;

  // Each fixture is narrowed to a non-null, enabled value up front. Narrowing here
  // rather than testing a derived boolean at the call site matters: spreading a
  // `T | null` union makes every prop optional, which no longer satisfies the
  // components' Zod-inferred (fully-resolved, defaults-applied) props types.
  const stickyCta = fixtures?.stickyCta?.enabled ? fixtures.stickyCta : null;
  const socialProofPopup = fixtures?.socialProofPopup?.enabled
    ? fixtures.socialProofPopup
    : null;
  const trustBar = fixtures?.trustBar?.enabled ? fixtures.trustBar : null;

  const trustBarPlacement = trustBar?.placement ?? "above-footer";
  const showTrustBarBelowHero =
    trustBar !== null && (trustBarPlacement === "below-hero" || trustBarPlacement === "both");
  const showTrustBarAboveFooter =
    trustBar !== null && (trustBarPlacement === "above-footer" || trustBarPlacement === "both");

  // `below-hero` injects the bar directly after the hero block. Resolved by id, not by
  // index, so it stays correct however the marketer reorders the canvas.
  const heroBlockId = blocks.find((block) => block.type === "hero-product" && !block.hidden)?.id;

  const stickyCtaActive = stickyCta !== null;

  return (
    <div
      {...themeRootAttributes(theme, page.id)}
      className={className}
      style={{
        ...themeToCssVars(theme),
        // The sticky bar is fixed to the bottom of the viewport; without matching body
        // padding it covers the footer's last row on mobile. BLOCK-CATALOG §3.1.
        ...(stickyCtaActive
          ? { paddingBottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }
          : null),
      }}
    >
      {blocks.map((block) => (
        <div key={block.id}>
          <RenderBlock block={block} />
          {trustBar && showTrustBarBelowHero && block.id === heroBlockId ? (
            <TrustBar {...trustBar} placement="below-hero" />
          ) : null}
        </div>
      ))}

      {trustBar && showTrustBarAboveFooter ? (
        <TrustBar {...trustBar} placement="above-footer" />
      ) : null}

      {/* ── Floating fixtures — outside the document flow ─────────────────── */}
      {stickyCta ? <StickyCta {...stickyCta} /> : null}
      {socialProofPopup ? <SocialProofPopup {...socialProofPopup} /> : null}
    </div>
  );
}
