/**
 * Landing Agent — the conversational edit pass.
 *
 *   Page + instruction ──▶ LlmProvider (forced render_page) ──▶ id repair ──▶ Zod ──▶ Page
 *
 * This is the half of the round-trip that makes the whole architecture worth having:
 *
 *   AI generates ──▶ human edits in Puck ──▶ AI edits again ──▶ human edits again
 *
 * The invariant that keeps this lossless is BLOCK ID STABILITY. Puck holds ids in its own
 * state, `stickyCta.trigger.blockId` points at one, `persona.recommended.offerId` points at
 * an offer id, anchor CTAs resolve to `#blk_...`, and analytics keys off `data-cta-id`.
 * If the model renumbers ids on an edit, every one of those references silently detaches and
 * the marketer's in-progress editor session desynchronises from the saved document.
 *
 * So we defend the invariant three times:
 *   1. Instruct — the edit prompt makes id preservation the first and loudest rule.
 *   2. Verify   — diff the returned ids against the originals before trusting anything.
 *   3. Repair   — re-attach dropped ids by matching on type and position, so a model slip
 *                 degrades into a correct page rather than a broken one.
 */

import { nanoid } from "nanoid";

import { type Page, PageSchema } from "@/lib/schema/page";

import { PageGenerationError } from "./errors";
import { assignMissingIds, formatZodIssues } from "./generate";
import { buildSystemPrompt } from "./prompt";
import { getProvider, type LlmTurn } from "./provider";

/* ────────────────────────────────────────────────────────────────────────────
   Prompt
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Appended to the generation system prompt. The block vocabulary, conversion rules and copy
 * rules all still apply on an edit — an edited page must remain a page that converts — so we
 * extend rather than replace.
 */
const EDIT_SYSTEM_SUFFIX = `
═══════════════════════════════════════════════════════════════════════════════
EDIT MODE
═══════════════════════════════════════════════════════════════════════════════

You are no longer composing a page from scratch. You are editing an EXISTING page that a
human marketer may already be working on in a visual editor.

RULE 1 — PRESERVE EVERY id. THIS OVERRIDES EVERYTHING ELSE.

  Every block that still exists in your output keeps the exact id it arrived with. Character
  for character. The same applies to every nested id: offer ids, persona ids, pillar ids,
  spec group and row ids, review ids, comparison column and row ids, FAQ item ids, trust
  badge ids, variant group and option ids.

  Ids are addresses, not labels. Other parts of the document point at them:
    - fixtures.stickyCta.trigger.blockId references a block id
    - persona.recommended.offerId references an offer id inside offer-stack
    - anchor CTAs use { kind: "url", href: "#<block id>" }
  Renumbering an id silently breaks every reference to it.

  Only ever mint a new id for a genuinely NEW element. If you rewrite all the copy in a
  block, that is still the same block — keep its id. Deleting a block is fine; its id simply
  disappears with it, and you must then also remove or repoint anything referencing it.

RULE 2 — CHANGE ONLY WHAT WAS ASKED.

  Return the COMPLETE page, including every block you did not touch, byte-identical.
  Returning a partial page deletes everything you left out.

  Do not "improve" copy you were not asked to improve. The marketer may have hand-written it,
  and silently overwriting human edits is the fastest way for a team to stop trusting this
  tool. If the instruction is narrow, your diff should be narrow.

RULE 3 — KEEP THE PAGE VALID AND KEEP IT CONVERTING.

  Every rule from the sections above still holds. In particular, after your edit:
    - Price integrity: compareAtPrice still exceeds price, savings figures still compute.
    - One primary action: every primary CTA still resolves to the same destination.
    - Data integrity: you may not introduce a number that was not already on the page or
      supplied in the instruction. An edit is not a licence to invent statistics.
    - Block count stays within 8-13, and required order rules still hold (announcement-bar
      at index 0, hero-product first non-announcement, collection-grid never above
      offer-stack).

  If the instruction would break one of these, satisfy the instruction's INTENT in a way that
  does not, and record what you did in the affected block's notes field.

Call render_page once with the complete, updated page.
`.trim();

function buildEditSystemPrompt(): string {
  return `${buildSystemPrompt()}\n\n${EDIT_SYSTEM_SUFFIX}`;
}

/** Summarises the target block so the model can locate it without scanning the JSON. */
function describeTarget(page: Page, targetBlockId: string): string {
  const block = page.blocks.find((candidate) => candidate.id === targetBlockId);

  if (!block) {
    return [
      `The instruction names block id "${targetBlockId}", but no block on this page has that id.`,
      "Apply the instruction to whichever block it most plausibly refers to, and explain the",
      "assumption in that block's notes field. Do not create a block just to satisfy the id.",
    ].join("\n");
  }

  return [
    `TARGET BLOCK: id "${block.id}", type "${block.type}" (index ${page.blocks.indexOf(block)}).`,
    "",
    "Confine your edit to this block. Every other block must come back byte-identical,",
    "including its id. Touch another block only if leaving it unchanged would break a",
    "cross-reference or a conversion rule — and say so in that block's notes.",
  ].join("\n");
}

