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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrders } from "@/lib/orders-store";
import { rupeesToPaise, paiseToRupees } from "@/lib/orders-store";
import {
  useOutsideWorkLabour,
  computeOutsideWorkLabourPosition,
  type OutsideWorkPayment,
} from "@/lib/outside-work-labour-store";
import { useWorkflowEngine } from "@/lib/workflow-engine";
import { Wallet, AlertTriangle } from "lucide-react";

const PAY_MODES: { value: OutsideWorkPayment["mode"]; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
];

/**
 * Records a payment made to an outside jeweller against their labour
 * outstanding — supports Full, Partial, or (by simply not recording one
 * yet) Pending payment; "status" is never a stored field, it's always
 * derived from totalBilled vs totalPaid (see computeOutsideWorkLabourPosition).
 * Every payment is its own immutable, timestamped record — the audit trail
 * is the log itself.
 */
export function OutsideWorkPaymentDialog({
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
  const addPayment = useOutsideWorkLabour((s) => s.addPayment);
  const charges = useOutsideWorkLabour((s) => s.charges);
  const payments = useOutsideWorkLabour((s) => s.payments);
  const config = useWorkflowEngine((s) => s.config);

  const jewellerCharges = useMemo(
    () => charges.filter((c) => c.jewellerId === jewellerId),
    [charges, jewellerId],
  );
  const jewellerPayments = useMemo(
    () => payments.filter((p) => p.jewellerId === jewellerId),
    [payments, jewellerId],
  );
  const position = useMemo(
    () => computeOutsideWorkLabourPosition(jewellerCharges, jewellerPayments),
    [jewellerCharges, jewellerPayments],
  );

  const [orderId, setOrderId] = useState("none");
  const [amountStr, setAmountStr] = useState("");
  const [mode, setMode] = useState<OutsideWorkPayment["mode"]>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setOrderId(defaultOrderId ?? "none");
      setAmountStr(
        position.outstandingPaise > 0 ? (position.outstandingPaise / 100).toFixed(2) : "",
      );
      setMode("cash");
      setReference("");
      setNotes("");
      setError(null);
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultOrderId]);

  const amountPaise = rupeesToPaise(amountStr || "0");
  const isOverpayment = amountPaise > position.outstandingPaise;
  const blockedAsAdvance = isOverpayment && !config.outsideWorkAllowAdvancePayments;
  const canSubmit = amountPaise > 0 && !blockedAsAdvance && !saving;
  const isFullSettlement =
    amountPaise >= position.outstandingPaise && position.outstandingPaise > 0;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    const order = orderId !== "none" ? orders.find((o) => o.id === orderId) : undefined;
    setSaving(true);
    try {
      await addPayment({
        jewellerId,
        jewellerName,
        amountPaise,
        mode,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        orderId: order?.id,
        orderNo: order?.orderNo,
      });

      if (order) {
        await useOrders.getState().appendTimeline(order.id, {
          ts: Date.now(),
          label: "Outside work payment made",
          note: `${jewellerName} · ₹${paiseToRupees(amountPaise)} via ${mode}`,
        });
      }

      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record payment.");
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
      <DialogContent className="max-w-md" onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-gold" /> Record Payment
          </DialogTitle>
          <DialogDescription>{jewellerName}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm flex items-center justify-between">
          <span className="text-muted-foreground">Outstanding</span>
          <span className="font-mono text-gold">₹{paiseToRupees(position.outstandingPaise)}</span>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Amount (₹) *</Label>
            <Input
              ref={firstFieldRef}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              data-testid="outside-payment-amount-input"
            />
          </div>

          <div>
            <Label>Mode *</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as OutsideWorkPayment["mode"])}>
              <SelectTrigger data-testid="outside-payment-mode-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAY_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Production Order (optional)</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger>
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
            <Label>Reference (optional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UTR / cheque no."
            />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
            />
          </div>

          {isFullSettlement && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-300">
              This clears the labour outstanding in full.
            </div>
          )}
          {isOverpayment && !blockedAsAdvance && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> This exceeds the current outstanding — the
              excess will show as an advance.
            </div>
          )}
          {blockedAsAdvance && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Advance payments are disabled (Settings →
              Workflow Engine) — amount cannot exceed the outstanding of ₹
              {paiseToRupees(position.outstandingPaise)}.
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
              {error}
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
            data-testid="outside-payment-submit"
          >
            <Wallet className="h-4 w-4" /> {saving ? "Saving…" : "Record Payment (Enter)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
