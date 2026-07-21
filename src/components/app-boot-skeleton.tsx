import { Skeleton } from "@/components/ui/skeleton";
import { ModuleSkeleton } from "@/components/module-skeleton";

/**
 * Full-screen boot placeholder shaped like the real app shell — sidebar rail,
 * top header, and a module body — shown while the session restores and the
 * critical (settings/branch) load runs. Replaces the bare spinning circle so
 * the app never flashes a blank white screen or an indefinite loader; the real
 * shell fades in over the same silhouette once ready.
 */
export function AppBootSkeleton() {
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar rail */}
      <div className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar p-4 gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/60 flex items-center gap-4 px-4 md:px-8">
          <Skeleton className="h-8 w-40 rounded-full" />
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
        </header>
        <main className="flex-1 overflow-hidden">
          <ModuleSkeleton />
        </main>
      </div>
    </div>
  );
}
