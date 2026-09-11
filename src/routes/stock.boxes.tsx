import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/lib/settings-store";
import { STOCK_LOCATION_LABELS, STOCK_LOCATIONS, useStock } from "@/lib/stock-store";
import { useStockBoxTrays } from "@/lib/stock-box-tray-store";
import { Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app-info";

export const Route = createFileRoute("/stock/boxes")({
  head: () => ({ meta: [{ title: `Box & Tray Masters · ${APP_NAME}` }] }),
  component: StockBoxesPage,
});

function StockBoxesPage() {
  const branchId = useSettings((s) => s.selectedBranchId || "MAIN");
  const { trays, loading, hydrate, upsert, remove } = useStockBoxTrays();
  const stockItems = useStock((s) => s.items);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [trayType, setTrayType] = useState<"box" | "tray" | "display">("tray");
  const [location, setLocation] = useState<string>("counter");

  useEffect(() => {
    void hydrate(branchId);
  }, [branchId, hydrate]);

  const branchTrays = useMemo(
    () => trays.filter((t) => t.branchId === branchId && t.isActive),
    [trays, branchId],
  );

  const itemsByTray = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of stockItems) {
      const tray = (item as { trayNumber?: string }).trayNumber;
      if (tray) map.set(tray, (map.get(tray) ?? 0) + 1);
    }
    return map;
  }, [stockItems]);

  async function handleSave() {
    if (!code.trim() || !name.trim()) {
      toast.error("Code and name are required.");
      return;
    }
    try {
      await upsert({
        branchId,
        code,
        name,
        trayType,
        stockLocation: location,
        capacityItems: null,
        notes: null,
        isActive: true,
      });
      toast.success("Box/tray saved.");
      setOpen(false);
      setCode("");
      setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Box & Tray Masters"
        subtitle="Physical stock organization for counter display, vault trays, and audit scans."
        backTo="/stock"
        backLabel="Back to Stock"
        actions={
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add Box / Tray
          </Button>
        }
      />

      {loading && branchTrays.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading trays…</p>
      ) : branchTrays.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground text-sm">
          No boxes or trays defined for this branch yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {branchTrays.map((tray) => (
            <div
              key={tray.id}
              className="flex items-center justify-between rounded-md border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <div className="font-semibold">
                    {tray.code} — {tray.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {tray.trayType.toUpperCase()} ·{" "}
                    {STOCK_LOCATION_LABELS[
                      tray.stockLocation as keyof typeof STOCK_LOCATION_LABELS
                    ] ?? tray.stockLocation}{" "}
                    · {itemsByTray.get(tray.code) ?? 0} tagged items
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{tray.trayType}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remove(tray.id)}
                  aria-label="Remove tray"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Assign tray codes on stock item detail pages or during physical stock audit scans.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Box / Tray</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Code</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TRAY-A1" />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Showroom Tray A1"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={trayType} onValueChange={(v) => setTrayType(v as typeof trayType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tray">Tray</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="display">Display</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Stock location</Label>
              <Select value={location} onValueChange={setLocation}>
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
          <DialogFooter>
            <Button onClick={() => void handleSave()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
