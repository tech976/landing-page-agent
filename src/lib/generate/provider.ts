/**
 * Landing Agent — the LLM provider abstraction.
 *
 * Both passes (generate, edit) need exactly one thing from a model: force it to call
 * `render_page` once and hand back the raw tool input. Everything downstream — id assignment,
 * normalisation, Zod validation, id repair — is provider-agnostic and stays that way.
 *
 *   generate.ts ─┐
 *                ├─▶ LlmProvider.callPageTool(system, turns) ─▶ { toolCallId, input }
 *   edit.ts    ──┘
 *
 * TWO IMPLEMENTATIONS, DELIBERATELY NOT EQUIVALENT
 *
 *   ANTHROPIC is the production path. `renderPageTool` is declared `strict: true`, so the
 *   sampler is grammar-constrained: it physically cannot emit an unknown block type, an
 *   illegal enum, or malformed JSON. The system prompt carries an ephemeral cache breakpoint
 *   that covers the ~29k-token page schema, which is what makes the retry turn cheap.
 *
 *   GROQ is a test path. It is OpenAI-compatible function calling: the schema is advisory,
 *   not a grammar. The model can and does emit truncated or malformed `arguments` strings,
 *   unknown enum values, and missing required fields. Zod remains the authority for both
 *   providers, so a bad Groq page is REJECTED rather than rendered — but expect it to fail
 *   validation far more often, and expect the single retry to matter far more.
 *
 * See the header of `getProvider` for the env contract.
 */

import Anthropic from "@anthropic-ai/sdk";

import { PageGenerationError } from "./errors";
import {
  FORCE_RENDER_PAGE,
  PAGE_JSON_SCHEMA,
  PAGE_TOOLS,
  RENDER_PAGE_TOOL_NAME,
  renderPageTool,
} from "./tools";

/* ────────────────────────────────────────────────────────────────────────────
   The provider-neutral wire format
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * One turn of the conversation, in the only three shapes this application ever produces.
 *
 * There is no plain `assistant` text turn on purpose: `tool_choice` forces the tool, so the
 * assistant only ever speaks by calling `render_page`.
 */
export type LlmTurn =
  | { role: "user"; text: string }
  | { role: "assistant-tool-call"; toolCallId: string; rawInput: unknown }
  | { role: "tool-error"; toolCallId: string; text: string };

/** The forced `render_page` call, unwrapped. `input` is raw and NOT yet validated. */
export interface PageToolResult {
  toolCallId: string;
  input: unknown;
}

/**
 * Which pass is running. Used only to keep error copy accurate — the generation pass and the
 * edit pass have always worded their "no tool call" failure differently, and that wording is
 * what a marketer sees in the UI.
 */
export interface CallContext {
  pass?: "generate" | "edit";
}

export interface LlmProvider {
  readonly name: "anthropic" | "groq";
  readonly model: string;
  callPageTool(system: string, turns: LlmTurn[], context?: CallContext): Promise<PageToolResult>;
}

/* ────────────────────────────────────────────────────────────────────────────
   Configuration
   ──────────────────────────────────────────────────────────────────────────── */

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/**
 * A full 12-block page runs 12-20k output tokens. 32k leaves headroom so a rich page is
 * never truncated mid-JSON — a truncated tool call is unrecoverable, not merely invalid.
 * Above ~16k the SDK needs streaming to avoid an HTTP timeout, hence `.stream()` below.
 */
const MAX_TOKENS = 32_000;

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Groq's per-model completion caps vary. Override when a model rejects 32k. */
function groqMaxTokens(): number {
  const raw = process.env.GROQ_MAX_TOKENS;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : MAX_TOKENS;
}

/** Reads LLM_PROVIDER, defaulting to Anthropic. Never throws. */
function resolveProviderName(): "anthropic" | "groq" {
  const raw = (process.env.LLM_PROVIDER ?? "anthropic").trim().toLowerCase();
  if (raw === "" || raw === "anthropic") return "anthropic";
  if (raw === "groq") return "groq";

  throw new PageGenerationError(
    `LLM_PROVIDER is set to "${process.env.LLM_PROVIDER}", which is not a known provider. ` +
      `Set LLM_PROVIDER to "anthropic" or "groq" in .env.local.`,
    "missing-api-key",
  );
}

