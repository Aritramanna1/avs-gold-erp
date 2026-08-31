import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Printer, ScanLine, Tag, Package, Search, CheckCircle2 } from "lucide-react";
import { ModuleWorkspace } from "@/components/module-workspace";
import { BARCODE_STATUS_LABELS, useManufacturingBarcodes } from "@/lib/manufacturing-barcode-store";
import { useStock, type StockItem } from "@/lib/stock-store";
import { ManufacturingTagPrintDialog } from "@/components/manufacturing-tag-print-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mgToGrams } from "@/lib/gold";
import { usePrintEngine } from "@/lib/print-engine";

export const Route = createFileRoute("/barcode")({ component: BarcodeWorkspace });

function BarcodeWorkspace() {
  const search = useSearch({ from: "/barcode" }) as { selected?: string; tab?: string };
  const barcodes = useManufacturingBarcodes((s) => s.barcodes);
  const refreshMfg = useManufacturingBarcodes((s) => s.refresh);
  const stockItems = useStock((s) => s.items);
  const refreshStock = useStock((s) => s.refresh);
  const { triggerPrint } = usePrintEngine();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "stock" | "mfg" | "available">(
    (search.tab as any) || "all",
  );
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    void refreshMfg();
    void refreshStock();
  }, [refreshMfg, refreshStock]);

  const selectedMfg = barcodes.find((b) => b.id === search.selected) ?? null;
  const selectedStock = stockItems.find((i) => i.id === search.selected || i.barcode === search.selected) ?? null;

  const totalTags = stockItems.length + barcodes.length;
  const availableStock = stockItems.filter((i) => i.status === "available");

  const filteredStock = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = stockItems;
    if (activeTab === "available") list = list.filter((i) => i.status === "available");
    if (!q) return list;
    return list.filter(
      (i) =>
        i.barcode.toLowerCase().includes(q) ||
        i.itemName.toLowerCase().includes(q) ||
        (i.huid && i.huid.toLowerCase().includes(q)) ||
        (i.itemCode && i.itemCode.toLowerCase().includes(q)),
    );
  }, [stockItems, searchQuery, activeTab]);

  const filteredMfg = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return barcodes;
    return barcodes.filter(
      (b) =>
        b.barcodeNumber.toLowerCase().includes(q) ||
        b.productDescription.toLowerCase().includes(q) ||
        b.tagNumber.toLowerCase().includes(q) ||
        b.orderNo.toLowerCase().includes(q),
    );
  }, [barcodes, searchQuery]);

  return (
    <ModuleWorkspace
      eyebrow="Identification & Tracking"
      title="Barcode Desk & Tagging"
      description="Unified identification center for Ready Stock barcodes, Jewellery Tags, HUID certificates, and Manufacturing tags."
      icon={ScanLine}
      onRefresh={() => {
        void refreshMfg();
        void refreshStock();
      }}
      metrics={[
        { label: "Total Barcode Records", value: totalTags },
        { label: "Ready Stock Barcodes", value: stockItems.length },
        { label: "Available in Showroom", value: availableStock.length },
        { label: "Manufacturing Tags", value: barcodes.length },
      ]}
      actions={[
        { label: "Scan Barcode Desk", to: "/workshop/barcode-scanner", icon: ScanLine },
        { label: "Barcode Stock Register", to: "/reports/barcode-stock", icon: Tag },
        { label: "Stock Check / Audit", to: "/stock/verification", icon: CheckCircle2 },
      ]}
    >
      {/* Search & Filter Bar */}
      <div className="erp-surface mb-5 rounded-md p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search barcode number, HUID, item name, tag number, or order no..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto">
            <Button
              variant={activeTab === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("all")}
            >
              All ({totalTags})
            </Button>
            <Button
              variant={activeTab === "stock" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("stock")}
            >
              Ready Stock ({stockItems.length})
            </Button>
            <Button
              variant={activeTab === "available" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("available")}
            >
              Available ({availableStock.length})
            </Button>
            <Button
              variant={activeTab === "mfg" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("mfg")}
            >
              Manufacturing ({barcodes.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Selected Stock Item Card */}
      {selectedStock && (
        <section className="erp-surface mb-5 rounded-md p-5 border-l-4 border-l-gold">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-gold border-gold font-mono">
                  BARCODE: {selectedStock.barcode}
                </Badge>
                {selectedStock.huid && (
                  <Badge variant="secondary" className="font-mono">
                    HUID: {selectedStock.huid}
                  </Badge>
                )}
                <Badge>{selectedStock.status.toUpperCase()}</Badge>
              </div>
              <h2 className="mt-2 text-lg font-semibold">{selectedStock.itemName}</h2>
              <p className="text-sm text-muted-foreground">
                Item Code: {selectedStock.itemCode} · Location: {selectedStock.location || "Vault"} · Purity: {selectedStock.purity}
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Gross Weight</dt>
                  <dd className="font-medium">{mgToGrams(selectedStock.grossMg)} g</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Net Weight</dt>
                  <dd className="font-medium">{mgToGrams(selectedStock.netMg)} g</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fine Gold</dt>
                  <dd className="font-medium text-gold">{mgToGrams(selectedStock.fineMg)} g</dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => triggerPrint(`/stock/print/${selectedStock.id}`, `Tag ${selectedStock.barcode}`)}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" /> Print Tag
              </Button>
              <Link to="/stock/$id" params={{ id: selectedStock.id }}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Package className="h-4 w-4" /> View Stock Record
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Selected Mfg Tag Card */}
      {selectedMfg && (
        <section className="erp-surface mb-5 rounded-md p-5 border-l-4 border-l-blue-500">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Manufacturing Tag</p>
              <h2 className="mt-1 font-mono text-lg font-semibold">{selectedMfg.barcodeNumber}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedMfg.productDescription} - {selectedMfg.orderNo} -{" "}
                {BARCODE_STATUS_LABELS[selectedMfg.status] ?? selectedMfg.status}
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Tag number</dt>
                  <dd className="font-mono">{selectedMfg.tagNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Internal product</dt>
                  <dd className="font-mono">{selectedMfg.internalProductId}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Gross weight</dt>
                  <dd>{(selectedMfg.grossMg / 1000).toFixed(3)} g</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fine weight</dt>
                  <dd>{(selectedMfg.fineMg / 1000).toFixed(3)} g</dd>
                </div>
              </dl>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrintOpen(true)}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" /> Print Tag
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Registers List */}
      {(activeTab === "all" || activeTab === "stock" || activeTab === "available") && (
        <section className="erp-surface rounded-md p-5 mb-5">
          <div className="flex items-center justify-between mb-3 border-b pb-2">
            <h2 className="font-semibold text-sm uppercase tracking-wide">
              Inventory & Ready Stock Barcodes ({filteredStock.length})
            </h2>
            <Link to="/stock" className="text-xs text-gold hover:underline">
              Open Full Stock Register →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground text-left">
                <tr>
                  <th className="p-2.5">BARCODE</th>
                  <th className="p-2.5">ITEM NAME</th>
                  <th className="p-2.5">HUID</th>
                  <th className="p-2.5">LOCATION</th>
                  <th className="p-2.5 text-right">GROSS (G)</th>
                  <th className="p-2.5 text-right">FINE GOLD (G)</th>
                  <th className="p-2.5 text-center">STATUS</th>
                  <th className="p-2.5 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                      No matching stock barcodes found.
                    </td>
                  </tr>
                ) : (
                  filteredStock.slice(0, 25).map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-muted/30 ${selectedStock?.id === item.id ? "bg-gold/10" : ""}`}
                    >
                      <td className="p-2.5 font-mono font-medium text-gold">{item.barcode}</td>
                      <td className="p-2.5 font-medium">{item.itemName}</td>
                      <td className="p-2.5 font-mono text-muted-foreground">{item.huid || "—"}</td>
                      <td className="p-2.5 capitalize">{item.location || "safe"}</td>
                      <td className="p-2.5 text-right">{mgToGrams(item.grossMg)}</td>
                      <td className="p-2.5 text-right font-medium">{mgToGrams(item.fineMg)}</td>
                      <td className="p-2.5 text-center">
                        <Badge
                          variant={item.status === "available" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {item.status}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => triggerPrint(`/stock/print/${item.id}`, `Tag ${item.barcode}`)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Link to="/barcode" search={{ selected: item.id } as any}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            Select
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(activeTab === "all" || activeTab === "mfg") && (
        <section className="erp-surface rounded-md p-5">
          <div className="flex items-center justify-between mb-3 border-b pb-2">
            <h2 className="font-semibold text-sm uppercase tracking-wide">
              Manufacturing Job & Artisan Tags ({filteredMfg.length})
            </h2>
            <Link to="/workshop/barcode-scanner" className="text-xs text-gold hover:underline">
              Open Barcode Scanner Desk →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {filteredMfg.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No manufacturing tags found.</p>
            ) : (
              filteredMfg.slice(0, 10).map((barcode) => (
                <div
                  className={`flex flex-wrap justify-between items-center gap-3 py-3 text-sm ${
                    barcode.id === selectedMfg?.id ? "text-gold font-medium" : ""
                  }`}
                  key={barcode.id}
                >
                  <div>
                    <Link
                      to="/barcode"
                      search={{ selected: barcode.id } as any}
                      className="font-mono hover:underline"
                    >
                      {barcode.barcodeNumber}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {barcode.productDescription} ({barcode.orderNo})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {BARCODE_STATUS_LABELS[barcode.status] ?? barcode.status}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        search.selected = barcode.id;
                        setPrintOpen(true);
                      }}
                    >
                      Print
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      <ManufacturingTagPrintDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        barcode={selectedMfg}
      />
    </ModuleWorkspace>
  );
}

