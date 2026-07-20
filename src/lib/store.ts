/**
 * Landing Agent — JSON-file persistence.
 *
 * One page per file at `src/data/pages/<id>.json`. Deliberately not a database: this is a
 * prototype, and a directory of readable JSON documents means the whole pipeline — AI output,
 * editor output, renderer input — can be inspected and diffed with a text editor.
 *
 * Every read validates through `PageSchema`. A file on disk is untrusted input: it may have
 * been hand-edited, or written by an older version of the schema. Validating on read means a
 * corrupt file surfaces at the boundary rather than as a render crash three layers in.
 *
 * SERVER ONLY. Imports node:fs — never import this from a client component.
 */

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { cloneMockPage } from "@/lib/generate/mock";
import { type Page, PageSchema } from "@/lib/schema/page";

/** Resolved from cwd, which Next.js guarantees is the project root at runtime. */
const PAGES_DIR = path.join(process.cwd(), "src", "data", "pages");

/* ────────────────────────────────────────────────────────────────────────────
   Read-only filesystem fallback

   Serverless hosts (Vercel, Lambda) give each function a read-only filesystem
   outside /tmp, and Next.js does not trace files we open by a computed path — so
   on a deployed build both the write AND the read of src/data/pages fail.

   Rather than let that surface as a 500 on every route, the store probes once for
   writability and transparently degrades to an in-memory Map seeded from the mock
   page (a TS module, so it is always bundled). Local development is unaffected and
   still uses the real files; a deployment gets a working read-only demo whose edits
   live for the lifetime of the warm function instance.

   The tradeoff is explicit: in memory mode, published changes do not survive a cold
   start. That is correct for a demo deployment and wrong for production — persistence
   there belongs in a real database, not on the filesystem.
   ──────────────────────────────────────────────────────────────────────────── */

const memoryPages = new Map<string, Page>();
let writableProbe: Promise<boolean> | null = null;
let memorySeeded = false;

async function isWritable(): Promise<boolean> {
  writableProbe ??= (async () => {
    // Explicit override — set PAGE_STORE=memory to force the in-memory store. Useful on a
    // host whose filesystem is writable but ephemeral, and to exercise this path locally.
    if (process.env.PAGE_STORE === "memory") {
      console.warn("[store] PAGE_STORE=memory — using the in-memory page store.");
      return false;
    }

    try {
      await mkdir(PAGES_DIR, { recursive: true });
      const marker = path.join(PAGES_DIR, ".write-probe");
      await writeFile(marker, "", "utf8");
      await rm(marker, { force: true });
      return true;
    } catch {
      console.warn("[store] Filesystem is read-only — using the in-memory page store.");
      return false;
    }
  })();

  return writableProbe;
}

/** Populates the in-memory store once, so a read-only deployment still has content. */
function seedMemory(): void {
  if (memorySeeded) return;
  memorySeeded = true;

  const mock = cloneMockPage();
  const parsed = PageSchema.safeParse(mock);
  if (parsed.success) memoryPages.set(parsed.data.id, parsed.data);
  else console.warn("[store] Mock page failed PageSchema; in-memory store starts empty.");
}

/** Thrown when the store cannot satisfy a request. */
export class PageStoreError extends Error {
  override readonly name = "PageStoreError";
  readonly code: "invalid-id" | "not-found" | "invalid-page" | "corrupt-file";

  constructor(message: string, code: PageStoreError["code"], options: { cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.code = code;
  }
}

/**
 * Ids become filenames, so they are checked against a strict allow-list.
 * Without this, an id of `../../../.env` is a path-traversal write.
 */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function assertSafeId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new PageStoreError(
      `Invalid page id "${id}". Ids may contain only letters, digits, hyphen and underscore.`,
      "invalid-id",
    );
  }
}

function pageFilePath(id: string): string {
  assertSafeId(id);
  return path.join(PAGES_DIR, `${id}.json`);
}

async function ensureDir(): Promise<void> {
  await mkdir(PAGES_DIR, { recursive: true });
}

const isEnoent = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: string }).code === "ENOENT";

/* ────────────────────────────────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Validates and writes a page, stamping `updatedAt`.
 *
 * Validation happens here rather than at the call sites because this is the last gate before
 * disk: a page that reaches a file is a page the renderer and the Puck editor can both trust.
 *
 * @returns The parsed page as written, with defaults applied.
 * @throws {PageStoreError} with code `invalid-page` if the input does not satisfy PageSchema.
 */
export async function savePage(page: unknown): Promise<Page> {
  const parsed = PageSchema.safeParse(page);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new PageStoreError(`Refusing to save an invalid page — ${issues}`, "invalid-page", {
      cause: parsed.error,
    });
  }

  const record: Page = { ...parsed.data, updatedAt: new Date().toISOString() };

  if (!(await isWritable())) {
    assertSafeId(record.id);
    seedMemory();
    memoryPages.set(record.id, record);
    return record;
  }

  await ensureDir();
  await writeFile(pageFilePath(record.id), `${JSON.stringify(record, null, 2)}\n`, "utf8");

  return record;
}

/**
 * Reads one page by id.
 *
 * @returns The page, or `null` when no file exists. A missing page is an expected outcome,
 *          not an error — callers turn it into a 404.
 * @throws {PageStoreError} with code `corrupt-file` when the file exists but is unreadable
 *         as a valid page.
 */
export async function getPage(id: string): Promise<Page | null> {
  const filePath = pageFilePath(id);

  if (!(await isWritable())) {
    seedMemory();
    return memoryPages.get(id) ?? null;
  }

  let contents: string;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(contents);
  } catch (error) {
    throw new PageStoreError(`${id}.json is not valid JSON.`, "corrupt-file", { cause: error });
  }

  const parsed = PageSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PageStoreError(
      `${id}.json does not satisfy PageSchema — it may have been hand-edited or written by an older schema version.`,
      "corrupt-file",
      { cause: parsed.error },
    );
  }

  return parsed.data;
}

/** A row in the dashboard listing. Deliberately not the whole page — a list view never needs blocks[]. */
export interface PageSummary {
  id: string;
  slug: string;
  title: string;
  status: Page["status"];
  blockCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lists every stored page, newest first.
 *
 * A corrupt file is skipped with a warning rather than failing the whole listing — one bad
 * document must not make the dashboard unreachable.
 */
export async function listPages(): Promise<PageSummary[]> {
  const summarise = (page: Page): PageSummary => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    blockCount: page.blocks.length,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  });

  if (!(await isWritable())) {
    seedMemory();
    return [...memoryPages.values()]
      .map(summarise)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  await ensureDir();

  const entries = await readdir(PAGES_DIR, { withFileTypes: true });
  const ids = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -".json".length));

  const summaries: PageSummary[] = [];

  for (const id of ids) {
    try {
      const page = await getPage(id);
      if (!page) continue;
      summaries.push(summarise(page));
    } catch (error) {
      console.warn(`[store] Skipping unreadable page "${id}":`, error);
    }
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Deletes a page.
 *
 * @returns `true` if a file was removed, `false` if there was nothing to remove.
 */
export async function deletePage(id: string): Promise<boolean> {
  const filePath = pageFilePath(id);

  if (!(await isWritable())) {
    seedMemory();
    return memoryPages.delete(id);
  }

  try {
    await rm(filePath);
    return true;
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
}

/** Resolves a page by its URL slug — the renderer's entry point. */
export async function getPageBySlug(slug: string): Promise<Page | null> {
  const summaries = await listPages();
  const match = summaries.find((summary) => summary.slug === slug);
  return match ? getPage(match.id) : null;
}
