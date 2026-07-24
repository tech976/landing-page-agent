"use client";

/**
 * Landing Agent — the visual editor route.
 *
 * Contract source: docs/BLOCK-CATALOG.md §0.1 (lossless round-trip)
 *
 *   GET  /api/pages/:pageId   → { page: Page }        load
 *   POST /api/pages           → { page: Page }        publish (full document)
 *   POST /api/edit            → { page: Page }        AI edit pass
 *
 * The whole route is a client component. Puck is a browser-only editor — it measures
 * DOM, owns drag state and mounts an iframe canvas — so there is nothing for the
 * server to usefully render here, and the page is behind an internal auth boundary
 * rather than being crawled. Puck itself is loaded via `next/dynamic` with
 * `ssr: false` so it is never evaluated during SSR.
 *
 * THE ROUND-TRIP, concretely:
 *
 *   page (JSON)  ──pageToPuckData──▶  Puck canvas  ──onChange──▶  latestDataRef
 *                                                                       │
 *   page (JSON)  ◀──puckDataToPage(data, page)──────────────────────────┘
 *
 * `puckDataToPage` always takes the loaded page as its `base`, so meta, theme,
 * fixtures and tracking — none of which Puck models — survive every publish and every
 * AI pass untouched. The block ids survive because they live in `props.id`; see the
 * id-mapping note at the top of src/lib/puck/adapter.ts.
 */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";

import "@measured/puck/puck.css";

import { AiChatPanel, type AiEditResult } from "@/components/editor/AiChatPanel";
import { pageToPuckData, puckDataToPage } from "@/lib/puck/adapter";
import { puckConfig } from "@/lib/puck/config";
import type { Page } from "@/lib/schema/page";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonStyles } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

/** Puck touches `window` on mount — keep it out of the server render entirely. */
const Puck = dynamic(() => import("@measured/puck").then((mod) => mod.Puck), {
  ssr: false,
  loading: () => <CanvasMessage>Loading editor…</CanvasMessage>,
});

/* ────────────────────────────────────────────────────────────────────────────
   Small presentational helpers
   ──────────────────────────────────────────────────────────────────────────── */

function CanvasMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-8 text-sm text-app-fg-muted">
      {children}
    </div>
  );
}

type SaveState =
  | { kind: "idle" }
  | { kind: "busy"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

/**
 * Turns a raw API/provider error into one line a marketer can act on. The generation and
 * edit paths can only fail in a few infrastructure ways (no key, plan/rate limit, model
 * hiccup); a raw provider JSON blob in the chat reads as broken, so map the known classes to
 * plain language and keep everything else short.
 */
function friendlyEditError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("api key") || m.includes("api_key") || m.includes("503") || m.includes("not configured")) {
    return "AI editing isn’t connected yet. Add an API key in the app’s environment to turn it on.";
  }
  if (m.includes("rate_limit") || m.includes("payload too large") || m.includes("413") || m.includes("tokens per minute") || m.includes("429")) {
    return "The AI model hit a size or rate limit on the current plan. This runs on Claude, or on Groq’s paid tier.";
  }
  if (m.includes("validation") || m.includes("schema")) {
    return "The AI produced a change that didn’t fit the page rules and it was rejected. Try rephrasing the request.";
  }
  // Anything else: keep it, but don’t dump a giant JSON blob into the chat.
  return raw.length > 180 ? `${raw.slice(0, 180)}…` : raw;
}

/* ────────────────────────────────────────────────────────────────────────────
   Route
   ──────────────────────────────────────────────────────────────────────────── */

