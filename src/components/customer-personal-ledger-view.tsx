import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { type Person } from "@/lib/people-store";
import { Printer, Plus, ArrowLeft, AlertTriangle } from "lucide-react";

import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useLedger } from "@/lib/ledger-store";
import { fineGoldMg, mgToGrams, gramsToMg, parsePurity, COMMON_PURITIES } from "@/lib/gold";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";

export function CustomerPersonalLedgerView({
  person,
  onBack,
  triggerPrint,
}: {
  person: Person;
  onBack: () => void;
  triggerPrint: (url: string, titleName: string) => void;
}) {
  const { t } = useLanguage();
  const [showAddForm, setShowAddForm] = useState(false);
  const [txType, setTxType] = useState<
    | "gold_received"
    | "gold_given"
    | "cash_received_against_gold"
    | "cash_paid_against_gold"
    | "cash_advance_gold_credit"
  >("gold_received");
  const [gross, setGross] = useState("");
  const [less, setLess] = useState("");
  const [purity, setPurity] = useState("916");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-run compiled ledger on change of settlements list or other store triggers
  const settlements = useGoldSettlement((s) => s.settlements);
  const ledger = useMemo(() => compileCustomerLedger(person.id), [person.id, settlements]);

  const calculatedFineMg = useMemo(() => {
    try {
      const g = gramsToMg(gross);
      const l = gramsToMg(less);
      const n = Math.max(0, g - l);
      const p = parsePurity(purity);
      return fineGoldMg(n, p);
    } catch {
      return 0;
    }
  }, [gross, less, purity]);

  // Same formula as customer-account-ledger.ts's cashGoldEquivMg — cash
  // paise / rate paise-per-gram, converted to mg.
  const cashAdvanceGoldEquivMg = useMemo(() => {
    try {
      const amountPaise = rupeesToPaise(amount);
      const ratePaise = rupeesToPaise(rate);
      if (amountPaise <= 0 || ratePaise <= 0) return 0;
      return Math.round((amountPaise / ratePaise) * 1000);
    } catch {
      return 0;
    }
  }, [amount, rate]);

  // Auto-fill valued amount if rate and net gold are set
  useEffect(() => {
    const r = parseFloat(rate);
    const g = parseFloat(gross) || 0;
    const l = parseFloat(less) || 0;
    const net = Math.max(0, g - l);
    if (!isNaN(r) && r > 0 && net > 0) {
      setAmount((r * net).toFixed(2));
    }
  }, [rate, gross, less]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const purityVal = parsePurity(purity);
      const grossMg = gramsToMg(gross);
      const lessMg = gramsToMg(less);
      const netMg = Math.max(0, grossMg - lessMg);
      const fineMg = fineGoldMg(netMg, purityVal);
      const amountPaise = rupeesToPaise(amount);
      const ratePaise = rupeesToPaise(rate);

      if (["gold_received", "gold_given"].includes(txType) && grossMg <= 0) {
        throw new Error("Gross weight is required and must be greater than 0.");
      }

      if (
        ["cash_received_against_gold", "cash_paid_against_gold"].includes(txType) &&
        amountPaise <= 0
      ) {
        throw new Error("Amount is required and must be greater than 0.");
      }

      if (txType === "cash_advance_gold_credit" && (amountPaise <= 0 || ratePaise <= 0)) {
        throw new Error(
          "Cash amount and today's rate are both required and must be greater than 0.",
        );
      }

      // For a cash advance, the gold-credit weight IS the settlement's
      // gross/net weight (purity 999 — a fine-gold-denominated credit, not
      // a physical item with its own touch), so the settlement row is
      // self-consistent even for a report that reads gross_mg/net_mg
      // directly instead of going through compileCustomerLedger().
      const cashAdvanceMg = txType === "cash_advance_gold_credit" ? cashAdvanceGoldEquivMg : 0;

      // 1. Add Settlement in store & sync to DB
      await useGoldSettlement.getState().addSettlement({
        party_type: "customer",
        party_id: person.id,
        settlement_type: txType,
        purity: txType === "cash_advance_gold_credit" ? 999 : purityVal,
        gross_mg: txType === "cash_advance_gold_credit" ? cashAdvanceMg : grossMg,
        net_mg: txType === "cash_advance_gold_credit" ? cashAdvanceMg : netMg,
        wastage_mg: lessMg,
        rate_per_gram_paise: ratePaise,
        amount_paise: amountPaise,
        notes: notes.trim() || undefined,
        direction: [
          "gold_received",
          "cash_received_against_gold",
          "cash_advance_gold_credit",
        ].includes(txType)
          ? "Jama"
          : "Naam",
      });

      // 2. Add ledger entry in global gold ledger for physical inventory synchronization
      if (txType === "gold_received") {
        await useLedger.getState().append({
          type: "customer_gold_received",
          netFineMg: fineMg,
          deltas: { customer: fineMg },
          grossMg: grossMg,
          purity: purityVal,
          fineMg,
          notes: `Deposit from Customer ${person.fullName}: ${notes}`,
        });
      } else if (txType === "gold_given") {
        await useLedger.getState().append({
          type: "customer_gold_credit_applied",
          netFineMg: -fineMg,
          deltas: { customer: -fineMg },
          grossMg: grossMg,
          purity: purityVal,
          fineMg,
          notes: `Return/issue to Customer ${person.fullName}: ${notes}`,
        });
      }

      // Clear fields
      setGross("");
      setLess("");
      setRate("");
      setAmount("");
      setNotes("");
      setShowAddForm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5 h-9">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h2 className="font-serif text-xl text-gold">{person.fullName}'s Account</h2>
            <p className="text-xs text-muted-foreground">Running Gold Passbook & Monetary Ledger</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              triggerPrint(
                `/people/ledger-print/${person.id}`,
                `Ledger Statement · ${person.fullName}`,
              )
            }
            className="gap-1.5 h-9 text-gold border-gold/30 hover:bg-gold/10"
          >
            <Printer className="h-4 w-4" /> Print Statement
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-1.5 h-9 bg-primary text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Record Entry
          </Button>
        </div>
      </div>

      {/* Summaries Side-by-Side */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-gold/30 bg-gold/5 p-4 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold">
              Gold Account Custody
            </span>
            <div className="font-serif text-2xl text-gold mt-1 font-mono font-bold">
              {mgToGrams(ledger.closingGoldMg)}{" "}
              <span className="text-xs font-sans text-muted-foreground">g fine</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">
              {ledger.closingGoldMg > 0
                ? "Advance Gold deposited (We owe them gold)"
                : ledger.closingGoldMg < 0
                  ? "Outstanding Gold balance (Customer owes us gold)"
                  : "Fully balanced"}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-4 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Monetary Running Balance
            </span>
            <div
              className={`font-serif text-2xl mt-1 font-mono font-bold ${ledger.closingMoneyPaise > 0 ? "text-destructive" : ledger.closingMoneyPaise < 0 ? "text-emerald-500" : "text-foreground"}`}
            >
              ₹ {paiseToRupees(ledger.closingMoneyPaise)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {ledger.closingMoneyPaise > 0
                ? "Outstanding balance (Customer owes us money)"
                : ledger.closingMoneyPaise < 0
                  ? "Advance balance (Shop owes customer money)"
                  : "Fully balanced"}
            </p>
          </div>
        </div>
      </div>

      {/* Record Entry form */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-md border border-border bg-card p-5 space-y-4 shadow-elegant"
        >
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-serif text-base text-gold">Record Direct Gold/Money Entry</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 col-span-2">
              <Label>Transaction Type</Label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { v: "gold_received", label: "Gold Deposit" },
                  { v: "gold_given", label: "Gold Issue" },
                  { v: "cash_received_against_gold", label: "Receipt Payment" },
                  { v: "cash_paid_against_gold", label: "Payment Paid" },
                  { v: "cash_advance_gold_credit", label: "Cash → Gold Credit" },
                ].map((typeOption) => (
                  <Button
                    key={typeOption.v}
                    type="button"
                    variant={txType === typeOption.v ? "default" : "outline"}
                    className="text-xs h-8 px-2"
                    onClick={() => setTxType(typeOption.v as any)}
                  >
                    {typeOption.label}
                  </Button>
                ))}
              </div>
            </div>

            {["gold_received", "gold_given"].includes(txType) && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="grossWeight">Gross Weight (g)</Label>
                  <Input
                    id="grossWeight"
                    inputMode="decimal"
                    placeholder="10.000"
                    value={gross}
                    onChange={(e) => setGross(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lessWeight">Less Weight / Loss (g)</Label>
                  <Input
                    id="lessWeight"
                    inputMode="decimal"
                    placeholder="0.000"
                    value={less}
                    onChange={(e) => setLess(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txPurity">Purity (Touch)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="txPurity"
                      inputMode="numeric"
                      placeholder="916"
                      value={purity}
                      onChange={(e) => setPurity(e.target.value)}
                      required
                      className="flex-1 font-mono"
                    />
                    <Select value={purity} onValueChange={(v) => setPurity(v)}>
                      <SelectTrigger className="w-[120px]">
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
                <div className="space-y-1.5">
                  <Label>Calculated Fine Gold</Label>
                  <div className="h-10 px-3 bg-muted/40 rounded-lg flex items-center text-sm font-mono text-gold font-bold">
                    {mgToGrams(calculatedFineMg)} g Fine
                  </div>
                </div>
              </>
            )}

            {["cash_received_against_gold", "cash_paid_against_gold"].includes(txType) && (
              <>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="txAmount">Amount (₹)</Label>
                  <Input
                    id="txAmount"
                    inputMode="decimal"
                    placeholder="50000.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="font-mono font-bold text-base"
                  />
                </div>
              </>
            )}

            {txType === "cash_advance_gold_credit" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="txCashAdvanceAmount">Cash Received (₹)</Label>
                  <Input
                    id="txCashAdvanceAmount"
                    inputMode="decimal"
                    placeholder="150000.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="font-mono font-bold text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txCashAdvanceRate">Today's Rate (₹/g)</Label>
                  <Input
                    id="txCashAdvanceRate"
                    inputMode="decimal"
                    placeholder="15000.00"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    required
                    className="font-mono font-bold text-base"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Gold Credit (at today's rate)</Label>
                  <div className="h-10 px-3 bg-gold/10 rounded-lg flex items-center text-sm font-mono text-gold font-bold">
                    {mgToGrams(cashAdvanceGoldEquivMg)} g fine — credited to this customer's gold
                    balance, not cash balance
                  </div>
                </div>
              </>
            )}

            {["gold_received", "gold_given"].includes(txType) && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="txRate">Optional Rate (₹/g)</Label>
                  <Input
                    id="txRate"
                    inputMode="decimal"
                    placeholder="7200.00"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txAmountComputed">Optional Valued Amount (₹)</Label>
                  <Input
                    id="txAmountComputed"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="txNotes">Notes / Description</Label>
              <Textarea
                id="txNotes"
                placeholder="Details of old gold ornament, metal transaction, cash payment, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-primary text-primary-foreground"
            >
              {submitting ? "Saving..." : "Save Entry"}
            </Button>
          </div>
        </form>
      )}

      {/* Ledger Passbook Table */}
      <div className="rounded-md border border-border bg-card shadow-elegant overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
          <span className="font-serif text-sm text-gold font-bold">Passbook Ledger Logs</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {ledger.rows.length} rows
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/45 text-muted-foreground text-[10px] uppercase font-mono tracking-wider border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Ref</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left min-w-[150px]">Description</th>
                <th className="px-3 py-3 text-right">Gold In</th>
                <th className="px-3 py-3 text-right">Gold Out</th>
                <th className="px-3 py-3 text-right">Dr (Money)</th>
                <th className="px-3 py-3 text-right">Cr (Money)</th>
                <th className="px-4 py-3 text-right font-bold border-l border-border/40">
                  Gold Bal
                </th>
                <th className="px-4 py-3 text-right font-bold font-sans">Money Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {ledger.rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/10">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {row.date}
                  </td>
                  <td className="px-3 py-2.5 font-mono uppercase text-muted-foreground">
                    {row.voucherNo}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[10px] font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] break-words">
                    {row.description}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gold whitespace-nowrap">
                    {row.goldInMg > 0 ? `${mgToGrams(row.goldInMg)} g` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground whitespace-nowrap">
                    {row.goldOutMg > 0 ? `${mgToGrams(row.goldOutMg)} g` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-destructive whitespace-nowrap">
                    {row.moneyDebitPaise > 0 ? `₹${paiseToRupees(row.moneyDebitPaise)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-500 whitespace-nowrap">
                    {row.moneyCreditPaise > 0 ? `₹${paiseToRupees(row.moneyCreditPaise)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold font-mono text-gold border-l border-border/40 whitespace-nowrap">
                    {mgToGrams(row.closingGoldMg)} g
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-bold font-mono whitespace-nowrap ${row.closingMoneyPaise > 0 ? "text-destructive" : row.closingMoneyPaise < 0 ? "text-emerald-500" : "text-foreground"}`}
                  >
                    ₹{paiseToRupees(row.closingMoneyPaise)}
                  </td>
                </tr>
              ))}
              {ledger.rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-muted-foreground">
                    No ledger records found for this customer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
