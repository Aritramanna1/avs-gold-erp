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
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { usePolishing } from "@/lib/polishing-store";
import { useOrders } from "@/lib/orders-store";
import { useBusinessRules } from "@/lib/business-rules-store";
import { gramsToMg, mgToGrams, fineGoldMg, COMMON_PURITIES } from "@/lib/gold";
import { getDefaultPurityPermille } from "@/lib/ma-tara-workshop-policy";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { Sparkles, AlertTriangle } from "lucide-react";

/**
 * Send to Polishing — the 6 fields this phase calls for (Polisher, Product,
 * Weight, Purity, Expected Return Date, Remarks), plus an optional
 * Production Order link. Saving appends to the Gold Ledger (karigar
 * bucket — a polisher is, for balance purposes, a third party temporarily
 * holding the shop's gold), the Polishing Ledger, and — if linked and
 * `auto_timeline_entries_polishing` is on — the order's timeline.
 *
 * When opened from a specific order's own page, `orderId`/`orderNo` are
 * supplied as fixed props and no picker is shown. When opened standalone
 * (the Polishing Ledger page), a "Production Order" select lets the user
 * optionally link one — the same field, just rendered as an editable
 * picker instead of a fixed label, per "Production Order (optional)" being
 * a genuine field in this form, not just a prop the caller happens to know.
 */
