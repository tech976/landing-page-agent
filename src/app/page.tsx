import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  Copy,
  ExternalLink,
  FileWarning,
  LayoutTemplate,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import { PageSchema, StylePersonalitySchema } from "@/lib/schema/page";
import { cn, slugify } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";

/**
 * Landing Agent — dashboard.
 *
 * Lists every page in the on-disk JSON store and offers the four things the PPC
 * team does all day: edit, preview, duplicate a winner for a new campaign, and
 * delete a dead one.
 *
 * Storage is flat JSON files (prototype constraint — no database). Reading the
 * filesystem makes this route inherently dynamic.
 */

export const dynamic = "force-dynamic";

const PAGES_DIR = path.join(process.cwd(), "src", "data", "pages");

/* ────────────────────────────────────────────────────────────────────────────
   Reading the store

   The dashboard must survive a malformed page.json — a half-written file from an
   interrupted generation should show as a repairable row, never a 500 that hides
   every other page. So we validate against a deliberately narrow projection of
   PageSchema (derived from it, so it cannot drift) and surface failures inline.
   ──────────────────────────────────────────────────────────────────────────── */

const PageSummarySchema = PageSchema.pick({
  id: true,
  slug: true,
  title: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  blocks: z.array(z.unknown()).default([]),
  theme: z.object({ personality: StylePersonalitySchema.optional() }).optional(),
  meta: z.object({ description: z.string().optional() }).optional(),
});

type PageSummary = z.infer<typeof PageSummarySchema>;

interface BrokenPage {
  file: string;
  reason: string;
}

interface StoreContents {
  pages: PageSummary[];
  broken: BrokenPage[];
}

async function readStore(): Promise<StoreContents> {
  let files: string[];
  try {
    files = (await readdir(PAGES_DIR)).filter((file) => file.endsWith(".json"));
  } catch {
    // Directory absent on a fresh checkout — that is an empty store, not an error.
    return { pages: [], broken: [] };
  }

  const pages: PageSummary[] = [];
  const broken: BrokenPage[] = [];

  await Promise.all(
    files.map(async (file) => {
      try {
        const raw = await readFile(path.join(PAGES_DIR, file), "utf8");
        const parsed = PageSummarySchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          pages.push(parsed.data);
        } else {
          broken.push({
            file,
            reason: parsed.error.issues[0]?.message ?? "Does not match the page schema",
          });
        }
      } catch (error) {
        broken.push({
          file,
          reason: error instanceof Error ? error.message : "Unreadable file",
        });
      }
    }),
  );

  pages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  broken.sort((a, b) => a.file.localeCompare(b.file));
  return { pages, broken };
}

/* ────────────────────────────────────────────────────────────────────────────
   Server actions
   ──────────────────────────────────────────────────────────────────────────── */

/** Rejects anything that could escape PAGES_DIR via a crafted id. */
function pageFilePath(id: string): string {
  const safe = path.basename(`${id}.json`);
  const resolved = path.join(PAGES_DIR, safe);
  if (path.dirname(resolved) !== PAGES_DIR) {
    throw new Error("Invalid page id");
  }
  return resolved;
}

