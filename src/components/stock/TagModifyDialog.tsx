import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gramsToMg, mgToGrams, fineGoldMg, parsePurity } from "@/lib/gold";
import type { StockItem } from "@/lib/stock-store";
import { toast } from "sonner";

interface TagModifyDialogProps {
  item: StockItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    patch: Partial<StockItem>,
    audit: { reason: string; before: Record<string, unknown> },
  ) => Promise<void>;
}

export function TagModifyDialog({ item, open, onOpenChange, onSave }: TagModifyDialogProps) {
  const [grossStr, setGrossStr] = useState(mgToGrams(item.grossMg));
  const [netStr, setNetStr] = useState(mgToGrams(item.netMg));
  const [purityStr, setPurityStr] = useState(String(item.purity));
  const [huid, setHuid] = useState(item.huid ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!reason.trim() || reason.trim().length < 8) {
      toast.error("Enter a detailed reason (min 8 characters) for tag modification.");
      return;
    }
    try {
      const grossMg = gramsToMg(grossStr);
      const netMg = gramsToMg(netStr);
      const purity = parsePurity(purityStr);
      if (netMg > grossMg) {
        toast.error("Net weight cannot exceed gross weight.");
        return;
      }
      setBusy(true);
      await onSave(
        {
          grossMg,
          netMg,
          purity,
          fineMg: fineGoldMg(netMg, purity),
          huid: huid.trim() || undefined,
        },
        {
          reason: reason.trim(),
          before: {
            grossMg: item.grossMg,
            netMg: item.netMg,
            purity: item.purity,
            fineMg: item.fineMg,
            huid: item.huid,
          },
        },
      );
      toast.success("Tag modified with audit trail.");
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Modification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Controlled Tag Modification</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          RBAC-gated edit for {item.itemCode}. Changes are audited — no silent stock rewrite.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Gross (g)</Label>
            <Input value={grossStr} onChange={(e) => setGrossStr(e.target.value)} />
          </div>
          <div>
            <Label>Net (g)</Label>
            <Input value={netStr} onChange={(e) => setNetStr(e.target.value)} />
          </div>
          <div>
            <Label>Purity</Label>
            <Input value={purityStr} onChange={(e) => setPurityStr(e.target.value)} />
          </div>
          <div>
            <Label>HUID</Label>
            <Input value={huid} onChange={(e) => setHuid(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Modification reason (required)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy}>
            {busy ? "Saving…" : "Save with Audit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
