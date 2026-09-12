import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowRightLeft, Package, Plus, Scale, ScanLine } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { EmptyState, WebAppState } from "@/components/web-app-state";
import { ActionableEmptyState } from "@/components/ui/ActionableEmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/lib/settings-store";
import { isAdminLikeRole } from "@/lib/role-resolution";
import { resolveOperationalBranchId } from "@/lib/branch-scope";
import { fetchStockPage } from "@/lib/stock-query";
import { STOCK_STATUS_LABELS, type StockItem, type StockStatus } from "@/lib/stock-store";
import { StockListThumbnail } from "@/components/stock/StockListThumbnail";
import { StockHubTabs, isStockHubTab, type StockHubTabId } from "@/components/stock/StockHubTabs";
import { StockGoldPanel } from "@/components/stock/StockGoldPanel";
import { StockSatellitePanel } from "@/components/stock/StockSatellitePanels";
import { DEFAULT_FINENESS_BASIS } from "@/lib/gold";

type StockSearch = {
  tab?: StockHubTabId;
  q?: string;
  status?: StockStatus | "all";
  page?: number;
  selected?: string;
};

export const Route = createFileRoute("/stock/")({
  validateSearch: (search: Record<string, unknown>): StockSearch => ({
    tab: isStockHubTab(search.tab) ? search.tab : "gold",
    q: typeof search.q === "string" ? search.q : "",
    status: isStockStatus(search.status) ? search.status : "all",
    page:
      typeof search.page === "number"
        ? search.page
        : typeof search.page === "string"
          ? Number(search.page)
          : 1,
    selected: typeof search.selected === "string" ? search.selected : undefined,
  }),
  component: StockWorkspace,
});

function isStockStatus(value: unknown): value is StockStatus | "all" {
  return (
    value === "all" ||
    value === "available" ||
    value === "reserved" ||
    value === "sold" ||
    value === "repair" ||
    value === "scrap"
  );
}

function StockWorkspace() {
  const navigate = useNavigate({ from: "/stock/" });
  const search = useSearch({ from: "/stock/" });
  const tab: StockHubTabId = search.tab ?? "gold";
  const basis = DEFAULT_FINENESS_BASIS;

  useEffect(() => {
    const id = search.selected;
    if (!id) return;
    void navigate({ to: "/stock/$id", params: { id }, replace: true });
  }, [navigate, search.selected]);

  const title =
    tab === "gold"
      ? "Gold"
      : tab === "ready"
        ? "Ready stock"
        : tab === "items"
          ? "Items"
          : tab.charAt(0).toUpperCase() + tab.slice(1);

  const description =
    tab === "gold"
      ? `Vault and custody gold first. Fine quantity is shown as g @${basis}. Ready jewellery is under Ready.`
      : tab === "ready"
        ? "Finished jewellery inventory, status, location, barcode, and movement history."
        : "Stock section — summaries use existing gold ledger / vault data; deep links keep current routes.";

  return (
    <ModuleWorkspace
      eyebrow="Stock"
      title={title}
      description={description}
      icon={tab === "gold" ? Scale : Package}
      onRefresh={undefined}
      metrics={[]}
      actions={
        tab === "ready"
          ? [
              { label: "Add ready stock", to: "/stock/entry", icon: Plus },
              { label: "Scan barcode", to: "/workshop/barcode-scanner", icon: ScanLine },
              { label: "Stock verification", to: "/stock/verification", icon: ArrowRightLeft },
            ]
          : tab === "gold"
            ? [
                { label: "Open gold vault", to: "/ledger", icon: Scale },
                { label: "Add ready stock", to: "/stock/entry", icon: Plus },
              ]
            : [{ label: "Gold", to: "/stock", icon: Scale }]
      }
    >
      <StockHubTabs active={tab} />

      <div className="mt-4">
        {tab === "gold" ? (
          <StockGoldPanel />
        ) : tab === "ready" ? (
          <ReadyStockPanel />
        ) : (
          <StockSatellitePanel tab={tab} />
        )}
      </div>
    </ModuleWorkspace>
  );
}

