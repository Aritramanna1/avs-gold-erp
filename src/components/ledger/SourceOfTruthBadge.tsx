import { cn } from "@/lib/utils";

type SourceOfTruthBadgeProps = {
  variant?: "ledger" | "operational" | "report";
  className?: string;
};

/** Visual distinction: Ledger = authoritative; operational modules reconcile to it. Hidden in production tenant UI. */
export function SourceOfTruthBadge({
  variant = "ledger",
  className,
}: SourceOfTruthBadgeProps) {
  const showInternal =
    import.meta.env.DEV ||
    import.meta.env.VITE_APP_ENV === "staging" ||
    import.meta.env.VITE_SHOW_INTERNAL_LABELS === "1";
  if (!showInternal) return null;

  if (variant === "ledger") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400",
          className,
        )}
      >
        Ledger · Source of Truth
      </span>
    );
  }
  if (variant === "operational") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border border-muted-foreground/30 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
          className,
        )}
      >
        Operational · reconciles to Ledger
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400",
        className,
      )}
    >
      Report · derived from Ledger
    </span>
  );
}
