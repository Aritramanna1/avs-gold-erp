import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { useSchemeStore } from "@/lib/scheme-store";
import { toast } from "sonner";

export const Route = createFileRoute("/scheme/receipts")({
  head: () => ({ meta: [{ title: "Scheme Receipts · AVS ERP" }] }),
  component: SchemeReceiptsPage,
});

function SchemeReceiptsPage() {
  const accounts = useSchemeStore((s) => s.accounts);
  const receipts = useSchemeStore((s) => s.receipts);
  const hydrate = useSchemeStore((s) => s.hydrate);
  const postReceipt = useSchemeStore((s) => s.postReceipt);
  const [accountId, setAccountId] = useState("");
  const [amountRs, setAmountRs] = useState("");
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [installmentNo, setInstallmentNo] = useState("");
  const [narration, setNarration] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountPaise = Math.round(parseFloat(amountRs || "0") * 100);
    if (!accountId || amountPaise <= 0) {
      toast.error("Select account and enter amount.");
      return;
    }
    setSaving(true);
    try {
      await postReceipt({
        accountId,
        amountPaise,
        receiptDate,
        installmentNo: installmentNo ? Math.round(Number(installmentNo)) : undefined,
        narration: narration.trim() || undefined,
      });
      toast.success("Installment receipt posted.");
      setAmountRs("");
      setInstallmentNo("");
      setNarration("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Receipt failed.");
    } finally {
      setSaving(false);
    }
  }

  const accountLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.account_no} — ${a.party_name || a.party_id}` : id.slice(0, 8);
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Scheme Receipts"
        subtitle="Post installment cash — money voucher SoT"
        actions={<SourceOfTruthBadge variant="ledger" />}
      />

      <form onSubmit={onSubmit} className="erp-surface rounded-xl p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="acc">Scheme account</Label>
            <select
              id="acc"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Select account…</option>
              {accounts
                .filter((a) => a.status === "active")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_no} — {a.party_name || a.party_id}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amt">Amount ₹</Label>
            <Input
              id="amt"
              className="font-mono"
              value={amountRs}
              onChange={(e) => setAmountRs(e.target.value)}
              placeholder="5000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Receipt date</Label>
            <Input id="date" type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inst">Installment no.</Label>
            <Input
              id="inst"
              className="font-mono"
              value={installmentNo}
              onChange={(e) => setInstallmentNo(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="narr">Narration</Label>
            <Input id="narr" value={narration} onChange={(e) => setNarration(e.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Posting…" : "Post receipt"}
        </Button>
      </form>

      <div className="erp-surface rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Inst.</th>
              <th className="px-3 py-2 text-right">Amount ₹</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  No receipts yet.
                </td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-3 py-2 font-mono">{r.receipt_date}</td>
                  <td className="px-3 py-2">{accountLabel(r.account_id)}</td>
                  <td className="px-3 py-2 font-mono">{r.installment_no ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-right">{(r.amount_paise / 100).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={"/scheme"}>Scheme hub</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={"/reports/scheme"}>Scheme report</Link>
        </Button>
      </div>
    </div>
  );
}
