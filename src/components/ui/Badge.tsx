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

// The app-chrome namespace has a single accent (product indigo), so `brand` and
// `accent` tones intentionally resolve to the same swatch. `text-app-accent-fg` is
// the knockout white used on filled success/danger. `warning` uses `text-app-fg`
// because there is no app-warning foreground token (warning stays a bright amber in
// both themes — see report flag).
const TONE_CLASSES: Record<BadgeVariant, Record<BadgeTone, string>> = {
  soft: {
    neutral: "bg-app-surface-2 text-app-fg",
    brand: "bg-app-accent-soft text-app-accent",
    accent: "bg-app-accent-soft text-app-accent",
    success: "bg-app-success-soft text-app-success",
    warning: "bg-app-warning-soft text-app-fg",
    danger: "bg-app-danger-soft text-app-danger",
  },
  solid: {
    neutral: "bg-app-border-strong text-app-fg",
    brand: "bg-app-accent text-app-accent-fg",
    accent: "bg-app-accent text-app-accent-fg",
    success: "bg-app-success text-app-accent-fg",
    warning: "bg-app-warning text-app-fg",
    danger: "bg-app-danger text-app-accent-fg",
  },
  outline: {
    neutral: "border border-app-border-strong text-app-fg",
    brand: "border border-app-accent text-app-accent",
    accent: "border border-app-accent text-app-accent",
    success: "border border-app-success text-app-success",
    warning: "border border-app-warning text-app-fg",
    danger: "border border-app-danger text-app-danger",
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
