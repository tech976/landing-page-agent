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
      className={`flex h-full w-[360px] max-w-[85vw] shrink-0 flex-col border-l border-neutral-200 bg-white transition-[margin] duration-200 ease-out ${
        open ? "mr-0" : "-mr-[360px] max-[420px]:-mr-[85vw]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="grid size-6 place-items-center rounded-md bg-neutral-900 text-[13px] text-white">
            ✦
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900">AI Assistant</p>
            <p className="text-[11px] text-neutral-500">Edit this page by prompt</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI assistant"
          className="grid size-7 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          ✕
        </button>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              Describe a change and I&rsquo;ll update the page. I edit what you&rsquo;re looking at
              right now — review the result and hit <span className="font-medium">Publish</span>{" "}
              when you&rsquo;re happy.
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
              Try one
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(p)}
                  className="rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50"
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
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-neutral-900 px-3 py-2 text-sm text-white">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div
                  className={`max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm ${
                    m.tone === "error"
                      ? "bg-red-50 text-red-700"
                      : "bg-neutral-100 text-neutral-800"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ),
          )
        )}

        {busy ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-neutral-100 px-3 py-2.5">
              <span className="size-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-neutral-400" />
            </div>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div className="border-t border-neutral-200 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-neutral-300 bg-white p-2 focus-within:border-neutral-500">
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
            className="min-h-0 flex-1 resize-none bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 disabled:opacity-50"
            aria-label="Message the AI assistant"
          />
          <button
            type="button"
            onClick={() => void send(draft)}
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            ↑
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-neutral-400">
          Enter to send · Shift+Enter for a new line. Changes apply to your live canvas.
        </p>
      </div>
    </aside>
  );
}
