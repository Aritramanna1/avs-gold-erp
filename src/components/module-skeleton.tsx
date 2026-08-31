import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic module loading skeleton — page header, KPI row, table — matches AVS erp-surface tokens.
 */
export function ModuleSkeleton() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 bg-gold/10" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28 shrink-0 rounded-sm" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="erp-surface rounded-none p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      <div className="ornexa-panel rounded-sm overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-3 flex gap-4 erp-table">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1 bg-gold/10" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, r) => (
          <div key={r} className="border-t border-border px-4 py-3 flex gap-4 items-center">
            {Array.from({ length: 5 }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
