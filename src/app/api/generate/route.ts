/**
 * POST /api/generate
 *
 * Brief -> generated page -> disk.
 *
 * Body:  a `Brief` (see src/lib/schema/brief.ts), optionally with `{ "mock": true }`
 *        to bypass the API entirely and persist the example page — which is how the UI
 *        gets developed and demoed without a key.
 *
 * 200 -> { page }
 * 400 -> invalid brief, with the Zod issue paths
 * 422 -> the model produced a page that failed validation twice
 * 503 -> the active provider's API key is not configured (ANTHROPIC_API_KEY or GROQ_API_KEY,
 *        depending on LLM_PROVIDER — the response names which one)
 */

import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { generatePage, PageGenerationError } from "@/lib/generate/generate";
import { describeProvider } from "@/lib/generate/provider";
import { mockPage } from "@/lib/generate/mock";
import { BriefSchema } from "@/lib/schema/brief";
import { savePage } from "@/lib/store";

/** Generation streams a 32k-token tool call; the default serverless budget is too short. */
export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const useMock =
    typeof body === "object" && body !== null && (body as { mock?: unknown }).mock === true;

  if (useMock) {
    // A fresh id per call so the dashboard can hold several demo pages side by side.
    const now = new Date().toISOString();
    const page = await savePage({
      ...mockPage,
      id: `page_${nanoid(10)}`,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ page, source: "mock" }, { status: 200 });
  }

  // The intake wizard posts `{ brief: {...} }`; direct/API callers post the brief bare.
  // Accept both so the primary journey (/new -> Generate) cannot silently 400.
  const briefInput =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { brief?: unknown }).brief === "object" &&
    (body as { brief?: unknown }).brief !== null
      ? (body as { brief: unknown }).brief
      : body;

  const brief = BriefSchema.safeParse(briefInput);
  if (!brief.success) {
    return NextResponse.json(
      {
        error: "Invalid brief.",
        issues: brief.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const page = await generatePage(brief.data);
    const saved = await savePage(page);
    return NextResponse.json({ page: saved, source: "generated" }, { status: 200 });
  } catch (error) {
    if (error instanceof PageGenerationError) {
      const status =
        error.stage === "missing-api-key" ? 503 : error.stage === "validation-failed" ? 422 : 502;

      // A 503 is always a configuration problem, and which key is missing depends on
      // LLM_PROVIDER. Name the exact variable so the operator does not have to guess.
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
              `Switch providers by changing LLM_PROVIDER, or POST { "mock": true } to build ` +
              `the UI without any key.`,
          },
          { status },
        );
      }

      return NextResponse.json(
        { error: error.message, stage: error.stage, issues: error.issues },
        { status },
      );
    }

    console.error("[api/generate] Unexpected failure:", error);
    return NextResponse.json({ error: "Page generation failed." }, { status: 500 });
  }
}
