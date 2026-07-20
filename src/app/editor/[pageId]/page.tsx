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

import "@measured/puck/puck.css";

import { pageToPuckData, puckDataToPage } from "@/lib/puck/adapter";
import { puckConfig } from "@/lib/puck/config";
import type { Page } from "@/lib/schema/page";

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
    <div className="flex h-full w-full items-center justify-center p-8 text-sm text-neutral-500">
      {children}
    </div>
  );
}

type SaveState =
  | { kind: "idle" }
  | { kind: "busy"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

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
    async (instruction: string) => {
      const base = currentPage();
      if (!base || !instruction.trim()) return;

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
      } catch (error) {
        setSaveState({
          kind: "error",
          message: error instanceof Error ? error.message : "AI edit failed",
        });
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
        onPublish={() => publish()}
        onAiEdit={runAiEdit}
      />

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
  onPublish,
  onAiEdit,
}: {
  page: Page;
  dirty: boolean;
  saveState: SaveState;
  onPublish: () => void;
  onAiEdit: (instruction: string) => void | Promise<void>;
}) {
  const [instruction, setInstruction] = useState("");
  const busy = saveState.kind === "busy";

  const submitInstruction = async () => {
    if (!instruction.trim() || busy) return;
    await onAiEdit(instruction);
    setInstruction("");
  };

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
      {/* Title */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-neutral-900">{page.title}</h1>
          {dirty ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Unsaved
            </span>
          ) : null}
        </div>
        <p className="truncate text-xs text-neutral-500">
          /{page.slug} · {page.status}
        </p>
      </div>

      {/* AI edit box */}
      <div className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:ml-4 sm:w-auto sm:flex-1">
        <input
          type="text"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submitInstruction();
            }
          }}
          disabled={busy}
          placeholder="Ask AI to edit — e.g. “make the hero headline shorter and add a COD trust chip”"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-500 disabled:opacity-50"
          aria-label="AI edit instruction"
        />
        <button
          type="button"
          onClick={() => void submitInstruction()}
          disabled={busy || !instruction.trim()}
          className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          Apply
        </button>
      </div>

      {/* Status + actions */}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {saveState.kind !== "idle" ? (
          <span
            className={
              saveState.kind === "error"
                ? "text-xs text-red-600"
                : "text-xs text-neutral-500"
            }
            role="status"
          >
            {saveState.message}
          </span>
        ) : null}

        <Link
          href={`/preview/${page.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          Preview
        </Link>

        <button
          type="button"
          onClick={onPublish}
          disabled={busy}
          className="rounded-md bg-neutral-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Publish
        </button>
      </div>
    </header>
  );
}
