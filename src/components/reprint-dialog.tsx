import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { REPRINT_REASON_LABELS, type ReprintReason } from "@/lib/printlog-store";
import { Printer } from "lucide-react";

export function ReprintReasonDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: ReprintReason, note?: string) => void;
}) {
  const [reason, setReason] = useState<ReprintReason>("customer_copy");
  const [note, setNote] = useState("");

  function confirm() {
    onConfirm(reason, note.trim() || undefined);
    onClose();
    setNote("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reprint — please select a reason</DialogTitle>
          <DialogDescription>
            Every reprint is logged for audit. Choose the closest reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={(v) => setReason(v as ReprintReason)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REPRINT_REASON_LABELS) as ReprintReason[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {REPRINT_REASON_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Optional note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} className="gap-1">
            <Printer className="h-4 w-4" /> Reprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
