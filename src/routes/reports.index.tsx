import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { PrintHeader } from "@/components/print-header";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLedger, computeBalances, MOVEMENT_LABELS } from "@/lib/ledger-store";
import { useOrders, ORDER_STATUS_LABELS } from "@/lib/orders-store";
import { useJobCards, JOB_STATUS_LABELS, karigarCustodySummaries } from "@/lib/jobcards-store";
import { useStock, STOCK_STATUS_LABELS, STOCK_LOCATION_LABELS } from "@/lib/stock-store";
import {
  useBilling,
  customerLedger,
  paiseToRupees,
  PAYMENT_MODE_LABELS,
} from "@/lib/billing-store";
import { useRepairs, REPAIR_STATUS_LABELS } from "@/lib/repair-store";
import { useWorkers } from "@/lib/workers-store";
import { usePeople } from "@/lib/people-store";
import { useSettings } from "@/lib/settings-store";
import { useModuleStore } from "@/lib/module-store";
import { useExpensesStore } from "@/lib/expenses-store";
import { usePrintLog, PRINT_DOC_LABELS } from "@/lib/printlog-store";
import { mgToGrams } from "@/lib/gold";
import { Calendar, Download, Printer, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/reports/")({
  head: () => ({ meta: [{ title: "Reports · AVS Gold ERP" }] }),
  component: ReportsIndex,
});

