/**
 * /api/pages/[pageId]
 *
 * GET    -> { page: Page }        load a single page document
 * DELETE -> { deleted: true }     remove it from the JSON store
 *
 * The editor route (src/app/editor/[pageId]/page.tsx) calls GET on mount to hydrate the
 * Puck canvas. It receives the page document verbatim — the same JSON the generator wrote
 * and the same JSON POST /api/pages will store again after editing. No projection, no
 * view-model: any reshaping here would be exactly the lossy step the architecture exists
 * to avoid.
 *
 * DELETE lives here rather than on the collection route because a destructive operation
 * must name its target unambiguously (see the note in ../route.ts).
 */

import { NextResponse } from "next/server";

import { deletePage, getPage, PageStoreError } from "@/lib/store";

export const runtime = "nodejs";
/** Drafts change constantly while an editor session is open — never serve a cached read. */
export const dynamic = "force-dynamic";

interface RouteContext {
  /** Next.js 15+ hands route params in as a Promise. */
  params: Promise<{ pageId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { pageId } = await params;

  try {
    const page = await getPage(pageId);

    if (!page) {
      return NextResponse.json(
        { error: `No page with id "${pageId}".`, code: "not-found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ page }, { status: 200 });
  } catch (error) {
    if (error instanceof PageStoreError) {
      const status = error.code === "invalid-id" ? 400 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    console.error(`[api/pages/${pageId}] Load failed:`, error);
    return NextResponse.json({ error: "Could not load page." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { pageId } = await params;

  try {
    const deleted = await deletePage(pageId);

    if (!deleted) {
      return NextResponse.json(
        { error: `No page with id "${pageId}".`, code: "not-found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    if (error instanceof PageStoreError) {
      const status = error.code === "invalid-id" ? 400 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    console.error(`[api/pages/${pageId}] Delete failed:`, error);
    return NextResponse.json({ error: "Could not delete page." }, { status: 500 });
  }
}