function ReadyStockPanel() {
  const navigate = useNavigate({ from: "/stock/" });
  const search = useSearch({ from: "/stock/" });
  const currentUserRole = useSettings((s) => s.currentUserRole);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const [items, setItems] = useState<StockItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 25;
  const page = Math.max(1, Number(search.page) || 1);
  const status = search.status ?? "all";
  const q = search.q?.trim() ?? "";
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const visibleFineG = useMemo(
    () => (items.reduce((sum, item) => sum + item.fineMg, 0) / 1000).toFixed(3),
    [items],
  );

  useEffect(() => {
    const branchId =
      !currentUserRole || isAdminLikeRole(currentUserRole)
        ? null
        : resolveOperationalBranchId(selectedBranchId);
    let cancelled = false;

    setLoading(true);
    setError(null);
    fetchStockPage({ page, pageSize, query: q, status, branchId })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setTotalCount(result.totalCount);
        setAvailableCount(result.availableCount);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load ready stock.");
        setItems([]);
        setTotalCount(0);
        setAvailableCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserRole, page, q, selectedBranchId, status]);

  const updateSearch = (patch: Partial<StockSearch>) => {
    void navigate({
      search: (prev) => {
        const next = { ...prev, ...patch, tab: "ready" as const };
        if (patch.page !== undefined) next.page = patch.page;
        return next;
      },
      replace: true,
    });
  };

  return (
    <section className="erp-surface rounded-md p-5">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MetricChip label="Matching items" value={loading ? "..." : String(totalCount)} />
        <MetricChip label="Available" value={loading ? "..." : String(availableCount)} />
        <MetricChip label="Page gold" value={`${visibleFineG} g`} />
        <MetricChip label="Page" value={`${page} / ${totalPages}`} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-semibold">Ready stock register</h2>
          <p className="text-sm text-muted-foreground">
            Finished jewellery tags — use Gold tab for vault fine metal.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(220px,320px)_180px_auto]">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Search
            </span>
            <Input
              value={search.q ?? ""}
              onChange={(event) => updateSearch({ q: event.target.value, page: 1 })}
              placeholder="Item, barcode, HUID, category"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </span>
            <Select
              value={status}
              onValueChange={(value) =>
                updateSearch({ status: value as StockStatus | "all", page: 1 })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STOCK_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button variant="outline" asChild className="self-end">
            <Link to="/stock/import">Import</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-4">
          <WebAppState
            title="Loading stock register"
            description="Fetching the current page from Supabase."
          />
        </div>
      ) : error ? (
        <div className="mt-4">
          <WebAppState
            tone="danger"
            title="Stock could not load"
            description={error}
            action={{ label: "Try again", onClick: () => updateSearch({ page }) }}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4">
          {q || status !== "all" ? (
            <EmptyState
              title="No stock matches this filter"
              description="Change the search or status filter."
              action={{
                label: "Clear filters",
                onClick: () => updateSearch({ q: "", status: "all", page: 1 }),
              }}
            />
          ) : (
            <ActionableEmptyState
              variant="stock"
              title="No Ready Stock yet"
              description="Your showroom inventory is empty. Add finished jewellery items with weight, purity, barcode, and product photo to start selling."
              actionLabel="Add Ready Stock"
              onAction={() => void navigate({ to: "/stock/entry" })}
            />
          )}
        </div>
      ) : (
        <>
          <div className="block md:hidden mt-4 space-y-2">
            {items.map((item) => (
              <Link
                key={item.id}
                to="/stock/$id"
                params={{ id: item.id }}
                className="block border border-border rounded-md p-3 bg-card hover:bg-muted/20 active:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <StockListThumbnail
                    imageStoragePath={item.imageStoragePath}
                    alt={item.itemName}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{item.itemName}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {item.itemCode}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm text-gold">
                          {(item.fineMg / 1000).toFixed(3)} g
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {STOCK_STATUS_LABELS[item.status]}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {item.barcode && (
                        <span>
                          BC: <span className="font-mono">{item.barcode}</span>
                        </span>
                      )}
                      {item.huid && (
                        <span>
                          HUID: <span className="font-mono">{item.huid}</span>
                        </span>
                      )}
                      {item.location && <span>{item.location}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-4 hidden md:block overflow-x-auto">
            <table className="erp-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left w-14" />
                  <th className="text-left">Item</th>
                  <th className="text-left">Barcode</th>
                  <th className="text-left">HUID</th>
                  <th className="text-left">Location</th>
                  <th className="text-right">Fine gold</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <StockListThumbnail
                        imageStoragePath={item.imageStoragePath}
                        alt={item.itemName}
                      />
                    </td>
                    <td>
                      <Link to="/stock/$id" params={{ id: item.id }} className="hover:underline">
                        <span className="font-medium">{item.itemName}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {item.itemCode}
                        </span>
                      </Link>
                    </td>
                    <td className="font-mono text-xs">{item.barcode || "-"}</td>
                    <td className="font-mono text-xs">{item.huid || "-"}</td>
                    <td>{item.location}</td>
                    <td className="text-right font-mono">{(item.fineMg / 1000).toFixed(3)} g</td>
                    <td className="text-right">{STOCK_STATUS_LABELS[item.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of{" "}
              {totalCount}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => updateSearch({ page: page - 1 })}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => updateSearch({ page: page + 1 })}
              >
                Next
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-gold">{value}</div>
    </div>
  );
}
