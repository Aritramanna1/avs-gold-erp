import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/lib/settings-store";
import {
  STOCK_LOCATION_LABELS,
  STOCK_LOCATIONS,
  type StockLocation,
  useStock,
} from "@/lib/stock-store";
import { useStockTransfers } from "@/lib/stock-transfer-store";
import { mgToGrams } from "@/lib/gold";
import { ArrowLeftRight, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stock/transfers")({
  head: () => ({ meta: [{ title: "Stock Transfer Vouchers · AVS ERP" }] }),
  component: StockTransfersPage,
});

function StockTransfersPage() {
  const branchId = useSettings((s) => s.selectedBranchId || "MAIN");
  const vouchers = useStockTransfers((s) => s.vouchers);
  const loading = useStockTransfers((s) => s.loading);
  const loadError = useStockTransfers((s) => s.loadError);
  const hydrate = useStockTransfers((s) => s.hydrate);
  const createTransfer = useStockTransfers((s) => s.createTransfer);
  const markReceived = useStockTransfers((s) => s.markReceived);

  // Stable selector — NEVER filter inside the Zustand selector (new array every
  // read → React #185 max update depth on this page).
  const allStockItems = useStock((s) => s.items);
  const refreshStock = useStock((s) => s.refresh);

  const [fromLocation, setFromLocation] = useState<StockLocation>("vault");
  const [toLocation, setToLocation] = useState<StockLocation>("counter");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [narration, setNarration] = useState("");
  const [saving, setSaving] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  useEffect(() => {
    void refreshStock()
      .then(() => {
})
      .catch(() => undefined);
  }, [refreshStock, branchId]);

  useEffect(() => {
    void hydrate(branchId).then(() => {
});
  }, [branchId, hydrate]);

  const availableAtFrom = useMemo(
    () =>
      allStockItems.filter(
        (i) => i.status === "available" && i.location === fromLocation,
      ),
    [allStockItems, fromLocation],
  );

  const inTransit = useMemo(
    () => vouchers.filter((v) => v.branchId === branchId && v.status === "in_transit"),
    [vouchers, branchId],
  );

  function toggleItem(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleCreate() {
    if (fromLocation === toLocation) {
      toast.error("From and to locations must differ.");
      return;
    }
    const items = availableAtFrom
      .filter((i) => selectedIds.includes(i.id))
      .map((i) => ({
        stockItemId: i.id,
        itemCode: i.itemCode,
        grossMg: i.grossMg,
        fineMg: i.fineMg,
      }));
    if (items.length === 0) {
      toast.error("Select at least one stock item at the From location.");
      return;
    }
    setSaving(true);
    try {
      // Prefer online create; fall back to offline queue only when offline helpers say so.
      const { captureStockTransfer } = await import("@/lib/offline");
      const queued = await captureStockTransfer({
        branchId,
        fromLocation,
        toLocation,
        items,
        narration,
      });
      if (queued.mode === "queued") {
        toast.message("Transfer saved offline — Pending Sync");
        setSelectedIds([]);
        setNarration("");
        return;
      }
      const v = queued.result as { voucherNumber: string };
toast.success(`Transfer ${v.voucherNumber} created.`);
      setSelectedIds([]);
      setNarration("");
      await hydrate(branchId);
      await refreshStock();
    } catch (e) {
toast.error(e instanceof Error ? e.message : "Transfer failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive(id: string) {
    setReceivingId(id);
    try {
      await markReceived(id);
      toast.success("Transfer received.");
      await hydrate(branchId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark received.");
    } finally {
      setReceivingId(null);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Stock Transfer Vouchers"
        subtitle="Move tagged jewellery between vault, counter, transit, and outside vendor — with in-transit custody and receive confirmation."
        backTo="/stock"
        backLabel="Back to Stock"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              void hydrate(branchId);
              void refreshStock();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      />

      {loadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive space-y-2">
          <p className="font-medium">Could not load transfer vouchers</p>
          <p className="font-mono text-xs break-all">{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void hydrate(branchId)}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="rounded-md border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" /> New Transfer
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>From</Label>
            <Select
              value={fromLocation}
              onValueChange={(v) => {
                setFromLocation(v as StockLocation);
                setSelectedIds([]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {STOCK_LOCATION_LABELS[loc]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>To</Label>
            <Select value={toLocation} onValueChange={(v) => setToLocation(v as StockLocation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {STOCK_LOCATION_LABELS[loc]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="max-h-48 overflow-auto border rounded-md divide-y text-xs">
          {availableAtFrom.length === 0 ? (
            <p className="p-3 text-muted-foreground">
              No available stock at {STOCK_LOCATION_LABELS[fromLocation]}. Change From, or add stock
              under Ready Stock first.
            </p>
          ) : (
            availableAtFrom.slice(0, 80).map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleItem(item.id)}
                />
                <span className="font-mono">{item.itemCode}</span>
                <span className="text-muted-foreground">{mgToGrams(item.grossMg)} g</span>
                <span className="text-muted-foreground truncate">{item.itemName}</span>
              </label>
            ))
          )}
        </div>
        <div>
          <Label>Narration</Label>
          <Input
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Transfer reason"
          />
        </div>
        <Button
          disabled={saving || selectedIds.length === 0 || fromLocation === toLocation}
          onClick={() => void handleCreate()}
        >
          {saving ? "Creating…" : "Create Transfer Voucher"}
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">In Transit</h3>
        {loading && inTransit.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : inTransit.length === 0 ? (
          <p className="text-xs text-muted-foreground">No transfers in transit.</p>
        ) : (
          inTransit.map((v) => (
            <div
              key={v.id}
              className="rounded-md border p-4 flex items-center justify-between gap-4"
            >
              <div>
                <div className="font-semibold font-mono">{v.voucherNumber}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {STOCK_LOCATION_LABELS[v.fromLocation as StockLocation] ?? v.fromLocation} →{" "}
                  {STOCK_LOCATION_LABELS[v.toLocation as StockLocation] ?? v.toLocation} ·{" "}
                  {v.itemCount} items · {mgToGrams(v.totalGrossMg)} g gross
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{v.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={receivingId === v.id}
                  onClick={() => void handleReceive(v.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Receive
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
