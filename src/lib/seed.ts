/**
 * Landing Agent — example-page seeding.
 *
 * Writes the mock page (src/lib/generate/mock.ts) into the JSON store the first time the
 * server starts, so a fresh clone opens on a real, previewable, editable landing page
 * with NO ANTHROPIC_API_KEY set. Every path except generation — dashboard, Puck editor,
 * round-trip save, production preview — is exercisable offline.
 *
 * IDEMPOTENT AND NON-DESTRUCTIVE. If the file already exists it is left completely alone.
 * The seed page is a normal page once written: editing it in Puck and saving must survive
 * a server restart, so re-seeding over the top would silently discard a marketer's work.
 * Delete src/data/pages/page_mock_kaarva.json to get the pristine copy back.
 *
 * SERVER ONLY — reaches the filesystem through src/lib/store.ts.
 */

import { access } from "node:fs/promises";
import path from "node:path";

import { cloneMockPage } from "@/lib/generate/mock";
import { savePage } from "@/lib/store";

const PAGES_DIR = path.join(process.cwd(), "src", "data", "pages");

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export interface SeedResult {
  status: "created" | "already-present" | "failed";
  pageId: string;
}

/**
 * Ensures the example page exists on disk.
 *
 * Never throws. Seeding is a developer convenience, not a correctness requirement — a
 * failure here (read-only volume, permissions) must not stop the server from booting.
 */
export async function seedExamplePage(): Promise<SeedResult> {
  const page = cloneMockPage();
  const target = path.join(PAGES_DIR, `${page.id}.json`);

  try {
    if (await exists(target)) {
      return { status: "already-present", pageId: page.id };
    }

    // Goes through savePage so the seed passes the exact same PageSchema gate as
    // generator output and editor output. If the mock ever drifts from the schema, it
    // fails here rather than producing a file the renderer cannot read.
    await savePage(page);

    console.info(
      `[seed] Wrote example page "${page.id}" (${page.slug}). ` +
        `Open /editor/${page.id} or /preview/${page.id}.`,
    );

    return { status: "created", pageId: page.id };
  } catch (error) {
    console.error("[seed] Could not write the example page:", error);
    return { status: "failed", pageId: page.id };
  }
}
