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
import {
  useStones,
  loadStones,
  STONE_TYPE_LABELS,
  type StoneType,
  type StoneRecord,
} from "@/lib/stone-store";
import { fmtRs } from "@/lib/report-engine";
import { Gem, Plus, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stock/stones")({
  head: () => ({ meta: [{ title: "Stone & Diamond Tracking · AVS Gold ERP" }] }),
  component: StonesPage,
});

function StonesPage() {
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const stones = useStones((s) => s.stones);
  const items = useStock((s) => s.items);
  const [adding, setAdding] = useState(false);
  const [linkingStone, setLinkingStone] = useState<StoneRecord | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    void loadStones();
  }, []);

  const branchStones = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return stones
      .filter((s) => s.branchId === (selectedBranchId || "MAIN"))
      .filter(
        (s) =>
          !needle ||
          (s.certificateNumber ?? "").toLowerCase().includes(needle) ||
          STONE_TYPE_LABELS[s.stoneType].toLowerCase().includes(needle),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [stones, selectedBranchId, q]);

  const itemCodeById = useMemo(() => new Map(items.map((i) => [i.id, i.itemCode])), [items]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Stone & Diamond Tracking"
        subtitle="Per-stone certificate, carat and cost records — linked to the finished item they're set into."
        actions={
          <Button onClick={() => setAdding(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Stone
          </Button>
        }
      />

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by certificate number or stone type"
        className="mb-4 max-w-sm"
      />

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-3">Stone</th>
                <th className="p-3">Carat</th>
                <th className="p-3">Clarity/Color</th>
                <th className="p-3">Certificate</th>
                <th className="p-3">Cost</th>
                <th className="p-3">Linked Item</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {branchStones.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No stone records yet.
                  </td>
                </tr>
              )}
              {branchStones.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="p-3 flex items-center gap-2">
                    <Gem className="h-4 w-4 text-muted-foreground" />
                    {STONE_TYPE_LABELS[s.stoneType]} {s.count > 1 ? `×${s.count}` : ""}
                  </td>
                  <td className="p-3">{s.caratWeight.toFixed(3)} ct</td>
                  <td className="p-3">
                    {s.clarity ?? "—"} / {s.color ?? "—"}
                  </td>
                  <td className="p-3">
                    {s.certificateNumber ? (
                      <span>
                        {s.certificateNumber}
                        {s.certifyingLab ? ` (${s.certifyingLab})` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">{s.purchaseCostPaise ? fmtRs(s.purchaseCostPaise) : "—"}</td>
                  <td className="p-3">
                    {s.itemId ? (
                      <Badge variant="secondary">{itemCodeById.get(s.itemId) ?? s.itemId}</Badge>
                    ) : (
                      <Badge variant="outline">Unset</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {s.itemId ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1"
                        onClick={() => useStones.getState().unlinkFromItem(s.id)}
                      >
                        <Unlink className="h-3.5 w-3.5" /> Unlink
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => setLinkingStone(s)}
                      >
                        <Link2 className="h-3.5 w-3.5" /> Link to Item
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddStoneDialog
        open={adding}
        onClose={() => setAdding(false)}
        branchId={selectedBranchId || "MAIN"}
      />
      <LinkStoneDialog stone={linkingStone} onClose={() => setLinkingStone(null)} />
    </div>
  );
}

function AddStoneDialog({
  open,
  onClose,
  branchId,
}: {
  open: boolean;
  onClose: () => void;
  branchId: string;
}) {
  const [stoneType, setStoneType] = useState<StoneType>("diamond");
  const [count, setCount] = useState("1");
  const [caratWeight, setCaratWeight] = useState("");
  const [clarity, setClarity] = useState("");
  const [color, setColor] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [certifyingLab, setCertifyingLab] = useState("");
  const [costR, setCostR] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const carat = Number(caratWeight);
    if (!carat || carat <= 0) {
      toast.error("Enter a valid carat weight");
      return;
    }
    setSaving(true);
    try {
      await useStones.getState().add({
        branchId,
        stoneType,
        count: Math.max(1, Number(count) || 1),
        caratWeight: carat,
        clarity: clarity || undefined,
        color: color || undefined,
        certificateNumber: certificateNumber || undefined,
        certifyingLab: certifyingLab || undefined,
        purchaseCostPaise: costR ? Math.round(Number(costR) * 100) : undefined,
      });
      toast.success("Stone record added.");
      setCaratWeight("");
      setClarity("");
      setColor("");
      setCertificateNumber("");
      setCertifyingLab("");
      setCostR("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Stone / Diamond Record</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label>Stone Type</Label>
            <select
              value={stoneType}
              onChange={(e) => setStoneType(e.target.value as StoneType)}
              className="rounded-lg border border-border bg-background p-2 text-sm h-10"
            >
              {Object.entries(STONE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Count</Label>
            <Input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Carat Weight *</Label>
            <Input
              type="number"
              step="0.001"
              value={caratWeight}
              onChange={(e) => setCaratWeight(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Purchase Cost (₹)</Label>
            <Input
              type="number"
              step="0.01"
              value={costR}
              onChange={(e) => setCostR(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Clarity</Label>
            <Input
              value={clarity}
              onChange={(e) => setClarity(e.target.value)}
              placeholder="e.g. VVS1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Color</Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. D" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Certificate Number</Label>
            <Input
              value={certificateNumber}
              onChange={(e) => setCertificateNumber(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Certifying Lab</Label>
            <Input
              value={certifyingLab}
              onChange={(e) => setCertifyingLab(e.target.value)}
              placeholder="e.g. GIA, IGI"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={saving}>
            Add Stone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkStoneDialog({ stone, onClose }: { stone: StoneRecord | null; onClose: () => void }) {
  const items = useStock((s) => s.items);
  const [q, setQ] = useState("");

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter(
        (i) =>
          !needle ||
          i.itemCode.toLowerCase().includes(needle) ||
          i.barcode.toLowerCase().includes(needle) ||
          i.itemName.toLowerCase().includes(needle),
      )
      .slice(0, 50);
  }, [items, q]);

  async function handleLink(itemId: string) {
    if (!stone) return;
    await useStones.getState().linkToItem(stone.id, itemId);
    toast.success("Stone linked to item.");
    onClose();
  }

  return (
    <Dialog open={!!stone} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Stone to Stock Item</DialogTitle>
        </DialogHeader>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search item code, barcode or name"
          className="mb-2"
        />
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          {candidates.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between p-2 border-b border-border last:border-0 text-sm"
            >
              <span>
                {i.itemCode} · {i.itemName}
              </span>
              <Button size="sm" variant="outline" onClick={() => handleLink(i.id)}>
                Link
              </Button>
            </div>
          ))}
          {candidates.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">No matching items.</div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
