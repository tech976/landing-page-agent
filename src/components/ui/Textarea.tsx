"use client";

import type * as React from "react";
import { useId } from "react";

import { cn } from "@/lib/utils";
import {
  CONTROL_BASE,
  CONTROL_INVALID,
  CONTROL_VALID,
} from "@/components/ui/Input";
import { FieldError, FieldHint, Label } from "@/components/ui/Label";

/**
 * Multi-line input. Shares the exact control skin with `Input` so a form built from
 * both reads as one system.
 *
 * `counter` renders a live "used / max" figure beside the label — the brief schema
 * caps nearly every free-text field (description 2000, adBody 600, terms 300), and
 * a marketer should see the ceiling before Zod rejects the step.
 */
export interface TextareaProps extends React.ComponentPropsWithRef<"textarea"> {
  label?: React.ReactNode;
  requiredMark?: boolean;
  hint?: React.ReactNode;
  error?: string;
  aside?: React.ReactNode;
  /** Show a `n/maxLength` counter beside the label. Requires `maxLength`. */
  counter?: boolean;
  wrapperClassName?: string;
}

export function Textarea({
  label,
  requiredMark,
  hint,
  error,
  aside,
  counter = false,
  className,
  wrapperClassName,
  id,
  rows = 4,
  maxLength,
  value,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const used = typeof value === "string" ? value.length : 0;
  const showCounter = counter && typeof maxLength === "number";
  const overLimit = showCounter && used > maxLength;

  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {label ? (
        <Label
          htmlFor={textareaId}
          required={requiredMark}
          aside={
            showCounter ? (
              <span className={cn("tabular-nums", overLimit && "text-danger-fg")}>
                {used}/{maxLength}
              </span>
            ) : (
              aside
            )
          }
        >
          {label}
        </Label>
      ) : null}
      <textarea
        id={textareaId}
        rows={rows}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-required={requiredMark || undefined}
        aria-describedby={describedBy}
        className={cn(
          CONTROL_BASE,
          "resize-y py-2.5 leading-relaxed",
          error ? CONTROL_INVALID : CONTROL_VALID,
          className,
        )}
        {...props}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
    </div>
  );
}