async function duplicatePage(formData: FormData): Promise<void> {
  "use server";

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const source = JSON.parse(await readFile(pageFilePath(id), "utf8")) as Record<
    string,
    unknown
  >;

  const existingSlugs = new Set((await readStore()).pages.map((page) => page.slug));
  const baseSlug = slugify(`${String(source.slug ?? "page")}-copy`);
  let slug = baseSlug;
  let attempt = 2;
  while (existingSlugs.has(slug)) {
    slug = slugify(`${baseSlug}-${attempt}`);
    attempt += 1;
  }

  const now = new Date().toISOString();
  const copy = {
    ...source,
    id: nanoid(12),
    slug,
    title: `${String(source.title ?? "Untitled")} (copy)`,
    // A duplicate is always a draft — never inherit `published` and risk a live
    // page appearing under a new slug without review.
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  await writeFile(pageFilePath(copy.id), `${JSON.stringify(copy, null, 2)}\n`, "utf8");
  revalidatePath("/");
}

async function deletePage(formData: FormData): Promise<void> {
  "use server";

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await unlink(pageFilePath(id));
  revalidatePath("/");
}

/* ────────────────────────────────────────────────────────────────────────────
   Presentation helpers
   ──────────────────────────────────────────────────────────────────────────── */

const STATUS_TONE: Record<PageSummary["status"], BadgeTone> = {
  draft: "neutral",
  review: "warning",
  published: "success",
  archived: "neutral",
};

const STATUS_LABEL: Record<PageSummary["status"], string> = {
  draft: "Draft",
  review: "In review",
  published: "Published",
  archived: "Archived",
};

/**
 * Thumbnail stand-in until real page screenshots exist. Keyed off the style
 * personality so a marketer can recognise a page by shape at a glance. Static
 * lookup, token classes only — DESIGN-SYSTEM §2.4a.
 */
const PERSONALITY_THUMB: Record<string, string> = {
  "bold-commerce": "bg-primary-soft text-primary",
  "premium-minimal": "bg-surface-sunken text-fg-strong",
  "vibrant-youth": "bg-accent-soft text-accent",
};

const PERSONALITY_LABEL: Record<string, string> = {
  "bold-commerce": "Bold commerce",
  "premium-minimal": "Premium minimal",
  "vibrant-youth": "Vibrant youth",
};

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60_000],
  ["month", 30 * 24 * 60 * 60_000],
  ["day", 24 * 60 * 60_000],
  ["hour", 60 * 60_000],
  ["minute", 60_000],
];

function formatRelative(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "unknown";

  const deltaMs = timestamp - Date.now();
  const formatter = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(deltaMs) >= ms) {
      return formatter.format(Math.round(deltaMs / ms), unit);
    }
  }
  return "just now";
}

/* ────────────────────────────────────────────────────────────────────────────
   Screen
   ──────────────────────────────────────────────────────────────────────────── */

