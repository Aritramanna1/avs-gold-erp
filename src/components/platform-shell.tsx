/**
 * Platform Owner — collapsible sidebar with unique active states per route.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import {
  findNavGroupForItem,
  isPlatformNavItemActive,
  normalizePlatformSearch,
  platformOwnerNav,
  type PlatformNavItem,
} from "@/lib/platform-owner-nav";
import { PlatformAccountMenu } from "@/components/platform/PlatformAccountMenu";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ornexa-platform-nav-expanded";

function loadExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  const defaults: Record<string, boolean> = {};
  for (const g of platformOwnerNav) defaults[g.id] = true;
  return defaults;
}

export function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({
    select: (s) => normalizePlatformSearch(s.location.search as Record<string, unknown>),
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded);

  const activeItemId = useMemo(() => {
    for (const group of platformOwnerNav) {
      for (const item of group.items) {
        if (isPlatformNavItemActive(item, pathname, search)) return item.id;
      }
    }
    return null;
  }, [pathname, search]);

  useEffect(() => {
    if (!activeItemId) return;
    const groupId = findNavGroupForItem(activeItemId);
    if (!groupId) return;
    setExpanded((prev) => {
      if (prev[groupId]) return prev;
      const next = { ...prev, [groupId]: true };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [activeItemId]);

  function toggleGroup(groupId: string) {
    setExpanded((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card print:hidden">
        <div className="p-4 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            AVS Platform
          </p>
          <p className="font-serif text-sm font-bold text-gold">Owner Console</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {platformOwnerNav.map((group) => {
            const isOpen = expanded[group.id] !== false;
            return (
              <div key={group.id} className="rounded-md">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40"
                >
                  <span>{group.title}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      isOpen ? "rotate-0" : "-rotate-90",
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="mt-0.5 space-y-0.5 pb-1">
                    {group.items.map((item) => (
                      <NavLink key={item.id} item={item} active={activeItemId === item.id} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <PlatformAccountMenu />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-border bg-card px-4 py-3 lg:hidden print:hidden shrink-0">
          <p className="font-serif font-bold text-gold text-sm">Platform Owner</p>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full">{children}</main>
        <div className="lg:hidden border-t border-border p-3 print:hidden">
          <PlatformAccountMenu />
        </div>
      </div>
    </div>
  );
}

function NavLink({ item, active }: { item: PlatformNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.pathname}
      search={item.search as never}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition",
        active
          ? "bg-gold/15 text-gold ring-1 ring-gold/25"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
