import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrders } from "@/lib/orders-store";
import { rupeesToPaise, paiseToRupees } from "@/lib/orders-store";
import { useOutsideWorkLabour, OUTSIDE_WORK_LABOUR_METHODS } from "@/lib/outside-work-labour-store";
import { useWorkflowEngine } from "@/lib/workflow-engine";
import { Receipt, AlertTriangle, FileUp } from "lucide-react";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * "Labour Charge / Bill" — records what an outside jeweller billed for
 * their work. Does not touch the Gold Ledger (labour is cash, not gold);
 * it automatically contributes to the linked Production Order's
 * Manufacturing Cost purely by existing (computeOutsideWorkCostForOrder
 * reads this log directly — no duplicate cost entry anywhere else).
 */
export function OutsideWorkLabourDialog({
  open,
  onClose,
  jewellerId,
  jewellerName,
  defaultOrderId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  jewellerId: string;
  jewellerName: string;
  defaultOrderId?: string;
  onSaved?: () => void;
}) {
  const orders = useOrders((s) => s.orders);
  const addCharge = useOutsideWorkLabour((s) => s.addCharge);
  const config = useWorkflowEngine((s) => s.config);

  const [orderId, setOrderId] = useState("none");
  const [calculationMethod, setCalculationMethod] = useState(config.outsideWorkDefaultLabourMethod);
  const [quantityBasisStr, setQuantityBasisStr] = useState("");
  const [rateStr, setRateStr] = useState("");
  const [labourChargeStr, setLabourChargeStr] = useState("");
  const [gstEnabled, setGstEnabled] = useState(config.outsideWorkGstEnabled);
  const [gstRateStr, setGstRateStr] = useState(String(config.outsideWorkGstRatePct));
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attachment, setAttachment] = useState<{ dataUrl: string; fileName: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setOrderId(defaultOrderId ?? "none");
      setCalculationMethod(config.outsideWorkDefaultLabourMethod);
      setQuantityBasisStr("");
      setRateStr("");
      setLabourChargeStr("");
      setGstEnabled(config.outsideWorkGstEnabled);
      setGstRateStr(String(config.outsideWorkGstRatePct));
      setBillNumber("");
      setBillDate("");
      setRemarks("");
      setAttachment(null);
      setError(null);
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultOrderId]);

  // Auto-computes labour charge from quantity × rate when both are given —
  // but the operator can always override the computed figure directly, so
  // a calculation method quirk never blocks entering the real billed amount.
  useEffect(() => {
    const qty = Number(quantityBasisStr);
    const rate = Number(rateStr);
    if (Number.isFinite(qty) && qty > 0 && Number.isFinite(rate) && rate > 0) {
      setLabourChargeStr((rate * qty).toFixed(2));
    }
  }, [quantityBasisStr, rateStr]);

  const labourChargePaise = rupeesToPaise(labourChargeStr || "0");
  const gstRatePct = Number(gstRateStr) || 0;
  const gstAmountPaise = gstEnabled ? Math.round((labourChargePaise * gstRatePct) / 100) : 0;
  const totalPaise = labourChargePaise + gstAmountPaise;

  const canSubmit = labourChargePaise > 0 && !saving;

  const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB — stored inline as base64 in the row's JSONB data

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("Attachment too large — please choose a file under 5 MB.");
      e.target.value = "";
      return;
    }
    setUploadingFile(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachment({ dataUrl, fileName: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach file");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    const order = orderId !== "none" ? orders.find((o) => o.id === orderId) : undefined;
    setSaving(true);
    try {
      await addCharge({
        jewellerId,
        jewellerName,
        orderId: order?.id,
        orderNo: order?.orderNo,
        calculationMethod,
        quantityBasis: Number(quantityBasisStr) || undefined,
        ratePaise: rateStr ? rupeesToPaise(rateStr) : undefined,
        labourChargePaise,
        gstEnabled,
        gstRatePct,
        gstAmountPaise,
        totalPaise,
        billNumber: billNumber.trim() || undefined,
        billDate: billDate || undefined,
        billAttachmentDataUrl: attachment?.dataUrl,
        billAttachmentFileName: attachment?.fileName,
        remarks: remarks.trim() || undefined,
        approved: !config.outsideWorkApprovalRequired,
      });

      if (order) {
        await useOrders.getState().appendTimeline(order.id, {
          ts: Date.now(),
          label: "Outside work labour billed",
          note: `${jewellerName} · ₹${paiseToRupees(totalPaise)}${billNumber ? ` · Bill ${billNumber}` : ""}`,
        });
      }

      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record labour charge.");
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-gold" /> Labour Charge / Bill
          </DialogTitle>
          <DialogDescription>{jewellerName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Production Order (optional)</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger ref={firstFieldRef as any} data-testid="outside-labour-order-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked order</SelectItem>
                {orders.slice(0, 200).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.orderNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Labour Calculation Method</Label>
            <Select value={calculationMethod} onValueChange={setCalculationMethod}>
              <SelectTrigger data-testid="outside-labour-method-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTSIDE_WORK_LABOUR_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity (pcs / g)</Label>
              <Input
                value={quantityBasisStr}
                onChange={(e) => setQuantityBasisStr(e.target.value)}
                placeholder="Optional"
                inputMode="decimal"
              />
            </div>
            <div>
              <Label>Rate (₹ / unit)</Label>
              <Input
                value={rateStr}
                onChange={(e) => setRateStr(e.target.value)}
                placeholder="Optional"
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <Label>Labour Charge (₹) *</Label>
            <Input
              value={labourChargeStr}
              onChange={(e) => setLabourChargeStr(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              data-testid="outside-labour-amount-input"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="mb-0">GST</Label>
              <Switch
                checked={gstEnabled}
                onCheckedChange={setGstEnabled}
                data-testid="outside-labour-gst-switch"
              />
            </div>
            {gstEnabled && (
              <div className="flex items-center gap-2">
                <Input
                  value={gstRateStr}
                  onChange={(e) => setGstRateStr(e.target.value)}
                  className="w-24"
                  inputMode="decimal"
                />
                <span className="text-xs text-muted-foreground">
                  % → ₹{paiseToRupees(gstAmountPaise)}
                </span>
              </div>
            )}
            <div className="text-sm pt-1 border-t border-border/60">
              Total: <span className="font-mono text-gold">₹{paiseToRupees(totalPaise)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bill Number</Label>
              <Input
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>Bill Date</Label>
              <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Bill Attachment (optional)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
              >
                <FileUp className="h-3.5 w-3.5" /> {uploadingFile ? "Processing…" : "Choose File"}
              </Button>
              {attachment && (
                <span className="text-xs text-muted-foreground truncate">
                  {attachment.fileName}
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelected}
              />
            </div>
          </div>

          <div>
            <Label>Remarks (optional)</Label>
            <Textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes…"
            />
          </div>

          {config.outsideWorkApprovalRequired && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">
              This charge will be saved as <strong>pending approval</strong> — approve it from the
              ledger before it can be settled (Settings → Workflow Engine).
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel (Esc)
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="gap-2"
            data-testid="outside-labour-submit"
          >
            <Receipt className="h-4 w-4" /> {saving ? "Saving…" : "Save Bill (Enter)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
