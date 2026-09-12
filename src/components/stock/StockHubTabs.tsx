import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** AVS-4 / MVP-STOCK tab order. Gold first; Items last. No new routes — search param only. */
export const STOCK_HUB_TABS = [
  { id: "gold", label: "Gold" },
  { id: "ready", label: "Ready" },
  { id: "raw", label: "Raw" },
  { id: "wip", label: "WIP" },
  { id: "karigar", label: "Karigar" },
  { id: "branch", label: "Branch" },
  { id: "transfers", label: "Transfers" },
  { id: "items", label: "Items" },
] as const;

export type StockHubTabId = (typeof STOCK_HUB_TABS)[number]["id"];

export function isStockHubTab(value: unknown): value is StockHubTabId {
  return typeof value === "string" && STOCK_HUB_TABS.some((t) => t.id === value);
}

export function StockHubTabs({ active }: { active: StockHubTabId }) {
  return (
    <nav
      aria-label="Stock sections"
      className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1"
      data-testid="stock-hub-tabs"
    >
      {STOCK_HUB_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            to="/stock"
            search={(prev: any) => ({
              ...prev,
              tab: tab.id,
              // Reset ready-stock list filters when leaving Ready
              ...(tab.id !== "ready" ? { q: undefined, status: undefined, page: undefined } : {}),
            })}
            className={cn(
              "inline-flex min-h-12 min-w-[3rem] items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-gold text-black shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
