"use client";

/**
 * Landing Agent — the editor's AI chat panel.
 *
 * A docked, conversational way to edit the page by prompt. It is deliberately thin: it owns
 * only the message transcript and the composer. The actual edit — send the live canvas to
 * /api/edit, apply the returned page, remount the Puck canvas — lives in the editor route and
 * is handed in as `onEdit`. That keeps ONE code path for AI edits (the header button and this
 * panel both call it) and ONE source of truth for the live document.
 *
 * The transcript is a UI convenience, not conversation memory: each edit is applied to the
 * CURRENT page, so the model always sees the latest canvas, not a replayed chat history. That
 * is what makes "make it shorter" then "now add a COD badge" compose correctly — each prompt
 * edits the result of the last.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface AiEditResult {
  ok: boolean;
  /** A short line to show back in the chat — a confirmation or the error reason. */
  message: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tone?: "ok" | "error";
}

const EXAMPLE_PROMPTS = [
  "Make the hero headline shorter and punchier",
  "Add a Cash on Delivery trust badge",
  "Change the offer to Buy 2 Get 1 Free",
  "Make the whole tone more premium and calm",
  "Add an FAQ about delivery time to metro cities",
];

let messageSeq = 0;
const nextId = () => `msg_${++messageSeq}`;

export function AiChatPanel({
  open,
  onClose,
  onEdit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  /** Runs one AI edit against the live page. Resolves with a line to show in the transcript. */
  onEdit: (instruction: string) => Promise<AiEditResult>;
  /** True while any edit/publish is in flight — disables the composer. */
  busy: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message and the composer in view as the transcript grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Focus the composer whenever the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (text: string) => {
    const instruction = text.trim();
    if (!instruction || busy) return;

    setMessages((prev) => [...prev, { id: nextId(), role: "user", text: instruction }]);
    setDraft("");

    const result = await onEdit(instruction);

    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "assistant",
        text: result.message,
        tone: result.ok ? "ok" : "error",
      },
    ]);
  };

  return (
    <aside
      aria-label="AI assistant"
      aria-hidden={!open}
      className={cn(
        // Overlays the right edge of the canvas (absolute) instead of taking flex width, so
        // opening it never squeezes the Puck editor. The slide is an INLINE transform, not a
        // Tailwind translate-x class — the utility class was not being generated reliably in
        // this build, which left the closed panel on-screen. Inline style always applies.
        "absolute inset-y-0 right-0 z-30 flex w-[380px] max-w-[92vw] flex-col border-l border-app-border bg-app-surface shadow-2xl",
        !open && "pointer-events-none",
      )}
      style={{
        transform: open ? "translateX(0)" : "translateX(101%)",
        transition: "transform 200ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-lg bg-app-accent text-app-accent-fg shadow-sm"
          >
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="font-heading text-sm font-bold tracking-tight text-app-fg">AI Assistant</p>
            <p className="text-[11px] text-app-fg-muted">Edit this page by prompt</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI assistant"
          className="grid size-8 place-items-center rounded-md text-app-fg-muted transition-colors hover:bg-app-surface-2 hover:text-app-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-ring/60"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-app-fg-muted">
              Describe a change and I&rsquo;ll update the page. I edit what you&rsquo;re looking at
              right now — review the result and hit{" "}
              <span className="font-medium text-app-fg">Publish</span> when you&rsquo;re happy.
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-app-fg-muted">
              Try one
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(p)}
                  className="rounded-lg border border-app-border bg-app-surface px-3 py-2 text-left text-sm text-app-fg transition-colors hover:border-app-accent hover:bg-app-accent-soft hover:text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-ring/60 disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-app-accent px-3 py-2 text-sm text-app-accent-fg shadow-sm">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl rounded-bl-sm border px-3 py-2 text-sm",
                    m.tone === "error"
                      ? "border-app-danger/30 bg-app-danger-soft text-app-danger"
                      : "border-app-border bg-app-surface-2 text-app-fg",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ),
          )
        )}

        {busy ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-app-border bg-app-surface-2 px-3 py-2.5">
              <span className="size-1.5 animate-bounce rounded-full bg-app-fg-muted [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-app-fg-muted [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-app-fg-muted" />
            </div>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div className="border-t border-app-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-app-border-strong bg-app-surface-2 p-2 transition-colors focus-within:border-app-accent focus-within:ring-2 focus-within:ring-app-ring/40">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            disabled={busy}
            rows={2}
            placeholder="Ask AI to change the page…"
            className="min-h-0 flex-1 resize-none bg-transparent text-sm text-app-fg outline-none placeholder:text-app-fg-muted disabled:opacity-50"
            aria-label="Message the AI assistant"
          />
          <button
            type="button"
            onClick={() => void send(draft)}
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-app-accent text-app-accent-fg transition-colors hover:bg-app-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-ring/60 disabled:opacity-40"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-app-fg-muted">
          Enter to send · Shift+Enter for a new line. Changes apply to your live canvas.
        </p>
      </div>
    </aside>
  );
}
