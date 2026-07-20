/**
 * Landing Agent — the one error type the generation stack throws.
 *
 * This lives in its own module purely to break an import cycle: `provider.ts` throws
 * `PageGenerationError`, and `generate.ts` imports `provider.ts`. Putting the error in a
 * leaf module keeps the dependency graph acyclic.
 *
 * `generate.ts` re-exports both symbols, so every existing
 * `import { PageGenerationError } from "@/lib/generate/generate"` continues to work.
 */

export type GenerationStage =
  | "missing-api-key"
  | "api-error"
  | "no-tool-call"
  | "validation-failed";

/** Thrown on any unrecoverable failure of the generation or edit pass. */
export class PageGenerationError extends Error {
  override readonly name = "PageGenerationError";
  readonly stage: GenerationStage;
  /** Formatted Zod issues, present when `stage === "validation-failed"`. */
  readonly issues: string[];

  constructor(
    message: string,
    stage: GenerationStage,
    options: { issues?: string[]; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.stage = stage;
    this.issues = options.issues ?? [];
  }
}
