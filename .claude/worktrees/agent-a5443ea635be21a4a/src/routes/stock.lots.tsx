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
import { useSettings } from "@/lib/settings-store";
import { useStock } from "@/lib/stock-store";
import { useLots, loadLots, summarizeLot, type StockLot } from "@/lib/lot-store";
import { mgToGrams } from "@/lib/gold";
import { Package, Plus, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stock/lots")({
  head: () => ({ meta: [{ title: "Lot & Batch Management · MTJ ERP" }] }),
  component: LotsPage,
});

function LotsPage() {
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const lots = useLots((s) => s.lots);
  const [creating, setCreating] = useState(false);
  const [assigningLot, setAssigningLot] = useState<StockLot | null>(null);

  useEffect(() => {
    void loadLots();
  }, []);

  const branchLots = useMemo(
    () => lots.filter((l) => l.branchId === (selectedBranchId || "MAIN")).sort((a, b) => b.receivedAt - a.receivedAt),
    [lots, selectedBranchId],
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Lot & Batch Management"
        subtitle="Group stock items received or manufactured together for traceability and hallmark batches."
        actions={
          <Button onClick={() => setCreating(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Lot
          </Button>
        }
      />

      <div className="grid gap-4">
        {branchLots.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            No lots created yet for this branch.
          </div>
        )}
        {branchLots.map((lot) => {
          const summary = summarizeLot(lot.id);
          return (
            <div key={lot.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{lot.lotNumber}</span>
                  <Badge variant={lot.status === "open" ? "secondary" : "outline"}>{lot.status}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAssigningLot(lot)}>
                    Assign Items
                  </Button>
                  {lot.status === "open" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => useLots.getState().close(lot.id)}
                    >
                      <Lock className="h-3.5 w-3.5" /> Close Lot
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => useLots.getState().reopen(lot.id)}
                    >
                      <LockOpen className="h-3.5 w-3.5" /> Reopen
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-sm text-muted-foreground mb-2">
                Source: {lot.source.replace(/_/g, " ")}
                {lot.supplierOrKarigarName ? ` · ${lot.supplierOrKarigarName}` : ""} · Received{" "}
                {new Date(lot.receivedAt).toLocaleDateString()}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Items</div>
                  <div className="font-semibold">{summary.items.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Total Fine (g)</div>
                  <div className="font-semibold">{mgToGrams(summary.totalFineMg)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Available / Sold</div>
                  <div className="font-semibold">
                    {summary.availableCount} / {summary.soldCount}
                  </div>
                </div>
              </div>
              {lot.notes && <div className="text-sm text-muted-foreground mt-2">{lot.notes}</div>}
            </div>
          );
        })}
      </div>

      <NewLotDialog open={creating} onClose={() => setCreating(false)} branchId={selectedBranchId || "MAIN"} />
      <AssignItemsDialog lot={assigningLot} onClose={() => setAssigningLot(null)} />
    </div>
  );
}

function NewLotDialog({
  open,
  onClose,
  branchId,
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
}) {
  const [source, setSource] = useState<StockLot["source"]>("supplier_receipt");
  const [supplierName, setSupplierName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    try {
      const lotNumber = useLots.getState().nextLotNumber(branchId);
      await useLots.getState().create({
        branchId,
        lotNumber,
        source,
        supplierOrKarigarName: supplierName || undefined,
        notes: notes || undefined,
      });
      toast.success(`Lot ${lotNumber} created.`);
      setSupplierName("");
      setNotes("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create lot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Lot / Batch</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1">
            <Label>Source</Label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as StockLot["source"])}
              className="rounded-lg border border-border bg-background p-2 text-sm h-10"
            >
              <option value="supplier_receipt">Supplier Receipt</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="opening_stock">Opening Stock</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Supplier / Karigar Name (optional)</Label>
            <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            Create Lot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignItemsDialog({ lot, onClose }: { lot: StockLot | null; onClose: () => void }) {
  const items = useStock((s) => s.items);
  const [q, setQ] = useState("");

  const candidates = useMemo(() => {
    if (!lot) return [];
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) => i.lotId !== lot.id)
      .filter(
        (i) =>
          !needle ||
          i.itemCode.toLowerCase().includes(needle) ||
          i.barcode.toLowerCase().includes(needle) ||
          i.itemName.toLowerCase().includes(needle),
      )
      .slice(0, 50);
  }, [items, lot, q]);

  const assigned = useMemo(() => (lot ? items.filter((i) => i.lotId === lot.id) : []), [items, lot]);

  async function assign(itemId: string) {
    if (!lot) return;
    await useStock.getState().update(itemId, { lotId: lot.id });
  }

  async function unassign(itemId: string) {
    await useStock.getState().update(itemId, { lotId: undefined });
  }

  return (
    <Dialog open={!!lot} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Items to {lot?.lotNumber}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Currently in lot ({assigned.length})</Label>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border mt-1">
              {assigned.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">No items assigned yet.</div>
              )}
              {assigned.map((i) => (
                <div key={i.id} className="flex items-center justify-between p-2 border-b border-border last:border-0 text-sm">
                  <span>
                    {i.itemCode} · {i.itemName}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => unassign(i.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Add items</Label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by item code, barcode or name"
              className="mb-2"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
              {candidates.map((i) => (
                <div key={i.id} className="flex items-center justify-between p-2 border-b border-border last:border-0 text-sm">
                  <span>
                    {i.itemCode} · {i.itemName}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => assign(i.id)}>
                    Add
                  </Button>
                </div>
              ))}
              {candidates.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">No matching unassigned items.</div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
