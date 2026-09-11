import { Link, useRouterState } from "@tanstack/react-router";
import { FIRM_PRIMARY_NAV, isFirmPrimaryPath } from "@/lib/firm-primary-nav";
import { getActiveWorkspace } from "@/lib/workspace-registry";
import { cn } from "@/lib/utils";

/**
 * MVP-NAV shell: Home · Sell · Customers · Stock · Make · Money · Reports · More
 * Layer-3 sub-tabs remain contextual under the active area.
 */
export function WorkspaceHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search });

  if (!isFirmPrimaryPath(pathname)) return null;

  const workspace = getActiveWorkspace(pathname);

  return (
    <div
      className="border-b border-border/80 bg-card/60 backdrop-blur-md px-3 md:px-6 py-2.5 shrink-0 flex flex-col gap-2 no-print relative z-20"
      id="workspace-contextual-bar"
    >
      <nav
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 -mx-1 px-1"
        aria-label="Primary navigation"
      >
        {FIRM_PRIMARY_NAV.map((slot) => {
          const Icon = slot.icon;
          const active = slot.match(pathname);
          return (
            <Link
              key={slot.id}
              to={slot.to as never}
              search={(slot.search ?? undefined) as never}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-2 min-h-12 text-xs font-semibold whitespace-nowrap transition-all border shrink-0 cursor-pointer",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-background/80 text-muted-foreground hover:text-foreground border-border hover:border-gold/40 hover:bg-gold/5",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{slot.word}</span>
            </Link>
          );
        })}
      </nav>

      {workspace && workspace.items.length > 0 ? (
        <nav
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 -mx-1 px-1"
          aria-label={`${workspace.title} navigation`}
        >
          {workspace.items.map((item) => {
            const isActive =
              pathname === item.to ||
              (item.to !== workspace.baseRoute && pathname.startsWith(item.to));
            return (
              <Link
                key={item.id}
                to={item.to as never}
                params={(item.params ?? {}) as never}
                search={(item.search ?? search) as never}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all border shrink-0 cursor-pointer",
                  isActive
                    ? "bg-primary/15 text-foreground border-primary/40 font-semibold"
                    : "bg-background/60 text-muted-foreground hover:text-foreground border-border/70 hover:border-gold/30",
                )}
                title={item.description}
              >
                <span>{item.title}</span>
                {item.badge ? (
                  <span className="rounded bg-muted px-1 py-0.2 text-[9px] font-mono text-muted-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