function buildEditUserMessage(page: Page, instruction: string, targetBlockId?: string): string {
  const idInventory = page.blocks
    .map((block, index) => `  ${String(index).padStart(2, " ")}  ${block.id}  (${block.type})`)
    .join("\n");

  return `
Apply this edit to the page below.

═══════════════════════════════════════════════════════════════════════════════
INSTRUCTION
═══════════════════════════════════════════════════════════════════════════════

${instruction}

${targetBlockId ? `═══════════════════════════════════════════════════════════════════════════════\nSCOPE\n═══════════════════════════════════════════════════════════════════════════════\n\n${describeTarget(page, targetBlockId)}\n` : ""}
═══════════════════════════════════════════════════════════════════════════════
BLOCK IDs THAT MUST SURVIVE
═══════════════════════════════════════════════════════════════════════════════

Every id below must appear in your output unless the instruction explicitly asks you to
delete that block. These are exact strings — copy them, do not retype them.

${idInventory}

═══════════════════════════════════════════════════════════════════════════════
CURRENT PAGE
═══════════════════════════════════════════════════════════════════════════════

\`\`\`json
${JSON.stringify(page, null, 2)}
\`\`\`

═══════════════════════════════════════════════════════════════════════════════

Return the COMPLETE updated page via render_page. Not a diff, not the changed blocks — the
whole document, with every untouched block reproduced exactly as it appears above.
`.trim();
}

/* ────────────────────────────────────────────────────────────────────────────
   Id repair
   ──────────────────────────────────────────────────────────────────────────── */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

interface IdRepairReport {
  /** Original ids the model returned unchanged. */
  preserved: string[];
  /** Original ids re-attached by type+position matching because the model dropped them. */
  repaired: Array<{ id: string; type: string; position: number }>;
  /** Original ids absent from the output and not recoverable — treated as deletions. */
  dropped: string[];
}

/**
 * Re-attaches original block ids that the model failed to carry through.
 *
 * Strategy, in order:
 *   1. An edited block whose id matches an unclaimed original id keeps it. (The normal case.)
 *   2. An edited block with a missing, unknown, or duplicate id adopts the id of the nearest
 *      unclaimed original block OF THE SAME TYPE. Type is the guard: matching on position
 *      alone would happily rename a review-wall into a hero's id after an insertion.
 *   3. Anything still id-less is genuinely new and gets a fresh nanoid.
 *
 * Mutates `editedBlocks` in place.
 */
export function repairBlockIds(
  original: Page["blocks"],
  editedBlocks: unknown[],
): IdRepairReport {
  const originals = original.map((block, position) => ({
    id: block.id,
    type: block.type as string,
    position,
  }));
  const originalIds = new Set(originals.map((entry) => entry.id));

  /** Edited-array index -> the id that block definitively owns once we are done. */
  const resolved = new Map<number, string>();
  /** Every id now spoken for, whether inherited or newly minted. */
  const usedIds = new Set<string>();
  const report: IdRepairReport = { preserved: [], repaired: [], dropped: [] };

  const readId = (block: unknown): string | null => {
    if (!isPlainObject(block)) return null;
    const id = block.id;
    return typeof id === "string" && id.trim().length > 0 ? id : null;
  };

  // Pass 1 — honour ids that came back intact. First claim on an id wins; if the model
  // emitted the same id twice, only one block keeps it and the other falls through.
  editedBlocks.forEach((block, index) => {
    const id = readId(block);
    if (!id || !originalIds.has(id) || usedIds.has(id)) return;
    resolved.set(index, id);
    usedIds.add(id);
    report.preserved.push(id);
  });

  // Pass 2 — re-attach dropped ids. Type is the guard and position is the tiebreaker:
  // matching on position alone would happily hand a review-wall the hero's id after an
  // insertion shifted everything down by one.
  editedBlocks.forEach((block, index) => {
    if (!isPlainObject(block) || resolved.has(index)) return;

    const type = typeof block.type === "string" ? block.type : null;
    if (!type) return;

    const match = originals
      .filter((candidate) => candidate.type === type && !usedIds.has(candidate.id))
      .sort((a, b) => Math.abs(a.position - index) - Math.abs(b.position - index))[0];
    if (!match) return;

    block.id = match.id;
    resolved.set(index, match.id);
    usedIds.add(match.id);
    report.repaired.push({ id: match.id, type, position: index });
  });

  // Pass 3 — whatever is left is a genuinely new block. Keep the model's own id when it is
  // free and not an original's, otherwise mint one.
  editedBlocks.forEach((block, index) => {
    if (!isPlainObject(block) || resolved.has(index)) return;

    const existing = readId(block);
    if (existing && !originalIds.has(existing) && !usedIds.has(existing)) {
      resolved.set(index, existing);
      usedIds.add(existing);
      return;
    }

    const type = typeof block.type === "string" ? block.type.replace(/[^a-z0-9]+/gi, "_") : "block";
    let minted = `blk_${type}_${nanoid(6)}`;
    while (usedIds.has(minted)) minted = `blk_${type}_${nanoid(6)}`;

    block.id = minted;
    resolved.set(index, minted);
    usedIds.add(minted);
  });

  report.dropped = originals
    .filter((candidate) => !usedIds.has(candidate.id))
    .map((candidate) => candidate.id);

  return report;
}