export default function EditorPage({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = use(params);

  /** The authoritative loaded document. Every conversion uses this as its base. */
  const [page, setPage] = useState<Page | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [dirty, setDirty] = useState(false);

  /**
   * Bumping this remounts <Puck>. Puck takes `data` as seed state only — it is
   * uncontrolled after mount — so replacing the canvas after an AI edit means giving
   * it a new key. This is the supported way to swap the document under the editor.
   */
  const [canvasVersion, setCanvasVersion] = useState(0);

  /** Whether the AI chat panel is docked open. */
  const [chatOpen, setChatOpen] = useState(false);

  /**
   * Latest canvas data, held in a ref rather than state: Puck's onChange fires on
   * every keystroke, and re-rendering this route on each one would thrash the editor
   * for no benefit. Nothing renders from it — it is read at publish/AI-edit time.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestDataRef = useRef<any>(null);

  /* ── Load ───────────────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/pages/${encodeURIComponent(pageId)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Could not load page (${res.status})`);

        const body = await res.json();
        const loaded: Page = body.page ?? body;

        if (!cancelled) {
          setPage(loaded);
          latestDataRef.current = null;
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load page");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageId]);

  /* ── Seed data for the canvas ───────────────────────────────────────────── */

  const puckData = useMemo(() => (page ? pageToPuckData(page) : null), [page]);

  /* ── Read the canvas back into a Page ───────────────────────────────────── */

  const currentPage = useCallback((): Page | null => {
    if (!page) return null;
    // No edits yet → the loaded document is already current.
    if (!latestDataRef.current) return page;
    return puckDataToPage(latestDataRef.current, page);
  }, [page]);

  /* ── Publish ────────────────────────────────────────────────────────────── */

  const publish = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (data?: any) => {
      if (!page) return;

      const next = data ? puckDataToPage(data, page) : currentPage();
      if (!next) return;

      setSaveState({ kind: "busy", message: "Publishing…" });

      try {
        const res = await fetch("/api/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page: next }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Publish failed (${res.status})`);
        }

        const body = await res.json().catch(() => ({}));
        // Adopt the server's copy so `updatedAt`/`status` stamps land in the base
        // document — otherwise the next publish would ship stale metadata.
        if (body.page) setPage(body.page as Page);

        setDirty(false);
        setSaveState({ kind: "ok", message: "Published" });
      } catch (error) {
        setSaveState({
          kind: "error",
          message: error instanceof Error ? error.message : "Publish failed",
        });
      }
    },
    [page, currentPage],
  );

  /* ── AI edit pass ───────────────────────────────────────────────────────── */

  const runAiEdit = useCallback(
    async (instruction: string): Promise<AiEditResult> => {
      const base = currentPage();
      if (!base || !instruction.trim()) {
        return { ok: false, message: "Nothing to edit yet." };
      }

      setSaveState({ kind: "busy", message: "Applying AI edit…" });

      try {
        const res = await fetch("/api/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Send the LIVE canvas state, not the last-saved page, so the AI edits what
          // the marketer is actually looking at. Unsaved changes are never discarded.
          body: JSON.stringify({ pageId, instruction, page: base }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // A 503 here is the expected "no API key yet" case — surface its guidance verbatim.
          throw new Error(body.error ?? `AI edit failed (${res.status})`);
        }

        const body = await res.json();
        const edited: Page = body.page ?? body;

        // Swap the document and remount the canvas with the result.
        setPage(edited);
        latestDataRef.current = null;
        setCanvasVersion((v) => v + 1);
        setDirty(true);
        setSaveState({ kind: "ok", message: "AI edit applied — review and publish" });
        return { ok: true, message: "Done — I updated the page. Review it and hit Publish." };
      } catch (error) {
        const raw = error instanceof Error ? error.message : "AI edit failed";
        const friendly = friendlyEditError(raw);
        setSaveState({ kind: "error", message: friendly });
        return { ok: false, message: friendly };
      }
    },
    [pageId, currentPage],
  );

  /* ── Render ─────────────────────────────────────────────────────────────── */

  if (loadError) {
    return <CanvasMessage>{loadError}</CanvasMessage>;
  }

  if (!page || !puckData) {
    return <CanvasMessage>Loading page…</CanvasMessage>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <EditorHeader
        page={page}
        dirty={dirty}
        saveState={saveState}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        onPublish={() => publish()}
      />

      {/* Canvas + docked chat panel share the row below the header. */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1">
          <Puck
            key={canvasVersion}
            config={puckConfig}
            data={puckData}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(data: any) => {
              latestDataRef.current = data;
              setDirty((wasDirty) => wasDirty || true);
            }}
            onPublish={publish}
            headerTitle={page.title}
            headerPath={`/${page.slug}`}
          />
        </div>

        <AiChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          onEdit={runAiEdit}
          busy={saveState.kind === "busy"}
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Header bar
   ──────────────────────────────────────────────────────────────────────────── */

function EditorHeader({
  page,
  dirty,
  saveState,
  chatOpen,
  onToggleChat,
  onPublish,
}: {
  page: Page;
  dirty: boolean;
  saveState: SaveState;
  chatOpen: boolean;
  onToggleChat: () => void;
  onPublish: () => void;
}) {
  const busy = saveState.kind === "busy";

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-app-border bg-app-surface px-4 py-2.5">
      {/* Title */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate font-heading text-sm font-bold tracking-tight text-app-fg">
            {page.title}
          </h1>
          {dirty ? (
            <Badge tone="warning" variant="soft" dot>
              Unsaved
            </Badge>
          ) : null}
        </div>
        <p className="truncate text-xs text-app-fg-muted">
          /{page.slug} · {page.status}
        </p>
      </div>

      {/* Status + actions */}
      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
        {saveState.kind !== "idle" ? (
          <span
            className={cn(
              "text-xs",
              saveState.kind === "error" ? "text-app-danger" : "text-app-fg-muted",
            )}
            role="status"
          >
            {saveState.message}
          </span>
        ) : null}

        {/* Ask AI — opens the chat panel where the page is edited by prompt */}
        <button
          type="button"
          onClick={onToggleChat}
          aria-pressed={chatOpen}
          className={buttonStyles({
            variant: "secondary",
            size: "sm",
            className: cn(
              "gap-1.5",
              chatOpen &&
                "border-app-accent bg-app-accent-soft text-app-accent hover:bg-app-accent-soft hover:text-app-accent",
            ),
          })}
        >
          <Sparkles className="size-4" aria-hidden />
          Ask AI
        </button>

        <ThemeToggle />

        <Link
          href={`/preview/${page.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles({ variant: "ghost", size: "sm" })}
        >
          <ExternalLink className="size-4" aria-hidden />
          Preview
        </Link>

        <Button variant="primary" size="sm" onClick={onPublish} disabled={busy}>
          Publish
        </Button>
      </div>
    </header>
  );
}