/**
 * Non-throwing description of the active provider, for error surfaces that need to name the
 * right env var without triggering the missing-key error they are trying to explain.
 */
export function describeProvider(): {
  provider: "anthropic" | "groq";
  model: string;
  apiKeyEnvVar: "ANTHROPIC_API_KEY" | "GROQ_API_KEY";
} {
  const raw = (process.env.LLM_PROVIDER ?? "anthropic").trim().toLowerCase();
  return raw === "groq"
    ? {
        provider: "groq",
        model: process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
        apiKeyEnvVar: "GROQ_API_KEY",
      }
    : {
        provider: "anthropic",
        model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
        apiKeyEnvVar: "ANTHROPIC_API_KEY",
      };
}

/* ────────────────────────────────────────────────────────────────────────────
   Anthropic — the production path
   ──────────────────────────────────────────────────────────────────────────── */

let cachedAnthropicClient: Anthropic | null = null;

/** Lazily constructed so that importing this module never throws in a keyless dev environment. */
export function getAnthropicClient(): Anthropic {
  if (cachedAnthropicClient) return cachedAnthropicClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new PageGenerationError(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key, " +
        "or use the mock page from src/lib/generate/mock.ts to develop the UI without an API key.",
      "missing-api-key",
    );
  }

  cachedAnthropicClient = new Anthropic({ apiKey });
  return cachedAnthropicClient;
}

/** `LlmTurn[]` -> Anthropic message params. A tool-error turn becomes an `is_error` result. */
function toAnthropicMessages(turns: LlmTurn[]): Anthropic.MessageParam[] {
  return turns.map((turn): Anthropic.MessageParam => {
    switch (turn.role) {
      case "user":
        return { role: "user", content: turn.text };
      case "assistant-tool-call":
        return {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: turn.toolCallId,
              name: RENDER_PAGE_TOOL_NAME,
              input: turn.rawInput,
            },
          ],
        };
      case "tool-error":
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: turn.toolCallId,
              content: turn.text,
              is_error: true,
            },
          ],
        };
    }
  });
}

class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  readonly model: string;

  constructor(model: string) {
    this.model = model;
  }

  /**
   * One turn against the Messages API.
   *
   * The system prompt carries a cache breakpoint. Tools render before system, so the
   * breakpoint covers the ~29k-token page schema as well as the prompt — which is what makes
   * the retry turn, and every subsequent generation, cheap.
   */
  async callPageTool(
    system: string,
    turns: LlmTurn[],
    context: CallContext = {},
  ): Promise<PageToolResult> {
    const client = getAnthropicClient();

    let message: Anthropic.Message;
    try {
      const stream = client.messages.stream({
        model: this.model,
        max_tokens: MAX_TOKENS,
        // Thinking is left off: `tool_choice` already forces the single tool, so there is no
        // decision for the model to reason about, and the whole output budget goes to the page.
        output_config: { effort: "high" },
        system: [
          {
            type: "text",
            text: system,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: PAGE_TOOLS,
        tool_choice: FORCE_RENDER_PAGE,
        messages: toAnthropicMessages(turns),
      });

      message = await stream.finalMessage();
    } catch (error) {
      if (error instanceof PageGenerationError) throw error;

      const detail =
        error instanceof Anthropic.APIError ? `${error.status}: ${error.message}` : String(error);
      throw new PageGenerationError(`Anthropic API request failed — ${detail}`, "api-error", {
        cause: error,
      });
    }

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === RENDER_PAGE_TOOL_NAME,
    );

    // `tool_choice` forces the tool, so absence means something went genuinely wrong —
    // most often `stop_reason: "max_tokens"` truncating the tool input mid-object.
    if (!toolUse) {
      throw noToolCall(message.stop_reason, context.pass);
    }

    return { toolCallId: toolUse.id, input: toolUse.input };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Groq — the OpenAI-compatible test path
   ──────────────────────────────────────────────────────────────────────────── */

interface OpenAiToolCall {
  id?: unknown;
  type?: unknown;
  function?: { name?: unknown; arguments?: unknown };
}

interface OpenAiChoice {
  finish_reason?: unknown;
  message?: { content?: unknown; tool_calls?: unknown };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `LlmTurn[]` -> OpenAI chat messages, prefixed with the system prompt. */
function toOpenAiMessages(system: string, turns: LlmTurn[]): unknown[] {
  const messages: unknown[] = [{ role: "system", content: system }];

  for (const turn of turns) {
    switch (turn.role) {
      case "user":
        messages.push({ role: "user", content: turn.text });
        break;
      case "assistant-tool-call":
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: turn.toolCallId,
              type: "function",
              function: {
                name: RENDER_PAGE_TOOL_NAME,
                // OpenAI-shaped tool calls carry arguments as a JSON *string*, not an object.
                arguments: safeStringify(turn.rawInput),
              },
            },
          ],
        });
        break;
      case "tool-error":
        messages.push({
          role: "tool",
          tool_call_id: turn.toolCallId,
          content: turn.text,
        });
        break;
    }
  }

  return messages;
}

