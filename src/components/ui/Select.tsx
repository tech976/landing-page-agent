"use client";

import type * as React from "react";
import { useId } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CONTROL_BASE,
  CONTROL_INVALID,
  CONTROL_VALID,
} from "@/components/ui/Input";
import { FieldError, FieldHint, Label } from "@/components/ui/Label";

/**
 * Native `<select>` with the shared control skin.
 *
 * Deliberately native, not a custom listbox: on Android the OS picker is faster,
 * accessible for free, and does not fight the on-screen keyboard — which matters
 * when 67%+ of the team's own traffic is mobile too.
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.ComponentPropsWithRef<"select"> {
  label?: React.ReactNode;
  requiredMark?: boolean;
  hint?: React.ReactNode;
  error?: string;
  aside?: React.ReactNode;
  /** Convenience alternative to passing `<option>` children. */
  options?: readonly SelectOption[];
  /** Renders a disabled, empty-valued first option. */
  placeholder?: string;
  wrapperClassName?: string;
}

export function Select({
  label,
  requiredMark,
  hint,
  error,
  aside,
  options,
  placeholder,
  className,
  wrapperClassName,
  id,
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {label ? (
        <Label htmlFor={selectId} required={requiredMark} aside={aside}>
          {label}
        </Label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-required={requiredMark || undefined}
          aria-describedby={describedBy}
          className={cn(
            CONTROL_BASE,
            "h-11 cursor-pointer appearance-none pr-10",
            error ? CONTROL_INVALID : CONTROL_VALID,
            className,
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options?.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-fg"
        />
      </div>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {hint ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
    </div>
  );
}
