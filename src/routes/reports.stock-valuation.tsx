import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { fetchItemStockBook, type ItemStockRow } from "@/lib/stock-books-query";
import { exportToCSV, fmtG, fmtRs, triggerPrint } from "@/lib/report-engine";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports/stock-valuation")({
  head: () => ({ meta: [{ title: "Item Stock · AVS ERP" }] }),
  component: ItemStockPage,
});

function ItemStockPage() {
  const ratePaise = getCurrentGoldRatePaise() || 0;
  const [rows, setRows] = useState<ItemStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchItemStockBook("on_hand")
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load item stock");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const valued = useMemo(() => {
    return rows.map((row) => {
      const marketPaise =
        ratePaise > 0 ? Math.round((row.fine_mg * ratePaise) / 1000) : 0;
      const costPaise = row.cost_paise;
      const carryingPaise =
        costPaise > 0 && marketPaise > 0 ? Math.min(costPaise, marketPaise) : costPaise || marketPaise;
      return { ...row, marketPaise, carryingPaise };
    });
  }, [rows, ratePaise]);

  const totals = useMemo(
    () =>
      valued.reduce(
        (acc, row) => ({
          pcs: acc.pcs + row.pcs,
          grossMg: acc.grossMg + row.gross_mg,
          netMg: acc.netMg + row.net_mg,
          fineMg: acc.fineMg + row.fine_mg,
          costPaise: acc.costPaise + row.cost_paise,
          marketPaise: acc.marketPaise + row.marketPaise,
          carryingPaise: acc.carryingPaise + row.carryingPaise,
        }),
        { pcs: 0, grossMg: 0, netMg: 0, fineMg: 0, costPaise: 0, marketPaise: 0, carryingPaise: 0 },
      ),
    [valued],
  );

  function handleCSV() {
    exportToCSV("item-stock.csv", [
      ["Code", "Name", "Category", "Pcs", "Gross g", "Net g", "Fine g", "Cost", "Market", "Carrying"],
      ...valued.map((row) => [
        row.item_code,
        row.item_name,
        row.category,
        String(row.pcs),
        fmtG(row.gross_mg),
        fmtG(row.net_mg),
        fmtG(row.fine_mg),
        fmtRs(row.cost_paise),
        fmtRs(row.marketPaise),
        fmtRs(row.carryingPaise),
      ]),
    ]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Item Stock"
        subtitle="Offline-shaped on-hand stock by item (server RPC). Valuation: tagged cost vs live bhav; carrying = lower of cost/NRV."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV} disabled={valued.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerPrint()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        }
      />
      <p className="text-xs text-muted-foreground">
        {loading
          ? "Loading from server…"
          : `Live rate ${ratePaise ? fmtRs(ratePaise) + "/g" : "not set"} · ${valued.length} item group(s) · Pcs ${totals.pcs} · Fine ${fmtG(totals.fineMg)} · Cost ${fmtRs(totals.costPaise)} · Carrying ${fmtRs(totals.carryingPaise)}`}
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-2">Code</th>
              <th className="py-2">Item</th>
              <th className="py-2">Category</th>
              <th className="py-2 text-right">Pcs</th>
              <th className="py-2 text-right">Gross</th>
              <th className="py-2 text-right">Net</th>
              <th className="py-2 text-right">Fine</th>
              <th className="py-2 text-right">Cost</th>
              <th className="py-2 text-right">Market</th>
              <th className="py-2 text-right">Carrying</th>
            </tr>
          </thead>
          <tbody>
            {!loading && valued.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-6 text-muted-foreground">
                  No available or reserved stock.
                </td>
              </tr>
            ) : (
              valued.map((row) => (
                <tr key={`${row.item_code}:${row.category}`} className="border-b border-border/40">
                  <td className="py-1.5 font-mono">{row.item_code}</td>
                  <td className="py-1.5">{row.item_name}</td>
                  <td className="py-1.5">{row.category}</td>
                  <td className="py-1.5 text-right font-mono">{row.pcs}</td>
                  <td className="py-1.5 text-right font-mono">{fmtG(row.gross_mg)}</td>
                  <td className="py-1.5 text-right font-mono">{fmtG(row.net_mg)}</td>
                  <td className="py-1.5 text-right font-mono">{fmtG(row.fine_mg)}</td>
                  <td className="py-1.5 text-right font-mono">{row.cost_paise ? fmtRs(row.cost_paise) : "—"}</td>
                  <td className="py-1.5 text-right font-mono">{row.marketPaise ? fmtRs(row.marketPaise) : "—"}</td>
                  <td className="py-1.5 text-right font-mono">{fmtRs(row.carryingPaise)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