export default async function DashboardPage() {
  const { pages, broken } = await readStore();

  const published = pages.filter((page) => page.status === "published").length;
  const drafts = pages.filter((page) => page.status === "draft").length;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-[var(--container-page)] flex-wrap items-center gap-4 px-[var(--space-gutter)] py-4">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-9 items-center justify-center rounded-lg bg-primary text-on-primary"
            >
              <Sparkles className="size-5" />
            </span>
            <span className="font-heading text-lg font-extrabold tracking-tight text-fg-strong">
              Landing Agent
            </span>
          </div>
          <span className="ml-auto" />
          <Link href="/new" className={buttonStyles({ size: "sm" })}>
            <Plus className="size-4" />
            New Landing Page
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[var(--container-page)] flex-1 px-[var(--space-gutter)] py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-extrabold tracking-tight text-fg-strong sm:text-4xl">
              Landing pages
            </h1>
            <p className="mt-2 font-body text-base text-muted-fg">
              {pages.length === 0
                ? "No pages yet — start with a brief."
                : `${pages.length} page${pages.length === 1 ? "" : "s"} · ${published} published · ${drafts} draft${drafts === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        {broken.length > 0 ? (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-warning bg-warning-soft p-4">
            <FileWarning className="mt-0.5 size-5 shrink-0 text-warning-fg" aria-hidden />
            <div>
              <p className="font-body text-sm font-semibold text-warning-fg">
                {broken.length} file{broken.length === 1 ? "" : "s"} could not be read
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {broken.map((entry) => (
                  <li key={entry.file} className="font-body text-xs text-warning-fg">
                    <span className="font-mono">{entry.file}</span> — {entry.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {pages.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {pages.map((page) => (
              <li key={page.id}>
                <PageCard page={page} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <Card variant="flat" className="mt-8 border-dashed">
      <CardBody className="items-center gap-4 py-14 text-center sm:py-20">
        <span
          aria-hidden
          className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"
        >
          <LayoutTemplate className="size-7" />
        </span>
        <h2 className="font-heading text-2xl font-extrabold tracking-tight text-fg-strong">
          No landing pages yet
        </h2>
        <p className="max-w-prose font-body text-base text-muted-fg">
          Fill in a brief — brand, product, offer, proof, audience, campaign, style —
          and the generator composes a validated page from the block registry. You can
          then edit every block visually.
        </p>
        <Link href="/new" className={cn(buttonStyles({ size: "lg" }), "mt-2")}>
          <Plus className="size-5" />
          New Landing Page
        </Link>
        <p className="font-body text-xs text-muted-fg">
          In a hurry? The brief has a “Fill with sample data” button.
        </p>
      </CardBody>
    </Card>
  );
}

function PageCard({ page }: { page: PageSummary }) {
  const personality = page.theme?.personality ?? "bold-commerce";
  const thumbClass = PERSONALITY_THUMB[personality] ?? PERSONALITY_THUMB["bold-commerce"];
  const blockCount = page.blocks.length;

  return (
    <Card interactive className="flex h-full flex-col">
      {/* Thumbnail placeholder — a real screenshot service replaces this later. */}
      <div
        className={cn(
          "relative flex aspect-card items-center justify-center overflow-hidden",
          thumbClass,
        )}
      >
        <span
          aria-hidden
          className="font-heading text-5xl font-extrabold tracking-tighter opacity-70"
        >
          {page.title.slice(0, 2).toUpperCase()}
        </span>
        <span className="absolute top-3 left-3">
          <Badge tone={STATUS_TONE[page.status]} variant="solid" dot>
            {STATUS_LABEL[page.status]}
          </Badge>
        </span>
      </div>

      <CardBody className="flex-1 gap-2">
        <h2 className="font-heading text-xl font-bold tracking-tight text-fg-strong">
          <Link
            href={`/editor/${page.id}`}
            className="rounded-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
          >
            {page.title}
          </Link>
        </h2>
        <p className="font-mono text-xs text-muted-fg">/{page.slug}</p>
        <p className="mt-1 font-body text-xs text-muted-fg">
          Edited {formatRelative(page.updatedAt)} · {blockCount} block
          {blockCount === 1 ? "" : "s"} ·{" "}
          {PERSONALITY_LABEL[personality] ?? personality}
        </p>
      </CardBody>

      <CardFooter className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/editor/${page.id}`}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            <Pencil className="size-4" />
            Edit
          </Link>
          {/* Preview resolves by id, not slug: the route is /preview/[pageId] and
              calls getPage(id), which reads <id>.json. Linking by slug 404s for
              every page whose slug differs from its id. */}
          <Link
            href={`/preview/${page.id}`}
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            <ExternalLink className="size-4" />
            Preview
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <form action={duplicatePage}>
            <input type="hidden" name="id" value={page.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              aria-label={`Duplicate ${page.title}`}
              title="Duplicate"
              className="size-11 p-0"
            >
              <Copy className="size-4" />
            </Button>
          </form>

          {/* Destructive action behind a confirmation step. `<details>` keeps this
              a Server Component — no client bundle for a once-a-week action. */}
          <details className="relative">
            <summary
              className={cn(
                buttonStyles({ variant: "ghost", size: "sm" }),
                "size-11 list-none p-0 text-danger-fg [&::-webkit-details-marker]:hidden",
              )}
              aria-label={`Delete ${page.title}`}
              title="Delete"
            >
              <Trash2 className="size-4" />
            </summary>
            <div className="absolute right-0 bottom-full z-40 mb-2 w-60 rounded-lg border border-border bg-surface-raised p-3 shadow-lg">
              <p className="font-body text-sm text-fg">
                Delete <span className="font-semibold">{page.title}</span>? This cannot
                be undone.
              </p>
              <form action={deletePage} className="mt-3 flex justify-end">
                <input type="hidden" name="id" value={page.id} />
                <Button type="submit" variant="danger" size="sm">
                  Delete page
                </Button>
              </form>
            </div>
          </details>
        </div>
      </CardFooter>
    </Card>
  );
}
