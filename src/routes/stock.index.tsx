import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowRightLeft, Package, Plus, ScanLine } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { EmptyState, WebAppState } from "@/components/web-app-state";
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
import { fetchStockPage } from "@/lib/stock-query";
import { STOCK_STATUS_LABELS, type StockItem, type StockStatus } from "@/lib/stock-store";

type StockSearch = {
  q?: string;
  status?: StockStatus | "all";
  page?: number;
};

export const Route = createFileRoute("/stock/")({
  validateSearch: (search: Record<string, unknown>): StockSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    status: isStockStatus(search.status) ? search.status : "all",
    page:
      typeof search.page === "number"
        ? search.page
        : typeof search.page === "string"
          ? Number(search.page)
          : 1,
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
  const navigate = useNavigate({ from: "/stock" });
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
    const globalRoles = [
      "Super Owner",
      "Administrator",
      "CEO (View Only)",
      "owner",
      "admin",
      "saas_admin",
    ];
    const branchId =
      currentUserRole && !globalRoles.includes(currentUserRole) ? selectedBranchId || "MAIN" : null;
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
      search: (prev) => ({
        ...prev,
        ...patch,
        page: patch.page ?? 1,
      }),
      replace: true,
    });
  };

  return (
    <ModuleWorkspace
      eyebrow="Inventory desk"
      title="Ready stock"
      description="Work with real finished jewellery inventory, status, location, barcode, and movement history."
      icon={Package}
      onRefresh={() => updateSearch({ page })}
      metrics={[
        { label: "Matching items", value: loading ? "..." : totalCount },
        { label: "Available", value: loading ? "..." : availableCount },
        { label: "Page gold", value: `${visibleFineG} g` },
        { label: "Page", value: `${page} / ${totalPages}` },
      ]}
      actions={[
        { label: "Add ready stock", to: "/stock/entry", icon: Plus },
        { label: "Scan barcode", to: "/workshop/barcode-scanner", icon: ScanLine },
        { label: "Stock verification", to: "/stock/verification", icon: ArrowRightLeft },
      ]}
    >
      <section className="erp-surface rounded-md p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold">Stock register</h2>
            <p className="text-sm text-muted-foreground">
              Server-paginated inventory with RLS-backed search and status filtering.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,320px)_180px_auto]">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Search
              </span>
              <Input
                value={search.q ?? ""}
                onChange={(event) => updateSearch({ q: event.target.value })}
                placeholder="Item, barcode, HUID, category"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </span>
              <Select
                value={status}
                onValueChange={(value) => updateSearch({ status: value as StockStatus | "all" })}
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
            <EmptyState
              title={
                q || status !== "all" ? "No stock matches this filter" : "No ready stock found"
              }
              description={
                q || status !== "all"
                  ? "Change the search or status filter. The result is empty after applying Supabase/RLS visibility and current filters."
                  : "Add finished jewellery, import a stock sheet, or generate stock from the manufacturing flow. Each item should carry location, barcode or HUID where applicable, status, and movement history."
              }
              action={
                q || status !== "all"
                  ? {
                      label: "Clear filters",
                      onClick: () => updateSearch({ q: "", status: "all" }),
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="erp-table w-full text-sm">
                <thead>
                  <tr>
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
    </ModuleWorkspace>
  );
}
