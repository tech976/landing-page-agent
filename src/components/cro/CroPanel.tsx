"use client";

/**
 * Landing Agent — the editor's CRO panel.
 *
 * Makes the product's conversion-optimisation claim visible and provable: a score, a
 * category breakdown, and a prioritised, evidence-cited list of what's strong and what could
 * lift. It recomputes from the LIVE canvas (deterministic, key-free — see src/lib/cro/audit)
 * so a marketer watches the number move as they edit.
 *
 * Each improvable finding carries a "Fix with AI" button that pipes the finding's fix straight
 * into the same /api/edit flow the chat uses — audit → one-click fix → re-check.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Sparkles, TriangleAlert, X, XCircle } from "lucide-react";

import type { CroFinding, CroReport } from "@/lib/cro/audit";
import { CroScoreRing } from "@/components/cro/CroScoreRing";

const STATUS_ICON = {
  pass: { Icon: Check, cls: "text-app-success" },
  warn: { Icon: TriangleAlert, cls: "text-app-warning" },
  fail: { Icon: XCircle, cls: "text-app-danger" },
} as const;

const IMPACT_LABEL: Record<CroFinding["impact"], string> = {
  high: "High impact",
  medium: "Medium",
  low: "Low",
};

export function CroPanel({
  open,
  onClose,
  computeReport,
  onFix,
  aiBusy,
}: {
  open: boolean;
  onClose: () => void;
  /** Reads the live canvas and returns a fresh audit — called on open and on Re-check. */
  computeReport: () => CroReport | null;
  /** Pipe a finding's fix into the AI edit flow. Undefined disables the "Fix with AI" buttons. */
  onFix?: (instruction: string) => void | Promise<void>;
  /** True while an AI edit is in flight. */
  aiBusy: boolean;
}) {
  const [report, setReport] = useState<CroReport | null>(null);
  const [showPassed, setShowPassed] = useState(false);

  const recheck = useCallback(() => setReport(computeReport()), [computeReport]);

  // Fresh audit whenever the panel opens.
  useEffect(() => {
    if (open) recheck();
  }, [open, recheck]);

  const improvable = report?.findings.filter((f) => f.status !== "pass") ?? [];
  const passed = report?.findings.filter((f) => f.status === "pass") ?? [];

  return (
    <aside
      aria-label="CRO score"
      aria-hidden={!open}
      className={`flex h-full w-[380px] max-w-[88vw] shrink-0 flex-col border-l border-app-border bg-app-surface transition-[margin] duration-200 ease-out ${
        open ? "mr-0" : "-mr-[380px] max-[440px]:-mr-[88vw]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-app-border px-4 py-3">
        <div>
          <p className="font-heading text-sm font-bold tracking-tight text-app-fg">CRO Score</p>
          <p className="text-[11px] text-app-fg-muted">Evidence-based conversion audit</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={recheck}
            aria-label="Re-check current canvas"
            title="Re-check current canvas"
            className="grid size-8 place-items-center rounded-md text-app-fg-muted transition-colors hover:bg-app-surface-2 hover:text-app-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-ring/60"
          >
            <RefreshCw className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close CRO score"
            className="grid size-8 place-items-center rounded-md text-app-fg-muted transition-colors hover:bg-app-surface-2 hover:text-app-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-ring/60"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {report === null ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-app-fg-muted">
          Nothing to score yet.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Score hero */}
          <div className="flex items-center gap-4 border-b border-app-border px-4 py-5">
            <CroScoreRing score={report.score} grade={report.grade} size="lg" />
            <div className="min-w-0">
              <p className="font-heading text-lg font-extrabold tracking-tight text-app-fg">
                {report.grade}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-app-fg-muted">{report.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
                <span className="rounded-full bg-app-success-soft px-2 py-0.5 text-app-success">
                  {report.counts.pass} pass
                </span>
                {report.counts.warn > 0 ? (
                  <span className="rounded-full bg-app-warning-soft px-2 py-0.5 text-app-warning-fg">
                    {report.counts.warn} to improve
                  </span>
                ) : null}
                {report.counts.fail > 0 ? (
                  <span className="rounded-full bg-app-danger-soft px-2 py-0.5 text-app-danger">
                    {report.counts.fail} missing
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Category bars */}
          <div className="space-y-2 border-b border-app-border px-4 py-4">
            {report.categories.map((c) => (
              <div key={c.category} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-[11px] text-app-fg-muted">
                  {c.category}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-app-surface-2">
                  <div
                    className={`h-full rounded-full ${
                      c.score >= 80
                        ? "bg-app-success"
                        : c.score >= 60
                          ? "bg-app-accent"
                          : "bg-app-warning"
                    }`}
                    style={{ width: `${c.score}%` }}
                  />
                </div>
                <span className="w-7 shrink-0 text-right text-[11px] font-semibold tabular-nums text-app-fg">
                  {c.score}
                </span>
              </div>
            ))}
          </div>

          {/* Improvable findings first */}
          <div className="px-4 py-4">
            {improvable.length > 0 ? (
              <>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-app-fg-muted">
                  Wins available ({improvable.length})
                </p>
                <ul className="space-y-2">
                  {improvable.map((f) => (
                    <FindingRow key={f.id} finding={f} onFix={onFix} aiBusy={aiBusy} />
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-app-success-soft px-3 py-2.5 text-sm text-app-success">
                <Check className="size-4 shrink-0" aria-hidden />
                Every check passes. This page follows the conversion playbook.
              </div>
            )}

            {passed.length > 0 ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowPassed((v) => !v)}
                  className="text-[11px] font-medium text-app-fg-muted hover:text-app-fg"
                >
                  {showPassed ? "Hide" : "Show"} {passed.length} passing checks
                </button>
                {showPassed ? (
                  <ul className="mt-2 space-y-2">
                    {passed.map((f) => (
                      <FindingRow key={f.id} finding={f} onFix={undefined} aiBusy={aiBusy} />
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </aside>
  );
}

function FindingRow({
  finding,
  onFix,
  aiBusy,
}: {
  finding: CroFinding;
  onFix?: (instruction: string) => void | Promise<void>;
  aiBusy: boolean;
}) {
  const { Icon, cls } = STATUS_ICON[finding.status];
  const lift = finding.evidence?.liftRangePct;

  return (
    <li className="rounded-lg border border-app-border bg-app-surface p-3">
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 size-4 shrink-0 ${cls}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-app-fg">{finding.title}</p>
            {finding.impact !== "low" ? (
              <span className="rounded-full bg-app-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-app-fg-muted">
                {IMPACT_LABEL[finding.impact]}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{finding.detail}</p>

          {lift ? (
            <p className="mt-1.5 text-[11px] text-app-fg-muted">
              Evidence:{" "}
              <span className="font-medium text-app-fg">
                +{lift[0]}–{lift[1]}%
              </span>{" "}
              <span className="opacity-80">({finding.evidence?.source})</span>
            </p>
          ) : finding.evidence ? (
            <p className="mt-1.5 text-[11px] text-app-fg-muted opacity-80">
              {finding.evidence.source}
            </p>
          ) : null}

          {finding.status !== "pass" && finding.fix && onFix ? (
            <button
              type="button"
              disabled={aiBusy}
              onClick={() => void onFix(finding.fix as string)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-app-accent bg-app-accent-soft px-2.5 py-1 text-xs font-semibold text-app-accent transition-colors hover:bg-app-accent hover:text-app-accent-fg disabled:opacity-50"
            >
              <Sparkles className="size-3.5" aria-hidden />
              Fix with AI
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
