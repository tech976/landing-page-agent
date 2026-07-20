/**
 * Landing Agent — the generation pass.
 *
 *   Brief ──▶ LlmProvider (forced render_page tool) ──▶ id assignment ──▶ Zod ──▶ Page
 *                          ▲                                            │
 *                          └────── one retry with the Zod errors ◀──────┘
 *
 * Two layers of defence, in this order:
 *
 *   1. GRAMMAR. On the Anthropic path `renderPageTool` is declared `strict: true`, so the
 *      sampler is constrained to the JSON Schema. It physically cannot emit an unknown block
 *      type or an illegal enum value. This eliminates most structural failure before it
 *      happens. On the Groq path this layer does NOT exist — the OpenAI-compatible endpoint
 *      treats the schema as advice, so layer 2 does all the work. See `provider.ts`.
 *   2. ZOD. `PageSchema.safeParse` is still the authority. It catches what a JSON Schema
 *      cannot express — the length and range constraints we deliberately folded into
 *      descriptions in `tools.ts`, plus defaults, plus type narrowing.
 *
 * When layer 2 rejects, we retry ONCE with the actual Zod issue paths fed back as a user
 * message. Feeding the specific failures back is far more effective than resampling: the
 * model patches the named field instead of regenerating and reintroducing the same mistake.
 */

import { nanoid } from "nanoid";
import type { z } from "zod";

import type { Brief } from "@/lib/schema/brief";
import { type Page, PageSchema } from "@/lib/schema/page";

import { PageGenerationError } from "./errors";
import { buildRepairMessage, buildSystemPrompt, buildUserMessage } from "./prompt";
import { getProvider, type LlmTurn } from "./provider";

/* ────────────────────────────────────────────────────────────────────────────
   Re-exports — the error type and the client have always been imported from this
   module. They now live in `errors.ts` and `provider.ts`; these keep every existing
   import path working.
   ──────────────────────────────────────────────────────────────────────────── */

export { PageGenerationError } from "./errors";
export type { GenerationStage } from "./errors";
export {
  DEFAULT_ANTHROPIC_MODEL as GENERATION_MODEL,
  getAnthropicClient,
} from "./provider";

/* ────────────────────────────────────────────────────────────────────────────
   Id assignment
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Array-valued props whose elements carry a stable `IdSchema` id.
 * Anything not listed here is either a scalar array (`bullets`, `keywords`, `defaultOpen`)
 * or an object array with no id, and is left untouched.
 */
const ID_BEARING_ARRAYS: Record<string, string> = {
  blocks: "blk",
  variants: "var",
  options: "opt",
  offers: "off",
  items: "item",
  personas: "per",
  pillars: "pil",
  groups: "grp",
  rows: "row",
  columns: "col",
  reviews: "rev",
  badges: "tb",
  events: "ev",
  /** `PopupSource.fallback` — an array of PopupEvent when the mode is api/shopify-backed. */
  fallback: "ev",
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasUsableId = (value: Record<string, unknown>): boolean =>
  typeof value.id === "string" && value.id.trim().length > 0;

/** Slugifies a block `type` so generated ids stay readable: "hero-product" -> "hero_product". */
function slugSegment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug.length > 0 ? slug.slice(0, 24) : null;
}

function makeId(prefix: string, node: Record<string, unknown>): string {
  const typeSegment = slugSegment(node.type);
  return typeSegment ? `${prefix}_${typeSegment}_${nanoid(6)}` : `${prefix}_${nanoid(8)}`;
}

/**
 * Walks the page and assigns a nanoid to every id-bearing object that lacks one.
 *
 * Runs BEFORE `safeParse`, because `IdSchema` requires a non-empty string — an id-less block
 * would otherwise fail validation and burn the single retry on something we can simply fix.
 *
 * Existing ids are never touched. That is the whole point: the human/AI round-trip is lossless
 * only because ids survive every pass.
 *
 * Mutates in place; call on a value you own.
 */
export function assignMissingIds(node: unknown, parentKey?: string): void {
  if (Array.isArray(node)) {
    const prefix = parentKey ? ID_BEARING_ARRAYS[parentKey] : undefined;
    for (const element of node) {
      if (prefix && isPlainObject(element) && !hasUsableId(element)) {
        element.id = makeId(prefix, element);
      }
      assignMissingIds(element, parentKey);
    }
    return;
  }

  if (!isPlainObject(node)) return;

  for (const [key, value] of Object.entries(node)) {
    assignMissingIds(value, key);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Normalisation
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Fills the server-owned envelope fields.
 *
 * `id`, `createdAt` and `updatedAt` are required by `PageSchema` but are not the model's
 * business — it has no clock and no id namespace. We overwrite rather than trust, so a
 * hallucinated timestamp can never reach disk.
 */
function normalizePage(raw: unknown, now: string): unknown {
  if (!isPlainObject(raw)) return raw;

  assignMissingIds(raw);

  if (!hasUsableId(raw)) raw.id = `page_${nanoid(10)}`;
  raw.createdAt = now;
  raw.updatedAt = now;
  if (typeof raw.status !== "string") raw.status = "draft";

  return raw;
}

/* ────────────────────────────────────────────────────────────────────────────
   Response handling
   ──────────────────────────────────────────────────────────────────────────── */

/** Renders Zod issues as `path: message` lines the model can act on directly. */
export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Generates a validated `Page` from a `Brief`.
 *
 * Retries exactly once on schema failure, feeding the Zod issues back. A second failure
 * throws rather than looping — a page that fails twice with explicit error paths is failing
 * for a reason more retries will not fix, and an unbounded loop against a forced 32k-token
 * tool call is an expensive way to discover that.
 *
 * @throws {PageGenerationError} on a missing key, an API failure, a truncated tool call, or
 *         a page that fails validation twice. `error.issues` carries the Zod paths.
 */
export async function generatePage(brief: Brief): Promise<Page> {
  const provider = getProvider();
  const system = buildSystemPrompt();

  const turns: LlmTurn[] = [{ role: "user", text: buildUserMessage(brief) }];

  const first = await provider.callPageTool(system, turns, { pass: "generate" });
  const now = new Date().toISOString();

  const firstAttempt = PageSchema.safeParse(normalizePage(first.input, now));
  if (firstAttempt.success) return firstAttempt.data;

  // Retry once. The model sees its own tool call and the exact reasons it was rejected.
  const issues = formatZodIssues(firstAttempt.error);

  turns.push(
    { role: "assistant-tool-call", toolCallId: first.toolCallId, rawInput: first.input },
    { role: "tool-error", toolCallId: first.toolCallId, text: buildRepairMessage(issues) },
  );

  const second = await provider.callPageTool(system, turns, { pass: "generate" });

  const secondAttempt = PageSchema.safeParse(normalizePage(second.input, now));
  if (secondAttempt.success) return secondAttempt.data;

  const finalIssues = formatZodIssues(secondAttempt.error);
  throw new PageGenerationError(
    `Page failed schema validation twice (${finalIssues.length} issue(s) remaining). ` +
      `First attempt: ${issues.length} issue(s).`,
    "validation-failed",
    { issues: finalIssues },
  );
}