export function SendToPolishingDialog({
  open,
  onClose,
  orderId: fixedOrderId,
  orderNo: fixedOrderNo,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  orderId?: string;
  orderNo?: string;
  onSent?: (info: { grossMg: number; polisherName: string }) => void;
}) {
  const appendLedger = useLedger((s) => s.append);
  const allOrders = useOrders((s) => s.orders);
  const [pickedOrderId, setPickedOrderId] = useState<string>("");
  const orderId = fixedOrderId ?? (pickedOrderId || undefined);
  const orderNo = fixedOrderId
    ? fixedOrderNo
    : allOrders.find((o) => o.id === pickedOrderId)?.orderNo;
  const entries = useLedger((s) => s.entries);
  const people = usePeople((s) => s.people);
  const addPolishing = usePolishing((s) => s.add);
  const isEnabled = useBusinessRules((s) => s.isEnabled);
  const requireApproval = isEnabled("require_approval_before_sending_polishing");

  const polishers = useMemo(
    () =>
      people.filter(
        (p) => p.type === "karigar" || p.type === "worker" || p.type === "outside_worker",
      ),
    [people],
  );
  const balances = useMemo(() => computeBalances(entries), [entries]);
  const vaultMg = balances.buckets.vault;

  const [polisherId, setPolisherId] = useState("");
  const [product, setProduct] = useState("");
  const [weightStr, setWeightStr] = useState("");
  const [purityStr, setPurityStr] = useState(String(getDefaultPurityPermille()));
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setPolisherId("");
      setProduct("");
      setWeightStr("");
      setPurityStr("995");
      setExpectedReturnDate("");
      setRemarks("");
      setApprovedBy("");
      setPickedOrderId("");
      setError(null);
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [open]);

  const grossMg = (() => {
    const n = Number(weightStr);
    return Number.isFinite(n) && n > 0 ? gramsToMg(n) : 0;
  })();
  const purity = Number(purityStr) || 0;
  const fineMg = purity > 0 ? fineGoldMg(grossMg, purity) : grossMg;
  const willOverdraw = fineMg > vaultMg;
  const todayStr = new Date().toISOString().split("T")[0];
  const isPastDate = !!expectedReturnDate && expectedReturnDate < todayStr;

  const canSubmit =
    !!polisherId &&
    product.trim().length > 0 &&
    grossMg > 0 &&
    purity > 0 &&
    !isPastDate &&
    (!requireApproval || approvedBy.trim().length > 0) &&
    !saving;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    const polisher = people.find((p) => p.id === polisherId);
    if (!polisher) {
      setError("Select a polisher.");
      return;
    }
    setSaving(true);
    try {
      const ledgerEntry = await appendLedger({
        type: "sent_to_polisher",
        netFineMg: 0,
        deltas: { vault: -fineMg, karigar: fineMg },
        grossMg,
        purity,
        fineMg,
        reference: orderNo ?? product.trim(),
        notes: `Sent ${product.trim()} to ${polisher.fullName} for polishing${orderNo ? ` · Order ${orderNo}` : ""}${remarks.trim() ? ` · ${remarks.trim()}` : ""}`,
      });

      const { data } = await supabase.auth.getSession();
      await addPolishing(
        {
          type: "sent",
          polisherId,
          polisherName: polisher.fullName,
          orderId,
          orderNo,
          product: product.trim(),
          grossMg,
          purity,
          fineMg,
          expectedReturnDate: expectedReturnDate || undefined,
          remarks: remarks.trim() || undefined,
          ledgerEntryId: ledgerEntry.id,
          approvedBy: requireApproval ? approvedBy.trim() : undefined,
        },
        { id: data.session?.user.id ?? null, email: data.session?.user.email ?? null },
      );

      if (orderId && useBusinessRules.getState().isEnabled("auto_timeline_entries_polishing")) {
        const { useOrders: useOrdersLive } = await import("@/lib/orders-store");
        await useOrdersLive.getState().appendTimeline(orderId, {
          ts: Date.now(),
          label: "Sent to Polishing",
          note: `${(grossMg / 1000).toFixed(3)}g → ${polisher.fullName}`,
        });
      }

      onSent?.({ grossMg, polisherName: polisher.fullName });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to record send to polishing.");
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
            <Sparkles className="h-4 w-4 text-gold" /> Send to Polishing
          </DialogTitle>
          {orderNo && <DialogDescription>Order {orderNo}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Polisher *</Label>
            <Select value={polisherId} onValueChange={setPolisherId}>
              <SelectTrigger
                ref={firstFieldRef as any}
                data-testid="polishing-send-polisher-select"
              >
                <SelectValue placeholder="Select polisher…" />
              </SelectTrigger>
              <SelectContent>
                {polishers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName} · {PERSON_TYPE_LABELS[p.type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!fixedOrderId && (
            <div>
              <Label>Production Order (optional)</Label>
              <Select
                value={pickedOrderId || "none"}
                onValueChange={(v) => setPickedOrderId(v === "none" ? "" : v)}
              >
                <SelectTrigger data-testid="polishing-send-order-select">
                  <SelectValue placeholder="No order — standalone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No order — standalone</SelectItem>
                  {allOrders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.orderNo} · {o.item.itemName || o.item.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Product *</Label>
            <Input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. Gold bangle pair"
              data-testid="polishing-send-product-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Weight (g) *</Label>
              <Input
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value)}
                placeholder="10.000"
                inputMode="decimal"
                data-testid="polishing-send-weight-input"
              />
            </div>
            <div>
              <Label>Purity *</Label>
              <Select value={purityStr} onValueChange={setPurityStr}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_PURITIES.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {grossMg > 0 && purity > 0 && (
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 flex items-center justify-between text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Fine gold (auto)
                </div>
                <div className="font-mono text-gold">{mgToGrams(fineMg)} g</div>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                Vault after send:
                <br />
                <span className="font-mono text-foreground">
                  {mgToGrams(Math.max(0, vaultMg - fineMg))} g
                </span>
              </div>
            </div>
          )}

          <div>
            <Label>Expected Return Date</Label>
            <Input
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
              className={isPastDate ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {isPastDate && (
              <p className="text-xs text-red-500 mt-1 font-medium">
                Expected return date cannot be in the past.
              </p>
            )}
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

          {requireApproval && (
            <div>
              <Label>Approved By *</Label>
              <Input
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="Required by current settings — manager/owner name"
                data-testid="polishing-send-approver-input"
              />
            </div>
          )}

          {willOverdraw && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" /> Vault does not have enough fine gold for this
              send.
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
            data-testid="polishing-send-submit"
          >
            <Sparkles className="h-4 w-4" /> {saving ? "Sending…" : "Send (Enter)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
