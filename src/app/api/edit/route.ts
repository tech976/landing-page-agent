/**
 * POST /api/edit
 *
 * Conversational edit of a stored page.
 *
 * Body:  { pageId: string, instruction: string, targetBlockId?: string, page?: Page }
 *
 *        `page` is the live canvas document from the editor. When present it is validated
 *        and used as the edit base instead of the file on disk, so unsaved canvas changes
 *        survive an AI pass. When absent the stored page is used.
 *
 * 200 -> { page }
 * 400 -> malformed request
 * 404 -> no page with that id
 * 422 -> the edit produced an invalid page, or lost block ids (original left untouched)
 * 503 -> the active provider's API key is not configured (ANTHROPIC_API_KEY or GROQ_API_KEY,
 *        depending on LLM_PROVIDER — the response names which one)
 *
 * On any failure the stored page is left exactly as it was. `editPage` validates before this
 * route ever calls `savePage`, so a failed edit can never overwrite a good document.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { editPage } from "@/lib/generate/edit";
import { PageGenerationError } from "@/lib/generate/generate";
import { describeProvider } from "@/lib/generate/provider";
import { PageSchema } from "@/lib/schema/page";
import { getPage, savePage } from "@/lib/store";

export const maxDuration = 300;
export const runtime = "nodejs";

const EditRequestSchema = z.object({
  pageId: z.string().min(1).max(64),
  instruction: z.string().min(1).max(4000),
  /** Present when the request came from a block-level control in the editor. */
  targetBlockId: z.string().min(1).max(64).optional(),
  /**
   * The LIVE canvas document, sent by the editor so the AI edits what the marketer is
   * actually looking at rather than the last-saved file. Optional: API callers that only
   * know a pageId still get the stored page. Validated through PageSchema below — a client
   * document is untrusted input.
   */
  page: z.unknown().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = EditRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid edit request.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const { pageId, instruction, targetBlockId, page: clientPage } = parsed.data;

  const stored = await getPage(pageId);
  if (!stored) {
    return NextResponse.json({ error: `No page with id "${pageId}".` }, { status: 404 });
  }

  // Prefer the live canvas document when the editor supplied one, so unsaved block moves
  // and copy tweaks are not silently discarded by an AI pass. It must be a valid Page and
  // must be the same document — an id mismatch means a confused client, not an edit.
  let page = stored;
  if (clientPage !== undefined) {
    const live = PageSchema.safeParse(clientPage);
    if (!live.success) {
      return NextResponse.json(
        {
          error: "The supplied live page document is not a valid Page.",
          issues: live.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    if (live.data.id !== pageId) {
      return NextResponse.json(
        { error: `Live page id "${live.data.id}" does not match pageId "${pageId}".` },
        { status: 400 },
      );
    }
    page = live.data;
  }

  try {
    const edited = await editPage(page, instruction, targetBlockId);
    const saved = await savePage(edited);
    return NextResponse.json({ page: saved }, { status: 200 });
  } catch (error) {
    if (error instanceof PageGenerationError) {
      const status =
        error.stage === "missing-api-key" ? 503 : error.stage === "validation-failed" ? 422 : 502;

      // Which key is missing depends on LLM_PROVIDER. Name the exact variable.
      if (status === 503) {
        const { provider, model, apiKeyEnvVar } = describeProvider();
        return NextResponse.json(
          {
            error: error.message,
            stage: error.stage,
            issues: error.issues,
            provider,
            model,
            hint:
              `LLM_PROVIDER is "${provider}", so ${apiKeyEnvVar} must be set in .env.local. ` +
              `Switch providers by changing LLM_PROVIDER.`,
          },
          { status },
        );
      }

      return NextResponse.json(
        { error: error.message, stage: error.stage, issues: error.issues },
        { status },
      );
    }

    console.error("[api/edit] Unexpected failure:", error);
    return NextResponse.json({ error: "Page edit failed." }, { status: 500 });
  }
}
