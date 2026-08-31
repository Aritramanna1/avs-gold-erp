import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type ProgressiveDisclosureProps = {
  title: string;
  children: ReactNode;
  /** When true, section starts expanded (advanced-only flows). */
  defaultOpen?: boolean;
  className?: string;
  hint?: string;
};

/**
 * Collapsible field group — show basics first, advanced options on demand.
 * Uses native `<details>` for keyboard + screen-reader support.
 */
export function ProgressiveDisclosure({
  title,
  children,
  defaultOpen = false,
  className,
  hint,
}: ProgressiveDisclosureProps) {
  return (
    <details
      className={cn("rounded-md border border-border bg-muted/20 group", className)}
      open={defaultOpen || undefined}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 rounded-md [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      {hint ? <p className="px-3 pt-1 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="space-y-3 border-t border-border/60 px-3 pb-3 pt-2">{children}</div>
    </details>
  );
}
