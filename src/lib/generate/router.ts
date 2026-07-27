/**
 * Landing Agent — edit model router.
 *
 * An AI edit's cost is dominated by the model tier, and edit complexity varies enormously:
 * "change the product name" and "restructure the page to lead with reviews and make the tone
 * more premium" are not the same job. This routes each edit to the cheapest model that can do
 * it well:
 *
 *   simple   → Haiku   (rename, price change, fix a typo, swap a CTA label)   ~5x cheaper than Opus
 *   moderate → Sonnet  (rewrite a block's copy, add one element, change the offer)
 *   complex  → Opus    (restructure, reorder, whole-page tone, multi-part asks, "make it convert")
 *
 * Classification is a free, deterministic HEURISTIC — no LLM call, so the routing itself costs
 * nothing. It is deliberately CONSERVATIVE: only clearly-trivial edits go to Haiku; anything
 * ambiguous defaults to Sonnet (still far cheaper than Opus, and highly capable). Quality is
 * further protected by escalation — if a cheaper model's edit fails validation, editPage retries
 * with the next tier up (see the ladder), so a mis-route degrades cost, never correctness.
 *
 * Routing applies to the Anthropic provider only; Groq has a single model. Turn it off with
 * EDIT_MODEL_ROUTING=off (then every edit uses ANTHROPIC_MODEL). Override the tiers with
 * EDIT_MODEL_SIMPLE / EDIT_MODEL_MODERATE / EDIT_MODEL_COMPLEX.
 */

export type EditComplexity = "simple" | "moderate" | "complex";

const DEFAULT_TIER: Record<EditComplexity, string> = {
  simple: "claude-haiku-4-5",
  moderate: "claude-sonnet-5",
  complex: "claude-opus-4-8",
};

function tierModel(complexity: EditComplexity): string {
  const env =
    complexity === "simple"
      ? process.env.EDIT_MODEL_SIMPLE
      : complexity === "moderate"
        ? process.env.EDIT_MODEL_MODERATE
        : process.env.EDIT_MODEL_COMPLEX;
  return env?.trim() || DEFAULT_TIER[complexity];
}

/* ────────────────────────────────────────────────────────────────────────────
   Signals
   ──────────────────────────────────────────────────────────────────────────── */

// Any of these forces "complex": structural work, whole-page scope, or subjective/holistic
// quality goals that need the strongest model to judge.
const COMPLEX = [
  /\b(restructure|reorder|re-?order|redesign|re-?design|rebuild|revamp|overhaul|rework|reorgano?i[sz]e)\b/,
  /\b(add|insert|create|build)\b.{0,24}\b(section|block|page|flow|funnel)\b/,
  /\b(remove|delete|drop)\b.{0,24}\b(section|block)\b/,
  // Holistic quality goals — "trustworthy" (the feeling), NOT "trust badge" (a specific element).
  /\b(tone|voice|vibe|feel|mood|aesthetic|personality|premium|luxur|high-?end|upmarket|trustworth\w*|credibilit\w*|persuasi\w*|storytell\w*|narrative)\b/,
  /\b(convert|conversion|cro|optimi[sz]e|optimize for)\b/,
  /\b(whole|entire|complete|full)\b.{0,12}\b(page|thing|site|layout)\b/,
  /\b(everything|all the (blocks|sections|copy)|throughout|across the (page|whole))\b/,
  /\b(rewrite|redo|regenerate|start over|from scratch)\b.{0,16}\b(page|everything|whole|all)\b/,
];

// Localized, single-value change verbs.
const SIMPLE_VERB =
  /\b(change|changed|rename|renamed|replace|replaced|update|updated|set|edit|fix|fixed|correct|swap|capitali[sz]e|shorten|lengthen|bold|tweak|adjust)\b/;

// Small, specific targets a simple verb usually acts on.
const SIMPLE_TARGET =
  /\b(name|title|headline|heading|price|mrp|cta|button|button text|label|phone|number|whatsapp|colou?r|discount code|code|date|word|spelling|typo|tagline|subtitle|eyebrow|link|url|rating|count|percentage|percent|%|₹)\b/;

/* ────────────────────────────────────────────────────────────────────────────
   Classifier
   ──────────────────────────────────────────────────────────────────────────── */

/** Counts distinct "do X" actions — multi-action instructions are harder and score up. */
function actionCount(text: string): number {
  const segments = text.split(/\b(?:and|then|also|plus)\b|[;,]/i).map((s) => s.trim());
  const verby =
    /\b(change|rename|replace|update|set|edit|fix|correct|swap|add|insert|remove|delete|rewrite|make|move|reorder|shorten|lengthen|improve|turn|convert|highlight|emphasi[sz]e)\b/;
  return segments.filter((s) => s.length > 2 && verby.test(s)).length;
}

export interface EditClassification {
  complexity: EditComplexity;
  /** Short human-readable why, for logs and the cost display. */
  reason: string;
}

export function classifyEditComplexity(instruction: string): EditClassification {
  const text = instruction.trim().toLowerCase();
  const words = text.split(/\s+/).filter(Boolean).length;

  if (text === "") return { complexity: "moderate", reason: "empty instruction — safe default" };

  // 1. Any structural / holistic / subjective-quality signal → complex.
  for (const re of COMPLEX) {
    if (re.test(text)) return { complexity: "complex", reason: "structural or whole-page change" };
  }

  // 2. Several distinct actions in one instruction → complex.
  const actions = actionCount(text);
  if (actions >= 3) return { complexity: "complex", reason: `${actions} separate changes at once` };

  // 3. Long instructions carry more nuance → at least moderate, likely complex.
  if (words > 34) return { complexity: "complex", reason: "long, detailed instruction" };
  if (words > 22) return { complexity: "moderate", reason: "detailed instruction" };

  // 4. A short, single-action edit with a simple verb on a small target → simple.
  const isSingleAction = actions <= 1;
  const looksSimple = SIMPLE_VERB.test(text) && (SIMPLE_TARGET.test(text) || words <= 7);
  if (isSingleAction && looksSimple && words <= 16) {
    return { complexity: "simple", reason: "single small text change" };
  }

  // 5. Everything else — one clear change, but not obviously trivial → moderate (Sonnet).
  return { complexity: "moderate", reason: "single content change" };
}

/* ────────────────────────────────────────────────────────────────────────────
   Escalation ladder
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The models to try in order, cheapest-first from the classified tier up to Opus. If the
 * cheaper model's edit fails validation, editPage retries with the next entry — so a mis-route
 * costs a little, never the result. Deduped, so "complex" is a single Opus attempt.
 */
export function editModelLadder(complexity: EditComplexity): string[] {
  const order: EditComplexity[] = ["simple", "moderate", "complex"];
  const from = order.indexOf(complexity);
  const ladder = order.slice(from).map(tierModel);
  return [...new Set(ladder)];
}

/** True unless EDIT_MODEL_ROUTING is explicitly "off". */
export function isEditRoutingEnabled(): boolean {
  return (process.env.EDIT_MODEL_ROUTING ?? "on").trim().toLowerCase() !== "off";
}
