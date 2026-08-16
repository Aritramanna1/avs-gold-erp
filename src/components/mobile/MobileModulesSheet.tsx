import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, ChevronRight, LayoutGrid } from "lucide-react";
import { navigationGroups, itemRouteKey } from "@/lib/navigation-groups";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/lib/settings-store";
import { hasRoutePermission } from "@/lib/permissions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Full ERP module browser — grouped navigation on mobile. */
export function MobileModulesSheet({
  triggerClassName,
  onNavigate,
}: {
  triggerClassName?: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const role = useSettings((s) => s.currentUserRole);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return navigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!hasRoutePermission(role, item.to)) return false;
          if (!q) return true;
          return (
            item.label.toLowerCase().includes(q) ||
            item.to.toLowerCase().includes(q) ||
            group.label.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, role]);

  function closeAndNavigate() {
    setOpen(false);
    onNavigate?.();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={
            triggerClassName ??
            "flex w-full items-center gap-3 min-h-[var(--touch-target)] rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
          }
        >
          <LayoutGrid className="h-4 w-4 text-gold" />
          <span className="flex-1 text-left">All ERP Modules</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[min(85vh,640px)] rounded-t-xl p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
          <SheetTitle className="text-left font-serif">All Modules</SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Grouped navigation — same permissions as desktop.
          </p>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search modules…"
              className="pl-9"
              autoFocus
            />
          </div>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="ERP modules">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">No modules match.</p>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="mb-3">
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={itemRouteKey(item)}
                      to={item.to}
                      search={item.search}
                      onClick={closeAndNavigate}
                      className="flex items-center gap-3 min-h-[var(--touch-target)] rounded-md px-3 py-2.5 hover:bg-muted/50 active:bg-muted"
                    >
                      <Icon className="h-4 w-4 text-gold shrink-0" />
                      <span className="flex-1 text-sm font-medium">{item.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
