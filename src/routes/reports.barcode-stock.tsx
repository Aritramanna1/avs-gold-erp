import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { useStock } from "@/lib/stock-store";
import { fetchBarcodePending, type BarcodePendingRow } from "@/lib/stock-books-query";
import { mgToGrams } from "@/lib/gold";
import { usePrintEngine } from "@/lib/print-engine";
import { Printer, ScanLine, Tags } from "lucide-react";

type ViewMode = "all" | "single" | "lot" | "pending" | "print-scan";

const VIEW_MODES: ViewMode[] = ["all", "single", "lot", "pending", "print-scan"];

export const Route = createFileRoute("/reports/barcode-stock")({
  validateSearch: (s: Record<string, unknown>): { view?: ViewMode } => {
    const v = typeof s.view === "string" ? s.view : "all";
    return { view: VIEW_MODES.includes(v as ViewMode) ? (v as ViewMode) : "all" };
  },
  head: () => ({ meta: [{ title: "Barcode Stock · AVS ERP" }] }),
  component: BarcodeStockPage,
});

function BarcodeStockPage() {
  const items = useStock((s) => s.items);
  const { triggerPrint } = usePrintEngine();
  const navigate = useNavigate();
  const { view: viewFromSearch } = Route.useSearch();
  const view = viewFromSearch ?? "all";
  const setView = (next: ViewMode) => {
    void navigate({
      to: "/reports/barcode-stock",
      search: { view: next },
      replace: true,
    });
  };
  const [barcodeQ, setBarcodeQ] = useState("");
  const [lotQ, setLotQ] = useState("");
  const [pendingRows, setPendingRows] = useState<BarcodePendingRow[]>([]);
  const [pendingMeta, setPendingMeta] = useState({ total: 0, capped: false });
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);

  useEffect(() => {
    if (view !== "pending") return;
    let cancelled = false;
    setPendingLoading(true);
    setPendingError(null);
    void fetchBarcodePending()
      .then((r) => {
        if (cancelled) return;
        setPendingRows(r.rows);
        setPendingMeta({ total: r.total, capped: r.capped });
      })
      .catch((e: Error) => {
        if (!cancelled) setPendingError(e.message || "Failed to load barcode pending");
      })
      .finally(() => {
        if (!cancelled) setPendingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  const filtered = useMemo(() => {
    if (view === "single") {
      const q = barcodeQ.trim().toLowerCase();
      if (!q) return [];
      return items.filter(
        (i) =>
          i.barcode.toLowerCase() === q ||
          i.barcode.toLowerCase().includes(q) ||
          i.itemCode.toLowerCase().includes(q),
      );
    }
    if (view === "lot") {
      const q = lotQ.trim().toLowerCase();
      if (!q) return items.filter((i) => !!i.lotId);
      return items.filter((i) => (i.lotId || "").toLowerCase().includes(q));
    }
    if (view === "pending") return [];
    return items;
  }, [items, view, barcodeQ, lotQ]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Barcode Stock"
        subtitle="Tag register — all / single / lot / pending / print-scan (Offline barcode stock variants)"
        actions={
          <div className="flex items-center gap-2">
            <SourceOfTruthBadge variant="report" />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 no-print"
              onClick={() =>
                triggerPrint("/reports/book-print/barcode_stock", "Barcode Stock · Print")
              }
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 no-print">
        {(
          [
            ["all", "All tags"],
            ["single", "Single barcode"],
            ["lot", "By lot"],
            ["pending", "Pending"],
            ["print-scan", "Print / Scan"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={view === id ? "default" : "outline"}
            onClick={() => setView(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {view === "print-scan" ? (
        <div className="erp-surface rounded-xl p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Use manufacturing barcode workspace and shop-floor scanner. Tag stock remains inventory
            SoT; print uses AVS Universal Print Engine.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/barcode">
                <Tags className="h-4 w-4 mr-2" />
                Barcode & tagging
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/workshop/barcode-scanner">
                <ScanLine className="h-4 w-4 mr-2" />
                Scan barcode
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/stock">Ready stock</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/stock/lots">Lots</Link>
            </Button>
          </div>
        </div>
      ) : view === "pending" ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {pendingLoading
              ? "Loading pending tags…"
              : `${pendingRows.length} pending${pendingMeta.capped ? ` of ${pendingMeta.total}` : ""} — missing barcode, reserved, or no lot`}
          </p>
          {pendingError ? <p className="text-sm text-destructive">{pendingError}</p> : null}
          <div className="erp-surface rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Barcode</th>
                  <th className="px-3 py-2 text-right">Fine (g)</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {!pendingLoading && pendingRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No pending barcode tags.
                    </td>
                  </tr>
                ) : (
                  pendingRows.map((i) => (
                    <tr key={i.id} className="border-t border-border/60">
                      <td className="px-3 py-2 text-xs">{i.pending_reason}</td>
                      <td className="px-3 py-2 font-mono">{i.item_code}</td>
                      <td className="px-3 py-2">{i.item_name}</td>
                      <td className="px-3 py-2 font-mono">{i.barcode || "—"}</td>
                      <td className="px-3 py-2 font-mono text-right">{mgToGrams(i.fine_mg)}</td>
                      <td className="px-3 py-2">{i.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {view === "single" && (
            <div className="max-w-sm space-y-1.5 no-print">
              <Label htmlFor="bc">Barcode / item code</Label>
              <Input
                id="bc"
                className="font-mono"
                value={barcodeQ}
                onChange={(e) => setBarcodeQ(e.target.value)}
                placeholder="Scan or type…"
              />
            </div>
          )}
          {view === "lot" && (
            <div className="max-w-sm space-y-1.5 no-print">
              <Label htmlFor="lot">Lot id</Label>
              <Input
                id="lot"
                className="font-mono"
                value={lotQ}
                onChange={(e) => setLotQ(e.target.value)}
                placeholder="Filter lot…"
              />
            </div>
          )}

          <div className="erp-surface rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Barcode</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Purity</th>
                  <th className="px-3 py-2 text-right">Gross (g)</th>
                  <th className="px-3 py-2 text-right">Net (g)</th>
                  <th className="px-3 py-2 text-right">Fine (g)</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Lot</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      No stock tags for this view.
                    </td>
                  </tr>
                ) : (
                  filtered.map((i) => (
                    <tr key={i.id} className="border-t border-border/60">
                      <td className="px-3 py-2 font-mono">
                        <Link to="/stock/$id" params={{ id: i.id }} className="text-gold hover:underline">
                          {i.barcode}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{i.itemName}</td>
                      <td className="px-3 py-2 font-mono">{i.purity}</td>
                      <td className="px-3 py-2 font-mono text-right">{mgToGrams(i.grossMg)}</td>
                      <td className="px-3 py-2 font-mono text-right">{mgToGrams(i.netMg)}</td>
                      <td className="px-3 py-2 font-mono text-right">{mgToGrams(i.fineMg)}</td>
                      <td className="px-3 py-2">{i.status}</td>
                      <td className="px-3 py-2 font-mono text-xs">{i.lotId || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
