/**
 * MVP-STOCK (AVS-4 / AVS-32): Stock hub tabs — Gold first, not Ready Stock.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type StockHubTabId =
  | "gold"
  | "ready"
  | "raw"
  | "wip"
  | "karigar"
  | "branch"
  | "transfers"
  | "items";

type TabDef =
  | { id: StockHubTabId; label: string; kind: "hub"; tab: "gold" | "ready" | "items" }
  | { id: StockHubTabId; label: string; kind: "route"; to: string };

export const STOCK_HUB_TABS: readonly TabDef[] = [
  { id: "gold", label: "Gold", kind: "hub", tab: "gold" },
  { id: "ready", label: "Ready", kind: "hub", tab: "ready" },
  { id: "raw", label: "Raw", kind: "route", to: "/stock/lots" },
  { id: "wip", label: "WIP", kind: "route", to: "/workshop" },
  { id: "karigar", label: "Karigar", kind: "route", to: "/workshop/gold-book" },
  { id: "branch", label: "Branch", kind: "route", to: "/stock/boxes" },
  { id: "transfers", label: "Transfers", kind: "route", to: "/stock/transfers" },
  { id: "items", label: "Items", kind: "hub", tab: "items" },
] as const;

export function StockHubTabs({ active }: { active: StockHubTabId }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 mb-4"
      aria-label="Stock sections"
    >
      {STOCK_HUB_TABS.map((tab) => {
        const isActive =
          tab.kind === "hub"
            ? active === tab.tab || (tab.tab === "items" && active === "items")
            : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
        if (tab.kind === "route") {
          return (
            <Link
              key={tab.id}
              to={tab.to as never}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-2 min-h-12 text-xs font-semibold whitespace-nowrap border transition-all",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-gold/40 hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        }
        return (
          <Link
            key={tab.id}
            to="/stock"
            search={{ tab: tab.tab } as never}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-2 min-h-12 text-xs font-semibold whitespace-nowrap border transition-all",
              active === tab.tab
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-gold/40 hover:text-foreground",
            )}
            aria-current={active === tab.tab ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
