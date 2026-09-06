import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useOwnerTransactions,
  type OwnerTransaction,
} from "@/lib/owner-transactions-store";
import { gramsToMg, mgToGrams, fineGoldMg } from "@/lib/gold";
import { formatCurrencyRupees } from "@/lib/numbers";
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  UserCheck,
  ShieldCheck,
  Building2,
  Scale,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/manufacturing/owner-transactions")({
  head: () => ({
    meta: [
      { title: "Owner Transactions · AVS Manufacturing" },
      { name: "description", content: "Owner and family member drawings and capital ledger." },
    ],
  }),
  component: OwnerTransactionsPage,
});

function OwnerTransactionsPage() {
  const { familyAccounts, transactions, addFamilyAccount, addTransaction, getPersonSummary } =
    useOwnerTransactions();

  const [selectedAccountId, setSelectedAccountId] = useState(familyAccounts[0]?.id || "");
  const [txnType, setTxnType] = useState<OwnerTransaction["type"]>("Cash Withdrawal");
  const [cashAmountRs, setCashAmountRs] = useState("");
  const [goldGrossG, setGoldGrossG] = useState("");
  const [goldPurity, setGoldPurity] = useState("999");
  const [narration, setNarration] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // New account form state
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccRelation, setNewAccRelation] = useState<any>("Family Member");
  const [newAccPhone, setNewAccPhone] = useState("");

  const activeAccount = familyAccounts.find((a) => a.id === selectedAccountId) || familyAccounts[0];
  const summary = selectedAccountId ? getPersonSummary(selectedAccountId) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) {
      toast.error("Please select an owner / family member.");
      return;
    }

    setSubmitting(true);
    try {
      const cashAmountPaise = cashAmountRs ? Math.round(parseFloat(cashAmountRs) * 100) : 0;
      const grossMg = goldGrossG ? gramsToMg(goldGrossG) : 0;
      const purityVal = parseInt(goldPurity, 10) || 999;
      const fineMg = grossMg > 0 ? fineGoldMg(grossMg, purityVal) : 0;

      await addTransaction({
        familyAccountId: activeAccount.id,
        personName: activeAccount.name,
        date: new Date().toISOString().split("T")[0],
        type: txnType,
        cashAmountPaise,
        grossMg,
        purity: purityVal,
        fineMg,
        reasonOrNarration: narration.trim() || `${txnType} for ${activeAccount.name}`,
      });

      setCashAmountRs("");
      setGoldGrossG("");
      setNarration("");
    } catch (err: any) {
      toast.error(err?.message || "Transaction failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) {
      toast.error("Account name is required.");
      return;
    }

    const created = addFamilyAccount({
      name: newAccName.trim(),
      relation: newAccRelation,
      accountCode: `ACC-FAM-${Date.now().toString().slice(-4)}`,
      phone: newAccPhone.trim(),
      active: true,
    });

    setSelectedAccountId(created.id);
    setNewAccName("");
    setNewAccPhone("");
    setShowNewAccountModal(false);
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Owner & Family Member Transactions"
          description="Authoritative ledger for owner drawings, family member withdrawals, and capital contributions."
        />
        <Button
          onClick={() => setShowNewAccountModal(true)}
          className="bg-gold hover:bg-gold/90 text-black font-semibold text-xs flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Family Member Account
        </Button>
      </div>

      {showNewAccountModal && (
        <Card className="p-5 border border-gold/40 bg-card/95 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-bold text-sm">Create Family Member Ledger Account</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowNewAccountModal(false)}>✕</Button>
          </div>
          <form onSubmit={handleCreateAccount} className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Full Name</Label>
              <Input
                placeholder="e.g. Suman Gupta"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Relationship</Label>
              <select
                value={newAccRelation}
                onChange={(e) => setNewAccRelation(e.target.value as any)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs"
              >
                <option value="Owner / Partner">Owner / Partner</option>
                <option value="Spouse">Spouse</option>
                <option value="Child">Child</option>
                <option value="Parent">Parent</option>
                <option value="Family Member">Family Member</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone (Optional)</Label>
              <Input
                placeholder="+91 98..."
                value={newAccPhone}
                onChange={(e) => setNewAccPhone(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNewAccountModal(false)}>Cancel</Button>
              <Button type="submit" size="sm" className="bg-gold text-black font-semibold">Create Account</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Entry Form */}
        <Card className="p-5 border space-y-4 lg:col-span-1 bg-card/80">
          <div className="flex items-center gap-2 border-b pb-3">
            <Wallet className="h-5 w-5 text-gold" />
            <h3 className="font-bold text-sm text-foreground">Record Owner / Family Drawing</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Owner / Family Account</Label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs font-medium"
              >
                {familyAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.relation})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Transaction Type</Label>
              <select
                value={txnType}
                onChange={(e) => setTxnType(e.target.value as any)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs font-medium"
              >
                <option value="Cash Withdrawal">Cash Withdrawal (Drawings)</option>
                <option value="Gold Withdrawal">Gold Withdrawal (Vault Gold)</option>
                <option value="Capital Introduction (Cash)">Capital Introduction (Cash In)</option>
                <option value="Capital Introduction (Gold)">Capital Introduction (Gold In)</option>
              </select>
            </div>

            {txnType.includes("Cash") && (
              <div className="space-y-1">
                <Label className="text-[11px]">Cash Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="₹ 0"
                  value={cashAmountRs}
                  onChange={(e) => setCashAmountRs(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            )}

            {txnType.includes("Gold") && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Gross Wt (g)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={goldGrossG}
                    onChange={(e) => setGoldGrossG(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Purity (‰)</Label>
                  <Input
                    type="number"
                    placeholder="999"
                    value={goldPurity}
                    onChange={(e) => setGoldPurity(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[11px]">Purpose / Narration</Label>
              <Input
                placeholder="Household, travel, capital..."
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="text-xs"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gold hover:bg-gold/90 text-black font-semibold text-xs"
            >
              {submitting ? "Posting to Ledger..." : "Post Drawing Transaction"}
            </Button>
          </form>
        </Card>

        {/* Account Summary & Drawing Ledger */}
        <div className="space-y-4 lg:col-span-2">
          {summary && (
            <Card className="p-4 border bg-muted/20">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <h4 className="font-bold text-sm text-foreground">{activeAccount?.name}</h4>
                  <p className="text-[11px] text-muted-foreground">{activeAccount?.relation} · {activeAccount?.accountCode}</p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  Active Drawing Account
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                <div className="p-2.5 rounded-lg border bg-background/60">
                  <span className="text-[10px] text-muted-foreground block uppercase">Total Cash Withdrawn</span>
                  <span className="font-bold font-mono text-sm text-rose-500">
                    {formatCurrencyRupees(summary.totalCashWithdrawnPaise / 100)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border bg-background/60">
                  <span className="text-[10px] text-muted-foreground block uppercase">Total Gold Withdrawn</span>
                  <span className="font-bold font-mono text-sm text-gold">
                    {mgToGrams(summary.totalGoldWithdrawnMg)} g
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border bg-background/60">
                  <span className="text-[10px] text-muted-foreground block uppercase">Capital Cash In</span>
                  <span className="font-bold font-mono text-sm text-emerald-500">
                    {formatCurrencyRupees(summary.totalCapitalIntroducedCashPaise / 100)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border bg-background/60">
                  <span className="text-[10px] text-muted-foreground block uppercase">Net Cash Position</span>
                  <span className="font-bold font-mono text-sm text-foreground">
                    {formatCurrencyRupees(summary.netCashPositionPaise / 100)}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Ledger Table */}
          <Card className="border overflow-hidden">
            <div className="p-3.5 bg-muted/30 border-b flex items-center justify-between">
              <h4 className="font-semibold text-xs">Owner & Family Drawings Ledger</h4>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {transactions.length} Total Records
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b uppercase font-semibold text-[10px] text-muted-foreground">
                  <tr>
                    <th className="p-3">Txn Code / Date</th>
                    <th className="p-3">Person / Account</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Cash Amount (₹)</th>
                    <th className="p-3 text-right">Gold Wt (g)</th>
                    <th className="p-3">Purpose / Narration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="font-mono font-semibold">{t.transactionCode}</div>
                        <div className="text-[10px] text-muted-foreground">{t.date}</div>
                      </td>
                      <td className="p-3 font-medium">{t.personName}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            t.type.includes("Withdrawal")
                              ? "text-rose-500 border-rose-500/40"
                              : "text-emerald-500 border-emerald-500/40"
                          }`}
                        >
                          {t.type}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">
                        {t.cashAmountPaise > 0 ? formatCurrencyRupees(t.cashAmountPaise / 100) : "—"}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-gold">
                        {t.fineMg > 0 ? `${mgToGrams(t.fineMg)}g` : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground truncate max-w-xs">{t.reasonOrNarration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