/* ────────────────────────────────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────────────────────────────────── */

export interface EditPageOptions {
  /**
   * When false, an edit that drops block ids the instruction never mentioned still returns
   * (after repair) rather than throwing. Default true — repair is best-effort, and silently
   * accepting a page that lost half its ids is worse than surfacing it.
   */
  failOnMassIdLoss?: boolean;
}

/**
 * Applies a natural-language edit to an existing page.
 *
 * @param page          The current, already-validated page.
 * @param instruction   What the marketer asked for, in their own words.
 * @param targetBlockId Optional. Scopes the edit to one block — pass this whenever the
 *                      request came from a block-level control in the editor.
 *
 * @throws {PageGenerationError} on a missing key, an API failure, a truncated tool call, or
 *         an edited page that fails schema validation.
 */
export async function editPage(
  page: Page,
  instruction: string,
  targetBlockId?: string,
  options: EditPageOptions = {},
): Promise<Page> {
  const { failOnMassIdLoss = true } = options;
  const provider = getProvider();

  const turns: LlmTurn[] = [
    { role: "user", text: buildEditUserMessage(page, instruction, targetBlockId) },
  ];

  // The provider raises the "did not call render_page" and "API request failed" errors, so an
  // edit and a generation report an upstream failure identically.
  const result = await provider.callPageTool(buildEditSystemPrompt(), turns, { pass: "edit" });

  const edited = result.input;
  if (!isPlainObject(edited)) {
    throw new PageGenerationError(
      "The edit pass returned a tool input that was not an object.",
      "validation-failed",
    );
  }

  /* ── Verify and repair id stability, BEFORE validation ─────────────────── */

  let report: IdRepairReport = { preserved: [], repaired: [], dropped: [] };

  if (Array.isArray(edited.blocks)) {
    report = repairBlockIds(page.blocks, edited.blocks);
  }

  // Nested ids (offers, personas, FAQ items, …). Repair here is deliberately weaker than for
  // blocks — a fresh id on a nested element is recoverable, so we only guarantee presence.
  assignMissingIds(edited);

  // Server-owned envelope. The page keeps its identity and creation time across every edit;
  // only updatedAt moves.
  edited.id = page.id;
  edited.createdAt = page.createdAt;
  edited.updatedAt = new Date().toISOString();

  /* ── Validate ──────────────────────────────────────────────────────────── */

  const parsed = PageSchema.safeParse(edited);
  if (!parsed.success) {
    const issues = formatZodIssues(parsed.error);
    throw new PageGenerationError(
      `The edited page failed schema validation (${issues.length} issue(s)). The original page is unchanged.`,
      "validation-failed",
      { issues },
    );
  }

  /* ── Report ────────────────────────────────────────────────────────────── */

  if (report.repaired.length > 0) {
    console.warn(
      `[editPage] Re-attached ${report.repaired.length} block id(s) the model dropped: ` +
        report.repaired.map((entry) => `${entry.id} (${entry.type})`).join(", "),
    );
  }

  if (report.dropped.length > 0) {
    const message =
      `[editPage] ${report.dropped.length} of ${page.blocks.length} block id(s) did not survive ` +
      `the edit and could not be recovered: ${report.dropped.join(", ")}.`;

    // One or two dropped ids is a deletion the instruction probably asked for. Losing most of
    // them is the model having regenerated the page instead of editing it — that is data loss,
    // not an edit, and the caller should see it rather than have it written to disk.
    const lostMost = report.dropped.length > page.blocks.length / 2;

    if (lostMost && failOnMassIdLoss) {
      throw new PageGenerationError(
        `${message} This looks like a regeneration rather than an edit, so it was rejected and ` +
          `the original page is unchanged. Retry with a narrower instruction or a targetBlockId.`,
        "validation-failed",
        { issues: report.dropped.map((id) => `blocks: lost id "${id}"`) },
      );
    }

    console.warn(message);
  }

  return parsed.data;
}
