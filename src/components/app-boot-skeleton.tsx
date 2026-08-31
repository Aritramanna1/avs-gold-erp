import { Skeleton } from "@/components/ui/skeleton";
import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * Full-screen boot placeholder shaped like the real app shell — header,
 * offline menu strip, and module body — shown while session restores.
 */
export function AppBootSkeleton() {
  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground overflow-hidden">
      <header className="h-14 shrink-0 border-b border-border bg-card flex items-center gap-3 px-4 md:px-6">
        <Skeleton className="h-8 w-8 rounded-sm md:hidden" />
        <Skeleton className="h-6 w-32 rounded-sm" />
        <Skeleton className="hidden md:block h-7 w-36 rounded-sm border border-gold/30 bg-gold/5" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-sm" />
        </div>
      </header>
      <div className="hidden md:block h-10 shrink-0 border-b border-border bg-muted/20 px-4 flex items-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-sm" />
        ))}
      </div>
      <main className="flex-1 overflow-hidden">
        <ModuleSkeleton />
      </main>
    </div>
  );
}
