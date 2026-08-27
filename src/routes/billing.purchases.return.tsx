/**
 * Purchase Return — Jewellery ERP supplier return (partial or full).
 * Distinct from full reverse on purchases index.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSupplierPurchases, type SupplierPurchase } from "@/lib/supplier-purchases-store";
import { postUniversalTransaction } from "@/lib/transaction-types-store";
import { fineGoldMg, gramsToMg, mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/purchases/return")({
  head: () => ({ meta: [{ title: "Purchase Return · Ornexa ERP" }] }),
  component: PurchaseReturnPage,
});

function makeReturnNo(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `PRTN-${stamp}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function PurchaseReturnPage() {
  const { purchases, loading, refresh } = useSupplierPurchases();
  const [purchaseId, setPurchaseId] = useState("");
  const [returnGrossG, setReturnGrossG] = useState("");
  const [returnAmountRs, setReturnAmountRs] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const eligible = useMemo(() => purchases.filter((p) => !p.reversed), [purchases]);

  const selected: SupplierPurchase | undefined = eligible.find((p) => p.id === purchaseId);

  useEffect(() => {
    if (!selected) return;
    setReturnGrossG(mgToGrams(selected.grossMg));
    setReturnAmountRs(paiseToRupees(selected.totalPaise));
  }, [selected]);

  async function handleSubmit() {
    if (!selected) {
      toast.error("Select a purchase.");
      return;
    }
    const grossMg = gramsToMg(parseFloat(returnGrossG) || 0);
    const amountPaise = Math.round((parseFloat(returnAmountRs) || 0) * 100);
    const purity = selected.purityPermille ?? 995;
    const fineMg = fineGoldMg(grossMg, purity);
    const voucherNumber = makeReturnNo();
    setSaving(true);
    try {
      const result = await postUniversalTransaction({
        transactionCode: "PURCHASE_RETURN",
        voucherNumber,
        counterpartyId: selected.supplierId,
        grossWeightMg: grossMg,
        netWeightMg: grossMg,
        fineGoldCreditMg: fineMg,
        cashDebitPaise: amountPaise,
        metadata: {
          purchaseId: selected.id,
          purchaseNo: selected.purchaseNo,
          reason,
          partial: grossMg < selected.grossMg,
        },
      });
      if (result.error || !result.entryId) throw new Error(result.error ?? "Posting failed.");
      toast.success(`Purchase return ${voucherNumber} posted.`);
      setPurchaseId("");
      setReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Return failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto space-y-6">
      <PageHeader
        title="Purchase Return"
        subtitle="Return goods to supplier with metal and payment ledger reversal (partial or full)."
        backTo="/billing/purchases"
        backLabel="Purchases"
      />

      <div className="rounded-md border bg-card p-4 space-y-4">
        <div>
          <Label>Original purchase</Label>
          <Select value={purchaseId} onValueChange={setPurchaseId}>
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Loading…" : "Select purchase"} />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.purchaseNo} · {mgToGrams(p.grossMg)} g · ₹{paiseToRupees(p.totalPaise)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selected && (
          <>
            <div>
              <Label>Return gross weight (g)</Label>
              <Input value={returnGrossG} onChange={(e) => setReturnGrossG(e.target.value)} />
            </div>
            <div>
              <Label>Return amount (₹)</Label>
              <Input value={returnAmountRs} onChange={(e) => setReturnAmountRs(e.target.value)} />
            </div>
            <div>
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Defective lot, purity mismatch…"
              />
            </div>
            <Button disabled={saving} onClick={() => void handleSubmit()}>
              Post Purchase Return
            </Button>
            <p className="text-xs text-muted-foreground">
              For a full reversal of the original posting, use{" "}
              <Link to="/billing/purchases" className="underline">
                Purchases → Reverse
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
