/**
 * /api/pages
 *
 * GET  -> { pages: PageSummary[] }   the dashboard listing, newest first
 * POST -> { page: Page }             persists a page edited in the Puck canvas
 *
 * The POST half is the human end of the round-trip. Puck writes the SAME JSON document the
 * generator produced, so saving it is just a validate-and-write — there is no transformation
 * step here, and that absence is the point of the whole architecture.
 *
 * DELETE is intentionally not exposed on this collection route; a destructive operation
 * belongs on /api/pages/[id] where the target cannot be ambiguous.
 */

import { NextResponse } from "next/server";

import { listPages, PageStoreError, savePage } from "@/lib/store";

export const runtime = "nodejs";
/** Always read from disk — a cached listing would hide a page the user just generated. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pages = await listPages();
    return NextResponse.json({ pages }, { status: 200 });
  } catch (error) {
    console.error("[api/pages] Listing failed:", error);
    return NextResponse.json({ error: "Could not list pages." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  // Accept either a bare page or { page } — the editor sends one, scripts tend to send the other.
  const candidate =
    typeof body === "object" && body !== null && "page" in body
      ? (body as { page: unknown }).page
      : body;

  try {
    const page = await savePage(candidate);
    return NextResponse.json({ page }, { status: 200 });
  } catch (error) {
    if (error instanceof PageStoreError) {
      const status = error.code === "invalid-page" || error.code === "invalid-id" ? 400 : 500;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    console.error("[api/pages] Save failed:", error);
    return NextResponse.json({ error: "Could not save page." }, { status: 500 });
  }
}
