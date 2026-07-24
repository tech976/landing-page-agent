import { readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { Copy, ExternalLink, FileWarning, Pencil, Plus, Trash2 } from "lucide-react";

import { PageSchema, StylePersonalitySchema } from "@/lib/schema/page";
import { cn, slugify } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, IconButton, buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";
import { AppTopBar } from "@/components/app/AppTopBar";
import { CroScoreRing } from "@/components/cro/CroScoreRing";

import { auditPage, type CroReport } from "@/lib/cro/audit";

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

/**
 * A card's data: the summary projection plus its CRO audit for the score badge.
 * `cro` is null when a file satisfies the narrow summary yet fails FULL-schema
 * validation — the card still renders, just without a score (never crashes).
 */
type PageCardData = PageSummary & { cro: CroReport | null };

interface BrokenPage {
  file: string;
  reason: string;
}

interface StoreContents {
  pages: PageCardData[];
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

  const pages: PageCardData[] = [];
  const broken: BrokenPage[] = [];

  await Promise.all(
    files.map(async (file) => {
      try {
        const raw = await readFile(path.join(PAGES_DIR, file), "utf8");
        const json: unknown = JSON.parse(raw);
        const parsed = PageSummarySchema.safeParse(json);
        if (parsed.success) {
          // The badge needs the FULL Page, not the narrow summary. A file can
          // pass the summary yet fail full-schema validation; when it does we
          // skip the audit (cro: null) but still render the card. auditPage is a
          // pure, synchronous function over the already-parsed JSON — no I/O.
          const full = PageSchema.safeParse(json);
          pages.push({ ...parsed.data, cro: full.success ? auditPage(full.data) : null });
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
 * Thumbnail wash keyed off the style personality, so a marketer can recognise a
 * page family by its tint. App-chrome tokens only (the product indigo is the sole
 * accent), so each gradient stays legible in light AND dark — the variety comes
 * from direction and stops, never from a brand hue. Static lookup so Tailwind's
 * scanner sees every literal class.
 */
const PERSONALITY_GRADIENT: Record<string, string> = {
  "bold-commerce": "bg-gradient-to-br from-app-accent-soft via-app-surface to-app-surface-2",
  "premium-minimal": "bg-gradient-to-br from-app-surface-2 via-app-surface to-app-surface-2",
  "vibrant-youth": "bg-gradient-to-tr from-app-accent-soft via-app-surface-2 to-app-accent-soft",
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
    <div className="flex min-h-full flex-col bg-app-bg">
      <AppTopBar />

      <main className="mx-auto w-full max-w-[var(--container-page)] flex-1 px-[var(--space-gutter)] py-8 sm:py-12">
        {/* Page heading + at-a-glance counts. */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-extrabold tracking-tight text-app-fg sm:text-4xl">
              Landing pages
            </h1>
            <p className="mt-2 max-w-prose font-body text-base text-app-fg-muted">
              Every page your team has generated — ready to edit, preview, duplicate for
              a new campaign, or ship.
            </p>
          </div>

          {pages.length > 0 ? (
            <div className="flex shrink-0 items-center gap-2.5">
              <Stat value={pages.length} label={pages.length === 1 ? "page" : "pages"} />
              <Stat value={published} label="published" dot="bg-app-success" />
              <Stat value={drafts} label={drafts === 1 ? "draft" : "drafts"} dot="bg-app-border-strong" />
            </div>
          ) : null}
        </div>

        {broken.length > 0 ? <BrokenNotice broken={broken} /> : null}

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

/** Compact metric chip for the header summary. */
function Stat({ value, label, dot }: { value: number; label: string; dot?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-app-border bg-app-surface px-3.5 py-2 shadow-xs">
      {dot ? <span aria-hidden className={cn("size-2 rounded-full", dot)} /> : null}
      <span className="font-heading text-lg font-extrabold tabular-nums tracking-tight text-app-fg">
        {value}
      </span>
      <span className="font-body text-xs font-medium text-app-fg-muted">{label}</span>
    </div>
  );
}

/**
 * The repairable-file warning. Preserves the exact data the store surfaces
 * (filename + parser reason) and styles it as a warning card — never a dead end.
 */
function BrokenNotice({ broken }: { broken: BrokenPage[] }) {
  return (
    <div className="mt-6 flex items-start gap-3.5 rounded-xl border border-app-border-strong bg-app-warning-soft p-4 shadow-xs sm:p-5">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-app-warning text-app-warning-fg"
      >
        <FileWarning className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-bold tracking-tight text-app-fg">
          {broken.length} file{broken.length === 1 ? "" : "s"} need attention
        </p>
        <p className="mt-0.5 font-body text-xs text-app-fg-muted">
          These couldn&apos;t be read as a valid page and were skipped — fix the JSON to
          bring them back.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {broken.map((entry) => (
            <li
              key={entry.file}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-app-border bg-app-surface px-3 py-2"
            >
              <span className="font-mono text-xs font-semibold text-app-fg">{entry.file}</span>
              <span className="font-body text-xs text-app-fg-muted">{entry.reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card variant="flat" className="mt-8 border-dashed border-app-border-strong">
      <CardBody className="items-center gap-5 px-6 py-16 text-center sm:py-24">
        {/* Illustration — a little stack of "pages" with an accent + affordance. */}
        <div aria-hidden className="relative mb-2 grid h-32 w-56 place-items-center">
          <span className="absolute left-5 top-4 h-24 w-32 -rotate-[9deg] rounded-2xl border border-app-border bg-app-surface shadow-sm" />
          <span className="absolute right-5 top-4 h-24 w-32 rotate-[9deg] rounded-2xl border border-app-border bg-app-surface shadow-sm" />
          <span className="relative flex h-28 w-36 flex-col gap-2 rounded-2xl border border-app-border bg-app-surface p-3.5 shadow-card">
            <span className="h-2 w-10 rounded-full bg-app-accent-soft" />
            <span className="h-2.5 w-full rounded-full bg-app-border-strong" />
            <span className="h-2 w-2/3 rounded-full bg-app-border-strong" />
            <span className="mt-auto h-6 w-16 rounded-md bg-app-accent" />
          </span>
          <span className="absolute -top-1 right-3 flex size-10 items-center justify-center rounded-full bg-app-accent text-app-accent-fg shadow-card ring-4 ring-app-bg">
            <Plus className="size-5" />
          </span>
        </div>

        <h2 className="font-heading text-2xl font-extrabold tracking-tight text-app-fg">
          No landing pages yet
        </h2>
        <p className="max-w-prose font-body text-base text-app-fg-muted">
          Fill in a brief — brand, product, offer, proof, audience, campaign, style — and
          the generator composes a validated page from the block registry. You can then
          edit every block visually.
        </p>
        <Link href="/new" className={cn(buttonStyles({ size: "lg" }), "mt-2")}>
          <Plus className="size-5" aria-hidden />
          New Landing Page
        </Link>
        <p className="font-body text-xs text-app-fg-muted">
          In a hurry? The brief has a &ldquo;Fill with sample data&rdquo; button.
        </p>
      </CardBody>
    </Card>
  );
}

function PageCard({ page }: { page: PageCardData }) {
  const personality = page.theme?.personality ?? "bold-commerce";
  const gradient = PERSONALITY_GRADIENT[personality] ?? PERSONALITY_GRADIENT["bold-commerce"];
  const blockCount = page.blocks.length;
  const cro = page.cro;

  return (
    <Card interactive className="flex h-full flex-col">
      {/* Thumbnail placeholder — an abstract "page preview" until real screenshots
          exist: a gradient stage with a faux browser peeking up from the bottom. */}
      <div className={cn("relative aspect-card overflow-hidden", gradient)}>
        <span className="absolute left-3 top-3 z-10">
          <Badge tone={STATUS_TONE[page.status]} variant="solid" dot>
            {STATUS_LABEL[page.status]}
          </Badge>
        </span>

        <div className="absolute inset-x-5 top-9 -bottom-1 overflow-hidden rounded-t-xl border border-b-0 border-app-border bg-app-surface/90 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-app-border px-3 py-2">
            <span className="flex items-center gap-1" aria-hidden>
              <span className="size-1.5 rounded-full bg-app-danger" />
              <span className="size-1.5 rounded-full bg-app-warning" />
              <span className="size-1.5 rounded-full bg-app-success" />
            </span>
            <span className="ml-1 min-w-0 flex-1 truncate rounded bg-app-surface-2 px-1.5 py-0.5 font-mono text-[10px] leading-none text-app-fg-muted">
              /{page.slug}
            </span>
          </div>
          <div className="flex flex-col gap-2 px-4 pt-4" aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-app-accent-soft" />
            <span className="h-2.5 w-4/5 rounded-full bg-app-border-strong" />
            <span className="h-2 w-3/5 rounded-full bg-app-border-strong" />
            <span className="mt-1.5 h-5 w-16 rounded-md bg-app-accent" />
          </div>
        </div>
      </div>

      <CardBody className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-lg font-bold tracking-tight text-app-fg">
            <Link
              href={`/editor/${page.id}`}
              className="rounded-sm outline-none transition-colors duration-[var(--dur-fast)] hover:text-app-accent focus-visible:ring-4 focus-visible:ring-app-ring/50"
            >
              {page.title}
            </Link>
          </h2>

          {/* CRO score — proof at a glance that the page is conversion-optimized.
              Uses app status tokens (via the ring), so it reads in light and dark.
              Omitted only when the page failed full-schema validation. */}
          {cro ? (
            <span
              className="flex shrink-0 flex-col items-center gap-0.5"
              title={`CRO score ${cro.score} of 100 — ${cro.grade}`}
            >
              <CroScoreRing score={cro.score} grade={cro.grade} size="sm" />
              <span className="font-heading text-[9px] font-bold uppercase tracking-[0.12em] text-app-fg-muted">
                CRO
              </span>
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-2 font-body text-xs text-app-fg-muted">
          <Badge tone="accent" variant="soft">
            {PERSONALITY_LABEL[personality] ?? personality}
          </Badge>
          <span aria-hidden className="text-app-border-strong">
            ·
          </span>
          <span>
            {blockCount} block{blockCount === 1 ? "" : "s"}
          </span>
          <span aria-hidden className="text-app-border-strong">
            ·
          </span>
          <span>Edited {formatRelative(page.updatedAt)}</span>
        </div>
      </CardBody>

      <CardFooter className="justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/editor/${page.id}`}
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            <Pencil className="size-4" aria-hidden />
            Edit
          </Link>
          {/* Preview resolves by id, not slug: the route is /preview/[pageId] and
              calls getPage(id), which reads <id>.json. Linking by slug 404s for
              every page whose slug differs from its id. Opens in a new tab so the
              marketer keeps the dashboard open. */}
          <Link
            href={`/preview/${page.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            <ExternalLink className="size-4" aria-hidden />
            Preview
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <form action={duplicatePage}>
            <input type="hidden" name="id" value={page.id} />
            <IconButton type="submit" label={`Duplicate ${page.title}`}>
              <Copy className="size-4" aria-hidden />
            </IconButton>
          </form>

          {/* Destructive action behind a confirmation step. `<details>` keeps this
              a Server Component — no client bundle for a once-a-week action. */}
          <details className="relative">
            <summary
              className={cn(
                buttonStyles({ variant: "ghost", size: "sm" }),
                "size-11 list-none p-0 text-app-danger [&::-webkit-details-marker]:hidden",
              )}
              aria-label={`Delete ${page.title}`}
              title="Delete"
            >
              <Trash2 className="size-4" aria-hidden />
            </summary>
            <div className="absolute right-0 bottom-full z-40 mb-2 w-64 rounded-xl border border-app-border bg-app-surface p-3.5 shadow-lg">
              <p className="font-body text-sm text-app-fg">
                Delete <span className="font-semibold">{page.title}</span>? This cannot be
                undone.
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
