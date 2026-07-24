import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Form label. Token-driven, no hardcoded colour.
 *
 * `required` renders a visible marker plus a screen-reader word — a bare asterisk
 * is announced as "star" or skipped entirely by most screen readers.
 */
export interface LabelProps extends React.ComponentPropsWithRef<"label"> {
  required?: boolean;
  /** Right-aligned helper, e.g. a character counter or "Optional". */
  aside?: React.ReactNode;
}

export function Label({
  required = false,
  aside,
  className,
  children,
  ...props
}: LabelProps) {
  return (
    <label
      className={cn(
        "flex items-baseline justify-between gap-3",
        "font-body text-sm font-semibold tracking-tight text-app-fg",
        className,
      )}
      {...props}
    >
      <span>
        {children}
        {required ? (
          <>
            <span aria-hidden className="ml-0.5 text-app-danger">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </span>
      {aside ? (
        <span className="font-body text-xs font-normal text-app-fg-muted">{aside}</span>
      ) : null}
    </label>
  );
}

/** Small muted helper line, sits under a control. */
export function FieldHint({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<"p">) {
  return (
    <p className={cn("font-body text-xs text-app-fg-muted", className)} {...props}>
      {children}
    </p>
  );
}

/** Validation message. `role="alert"` so it is announced when it appears. */
export function FieldError({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<"p">) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn("font-body text-xs font-medium text-app-danger", className)}
      {...props}
    >
      {children}
    </p>
  );
}
