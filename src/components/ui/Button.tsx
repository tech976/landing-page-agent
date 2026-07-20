import type * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * App-shell button.
 *
 * DESIGN-SYSTEM §5. Every class is token-driven — no hex, no `bg-[#...]`, no
 * interpolation. Variants resolve through static lookup maps so Tailwind's scanner
 * can see every literal class string.
 *
 * §5.3 is non-negotiable: `sm` (h-11 / 44px) is the floor. No smaller size exists,
 * including in dense internal screens.
 *
 * `buttonStyles()` is exported separately so `next/link` anchors and `<label>`
 * elements can wear the exact same skin without nesting a real <button>.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 shrink-0 " +
  "font-heading font-bold tracking-tight text-center whitespace-nowrap " +
  "select-none cursor-pointer touch-manipulation " +
  "rounded-[var(--radius-cta)] " +
  "transition-[background-color,box-shadow,transform,border-color,color] " +
  "duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-surface " +
  "disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none " +
  "aria-disabled:opacity-50 aria-disabled:pointer-events-none " +
  "active:duration-[var(--dur-instant)]";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary shadow-cta " +
    "hover:bg-primary-hover hover:shadow-cta-hover hover:-translate-y-0.5 " +
    "active:bg-primary-active active:translate-y-0 active:scale-[0.98] active:shadow-cta",
  secondary:
    "bg-surface text-fg-strong border-2 border-border-strong shadow-xs " +
    "hover:bg-surface-sunken hover:border-primary hover:text-primary " +
    "active:bg-muted active:scale-[0.98]",
  ghost:
    "bg-transparent text-fg border-2 border-transparent " +
    "hover:bg-muted hover:text-fg-strong " +
    "active:bg-muted active:scale-[0.98]",
  // `text-surface` is knockout text — the page-background token used as a foreground
  // on a filled danger swatch. Still a token, never a literal white.
  danger:
    "bg-danger text-surface shadow-xs " +
    "hover:brightness-95 hover:-translate-y-0.5 " +
    "active:translate-y-0 active:scale-[0.98]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-11 min-h-11 px-4 gap-1.5 text-sm",
  md: "h-12 min-h-12 px-6 gap-2 text-base",
  lg: "h-14 min-h-14 px-8 gap-2.5 text-lg",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

export function buttonStyles({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    BASE,
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && "w-full",
    className,
  );
}

export interface ButtonProps extends React.ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Swaps the leading icon for a spinner and blocks interaction. */
  loading?: boolean;
  /** Rendered before the label. Ignored while `loading`. */
  icon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/**
 * Square 44×44 icon-only button. DESIGN-SYSTEM §5.3 — icon buttons are `size-11`
 * minimum. `label` is mandatory: an icon with no accessible name is a bug.
 */
export interface IconButtonProps extends Omit<ButtonProps, "children" | "size"> {
  label: string;
  children: React.ReactNode;
}

export function IconButton({
  label,
  variant = "ghost",
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size="sm"
      aria-label={label}
      title={label}
      className={cn("size-11 p-0", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
