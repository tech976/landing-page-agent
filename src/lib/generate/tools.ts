/**
 * Landing Agent — the Anthropic tool definition for page generation.
 *
 * The AI never emits HTML/JSX. It emits ONE tool call whose input is a `Page` document.
 * This file is the bridge between the Zod contract (`src/lib/schema/page.ts`) and the
 * grammar-constrained sampler.
 *
 * WHY GRAMMAR CONSTRAINT MATTERS
 * With `strict: true` plus `additionalProperties: false` and explicit `required` arrays,
 * the sampler physically cannot emit a key that is not in the registry, a block `type`
 * outside the locked union, or a structural enum the renderer cannot draw. Zod's
 * `safeParse` remains the authority — but it should almost never fail, because the
 * grammar already ruled out the failure modes.
 *
 * WHY WE POST-PROCESS ZOD'S OUTPUT
 * `z.toJSONSchema` is faithful to Zod, not to Anthropic's strict-tool-use dialect. Three
 * differences must be reconciled:
 *
 *   1. Zod omits `additionalProperties`. Strict tool use requires `false` on every object.
 *   2. Zod emits `oneOf` for discriminated unions. The strict dialect supports `anyOf`.
 *      `oneOf` and `anyOf` are equivalent here — every branch is disjoint by discriminator.
 *   3. Zod emits value constraints (`minLength`, `maxItems`, `pattern`, `minimum`, …).
 *      Strict tool use rejects them. Deleting them silently would throw away the single
 *      most useful guidance in the schema ("2–4 offers", "max 70 chars"), so we FOLD each
 *      constraint into the property's `description` before deleting the keyword. The model
 *      still sees the budget; the sampler still gets a legal schema; Zod still enforces it.
 *
 * SHALLOWNESS
 * Zod's default `reused: "inline"` expands every shared sub-schema in place, so the emitted
 * document carries no `$ref` indirection. That is deliberate — a flat schema samples more
 * reliably than a `$ref` graph. The cost is size, which is paid once and prompt-cached.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { PageSchema } from "@/lib/schema/page";

/* ────────────────────────────────────────────────────────────────────────────
   JSON Schema hardening
   ──────────────────────────────────────────────────────────────────────────── */

type JsonSchemaNode = Record<string, unknown>;

/** Keywords the strict dialect rejects, mapped to how they read in prose. */
const CONSTRAINT_PROSE: Record<string, (v: unknown) => string> = {
  minLength: (v) => `min ${v} chars`,
  maxLength: (v) => `max ${v} chars`,
  pattern: (v) => `must match ${v}`,
  minimum: (v) => `min ${v}`,
  maximum: (v) => `max ${v}`,
  exclusiveMinimum: (v) => `greater than ${v}`,
  exclusiveMaximum: (v) => `less than ${v}`,
  multipleOf: (v) => `multiple of ${v}`,
  minItems: (v) => `min ${v} items`,
  maxItems: (v) => `max ${v} items`,
  minProperties: (v) => `min ${v} properties`,
  maxProperties: (v) => `max ${v} properties`,
};

/** `format` values the strict dialect understands. Anything else gets folded to prose. */
const SUPPORTED_FORMATS = new Set([
  "date-time",
  "time",
  "date",
  "duration",
  "email",
  "hostname",
  "uri",
  "ipv4",
  "ipv6",
  "uuid",
]);

const isPlainObject = (v: unknown): v is JsonSchemaNode =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Child keys whose value is itself a schema node. */
const SCHEMA_VALUED_KEYS = ["items", "not", "if", "then", "else", "additionalItems"] as const;
/** Child keys whose value is an array of schema nodes. */
const SCHEMA_ARRAY_KEYS = ["anyOf", "allOf", "oneOf", "prefixItems"] as const;
/** Child keys whose value is a map of name → schema node. */
const SCHEMA_MAP_KEYS = ["properties", "$defs", "definitions", "patternProperties"] as const;

/**
 * Rewrites a Zod-emitted JSON Schema into Anthropic's strict-tool-use dialect.
 * Pure — never mutates the input.
 */
function hardenSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(hardenSchema);
  if (!isPlainObject(node)) return node;

  const out: JsonSchemaNode = {};
  const foldedNotes: string[] = [];

  for (const [key, value] of Object.entries(node)) {
    // Drop the meta-schema declaration on nested nodes; it belongs only at the root.
    if (key === "$schema") continue;

    // Defaults are applied by Zod on parse. The model omits optional fields instead,
    // so carrying `default` into the grammar is pure token cost.
    if (key === "default") continue;

    // Value constraints: preserve the meaning, drop the keyword.
    if (key in CONSTRAINT_PROSE) {
      foldedNotes.push(CONSTRAINT_PROSE[key](value));
      continue;
    }

    // Unsupported string formats become prose; supported ones pass through.
    if (key === "format" && typeof value === "string" && !SUPPORTED_FORMATS.has(value)) {
      foldedNotes.push(`format: ${value}`);
      continue;
    }

    // Discriminated unions: `oneOf` → `anyOf`. Branches are disjoint by discriminator,
    // so the two are semantically identical for this schema.
    if (key === "oneOf") {
      out.anyOf = (value as unknown[]).map(hardenSchema);
      continue;
    }

    if ((SCHEMA_VALUED_KEYS as readonly string[]).includes(key)) {
      out[key] = hardenSchema(value);
      continue;
    }

    if ((SCHEMA_ARRAY_KEYS as readonly string[]).includes(key)) {
      out[key] = (value as unknown[]).map(hardenSchema);
      continue;
    }

    if ((SCHEMA_MAP_KEYS as readonly string[]).includes(key) && isPlainObject(value)) {
      const mapped: JsonSchemaNode = {};
      for (const [childName, childSchema] of Object.entries(value)) {
        mapped[childName] = hardenSchema(childSchema);
      }
      out[key] = mapped;
      continue;
    }

    out[key] = value;
  }

  // Re-attach folded constraints so the model still sees the budget it must write to.
  if (foldedNotes.length > 0) {
    const existing = typeof out.description === "string" ? `${out.description} ` : "";
    out.description = `${existing}(${foldedNotes.join(", ")})`;
  }

  // Every object closes its shape. This is what stops the model inventing props.
  if (out.type === "object" || isPlainObject(out.properties)) {
    out.additionalProperties = false;
    if (!isPlainObject(out.properties)) out.properties = {};
    if (!Array.isArray(out.required)) out.required = [];
  }

  return out;
}