/**
 * A page we already sampled is being echoed back on the retry turn. It came from JSON, so it
 * serialises — but a cyclic or otherwise hostile value must not crash the retry.
 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "{}";
  } catch {
    return "{}";
  }
}

class GroqProvider implements LlmProvider {
  readonly name = "groq" as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(model: string, apiKey: string) {
    this.model = model;
    this.apiKey = apiKey;
  }

  async callPageTool(
    system: string,
    turns: LlmTurn[],
    context: CallContext = {},
  ): Promise<PageToolResult> {
    const body = {
      model: this.model,
      // Deterministic: this is a structured-extraction task, not a creative sampling one.
      // Copy quality comes from the prompt, not from temperature.
      temperature: 0,
      max_tokens: groqMaxTokens(),
      messages: toOpenAiMessages(system, turns),
      tools: [
        {
          type: "function",
          function: {
            name: RENDER_PAGE_TOOL_NAME,
            description: renderPageTool.description,
            parameters: PAGE_JSON_SCHEMA,
          },
        },
      ],
      // Groq honours a named function the same way Anthropic honours `tool_choice`, but it is
      // a strong instruction rather than a grammar constraint. See the module header.
      tool_choice: { type: "function", function: { name: RENDER_PAGE_TOOL_NAME } },
    };

    let response: Response;
    try {
      response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new PageGenerationError(`Groq API request failed — ${String(error)}`, "api-error", {
        cause: error,
      });
    }

    if (!response.ok) {
      // Groq reports schema rejections, model-not-found and token-cap violations in the body,
      // and the body is the only place the actionable detail lives.
      const detail = await response.text().catch(() => "(response body unreadable)");
      throw new PageGenerationError(
        `Groq API request failed — ${response.status} ${response.statusText}: ${truncate(detail, 2000)}`,
        "api-error",
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new PageGenerationError(
        "Groq returned a response body that was not valid JSON.",
        "api-error",
        { cause: error },
      );
    }

    const choice = (isRecord(payload) && Array.isArray(payload.choices)
      ? payload.choices[0]
      : undefined) as OpenAiChoice | undefined;

    const toolCalls = choice?.message?.tool_calls;
    const toolCall = (Array.isArray(toolCalls) ? toolCalls[0] : undefined) as
      | OpenAiToolCall
      | undefined;

    if (!toolCall) {
      // Map OpenAI's `finish_reason` onto the stop-reason vocabulary the shared error copy
      // speaks, so a truncated Groq call reads the same as a truncated Anthropic one.
      const finish = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
      throw noToolCall(finish === "length" ? "max_tokens" : finish, context.pass);
    }

    const rawArguments = toolCall.function?.arguments;
    if (typeof rawArguments !== "string") {
      throw new PageGenerationError(
        `Groq returned a ${RENDER_PAGE_TOOL_NAME} call whose arguments were ` +
          `${rawArguments === undefined ? "missing" : `a ${typeof rawArguments}`} rather than a JSON string.`,
        "no-tool-call",
      );
    }

    // THE Groq-specific failure mode. Anthropic's grammar makes malformed tool JSON
    // impossible; an OpenAI-compatible open model emits it regularly, usually by running out
    // of output tokens mid-object. Surface it as a typed error, never a raw SyntaxError.
    let input: unknown;
    try {
      input = JSON.parse(rawArguments);
    } catch (error) {
      const finish = typeof choice?.finish_reason === "string" ? choice.finish_reason : "unknown";
      const truncated = finish === "length";
      const reason = truncated
        ? `The response hit the ${groqMaxTokens()}-token output cap and the JSON was cut off mid-object. ` +
          "Reduce the block count, or raise GROQ_MAX_TOKENS if the model allows it."
        : `finish_reason was "${finish}". Open models on the OpenAI-compatible endpoint are not ` +
          "grammar-constrained, so malformed tool JSON is a known failure mode — retry, or " +
          "switch to LLM_PROVIDER=anthropic for a guaranteed-parseable tool call.";

      throw new PageGenerationError(
        `Groq returned ${rawArguments.length} characters of ${RENDER_PAGE_TOOL_NAME} arguments ` +
          `that are not valid JSON. ${reason} Parser said: ${
            error instanceof Error ? error.message : String(error)
          }`,
        "no-tool-call",
        { cause: error },
      );
    }

    const id = typeof toolCall.id === "string" && toolCall.id.length > 0 ? toolCall.id : "call_0";
    return { toolCallId: id, input };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Shared helpers
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The "model refused to call the tool" error, worded exactly as each pass has always worded
 * it. `tool_choice` forces the call for both providers, so reaching here means truncation or
 * an upstream refusal.
 */
