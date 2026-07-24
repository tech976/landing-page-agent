import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Card primitive. DESIGN-SYSTEM §6.4.
 *
 * No hooks — safe to render from a Server Component (the dashboard does).
 */

export type CardVariant = "raised" | "flat" | "outline";

const CARD_VARIANTS: Record<CardVariant, string> = {
  raised: "bg-app-surface border border-app-border shadow-card",
  flat: "bg-app-surface-2 border border-app-border",
  outline: "bg-app-surface border border-app-border",
};

export interface CardProps extends React.ComponentPropsWithRef<"div"> {
  variant?: CardVariant;
  /** §6.4 card-hover. Only for cards that are themselves a link target. */
  interactive?: boolean;
}

export function Card({
  variant = "raised",
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden",
        CARD_VARIANTS[variant],
        interactive &&
          "transition-[transform,box-shadow] duration-[var(--dur-base)] " +
            "ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:shadow-lg " +
            "focus-within:-translate-y-1 focus-within:shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-app-border px-4 py-3 sm:px-6 sm:py-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<"h3">) {
  return (
    <h3
      className={cn("font-heading text-xl font-bold tracking-tight text-app-fg", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<"p">) {
  return (
    <p className={cn("font-body text-sm leading-normal text-app-fg-muted", className)} {...props}>
      {children}
    </p>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<"div">) {
  return (
    <div className={cn("flex flex-col gap-3 p-4 sm:p-6", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-t border-app-border px-4 py-3 sm:px-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
