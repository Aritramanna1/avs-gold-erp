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
import { STOCK_LOCATION_LABELS, STOCK_LOCATIONS, useStock } from "@/lib/stock-store";
import { useStockTransfers } from "@/lib/stock-transfer-store";
import { mgToGrams } from "@/lib/gold";
import { ArrowLeftRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stock/transfers")({
  head: () => ({ meta: [{ title: "Stock Transfer Vouchers · Ornexa ERP" }] }),
  component: StockTransfersPage,
});

function StockTransfersPage() {
  const branchId = useSettings((s) => s.selectedBranchId || "MAIN");
  const { vouchers, loading, hydrate, createTransfer, markReceived } = useStockTransfers();
  const stockItems = useStock((s) => s.items.filter((i) => i.status === "available"));
  const [fromLocation, setFromLocation] = useState<string>("vault");
  const [toLocation, setToLocation] = useState<string>("counter");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void hydrate(branchId);
  }, [branchId, hydrate]);

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
    const items = stockItems
      .filter((i) => selectedIds.includes(i.id))
      .map((i) => ({
        stockItemId: i.id,
        itemCode: i.itemCode,
        grossMg: i.grossMg,
        fineMg: i.fineMg,
      }));
    if (items.length === 0) {
      toast.error("Select at least one stock item.");
      return;
    }
    setSaving(true);
    try {
      const v = await createTransfer({ branchId, fromLocation, toLocation, items });
      toast.success(`Transfer ${v.voucherNumber} created.`);
      setSelectedIds([]);
      await hydrate(branchId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Stock Transfer Vouchers"
        subtitle="Formal vault/counter/transit transfers with in-transit custody and receive confirmation."
        backTo="/stock"
        backLabel="Back to Stock"
      />

      <div className="rounded-md border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" /> New Transfer
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>From</Label>
            <Select value={fromLocation} onValueChange={setFromLocation}>
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
            <Select value={toLocation} onValueChange={setToLocation}>
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
          {stockItems.slice(0, 50).map((item) => (
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
            </label>
          ))}
        </div>
        <Button disabled={saving} onClick={() => void handleCreate()}>
          Create Transfer Voucher
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
                  {STOCK_LOCATION_LABELS[v.fromLocation as keyof typeof STOCK_LOCATION_LABELS] ??
                    v.fromLocation}{" "}
                  →{" "}
                  {STOCK_LOCATION_LABELS[v.toLocation as keyof typeof STOCK_LOCATION_LABELS] ??
                    v.toLocation}{" "}
                  · {v.itemCount} items · {mgToGrams(v.totalFineMg)} g fine
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{v.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() =>
                    void markReceived(v.id).then(() => toast.success("Transfer received."))
                  }
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