function noToolCall(stopReason: string | null, pass: CallContext["pass"]): PageGenerationError {
  if (pass === "edit") {
    const detail =
      stopReason === "max_tokens"
        ? "The response hit max_tokens and the tool call was truncated."
        : `stop_reason was "${stopReason}".`;
    return new PageGenerationError(
      `The model did not call ${RENDER_PAGE_TOOL_NAME} on the edit pass. ${detail}`,
      "no-tool-call",
    );
  }

  const detail =
    stopReason === "max_tokens"
      ? "The response hit max_tokens and the tool call was truncated. The page is likely too large — reduce the block count."
      : `stop_reason was "${stopReason}".`;

  return new PageGenerationError(
    `The model did not call ${RENDER_PAGE_TOOL_NAME}. ${detail}`,
    "no-tool-call",
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}… (${value.length} chars total)`;
}

/* ────────────────────────────────────────────────────────────────────────────
   Selection
   ──────────────────────────────────────────────────────────────────────────── */

let cachedProvider: LlmProvider | null = null;
let cachedProviderKey = "";

/**
 * Returns the provider selected by the environment.
 *
 *   LLM_PROVIDER      "anthropic" | "groq"   (default "anthropic")
 *   ANTHROPIC_API_KEY required when LLM_PROVIDER is "anthropic"
 *   ANTHROPIC_MODEL   default "claude-opus-4-8"
 *   GROQ_API_KEY      required when LLM_PROVIDER is "groq"
 *   GROQ_MODEL        default "openai/gpt-oss-120b"
 *
 * Resolution is deferred to call time, not import time, so a keyless dev environment can
 * still import this module, render the UI, and use the mock page.
 *
 * @throws {PageGenerationError} stage "missing-api-key" when the selected provider has no key.
 */
export function getProvider(): LlmProvider {
  const name = resolveProviderName();

  if (name === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new PageGenerationError(
        'GROQ_API_KEY is not set, but LLM_PROVIDER is "groq". Add GROQ_API_KEY to .env.local ' +
          "(create a key at https://console.groq.com/keys). To use Claude instead, set " +
          "LLM_PROVIDER=anthropic and supply ANTHROPIC_API_KEY. To develop the UI without any " +
          "key, use the mock page from src/lib/generate/mock.ts.",
        "missing-api-key",
      );
    }

    const model = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
    const key = `groq:${model}:${apiKey.slice(-6)}`;
    if (!cachedProvider || cachedProviderKey !== key) {
      cachedProvider = new GroqProvider(model, apiKey);
      cachedProviderKey = key;
    }
    return cachedProvider;
  }

  // Throws the long-standing ANTHROPIC_API_KEY message when the key is absent.
  getAnthropicClient();

  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
  const key = `anthropic:${model}`;
  if (!cachedProvider || cachedProviderKey !== key) {
    cachedProvider = new AnthropicProvider(model);
    cachedProviderKey = key;
  }
  return cachedProvider;
}