/**
 * Attaches a `description` to a property by dotted path, e.g. "meta.title".
 * Zod carries no JSDoc into JSON Schema, so the handful of fields where the model
 * routinely needs a nudge get one explicitly. Everything else is documented in the
 * system prompt (see `prompt.ts`), which is the cheaper place to teach semantics.
 */
function describe(root: JsonSchemaNode, path: string, description: string): void {
  const segments = path.split(".");
  let cursor: JsonSchemaNode = root;

  for (const segment of segments) {
    const properties: unknown = cursor.properties;
    if (!isPlainObject(properties)) return;
    const next: unknown = properties[segment];
    if (!isPlainObject(next)) return;
    cursor = next;
  }

  if (cursor !== root) {
    const existing = typeof cursor.description === "string" ? `${cursor.description} ` : "";
    cursor.description = `${existing}${description}`.trim();
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Build
   ──────────────────────────────────────────────────────────────────────────── */

function buildPageJsonSchema(): JsonSchemaNode {
  const raw = z.toJSONSchema(PageSchema, {
    // The model writes the INPUT shape: fields carrying a Zod `.default()` are optional,
    // because `safeParse` fills them afterwards. Using "output" here would force the model
    // to restate every default and roughly double the emitted JSON for zero gain.
    io: "input",
    // A `.transform()` or `.custom()` slipping into the schema would silently degrade the
    // grammar. Fail loudly at module load instead — see the SHALLOWNESS note in page.ts.
    unrepresentable: "throw",
    cycles: "throw",
    reused: "inline",
  }) as JsonSchemaNode;

  const hardened = hardenSchema(raw) as JsonSchemaNode;

  describe(
    hardened,
    "slug",
    "Lowercase kebab-case URL segment derived from the product and offer, e.g. 'leather-tote-monsoon-sale'.",
  );
  describe(hardened, "title", "Internal working title for the dashboard. Not the SEO title.");
  describe(
    hardened,
    "meta.title",
    "SEO <title>. Lead with the product and the offer. Keep under 60 characters so it does not truncate.",
  );
  describe(
    hardened,
    "meta.description",
    "SEO meta description. One benefit-led sentence that echoes the ad promise.",
  );
  describe(
    hardened,
    "blocks",
    "The page flow, in render order. 8-13 blocks for cold paid traffic. Every block needs a unique stable id.",
  );
  describe(
    hardened,
    "fixtures",
    "Page-level singletons that float above the document flow. Not part of blocks[] and never drag-reordered.",
  );
  describe(
    hardened,
    "theme",
    "Brand theme seeded from the brief's brand colours. primary and accent are the only raw colour literals in the whole system.",
  );

  return hardened;
}

/** The `Page` JSON Schema in Anthropic strict-tool-use dialect. Built once at module load. */
export const PAGE_JSON_SCHEMA = buildPageJsonSchema();

/** The tool name. Referenced by `generate.ts` and `edit.ts` when reading the tool result. */
export const RENDER_PAGE_TOOL_NAME = "render_page";

/**
 * THE tool. Both the generation pass and the conversational edit pass force this exact
 * tool, so a generated page and an edited page are guaranteed to be the same shape —
 * which is what makes the AI -> human -> AI round-trip lossless.
 */
export const renderPageTool = {
  name: RENDER_PAGE_TOOL_NAME,
  description: [
    "Emit the complete landing page as a single validated JSON document.",
    "",
    "The page is composed ONLY from the locked block registry — you cannot invent a block",
    "type, a prop name, or a layout value. Every block instance carries a stable string id",
    "that must never be reused or renumbered.",
    "",
    "All monetary amounts are integers in PAISE, not rupees: 249900 means Rs 2,499.00.",
    "Call this tool exactly once with the finished page.",
  ].join("\n"),
  // Grammar-constrained sampling. The sampler cannot leave the schema.
  strict: true,
  input_schema: PAGE_JSON_SCHEMA as Anthropic.Tool.InputSchema,
} satisfies Anthropic.Tool;

/** The tool list passed to the Messages API. One tool, always forced. */
export const PAGE_TOOLS: Anthropic.Tool[] = [renderPageTool];

/** Forces the model to answer with a `render_page` call rather than prose. */
export const FORCE_RENDER_PAGE: Anthropic.ToolChoice = {
  type: "tool",
  name: RENDER_PAGE_TOOL_NAME,
};
