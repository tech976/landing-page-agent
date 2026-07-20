import type * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Wizard progress indicator.
 *
 * Mobile-first by necessity: seven labelled steps cannot fit on a 360px screen, so
 * below `md` this collapses to a determinate progress bar plus "Step 3 of 7 ·
 * Offer". The full rail only appears once there is room for it.
 *
 * A step is reachable when it has been visited (`furthest`) — you may jump back to
 * fix Brand from Step 6, but you cannot skip ahead past unvalidated steps.
 */

export interface StepDefinition {
  id: string;
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: readonly StepDefinition[];
  /** Zero-based index of the active step. */
  current: number;
  /** Zero-based index of the furthest step reached. Controls reachability. */
  furthest?: number;
  onStepSelect?: (index: number) => void;
  className?: string;
}

export function Stepper({
  steps,
  current,
  furthest = current,
  onStepSelect,
  className,
}: StepperProps) {
  const total = steps.length;
  const active = steps[current];
  const percent = total > 1 ? (current / (total - 1)) * 100 : 100;

  return (
    <nav aria-label="Brief progress" className={className}>
      {/* ── Mobile: counter + determinate bar ─────────────────────────── */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-heading text-base font-bold tracking-tight text-fg-strong">
            {active?.title}
          </p>
          <p className="font-body text-xs font-semibold tracking-wide text-muted-fg tabular-nums">
            Step {current + 1} of {total}
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={current + 1}
          aria-valuetext={`Step ${current + 1} of ${total}: ${active?.title ?? ""}`}
          className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-muted"
        >
          <div
            className="h-full rounded-pill bg-primary transition-[width] duration-[var(--dur-base)] ease-[var(--ease-out-soft)]"
            style={{ width: `${Math.max(percent, 4)}%` }}
          />
        </div>
        {active?.description ? (
          <p className="mt-2 font-body text-xs text-muted-fg">{active.description}</p>
        ) : null}
      </div>

      {/* ── Desktop: full rail ────────────────────────────────────────── */}
      <ol className="hidden md:flex md:items-center md:gap-1">
        {steps.map((step, index) => {
          const isComplete = index < current;
          const isCurrent = index === current;
          const isReachable = index <= furthest;
          const isLast = index === total - 1;

          return (
            <li key={step.id} className="flex flex-1 items-center gap-1 last:flex-none">
              <StepButton
                step={step}
                index={index}
                isComplete={isComplete}
                isCurrent={isCurrent}
                isReachable={isReachable}
                onStepSelect={onStepSelect}
              />
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "h-0.5 min-w-4 flex-1 rounded-pill transition-colors duration-[var(--dur-base)]",
                    index < current ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface StepButtonProps {
  step: StepDefinition;
  index: number;
  isComplete: boolean;
  isCurrent: boolean;
  isReachable: boolean;
  onStepSelect?: (index: number) => void;
}

function StepButton({
  step,
  index,
  isComplete,
  isCurrent,
  isReachable,
  onStepSelect,
}: StepButtonProps) {
  const interactive = Boolean(onStepSelect) && isReachable && !isCurrent;

  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          "font-heading text-xs font-bold tabular-nums",
          "transition-colors duration-[var(--dur-fast)]",
          isCurrent && "bg-primary text-on-primary ring-4 ring-ring/30",
          isComplete && "bg-primary text-on-primary",
          !isCurrent && !isComplete && "bg-muted text-muted-fg",
        )}
      >
        {isComplete ? <Check className="size-3.5" /> : index + 1}
      </span>
      <span
        className={cn(
          "font-body text-sm font-semibold tracking-tight whitespace-nowrap",
          isCurrent ? "text-fg-strong" : isReachable ? "text-fg" : "text-muted-fg",
        )}
      >
        {step.title}
      </span>
    </>
  );

  const shared = cn(
    "flex items-center gap-2 rounded-md px-2 py-1.5",
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50",
  );

  if (!interactive) {
    return (
      <span
        className={cn(shared, !isReachable && "cursor-not-allowed")}
        aria-current={isCurrent ? "step" : undefined}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onStepSelect?.(index)}
      className={cn(shared, "cursor-pointer hover:bg-muted")}
      title={`Go back to ${step.title}`}
    >
      {content}
    </button>
  );
}
