"use client";

import type * as React from "react";
import { useId } from "react";

import { cn } from "@/lib/utils";
import { FieldError, FieldHint, Label } from "@/components/ui/Label";

/**
 * Text input with an optional label / hint / error shell.
 *
 * Height is `h-11` (44px) — DESIGN-SYSTEM §0.4 applies to form controls, not just
 * buttons. `text-base` on mobile is also load-bearing: iOS Safari zooms the viewport
 * when a focused input renders below 16px, which wrecks a mobile form.
 *
 * Client component: it calls `useId` to associate label + control when no explicit
 * `id` is supplied.
 */

export const CONTROL_BASE =
  "w-full rounded-md border bg-surface px-3 " +
  "font-body text-base text-fg placeholder:text-muted-fg " +
  "transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-surface-sunken " +
  "read-only:bg-surface-sunken";

export const CONTROL_VALID = "border-border hover:border-border-strong focus-visible:border-primary";
export const CONTROL_INVALID = "border-danger focus-visible:border-danger focus-visible:ring-danger/30";

// `prefix` is omitted from the base props deliberately: React's HTMLAttributes
// already declares it as the RDFa string attribute, and we want a ReactNode.
export interface InputProps
  extends Omit<React.ComponentPropsWithRef<"input">, "size" | "prefix"> {
  label?: React.ReactNode;
  /** Marks the label and sets aria-required. Does not add native `required`. */
  requiredMark?: boolean;
  hint?: React.ReactNode;
  /** Non-empty string switches the control into its invalid skin. */
  error?: string;
  /** Right-aligned helper beside the label, e.g. "Optional" or "0/60". */
  aside?: React.ReactNode;
  /** Leading adornment, e.g. a ₹ symbol or an icon. */
  prefix?: React.ReactNode;
  wrapperClassName?: string;
}

export function Input({
  label,
  requiredMark,
  hint,
  error,
  aside,
  prefix,
  className,
  wrapperClassName,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const control = (
    <input
      id={inputId}
      aria-invalid={error ? true : undefined}
      aria-required={requiredMark || undefined}
      aria-describedby={describedBy}
      className={cn(
        CONTROL_BASE,
        "h-11",
        error ? CONTROL_INVALID : CONTROL_VALID,
        prefix && "pl-8",
        className,
      )}
      {...props}
    />
  );

  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {label ? (
        <Label htmlFor={inputId} required={requiredMark} aside={aside}>
          {label}
        </Label>
      ) : null}
      {prefix ? (
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-body text-base text-muted-fg"
          >
            {prefix}
          </span>
          {control}
        </div>
      ) : (
        control
      )}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
    </div>
  );
}
