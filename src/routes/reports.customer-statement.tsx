import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { usePeople } from "@/lib/people-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { useCustomerPaymentAllocation } from "@/lib/customer-payment-allocation";
import { mgToGrams } from "@/lib/gold";
import { exportToCSV, triggerPrint } from "@/lib/report-engine";
import { Download, Printer, Filter, Calendar, FileText, CheckCircle2, Clock, Coins, Receipt } from "lucide-react";

export const Route = createFileRoute("/reports/customer-statement" as any)({
  head: () => ({ meta: [{ title: "Customer Annual Statement · AVS Gold ERP" }] }),
  component: CustomerAnnualStatementPage,
});

function CustomerAnnualStatementPage() {
  const people = usePeople((s) => s.people);
  const invoices = useBilling((s) => s.invoices);
  const { receipts, allocations } = useCustomerPaymentAllocation();

  const customers = useMemo(() => {
    return people.filter((p) => p.type === "customer" || (p.roles || []).includes("customer"));
  }, [people]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || "");
  const [financialYear, setFinancialYear] = useState<string>("2025-2026");
  const [startDate, setStartDate] = useState<string>("2025-04-01");
  const [endDate, setEndDate] = useState<string>("2026-03-31");

  const selectedCustomer = useMemo(() => {
    return people.find((p) => p.id === selectedCustomerId);
  }, [people, selectedCustomerId]);

  const ledgerSummary = useMemo(() => {
    if (!selectedCustomerId) return null;
    return compileCustomerLedger(selectedCustomerId);
  }, [selectedCustomerId, invoices]);

  // Customer Invoices in period
  const periodInvoices = useMemo(() => {
    if (!selectedCustomerId) return [];
    return invoices.filter((i) => {
      if (i.customerId !== selectedCustomerId) return false;
      if (i.status === "cancelled") return false;
      const d = new Date(i.createdAt).toISOString().split("T")[0];
      return d >= startDate && d <= endDate;
    });
  }, [invoices, selectedCustomerId, startDate, endDate]);

  // Customer Payments in period
  const periodPayments = useMemo(() => {
    if (!selectedCustomerId) return [];
    return receipts.filter((r) => {
      if (r.customerId !== selectedCustomerId) return false;
      if (r.reversedAt) return false;
      const d = r.date.split("T")[0];
      return d >= startDate && d <= endDate;
    });
  }, [receipts, selectedCustomerId, startDate, endDate]);

  // Calculations for period
  const totalBilledGoldMg = periodInvoices.reduce((s, i) => s + (i.totalFineMg || i.items?.reduce((acc, it) => acc + (it.fineMg || 0), 0) || 0), 0);
  const totalBilledCashPaise = periodInvoices.reduce((s, i) => s + (i.grandTotalPaise || 0), 0);

  const totalPaidGoldMg = periodPayments.reduce((s, r) => s + (r.goldReceivedMg || 0), 0);
  const totalPaidCashPaise = periodPayments.reduce((s, r) => s + (r.cashReceivedPaise || 0), 0);

  const unappliedAdvanceGoldMg = periodPayments.reduce((s, r) => s + (r.goldUnappliedMg || 0), 0);
  const unappliedAdvanceCashPaise = periodPayments.reduce((s, r) => s + (r.cashUnappliedPaise || 0), 0);

  const handleFYChange = (fy: string) => {
    setFinancialYear(fy);
    if (fy === "2025-2026") {
      setStartDate("2025-04-01");
      setEndDate("2026-03-31");
    } else if (fy === "2024-2025") {
      setStartDate("2024-04-01");
      setEndDate("2025-03-31");
    } else if (fy === "2026-2027") {
      setStartDate("2026-04-01");
      setEndDate("2027-03-31");
    }
  };

  const handleExportCSV = () => {
    if (!selectedCustomer || !ledgerSummary) return;
    const header = [
      "Date",
      "Voucher #",
      "Type",
      "Description",
      "Gold In (g)",
      "Gold Out (g)",
      "Money Debit (₹)",
      "Money Credit (₹)",
      "Closing Gold (g)",
      "Closing Money (₹)",
    ];

    const data = ledgerSummary.rows.map((r) => [
      r.date,
      r.voucherNo,
      r.type,
      r.description,
      r.goldInMg > 0 ? mgToGrams(r.goldInMg) : "0.000",
      r.goldOutMg > 0 ? mgToGrams(r.goldOutMg) : "0.000",
      r.moneyDebitPaise > 0 ? paiseToRupees(r.moneyDebitPaise) : "0.00",
      r.moneyCreditPaise > 0 ? paiseToRupees(r.moneyCreditPaise) : "0.00",
      mgToGrams(r.closingGoldMg),
      paiseToRupees(r.closingMoneyPaise),
    ]);

    exportToCSV(`Customer_Statement_${(selectedCustomer.fullName || (selectedCustomer as any).name || "Customer").replace(/\s+/g, "_")}_FY_${financialYear}.csv`, [header, ...data]);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Customer Annual Statement & Reconciliation"
        subtitle="Annual, year-end, and CA audit statement: chronological ledger, invoice-wise debits, payment credits, and automatic allocations."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV} disabled={!selectedCustomer}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => triggerPrint()} disabled={!selectedCustomer}>
              <Printer className="h-4 w-4" /> Print Statement
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="p-4 bg-card rounded-lg border border-border shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            Select Customer
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold font-medium"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName || (c as any).name || "Customer"} {c.phone ? `(${c.phone})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            Financial Year
          </label>
          <select
            value={financialYear}
            onChange={(e) => handleFYChange(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gold font-medium"
          >
            <option value="2026-2027">FY 2026-2027</option>
            <option value="2025-2026">FY 2025-2026</option>
            <option value="2024-2025">FY 2024-2025</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            Start Date
          </label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs" />
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            End Date
          </label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs" />
        </div>
      </div>

      {selectedCustomer && ledgerSummary && (
        <div className="space-y-6">
          {/* Customer Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-card rounded-lg border border-border space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Opening Balance</span>
              <div className="text-base font-bold font-mono text-foreground">
                {mgToGrams(ledgerSummary.openingGoldMg)} g Gold
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                ₹ {paiseToRupees(ledgerSummary.openingMoneyPaise)}
              </div>
            </div>

            <div className="p-4 bg-amber-500/5 rounded-lg border border-amber-500/20 space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-400">Total Invoiced (Debits)</span>
              <div className="text-base font-bold font-mono text-amber-300">
                {mgToGrams(totalBilledGoldMg)} g Gold
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                ₹ {paiseToRupees(totalBilledCashPaise)} ({periodInvoices.length} Bills)
              </div>
            </div>

            <div className="p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400">Payments & Allocations (Credits)</span>
              <div className="text-base font-bold font-mono text-emerald-300">
                {mgToGrams(totalPaidGoldMg)} g Gold
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                ₹ {paiseToRupees(totalPaidCashPaise)} ({periodPayments.length} Payments)
              </div>
            </div>

            <div className="p-4 bg-card rounded-lg border border-border space-y-1">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Closing Position</span>
              <div className="text-base font-bold font-mono text-gold">
                {mgToGrams(ledgerSummary.closingGoldMg)} g Gold Due
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                {unappliedAdvanceGoldMg > 0 ? `Advance: ${mgToGrams(unappliedAdvanceGoldMg)}g` : "₹ 0.00"}
              </div>
            </div>
          </div>

          {/* Section: Invoices Raised in Period */}
          <div className="bg-card rounded-lg border border-border p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-gold" />
                Invoices & Deliveries ({periodInvoices.length})
              </h3>
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">
                Period: {startDate} to {endDate}
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px]">
                  <tr className="border-b border-border text-left">
                    <th className="p-2.5">Invoice #</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Items</th>
                    <th className="p-2.5 text-right">Fine Gold</th>
                    <th className="p-2.5 text-right">Invoice Total</th>
                    <th className="p-2.5 text-right">Paid</th>
                    <th className="p-2.5 text-right">Balance</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {periodInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-2.5 font-mono font-semibold text-gold">{inv.invoiceNo}</td>
                      <td className="p-2.5 text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-2.5 max-w-xs truncate">
                        {inv.items?.map((it) => it.itemName).join(", ") || "Jewellery Items"}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-amber-300">
                        {mgToGrams(inv.totalFineMg || inv.items?.reduce((s, it) => s + (it.fineMg || 0), 0) || 0)} g
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        ₹ {paiseToRupees(inv.grandTotalPaise)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-emerald-400">
                        ₹ {paiseToRupees(inv.paidPaise)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-foreground">
                        ₹ {paiseToRupees(inv.balancePaise)}
                      </td>
                      <td className="p-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase font-bold ${
                            inv.status === "paid"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : inv.status === "partial"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "text-muted-foreground"
                          }`}
                        >
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {periodInvoices.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-muted-foreground">
                        No invoices found for this customer in the selected date period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Payments & Allocations in Period */}
          <div className="bg-card rounded-lg border border-border p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-400" />
                Payments & Automatic Allocations ({periodPayments.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px]">
                  <tr className="border-b border-border text-left">
                    <th className="p-2.5">Receipt #</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Mode</th>
                    <th className="p-2.5 text-right">Received (Gold)</th>
                    <th className="p-2.5 text-right">Received (Cash)</th>
                    <th className="p-2.5 text-right">Allocated</th>
                    <th className="p-2.5 text-right">Unapplied Advance</th>
                    <th className="p-2.5">Allocated Invoices</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {periodPayments.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-2.5 font-mono font-semibold text-gold">{r.receiptNo}</td>
                      <td className="p-2.5 text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-2.5">
                        <Badge variant="outline" className="text-[9px] uppercase font-bold text-gold">
                          {r.mode}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-amber-300">
                        {mgToGrams(r.goldReceivedMg)} g
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        ₹ {paiseToRupees(r.cashReceivedPaise)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-emerald-400 font-bold">
                        {r.mode === "gold" ? `${mgToGrams(r.goldAllocatedMg)} g` : `₹ ${paiseToRupees(r.cashAllocatedPaise)}`}
                      </td>
                      <td className="p-2.5 text-right font-mono text-blue-300 font-bold">
                        {r.goldUnappliedMg > 0 ? `${mgToGrams(r.goldUnappliedMg)} g` : "—"}
                      </td>
                      <td className="p-2.5 text-muted-foreground max-w-xs truncate">
                        {r.allocations.map((a) => `${a.invoiceNo} (${mgToGrams(a.appliedGoldMg)}g)`).join(", ")}
                      </td>
                    </tr>
                  ))}
                  {periodPayments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-muted-foreground">
                        No payments recorded for this customer in the selected date period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