function toCSV(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

function downloadCSV(name: string, rows: (string | number)[][]) {
  const blob = new Blob(["" + toCSV(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ReportsIndex() {
  const ledger = useLedger((s) => s.entries);
  const orders = useOrders((s) => s.orders);
  const jobs = useJobCards((s) => s.jobs);
  const stockItems = useStock((s) => s.items);
  const movements = useStock((s) => s.movements);
  const invoices = useBilling((s) => s.invoices);
  const repairs = useRepairs((s) => s.repairs);
  const workers = useWorkers((s) => s);
  const people = usePeople((s) => s.people);

  const balance = useMemo(() => computeBalances(ledger), [ledger]);
  const custody = useMemo(() => karigarCustodySummaries(jobs), [jobs]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const branches = useSettings((s) => s.branches);
  const expenses = useExpensesStore((s) => s.expenses);
  const withdrawals = useExpensesStore((s) => s.withdrawals);
  const expensePeople = useExpensesStore((s) => s.people);
  const printEvents = usePrintLog((s) => s.events);
  const securityLogs = useSettings((s) => s.securityLogs);

  const [selectedBranch, setSelectedBranch] = useState("all");

  const inRange = (ts: number) => {
    const d = new Date(ts);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to + "T23:59:59")) return false;
    return true;
  };

  const filteredOrders = orders.filter((o) => {
    if (!inRange(o.createdAt)) return false;
    if (selectedBranch !== "all" && (o.branchId || "MAIN") !== selectedBranch) return false;
    return true;
  });

  const filteredInvoices = invoices.filter((i) => {
    if (!inRange(i.createdAt)) return false;
    if (selectedBranch !== "all" && (i.branchId || "MAIN") !== selectedBranch) return false;
    return true;
  });

  const filteredJobs = jobs.filter((j) => {
    if (!inRange(j.createdAt)) return false;
    if (selectedBranch !== "all" && (j.branchId || "MAIN") !== selectedBranch) return false;
    return true;
  });

  const filteredRepairs = repairs.filter((r) => {
    if (!inRange(r.createdAt)) return false;
    if (selectedBranch !== "all" && (r.branchId || "MAIN") !== selectedBranch) return false;
    return true;
  });

  const filteredExpenses = expenses.filter((e) => {
    if (!inRange(new Date(e.date).getTime())) return false;
    if (selectedBranch !== "all" && (e.branchId || "MAIN") !== selectedBranch) return false;
    return true;
  });

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (!inRange(new Date(w.date).getTime())) return false;
    if (selectedBranch !== "all" && (w.branchId || "MAIN") !== selectedBranch) return false;
    return true;
  });

  const outstandingByCustomer = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; phone?: string; amount: number; days: number }
    >();
    const now = Date.now();
    for (const inv of invoices) {
      if (inv.balancePaise <= 0 || inv.status === "cancelled") continue;
      const ex = map.get(inv.customerId);
      const days = Math.floor((now - inv.createdAt) / 86400000);
      if (ex) {
        ex.amount += inv.balancePaise;
        ex.days = Math.max(ex.days, days);
      } else
        map.set(inv.customerId, {
          id: inv.customerId,
          name: inv.customerName,
          phone: inv.customerPhone,
          amount: inv.balancePaise,
          days,
        });
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [invoices]);

  // Sales tallies
  const sales = useMemo(() => {
    const totals = { sales: 0, gst: 0, cash: 0, upi: 0, bank: 0, card: 0, gold: 0, outstanding: 0 };
    for (const inv of filteredInvoices) {
      if (inv.status === "cancelled") continue;
      totals.sales += inv.subtotalPaise + inv.gstPaise;
      totals.gst += inv.gstPaise;
      for (const p of inv.payments) {
        if (p.mode === "cash") totals.cash += p.amountPaise;
        else if (p.mode === "upi") totals.upi += p.amountPaise;
        else if (p.mode === "bank") totals.bank += p.amountPaise;
        else if (p.mode === "card") totals.card += p.amountPaise;
        else if (p.mode === "gold_exchange" || p.mode === "customer_gold_credit")
          totals.gold += p.amountPaise;
        else if (p.mode === "outstanding") totals.outstanding += p.amountPaise;
      }
    }
    return totals;
  }, [filteredInvoices]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Reports"
        subtitle="Operational and financial reports from live data."
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Link to="/verify">
              <Button variant="outline" className="gap-2">
                🛡️ Verify Receipt
              </Button>
            </Link>
            <Link to="/reports/print-log">
              <Button variant="outline" className="gap-2">
                <Printer className="h-4 w-4" /> Print Log
              </Button>
            </Link>
            <Link to="/reports/print-queue">
              <Button variant="outline" className="gap-2">
                <Printer className="h-4 w-4" /> Print Queue &amp; History
              </Button>
            </Link>
            <Link to="/reports/daily-close">
              <Button className="gap-2">
                <Calendar className="h-4 w-4" /> Daily Close
              </Button>
            </Link>
            <Link to="/reports/month-end-close">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Month-End Close
              </Button>
            </Link>
            <Link to="/reports/inventory-ageing">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Inventory Ageing
              </Button>
            </Link>
            <Link to="/reports/exceptions">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Exception Report
              </Button>
            </Link>
            <Link to="/reports/approvals">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Pending Approvals
              </Button>
            </Link>
            <Link to="/reports/audit-log">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Audit Log
              </Button>
            </Link>
            <Link to="/reports/gold-reconciliation">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Gold Reconciliation
              </Button>
            </Link>
            <Link to="/people/import">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Import People
              </Button>
            </Link>
            <Link to="/stock/import">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Import Stock
              </Button>
            </Link>
            <Link to="/orders/import">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Import Orders
              </Button>
            </Link>
            <Link to="/reports/communication-analytics">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Communication Analytics
              </Button>
            </Link>
            <Link to="/reports/reminders">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Payment &amp; Gold Reminders
              </Button>
            </Link>
            <Link to="/reports/gold-summary">
              <Button className="gap-2">
                <Calendar className="h-4 w-4" /> Manufacturing Gold Summary
              </Button>
            </Link>
            <Link to="/reports/gold-outstanding">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Gold Outstanding
              </Button>
            </Link>
            <Link to="/reports/daily-gold-flow">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Daily Gold Flow
              </Button>
            </Link>
            <Link to="/reports/gold-position">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Gold Position (Daily/Weekly/Monthly/Yearly)
              </Button>
            </Link>
            <Link to="/reports/manufacturing">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Manufacturing Report
              </Button>
            </Link>
            <Link to="/reports/branch">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Branch Report
              </Button>
            </Link>
            <Link to="/reports/worker">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Worker Report
              </Button>
            </Link>
            <Link to="/reports/settlements">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Settlement Report
              </Button>
            </Link>
            <Link to="/reports/outside-work">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Outside Work Report
              </Button>
            </Link>
            <Link to="/reports/dealer">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Dealer Report
              </Button>
            </Link>
            <Link to="/reports/vault-reconciliation">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Vault Reconciliation
              </Button>
            </Link>
            <Link to="/reports/settlement-reconciliation">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Settlement Reconciliation
              </Button>
            </Link>
            <Link to="/reports/manufacturing-reconciliation">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Manufacturing Reconciliation
              </Button>
            </Link>
            <Link to="/reports/delivery-summary">
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" /> Daily Delivery Summary
              </Button>
            </Link>
          </div>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-4 mb-4 flex flex-wrap gap-4 items-end no-print">
        <div className="flex flex-col gap-1 w-48">
          <label className="text-xs text-muted-foreground font-semibold">Working Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="rounded-lg border border-border bg-background p-2 text-sm text-foreground focus:ring-1 focus:ring-gold outline-none h-10"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFrom("");
            setTo("");
          }}
        >
          Clear
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
          <Printer className="h-3 w-3" /> Print
        </Button>
      </div>

      <Tabs defaultValue="gold">
        <TabsList className="flex-wrap h-auto no-print">
          <TabsTrigger value="gold">Gold Balance</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="workshop">Workshop</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="billing">Billing / Sales</TabsTrigger>
          <TabsTrigger value="business_expenses">Expenses</TabsTrigger>
          <TabsTrigger value="family_withdrawals">Family & Person Outflows</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="custody">Karigar Custody</TabsTrigger>
          <TabsTrigger value="repair">Repair</TabsTrigger>
          <TabsTrigger value="worker">Worker / Attendance</TabsTrigger>
          <TabsTrigger value="log">Print Log</TabsTrigger>
          <TabsTrigger value="accounting">Accounting Export</TabsTrigger>
        </TabsList>

        <TabsContent value="gold">
          <Section title="Gold Balance Report" empty={ledger.length === 0}>
            <div className="grid sm:grid-cols-5 gap-3">
              {(["vault", "karigar", "finished", "customer", "scrap"] as const).map((b) => {
                const breakdown = balance.bucketBreakdowns[b];
                const purities = Object.values(breakdown?.purities || {}).filter(
                  (p) => p.grossMg !== 0 || p.fineMg !== 0,
                );
                return (
                  <div
                    key={b}
                    className="rounded-xl border border-border p-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-xs uppercase text-muted-foreground font-semibold">
                        {b}
                      </div>
                      <div className="text-lg font-serif text-gold mt-1">
                        {mgToGrams(breakdown?.fineMg || 0)} g <span className="text-xs">fine</span>
                      </div>
                      {breakdown?.grossMg !== breakdown?.fineMg && (
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Gross: {mgToGrams(breakdown?.grossMg || 0)} g
                        </div>
                      )}
                    </div>
                    {purities.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border/50 space-y-1">
                        {purities.map((p) => (
                          <div
                            key={p.purity}
                            className="flex justify-between text-[10px] font-mono"
                          >
                            <span className="text-muted-foreground">
                              {p.purity === 999
                                ? "24K"
                                : p.purity === 916
                                  ? "22K"
                                  : p.purity === 750
                                    ? "18K"
                                    : p.purity === 585
                                      ? "14K"
                                      : `${p.purity}`}
                              :
                            </span>
                            <span className="text-foreground font-semibold">
                              {mgToGrams(p.grossMg)} g
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-sm flex flex-wrap gap-4 items-center">
              <span>
                Total Under Management (Fine): <b>{mgToGrams(balance.totalUnderManagement)} g</b>
              </span>
              {balance.totalPhysicalUnderManagement !== balance.totalUnderManagement && (
                <span>
                  Total Physical Weight (Gross):{" "}
                  <b>{mgToGrams(balance.totalPhysicalUnderManagement)} g</b>
                </span>
              )}
              <span>
                Ledger Sum: <b>{mgToGrams(balance.ledgerTotal)} g</b>
              </span>
              <Badge
                variant="outline"
                className={
                  balance.balanced
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-red-500/15 text-red-300 border-red-500/30"
                }
              >
                {balance.balanced ? "BALANCED" : `DIFFERENCE ${mgToGrams(balance.discrepancyMg)} g`}
              </Badge>
            </div>
            <ExportRow
              onCsv={() =>
                downloadCSV("gold-balance.csv", [
                  ["Bucket", "Fine Grams", "Gross Grams"],
                  ...Object.entries(balance.bucketBreakdowns).map(([k, v]) => [
                    k,
                    mgToGrams(v.fineMg),
                    mgToGrams(v.grossMg),
                  ]),
                  [
                    "Total",
                    mgToGrams(balance.totalUnderManagement),
                    mgToGrams(balance.totalPhysicalUnderManagement),
                  ],
                ])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="orders">
          <Section title={`Orders (${filteredOrders.length})`} empty={filteredOrders.length === 0}>
            <Table
              headers={["No.", "Date", "Customer", "Status", "Item"]}
              rows={filteredOrders.map((o) => [
                o.orderNo,
                new Date(o.createdAt).toLocaleDateString("en-IN"),
                o.item.itemName ?? "—",
                ORDER_STATUS_LABELS[o.status],
                o.item.itemName,
              ])}
            />
            <ExportRow
              onCsv={() =>
                downloadCSV("orders.csv", [
                  ["No.", "Date", "Customer", "Status", "Item"],
                  ...filteredOrders.map((o) => [
                    o.orderNo,
                    new Date(o.createdAt).toLocaleDateString("en-IN"),
                    o.item.itemName,
                    ORDER_STATUS_LABELS[o.status],
                    o.item.itemName,
                  ]),
                ])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="workshop">
          <Section title={`Job Cards (${filteredJobs.length})`} empty={filteredJobs.length === 0}>
            <Table
              headers={[
                "No.",
                "Order",
                "Karigar",
                "Status",
                "Received (g)",
                "Overloss (g)",
              ]}
              rows={filteredJobs.map((j) => [
                j.jobNo,
                j.orderNo,
                j.karigarName ?? "—",
                JOB_STATUS_LABELS[j.status],
                j.workReceipt ? mgToGrams(j.workReceipt.finishedFineMg) : "—",
                j.workReceipt ? mgToGrams(j.workReceipt.overlossMg) : "—",
              ])}
            />
            <ExportRow
              onCsv={() =>
                downloadCSV("workshop.csv", [
                  ["No.", "Order", "Karigar", "Status", "Received g", "Overloss g"],
                  ...filteredJobs.map((j) => [
                    j.jobNo,
                    j.orderNo,
                    j.karigarName ?? "",
                    JOB_STATUS_LABELS[j.status],
                    j.workReceipt ? mgToGrams(j.workReceipt.finishedFineMg) : "",
                    j.workReceipt ? mgToGrams(j.workReceipt.overlossMg) : "",
                  ]),
                ])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="stock">
          <Section title={`Stock (${stockItems.length})`} empty={stockItems.length === 0}>
            <Table
              headers={["Code", "Barcode", "Item", "HUID", "Net g", "Status", "Location"]}
              rows={stockItems.map((i) => [
                i.itemCode,
                i.barcode,
                i.itemName,
                i.huid ?? "—",
                mgToGrams(i.netMg),
                STOCK_STATUS_LABELS[i.status],
                STOCK_LOCATION_LABELS[i.location],
              ])}
            />
            <ExportRow
              onCsv={() =>
                downloadCSV("stock.csv", [
                  ["Code", "Barcode", "Item", "HUID", "Net g", "Status", "Location"],
                  ...stockItems.map((i) => [
                    i.itemCode,
                    i.barcode,
                    i.itemName,
                    i.huid ?? "",
                    mgToGrams(i.netMg),
                    STOCK_STATUS_LABELS[i.status],
                    STOCK_LOCATION_LABELS[i.location],
                  ]),
                ])
              }
            />
            <div className="mt-3 text-xs text-muted-foreground">
              {movements.length} stock movements recorded.
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="billing">
          <Section
            title={`Billing / Sales (${filteredInvoices.length} invoices)`}
            empty={filteredInvoices.length === 0}
          >
            <div className="grid sm:grid-cols-4 gap-3 mb-3">
              <Stat label="Sales" value={`₹ ${paiseToRupees(sales.sales)}`} />
              <Stat label="Cash" value={`₹ ${paiseToRupees(sales.cash)}`} />
              <Stat label="UPI" value={`₹ ${paiseToRupees(sales.upi)}`} />
              {useModuleStore.getState().isModuleEnabled("gst") && (
                <Stat label="GST Collected" value={`₹ ${paiseToRupees(sales.gst)}`} />
              )}
            </div>
            <Table
              headers={["No.", "Date", "Customer", "Total", "Paid", "Balance"]}
              rows={filteredInvoices.map((i) => [
                i.invoiceNo,
                new Date(i.createdAt).toLocaleDateString("en-IN"),
                i.customerName,
                `₹ ${paiseToRupees(i.subtotalPaise + i.gstPaise)}`,
                `₹ ${paiseToRupees(i.paidPaise)}`,
                `₹ ${paiseToRupees(i.balancePaise)}`,
              ])}
            />
            <ExportRow
              onCsv={() =>
                downloadCSV("billing.csv", [
                  ["No.", "Date", "Customer", "Total", "Paid", "Balance"],
                  ...filteredInvoices.map((i) => [
                    i.invoiceNo,
                    new Date(i.createdAt).toLocaleDateString("en-IN"),
                    i.customerName,
                    paiseToRupees(i.subtotalPaise + i.gstPaise),
                    paiseToRupees(i.paidPaise),
                    paiseToRupees(i.balancePaise),
                  ]),
                ])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="business_expenses">
          <Section
            title="Business & Operations Expense Report"
            empty={filteredExpenses.length === 0}
          >
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <Stat
                label="Business Expenses"
                value={`₹ ${paiseToRupees(filteredExpenses.filter((e) => e.type === "business").reduce((s, e) => s + e.amountPaise, 0))}`}
              />
              <Stat
                label="Home & Personal"
                value={`₹ ${paiseToRupees(filteredExpenses.filter((e) => e.type === "personal").reduce((s, e) => s + e.amountPaise, 0))}`}
              />
              <Stat
                label="Investments & Loan Repayments"
                value={`₹ ${paiseToRupees(filteredExpenses.filter((e) => e.type === "investment").reduce((s, e) => s + e.amountPaise, 0))}`}
              />
            </div>
            <Table
              headers={["Date", "Type", "Category", "Payment Source", "Notes", "Amount"]}
              rows={filteredExpenses.map((e) => [
                e.date,
                e.type.toUpperCase(),
                e.category,
                e.paymentMode.toUpperCase(),
                e.notes ?? "—",
                `₹ ${paiseToRupees(e.amountPaise)}`,
              ])}
            />
            <ExportRow
              onCsv={() =>
                downloadCSV("operating-expenses.csv", [
                  ["Date", "Type", "Category", "Payment Source", "Notes", "Amount Rupees"],
                  ...filteredExpenses.map((e) => [
                    e.date,
                    e.type,
                    e.category,
                    e.paymentMode,
                    e.notes ?? "",
                    e.amountPaise / 100,
                  ]),
                ])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="family_withdrawals">
          <Section
            title="Family Member Withdrawals & Ledger Report"
            empty={filteredWithdrawals.length === 0 && expensePeople.length === 0}
          >
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-amber-300">
                  GST Exclusion & Internal Auditing Compliance
                </h4>
                <p className="text-xs text-amber-200/80 mt-1">
                  Family member personal ledger withdrawals are managed strictly as owner equity
                  drawdowns and are isolated from legal retail cash books, GST reports, and standard
                  supplier bills.
                </p>
              </div>
              <Badge className="bg-amber-500 text-neutral-900 border-none">
                CONFIRMED ISOLATION
              </Badge>
            </div>

            <h4 className="font-serif text-gold text-base mb-2">Member Cumulative Summary</h4>
            <Table
              headers={[
                "Family Member",
                "Role/Relation",
                "Register Phone",
                "Total Withdrawal Outflow",
              ]}
              rows={expensePeople.map((p) => {
                const totalPaise = filteredWithdrawals
                  .filter((w) => w.personId === p.id)
                  .reduce((sum, w) => sum + w.amountPaise, 0);
                return [
                  p.fullName,
                  p.role ?? "Owner Family",
                  p.phone ?? "—",
                  `₹ ${paiseToRupees(totalPaise)}`,
                ];
              })}
            />

            <h4 className="font-serif text-gold text-base mt-6 mb-2">Detailed Outflows Log</h4>
            <Table
              headers={["Date", "Family Member", "Payment Source", "Reason", "Notes", "Amount"]}
              rows={filteredWithdrawals.map((w) => {
                const p = expensePeople.find((x) => x.id === w.personId);
                return [
                  w.date,
                  p?.fullName ?? "—",
                  w.paymentMode.toUpperCase(),
                  w.reason ?? "—",
                  w.notes ?? "—",
                  `₹ ${paiseToRupees(w.amountPaise)}`,
                ];
              })}
            />

            <ExportRow
              onCsv={() =>
                downloadCSV("family-withdrawals.csv", [
                  ["Date", "Family Person", "Payment Source", "Reason", "Notes", "Amount Rupees"],
                  ...filteredWithdrawals.map((w) => {
                    const p = expensePeople.find((x) => x.id === w.personId);
                    return [
                      w.date,
                      p?.fullName ?? "",
                      w.paymentMode,
                      w.reason ?? "",
                      w.notes ?? "",
                      w.amountPaise / 100,
                    ];
                  }),
                ])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="outstanding">
          <Section
            title={`Customer Outstanding (${outstandingByCustomer.length})`}
            empty={outstandingByCustomer.length === 0}
          >
            <Table
              headers={["Customer", "Phone", "Amount", "Days"]}
              rows={outstandingByCustomer.map((o) => [
                o.name,
                o.phone ?? "—",
                `₹ ${paiseToRupees(o.amount)}`,
                o.days,
              ])}
            />
            <ExportRow
              onCsv={() =>
                downloadCSV("outstanding.csv", [
                  ["Customer", "Phone", "Amount", "Days"],
                  ...outstandingByCustomer.map((o) => [
                    o.name,
                    o.phone ?? "",
                    paiseToRupees(o.amount),
                    o.days,
                  ]),
                ])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="custody">
          <Section title={`Karigar Custody (${custody.length})`} empty={custody.length === 0}>
            <Table
              headers={[
                "Karigar",
                "Issued g",
                "Received g",
                "Scrap g",
                "Filings g",
                "Wastage g",
                "Overloss g",
                "Outstanding g",
              ]}
              rows={custody.map((c) => [
                c.karigarName,
                mgToGrams(c.issuedMg),
                mgToGrams(c.finishedMg),
                mgToGrams(c.scrapMg),
                mgToGrams(c.filingsMg),
                mgToGrams(c.wastageMg),
                mgToGrams(c.overlossMg),
                mgToGrams(c.outstandingMg),
              ])}
            />
            <ExportRow
              onCsv={() =>
                downloadCSV("custody.csv", [
                  [
                    "Karigar",
                    "Issued g",
                    "Received g",
                    "Scrap g",
                    "Filings g",
                    "Wastage g",
                    "Overloss g",
                    "Outstanding g",
                  ],
                  ...custody.map((c) => [
                    c.karigarName,
                    mgToGrams(c.issuedMg),
                    mgToGrams(c.finishedMg),
                    mgToGrams(c.scrapMg),
                    mgToGrams(c.filingsMg),
                    mgToGrams(c.wastageMg),
                    mgToGrams(c.overlossMg),
                    mgToGrams(c.outstandingMg),
                  ]),
                ])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="repair">
          <Section
            title={`Repair (${filteredRepairs.length})`}
            empty={filteredRepairs.length === 0}
          >
            <Table
              headers={["No.", "Date", "Customer", "Type", "Status", "Estimated", "Paid"]}
              rows={filteredRepairs.map((r) => [
                r.repairNo,
                new Date(r.createdAt).toLocaleDateString("en-IN"),
                r.customerName,
                r.kind,
                REPAIR_STATUS_LABELS[r.status],
                `₹ ${paiseToRupees(r.estimatedChargePaise)}`,
                `₹ ${paiseToRupees(r.advancePaise + r.payments.reduce((s, p) => s + (p.mode === "outstanding" ? 0 : p.amountPaise), 0))}`,
              ])}
            />
            <ExportRow
              onCsv={() =>
                downloadCSV("repair.csv", [
                  ["No.", "Date", "Customer", "Kind", "Status", "Estimated", "Paid"],
                  ...filteredRepairs.map((r) => [
                    r.repairNo,
                    new Date(r.createdAt).toLocaleDateString("en-IN"),
                    r.customerName,
                    r.kind,
                    REPAIR_STATUS_LABELS[r.status],
                    paiseToRupees(r.estimatedChargePaise),
                    paiseToRupees(
                      r.advancePaise +
                        r.payments.reduce(
                          (s, p) => s + (p.mode === "outstanding" ? 0 : p.amountPaise),
                          0,
                        ),
                    ),
                  ]),
                ])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="worker">
          <Section
            title="Worker / Attendance Summary"
            empty={workers.attendance.length === 0 && workers.withdrawals.length === 0}
          >
            <div className="grid sm:grid-cols-4 gap-3 mb-3">
              <Stat label="Attendance Entries" value={workers.attendance.length} />
              <Stat
                label="Withdrawals"
                value={`₹ ${paiseToRupees(workers.withdrawals.reduce((s, w) => s + w.amountPaise, 0))}`}
              />
              <Stat label="Loans" value={workers.loans.length} />
              <Stat label="Settlements" value={workers.settlements.length} />
            </div>
            <Table
              headers={["Worker", "Date", "Type", "Amount"]}
              rows={workers.withdrawals.slice(0, 50).map((w) => {
                const name = people.find((p) => p.id === w.workerId)?.fullName ?? w.workerId;
                return [name, w.date, "Withdrawal", `₹ ${paiseToRupees(w.amountPaise)}`];
              })}
            />
            <ExportRow
              onCsv={() =>
                downloadCSV("worker.csv", [
                  ["Worker", "Date", "Amount"],
                  ...workers.withdrawals.map((w) => [
                    people.find((p) => p.id === w.workerId)?.fullName ?? w.workerId,
                    w.date,
                    paiseToRupees(w.amountPaise),
                  ]),
                ])
              }
            />
          </Section>
        </TabsContent>

        <TabsContent value="log">
          <Section title="Print Log / Reprint Registry">
            <p className="text-sm text-muted-foreground mb-3">
              Every printed document is recorded. Open the full audit log for details.
            </p>
            <Link to="/reports/print-log">
              <Button size="sm" variant="outline">
                Open Print Log
              </Button>
            </Link>
          </Section>
        </TabsContent>

        <TabsContent value="accounting">
          <Section title="Accounting Export (CSV)">
            <p className="text-sm text-muted-foreground mb-3">
              Accounting export ready. Direct Tally / Zoho / Marg sync can be added in a future
              sprint.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() =>
                  downloadCSV("sales.csv", [
                    [
                      "Invoice No",
                      "Date",
                      "Customer",
                      "GSTIN",
                      "Taxable",
                      "CGST",
                      "SGST",
                      "Total",
                      "Paid",
                      "Balance",
                    ],
                    ...filteredInvoices
                      .filter((i) => i.status !== "cancelled")
                      .map((i) => [
                        i.invoiceNo,
                        new Date(i.createdAt).toLocaleDateString("en-IN"),
                        i.customerName,
                        i.customerGstin ?? "",
                        paiseToRupees(i.subtotalPaise),
                        paiseToRupees(i.cgstPaise),
                        paiseToRupees(i.sgstPaise),
                        paiseToRupees(i.subtotalPaise + i.gstPaise),
                        paiseToRupees(i.paidPaise),
                        paiseToRupees(i.balancePaise),
                      ]),
                  ])
                }
              >
                <FileSpreadsheet className="h-4 w-4" /> Sales CSV
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() =>
                  downloadCSV("gst-register.csv", [
                    [
                      "Invoice No",
                      "Date",
                      "Customer",
                      "GSTIN",
                      "Taxable (Making+Stone)",
                      "CGST 1.5%",
                      "SGST 1.5%",
                      "Total GST",
                    ],
                    ...filteredInvoices
                      .filter((i) => i.gst === "gst3" && i.status !== "cancelled")
                      .map((i) => {
                        const taxable = i.items.reduce(
                          (s, it) => s + it.makingChargesPaise + it.stoneChargesPaise,
                          0,
                        );
                        return [
                          i.invoiceNo,
                          new Date(i.createdAt).toLocaleDateString("en-IN"),
                          i.customerName,
                          i.customerGstin ?? "",
                          paiseToRupees(taxable),
                          paiseToRupees(i.cgstPaise),
                          paiseToRupees(i.sgstPaise),
                          paiseToRupees(i.gstPaise),
                        ];
                      }),
                  ])
                }
              >
                <FileSpreadsheet className="h-4 w-4" /> GST Register CSV
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() =>
                  downloadCSV("payments.csv", [
                    ["Invoice No", "Date", "Customer", "Mode", "Amount", "Reference", "Notes"],
                    ...filteredInvoices.flatMap((i) =>
                      i.payments.map((p) => [
                        i.invoiceNo,
                        new Date(p.ts).toLocaleDateString("en-IN"),
                        i.customerName,
                        PAYMENT_MODE_LABELS[p.mode],
                        paiseToRupees(p.amountPaise),
                        p.reference ?? "",
                        p.notes ?? "",
                      ]),
                    ),
                  ])
                }
              >
                <FileSpreadsheet className="h-4 w-4" /> Payments CSV
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() =>
                  downloadCSV("customer-outstanding.csv", [
                    ["Customer", "Phone", "GSTIN", "Outstanding", "Oldest (days)"],
                    ...outstandingByCustomer.map((o) => {
                      const p = people.find((x) => x.id === o.id);
                      return [
                        o.name,
                        o.phone ?? "",
                        p?.gstin ?? "",
                        paiseToRupees(o.amount),
                        o.days,
                      ];
                    }),
                  ])
                }
              >
                <FileSpreadsheet className="h-4 w-4" /> Customer Outstanding CSV
              </Button>

              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  const goldRatePerGram =
                    (useSettings.getState().goldRatePerGramPaise || 700000) / 100;
                  downloadCSV("stock-valuation.csv", [
                    [
                      "Item Code",
                      "Barcode",
                      "HUID",
                      "Item Name",
                      "Category",
                      "Purity",
                      "Gross Wt (g)",
                      "Net Wt (g)",
                      "Status",
                      "Location",
                      "Gold Rate (₹/g)",
                      "Est. Value (₹)",
                    ],
                    ...stockItems.map((item) => {
                      const grossG = (item.grossMg ?? 0) / 1000;
                      const netG = (item.netMg ?? 0) / 1000;
                      let val = 0;
                      if (item.purity) {
                        const purityVal = item.purity / 10 || 91.6;
                        const fineWt = netG * (purityVal / 100);
                        val = fineWt * goldRatePerGram;
                      } else {
                        val = netG * goldRatePerGram;
                      }
                      return [
                        item.itemCode ?? "",
                        item.barcode ?? "",
                        item.huid ?? "",
                        item.itemName,
                        item.category ?? "",
                        item.purity ?? "",
                        grossG.toFixed(3),
                        netG.toFixed(3),
                        STOCK_STATUS_LABELS[item.status] || item.status,
                        STOCK_LOCATION_LABELS[item.location] || item.location,
                        goldRatePerGram.toFixed(2),
                        val.toFixed(2),
                      ];
                    }),
                  ]);
                }}
              >
                <FileSpreadsheet className="h-4 w-4" /> Stock Valuation Register CSV
              </Button>

              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  const invoiceEntries = filteredInvoices.map((i) => [
                    `INV-${i.id.slice(0, 8)}`,
                    new Date(i.createdAt).toLocaleDateString("en-IN"),
                    "Sale Invoice",
                    i.invoiceNo,
                    i.customerName,
                    i.items.map((x) => x.itemName).join(", "),
                    paiseToRupees(i.grandTotalPaise),
                    "0.00",
                    i.status,
                  ]);

                  const paymentEntries = filteredInvoices.flatMap((i) =>
                    i.payments.map((p) => [
                      `PAY-${p.id.slice(0, 8)}`,
                      new Date(p.ts).toLocaleDateString("en-IN"),
                      "Payment Received",
                      i.invoiceNo,
                      i.customerName,
                      PAYMENT_MODE_LABELS[p.mode] || p.mode,
                      paiseToRupees(p.amountPaise),
                      "0.00",
                      "completed",
                    ]),
                  );

                  const expenseEntries = filteredExpenses.map((e) => [
                    `EXP-${e.id.slice(0, 8)}`,
                    e.date || new Date().toLocaleDateString("en-IN"),
                    "Expense",
                    e.type || "",
                    e.category,
                    e.notes || e.category,
                    "0.00",
                    paiseToRupees(e.amountPaise),
                    "completed",
                  ]);

                  downloadCSV("day-book.csv", [
                    [
                      "Transaction ID",
                      "Date",
                      "Type",
                      "Ref / Invoice No",
                      "Name / Party",
                      "Details",
                      "Inflow (₹)",
                      "Outflow (₹)",
                      "Status",
                    ],
                    ...invoiceEntries,
                    ...paymentEntries,
                    ...expenseEntries,
                  ]);
                }}
              >
                <FileSpreadsheet className="h-4 w-4" /> Day Book CSV
              </Button>

              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  const printRows = printEvents.map((pe) => [
                    "Print Event",
                    new Date(pe.firstPrintedAt).toLocaleDateString("en-IN"),
                    pe.printedBy,
                    PRINT_DOC_LABELS[pe.docType] || pe.docType,
                    `Doc No: ${pe.docNumber} (${pe.linkedLabel || ""})`,
                    `Reprints: ${pe.reprintCount}`,
                  ]);

                  const securityRows = securityLogs.map((sl) => [
                    "Security Log",
                    new Date(sl.ts).toLocaleDateString("en-IN"),
                    sl.userEmail,
                    sl.action,
                    sl.details,
                    "N/A",
                  ]);

                  downloadCSV("audit-trail.csv", [
                    [
                      "Log Type",
                      "Date",
                      "User",
                      "Action / Document",
                      "Details / Reference",
                      "Reprint Count / Meta",
                    ],
                    ...printRows,
                    ...securityRows,
                  ]);
                }}
              >
                <FileSpreadsheet className="h-4 w-4" /> Audit Trail & Security Logs CSV
              </Button>
            </div>
          </Section>
        </TabsContent>
      </Tabs>

      {ledger.length === 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          Movement labels available: {Object.values(MOVEMENT_LABELS).slice(0, 3).join(", ")}…
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 mt-3 print:border-none print:p-0 print:m-0 print:shadow-none print:bg-white print:text-black">
      <div className="hidden print:block">
        <PrintHeader title={title} />
      </div>
      <div className="flex items-center justify-between mb-3 print:hidden">
        <h3 className="font-serif text-gold text-lg">{title}</h3>
      </div>
      {empty ? (
        <div className="text-sm text-muted-foreground print:text-black">No records yet.</div>
      ) : (
        children
      )}
      <div className="hidden print:block mt-8">
        <AvsPrintFooter />
      </div>
    </div>
  );
}

function Table({
  headers,
  rows,
  rightAlignLast = true,
}: {
  headers: string[];
  rows: (string | number)[][];
  rightAlignLast?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            {headers.map((h, i) => (
              <th
                key={h}
                className={`p-2 ${rightAlignLast && i === headers.length - 1 ? "text-right" : "text-left"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`p-2 ${rightAlignLast && j === r.length - 1 ? "text-right font-mono" : ""}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-serif text-gold">{value}</div>
    </div>
  );
}

function ExportRow({ onCsv }: { onCsv: () => void }) {
  return (
    <div className="mt-3 flex gap-2 justify-end no-print">
      <Button size="sm" variant="outline" className="gap-1" onClick={onCsv}>
        <FileSpreadsheet className="h-3 w-3" /> Export CSV
      </Button>
      <Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}>
        <Printer className="h-3 w-3" /> Print Report
      </Button>
    </div>
  );
}
