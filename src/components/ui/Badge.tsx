import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Status / metadata pill.
 *
 * Tones resolve through a static lookup map — never `bg-${tone}` interpolation,
 * which Tailwind's scanner cannot see (DESIGN-SYSTEM §2.4a).
 *
 * No hooks — safe inside a Server Component.
 */

export type BadgeTone = "neutral" | "brand" | "accent" | "success" | "warning" | "danger";
export type BadgeVariant = "soft" | "solid" | "outline";

const TONE_CLASSES: Record<BadgeVariant, Record<BadgeTone, string>> = {
  soft: {
    neutral: "bg-muted text-fg",
    brand: "bg-primary-soft text-primary",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success-fg",
    warning: "bg-warning-soft text-warning-fg",
    danger: "bg-danger-soft text-danger-fg",
  },
  solid: {
    neutral: "bg-secondary text-on-secondary",
    brand: "bg-primary text-on-primary",
    accent: "bg-accent text-on-accent",
    success: "bg-success text-surface",
    warning: "bg-warning text-warning-fg",
    danger: "bg-danger text-surface",
  },
  outline: {
    neutral: "border border-border-strong text-fg",
    brand: "border border-primary text-primary",
    accent: "border border-accent text-accent",
    success: "border border-success text-success-fg",
    warning: "border border-warning text-warning-fg",
    danger: "border border-danger text-danger-fg",
  },
};

export interface BadgeProps extends React.ComponentPropsWithRef<"span"> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  /** Adds a small leading dot in the current text colour. */
  dot?: boolean;
}

export function Badge({
  tone = "neutral",
  variant = "soft",
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1",
        "font-body text-xs font-semibold tracking-wide whitespace-nowrap",
        TONE_CLASSES[variant][tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}
