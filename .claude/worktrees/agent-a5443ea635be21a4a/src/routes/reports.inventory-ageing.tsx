import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStock, STOCK_LOCATION_LABELS, type StockItem } from "@/lib/stock-store";
import { useSettings } from "@/lib/settings-store";
import { exportToCSV, fmtG } from "@/lib/report-engine";
import { Download } from "lucide-react";

export const Route = createFileRoute("/reports/inventory-ageing")({
  head: () => ({ meta: [{ title: "Inventory Ageing · MTJ ERP" }] }),
  component: InventoryAgeingPage,
});

interface AgeBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
}

const BUCKETS: AgeBucket[] = [
  { label: "0-30 days", minDays: 0, maxDays: 30 },
  { label: "31-60 days", minDays: 31, maxDays: 60 },
  { label: "61-90 days", minDays: 61, maxDays: 90 },
  { label: "91-180 days", minDays: 91, maxDays: 180 },
  { label: "181-365 days", minDays: 181, maxDays: 365 },
  { label: "365+ days", minDays: 366, maxDays: null },
];

function ageDays(createdAt: number): number {
  return Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
}

function bucketFor(days: number): AgeBucket {
  return BUCKETS.find((b) => days >= b.minDays && (b.maxDays === null || days <= b.maxDays)) ?? BUCKETS[BUCKETS.length - 1];
}

function InventoryAgeingPage() {
  const items = useStock((s) => s.items);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const [scope, setScope] = useState<"branch" | "all">("branch");

  const available = useMemo(() => {
    const base = items.filter((i) => i.status === "available" || i.status === "reserved");
    if (scope === "all") return base;
    return base.filter((i) => (i as StockItem & { branchId?: string }).branchId === selectedBranchId || !selectedBranchId);
  }, [items, scope, selectedBranchId]);

  const buckets = useMemo(() => {
    return BUCKETS.map((b) => {
      const inBucket = available.filter((i) => bucketFor(ageDays(i.createdAt)).label === b.label);
      return {
        ...b,
        items: inBucket,
        count: inBucket.length,
        fineMg: inBucket.reduce((sum, i) => sum + i.fineMg, 0),
        valuePaise: inBucket.reduce((sum, i) => sum + (i.pricePaise ?? 0), 0),
      };
    });
  }, [available]);

  const totalFineMg = available.reduce((sum, i) => sum + i.fineMg, 0);
  const oldStockFineMg = buckets
    .filter((b) => b.minDays >= 181)
    .reduce((sum, b) => sum + b.fineMg, 0);

  function handleExport() {
    const rows: (string | number)[][] = [
      ["Item Code", "Item Name", "Barcode", "Location", "Age (days)", "Age Bucket", "Fine (mg)", "Created"],
    ];
    for (const i of available) {
      const days = ageDays(i.createdAt);
      rows.push([
        i.itemCode,
        i.itemName,
        i.barcode,
        STOCK_LOCATION_LABELS[i.location],
        days,
        bucketFor(days).label,
        i.fineMg,
        new Date(i.createdAt).toLocaleDateString(),
      ]);
    }
    exportToCSV(`inventory-ageing-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Inventory Ageing"
        subtitle="How long available stock has been sitting, by age bucket. Slow-moving stock over 180 days needs review."
        actions={
          <div className="flex gap-2 items-center">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "branch" | "all")}
              className="rounded-lg border border-border bg-background p-2 text-sm h-10"
            >
              <option value="branch">Current Branch</option>
              <option value="all">All Branches</option>
            </select>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total Available Items</div>
          <div className="text-2xl font-semibold">{available.length}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total Fine Gold</div>
          <div className="text-2xl font-semibold">{fmtG(totalFineMg)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Aged 180+ days (fine)</div>
          <div className="text-2xl font-semibold text-destructive">{fmtG(oldStockFineMg)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3">Age Bucket</th>
              <th className="p-3">Items</th>
              <th className="p-3">Fine Gold</th>
              <th className="p-3">% of Total Fine</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label} className="border-b border-border last:border-0">
                <td className="p-3">
                  <Badge variant={b.minDays >= 181 ? "destructive" : "secondary"}>{b.label}</Badge>
                </td>
                <td className="p-3">{b.count}</td>
                <td className="p-3">{fmtG(b.fineMg)}</td>
                <td className="p-3">
                  {totalFineMg > 0 ? ((b.fineMg / totalFineMg) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border font-semibold">Slow-Moving Stock (180+ days)</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3">Item Code</th>
              <th className="p-3">Name</th>
              <th className="p-3">Location</th>
              <th className="p-3">Age (days)</th>
              <th className="p-3">Fine Gold</th>
            </tr>
          </thead>
          <tbody>
            {buckets
              .filter((b) => b.minDays >= 181)
              .flatMap((b) => b.items)
              .sort((a, b) => a.createdAt - b.createdAt)
              .slice(0, 100)
              .map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className="p-3">{i.itemCode}</td>
                  <td className="p-3">{i.itemName}</td>
                  <td className="p-3">{STOCK_LOCATION_LABELS[i.location]}</td>
                  <td className="p-3">{ageDays(i.createdAt)}</td>
                  <td className="p-3">{fmtG(i.fineMg)}</td>
                </tr>
              ))}
            {buckets.filter((b) => b.minDays >= 181).every((b) => b.items.length === 0) && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No slow-moving stock — everything is under 180 days old.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
