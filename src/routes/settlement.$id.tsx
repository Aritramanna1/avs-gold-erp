import { createFileRoute, useParams, Link } from "@tanstack/react-router";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useSettlements,
  previewSettlementTotals,
  FINANCIAL_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  type DeliveryStatus,
} from "@/lib/settlement-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import {
  paiseToRupees,
  rupeesToPaise,
  PAYMENT_MODE_LABELS,
  type PaymentMode,
} from "@/lib/billing-store";
import { useCurrentBranchId } from "@/lib/branch-store";
import { mgToGrams, gramsToMg, fineGoldMg, COMMON_PURITIES } from "@/lib/gold";
import { getDefaultPurityPermille } from "@/lib/ma-tara-workshop-policy";
import { useCurrentGoldRatePaise } from "@/lib/bullion-rate-service";
import { ArrowLeft, Printer, CheckCircle2, Truck, Coins } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settlement/$id")({
  head: () => ({ meta: [{ title: "Settlement · AVS Gold ERP" }] }),
  component: SettlementView,
});

const CASH_MODES: PaymentMode[] = ["cash", "upi", "bank", "cheque"];

function SettlementView() {
  const { id } = useParams({ from: "/settlement/$id" });
  const s = useSettlements((st) => st.settlements.find((x) => x.id === id));
  const refresh = useSettlements((st) => st.refresh);
  const recordPayment = useSettlements((st) => st.recordPayment);
  const applyExistingCredit = useSettlements((st) => st.applyExistingCredit);
  const setDeliveryStatus = useSettlements((st) => st.setDeliveryStatus);
  const patchRemarks = useSettlements((st) => st.patchRemarks);
  const addItem = useSettlements((st) => st.addItem);
  const removeItem = useSettlements((st) => st.removeItem);
  const completeFinalSettlement = useSettlements((st) => st.completeFinalSettlement);
  const branchId = useCurrentBranchId();
  const goldRatePerGramPaise = useCurrentGoldRatePaise();

  const [payMode, setPayMode] = useState<PaymentMode>("cash");
  const [payAmt, setPayAmt] = useState("");
  const [goldGramsStr, setGoldGramsStr] = useState("");
  const [goldPurityStr, setGoldPurityStr] = useState(String(getDefaultPurityPermille()));
  const [payRef, setPayRef] = useState("");
  const [deliveryPersonName, setDeliveryPersonName] = useState("");
  const [finalising, setFinalising] = useState(false);
  const [finaliseConfirmOpen, setFinaliseConfirmOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemGrossG, setNewItemGrossG] = useState("");
  const [newItemPurity, setNewItemPurity] = useState(String(getDefaultPurityPermille()));
  const [newItemMaking, setNewItemMaking] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Only refresh from storage if this settlement isn't already in memory
  // (e.g. a fresh page load / direct link) — refreshing unconditionally
  // would race the store's own optimistic update right after createDraft()/
  // recordPayment() and could wipe it with a stale cached read before
  // the write has finished propagating (same class of bug fixed earlier in
  // outside-work-store.ts's own pages).
  useEffect(() => {
    if (!s) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDeliveryPersonName(s?.deliveryPersonName ?? "");
  }, [s?.id, s?.deliveryPersonName]);

  const liveLedger = useMemo(() => (s ? compileCustomerLedger(s.customerId) : null), [s]);
  const preview = useMemo(
    () => (s ? previewSettlementTotals(s.items, s.gst, s.payments) : null),
    [s],
  );

  if (!s || !preview) {
    return (
      <div className="p-8 text-center">
        <p className="font-semibold">Settlement not found</p>
        <Link to="/billing" className="text-gold underline mt-2 inline-block">
          Back to Billing
        </Link>
      </div>
    );
  }

  const isFinalised = !!s.finalisedAt;

  async function handleAddItem() {
    const grossMg = gramsToMg(newItemGrossG || "0");
    const purity = Number(newItemPurity) || 0;
    if (grossMg <= 0 || purity <= 0) {
      toast.error("Enter item weight and purity.");
      return;
    }
    setAddingItem(true);
    try {
      const fineMg = fineGoldMg(grossMg, purity);
      await addItem(s!.id, {
        itemName: newItemName.trim() || "Product",
        category: "Jewellery",
        purity,
        grossMg,
        netMg: grossMg,
        fineMg,
        goldRatePerGramPaise,
        makingChargesPaise: Math.round((Number(newItemMaking) || 0) * 100),
        stoneChargesPaise: 0,
        hallmarkChargesPaise: 0,
        otherChargesPaise: 0,
        discountPaise: 0,
      });
      setNewItemName("");
      setNewItemGrossG("");
      setNewItemPurity("995");
      setNewItemMaking("");
      toast.success("Item added to settlement.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add item.");
    } finally {
      setAddingItem(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    try {
      await removeItem(s!.id, itemId);
      toast.success("Item removed.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove item.");
    }
  }

  async function handleApplyCredit(kind: "gold" | "cash" | "both") {
    if (!liveLedger) return;
    await applyExistingCredit(s!.id, {
      goldCreditMg: kind === "gold" || kind === "both" ? liveLedger.goldAdvanceMg : undefined,
      cashCreditPaise:
        kind === "cash" || kind === "both" ? liveLedger.moneyAdvancePaise : undefined,
    });
    toast.success("Existing credit applied.");
  }

  async function handleRecordPayment() {
    const amt = payMode === "gold_exchange" ? 0 : rupeesToPaise(payAmt);
    if (payMode !== "gold_exchange" && amt <= 0) {
      toast.error("Enter a payment amount.");
      return;
    }
    let goldFields = {};
    if (payMode === "gold_exchange") {
      const goldGrossMg = gramsToMg(goldGramsStr || "0");
      const purity = Number(goldPurityStr) || 0;
      if (goldGrossMg <= 0 || purity <= 0) {
        toast.error("Enter gold weight and purity.");
        return;
      }
      const goldFineMg = fineGoldMg(goldGrossMg, purity);
      const goldValuePaise = Math.round((goldFineMg * goldRatePerGramPaise) / 1000);
      goldFields = {
        goldGrossMg,
        goldPurity: purity,
        goldFineMg,
        goldRatePerGramPaise,
      };
      await recordPayment(s!.id, {
        mode: "gold_exchange",
        amountPaise: goldValuePaise,
        reference: payRef || undefined,
        ...goldFields,
      });
    } else {
      await recordPayment(s!.id, {
        mode: payMode,
        amountPaise: amt,
        reference: payRef || undefined,
      });
    }
    setPayAmt("");
    setPayRef("");
    setGoldGramsStr("");
    toast.success("Payment recorded.");
  }

  async function handleFinalSettlement() {
    setFinaliseConfirmOpen(false);
    setFinalising(true);
    try {
      const invoice = await completeFinalSettlement(s!.id, branchId);
      toast.success(`Final Settlement complete — GST Invoice ${invoice.invoiceNo} generated.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to complete final settlement.");
    } finally {
      setFinalising(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/billing">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <PageHeader
            title={s.settlementNo}
            subtitle={`${s.customerName}${s.orderNo ? ` · Order ${s.orderNo}` : ""}`}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="settlement-financial-status">
            {FINANCIAL_STATUS_LABELS[s.financialStatus]}
          </Badge>
          <Badge variant="outline" data-testid="settlement-delivery-status">
            {DELIVERY_STATUS_LABELS[s.deliveryStatus]}
          </Badge>
          <Link to="/settlement/draft-print/$id" params={{ id: s.id }}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              data-testid="settlement-print-draft"
            >
              <Printer className="h-3.5 w-3.5" /> Print Draft (2 Copies)
            </Button>
          </Link>
          {isFinalised && s.linkedInvoiceId && (
            <>
              <Link to="/billing/settlement-slip/$id" params={{ id: s.linkedInvoiceId }}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Settlement Receipt
                </Button>
              </Link>
              <Link to="/billing/print/$id" params={{ id: s.linkedInvoiceId }}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> GST Invoice
                </Button>
              </Link>
              {s.goldSettlementId && (
                <Link to="/billing/gold-settlement-print/$id" params={{ id: s.goldSettlementId }}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Printer className="h-3.5 w-3.5" /> Gold Settlement Voucher
                  </Button>
                </Link>
              )}
              <Button
                size="sm"
                className="gap-1.5"
                data-testid="settlement-print-both"
                onClick={() => {
                  window.open(`/billing/settlement-slip/${s.linkedInvoiceId}`, "_blank");
                  window.open(`/billing/print/${s.linkedInvoiceId}`, "_blank");
                }}
              >
                <Printer className="h-3.5 w-3.5" /> Print Both
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-5 space-y-3">
        <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Items ({s.items.length})
        </div>
        <div className="space-y-1.5">
          {s.items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between text-sm rounded-lg border border-border bg-background/40 px-3 py-1.5"
            >
              <span>
                {it.itemName} — {mgToGrams(it.grossMg)} g · {it.purity} purity
                {it.makingChargesPaise > 0
                  ? ` · Making ₹${paiseToRupees(it.makingChargesPaise)}`
                  : ""}
              </span>
              {!isFinalised && s.items.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-destructive"
                  onClick={() => handleRemoveItem(it.id)}
                  data-testid={`settlement-remove-item-${it.id}`}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        {!isFinalised && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end pt-2 border-t border-border">
            <div className="col-span-2 md:col-span-1">
              <Label className="text-xs">Item name</Label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Product"
                data-testid="settlement-new-item-name"
              />
            </div>
            <div>
              <Label className="text-xs">Weight (g)</Label>
              <Input
                value={newItemGrossG}
                onChange={(e) => setNewItemGrossG(e.target.value)}
                placeholder="10.000"
                inputMode="decimal"
                data-testid="settlement-new-item-weight"
              />
            </div>
            <div>
              <Label className="text-xs">Purity</Label>
              <Select value={newItemPurity} onValueChange={setNewItemPurity}>
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
            <div>
              <Label className="text-xs">Making (₹)</Label>
              <Input
                value={newItemMaking}
                onChange={(e) => setNewItemMaking(e.target.value)}
                placeholder="0"
                inputMode="decimal"
              />
            </div>
            <Button
              onClick={handleAddItem}
              disabled={addingItem}
              className="gap-1.5"
              data-testid="settlement-add-item"
            >
              {addingItem ? "Adding…" : "Add Item"}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-5 space-y-2">
        <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Delivery Status
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["ready", "delivered", "closed"] as DeliveryStatus[]).map((ds) => (
            <Button
              key={ds}
              size="sm"
              variant={s.deliveryStatus === ds ? "default" : "outline"}
              onClick={() => setDeliveryStatus(s.id, ds)}
              className="gap-1.5"
              data-testid={`settlement-delivery-${ds}`}
            >
              <Truck className="h-3.5 w-3.5" /> {DELIVERY_STATUS_LABELS[ds]}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-2 pt-2">
          <div className="flex-1">
            <Label className="text-xs">
              Delivery Person <span className="text-muted-foreground">(internal only)</span>
            </Label>
            <Input
              value={deliveryPersonName}
              onChange={(e) => setDeliveryPersonName(e.target.value)}
              placeholder="Who is carrying this settlement out"
              data-testid="settlement-delivery-person"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              patchRemarks(s.id, { deliveryPersonName: deliveryPersonName.trim() || undefined })
            }
            data-testid="settlement-delivery-person-save"
          >
            Save
          </Button>
        </div>
      </div>

      {liveLedger &&
        !isFinalised &&
        (() => {
          // Available = what compileCustomerLedger() reports minus what
          // THIS settlement has already applied (see the identical guard
          // in settlement-store.ts's applyExistingCredit()) — once fully
          // consumed, the button disappears entirely instead of allowing a
          // no-op click, so it's obvious credit has already been used.
          const availableGoldMg = Math.max(0, liveLedger.goldAdvanceMg - s.goldCreditUsedMg);
          const availableCashPaise = Math.max(
            0,
            liveLedger.moneyAdvancePaise - s.cashCreditUsedPaise,
          );
          if (availableGoldMg <= 0 && availableCashPaise <= 0) return null;
          return (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3">
              <div className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                Existing Credit Detected
              </div>
              <div className="flex gap-6 text-sm">
                {availableGoldMg > 0 && (
                  <div>
                    Gold Credit: <span className="font-mono">{mgToGrams(availableGoldMg)} g</span>
                  </div>
                )}
                {availableCashPaise > 0 && (
                  <div>
                    Cash Credit:{" "}
                    <span className="font-mono">₹{paiseToRupees(availableCashPaise)}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {availableGoldMg > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplyCredit("gold")}
                    data-testid="settlement-apply-gold-credit"
                  >
                    Use Gold Credit
                  </Button>
                )}
                {availableCashPaise > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplyCredit("cash")}
                    data-testid="settlement-apply-cash-credit"
                  >
                    Use Cash Credit
                  </Button>
                )}
                {availableGoldMg > 0 && availableCashPaise > 0 && (
                  <Button size="sm" variant="outline" onClick={() => handleApplyCredit("both")}>
                    Use Both
                  </Button>
                )}
              </div>
            </div>
          );
        })()}

      <div className="rounded-md border border-border bg-card p-5 space-y-2">
        <div className="text-sm font-bold uppercase tracking-wider text-gold">Preview Totals</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Subtotal</div>
            <div className="font-mono">₹{paiseToRupees(preview.subtotalPaise)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">GST + TCS</div>
            <div className="font-mono">₹{paiseToRupees(preview.gstPaise + preview.tcsPaise)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Paid</div>
            <div className="font-mono">₹{paiseToRupees(preview.paidPaise)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Balance</div>
            <div
              className={`font-mono font-bold ${preview.balancePaise > 0 ? "text-amber-400" : "text-emerald-400"}`}
            >
              ₹{paiseToRupees(preview.balancePaise)}
            </div>
          </div>
        </div>
      </div>

      {!isFinalised && (
        <div className="rounded-md border border-border bg-card p-5 space-y-3">
          <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Record Payment
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={payMode} onValueChange={(v) => setPayMode(v as PaymentMode)}>
              <SelectTrigger data-testid="settlement-payment-mode-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...CASH_MODES, "gold_exchange" as PaymentMode].map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {payMode === "gold_exchange" ? (
              <>
                <Input
                  placeholder="Gold gross (g)"
                  value={goldGramsStr}
                  onChange={(e) => setGoldGramsStr(e.target.value)}
                  data-testid="settlement-gold-payment-grams"
                />
                <Select value={goldPurityStr} onValueChange={setGoldPurityStr}>
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
              </>
            ) : (
              <Input
                placeholder="Amount (₹)"
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value)}
                data-testid="settlement-payment-amount"
              />
            )}
            <Input
              placeholder="Reference"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />
          </div>
          <Button
            onClick={handleRecordPayment}
            className="gap-2"
            data-testid="settlement-record-payment"
          >
            <Coins className="h-4 w-4" /> Record Payment
          </Button>
        </div>
      )}

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-serif text-gold">
          Payments Recorded
        </div>
        {s.payments.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No payments recorded yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {s.payments.map((p) => (
              <li key={p.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <span>
                  {PAYMENT_MODE_LABELS[p.mode]}
                  {p.goldFineMg ? ` · ${mgToGrams(p.goldFineMg)} g fine` : ""}
                </span>
                <span className="font-mono">₹{paiseToRupees(p.amountPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isFinalised ? (
        <Button
          onClick={() => setFinaliseConfirmOpen(true)}
          disabled={finalising}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid="settlement-complete-final"
        >
          <CheckCircle2 className="h-4 w-4" />{" "}
          {finalising ? "Finalising…" : "Complete Final Settlement"}
        </Button>
      ) : (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          Final Settlement complete — GST Invoice {s.linkedInvoiceNo} generated.
        </div>
      )}

      {/* Complete Final Settlement is irreversible — it generates a real
          GST Invoice. Require an explicit confirmation, matching the same
          pattern Manufacturing Bill finalisation already uses. */}
      <AlertDialog open={finaliseConfirmOpen} onOpenChange={setFinaliseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Final Settlement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a real GST Invoice for <strong>{s.customerName}</strong> based on
              the payments recorded so far (Balance: ₹{paiseToRupees(preview.balancePaise)}). This
              cannot be undone from here — cancel the resulting invoice from Billing if a mistake is
              found.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Again</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleFinalSettlement}
            >
              Complete Final Settlement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
