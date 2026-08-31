/**
 * Canonical Route: /reports/financial-statements
 * Trial Balance, Trading Account, P&L, and Balance Sheet from chart of accounts.
 * Operational books tab is a dual-run from invoices — it does not write CoA.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChartOfAccountsStore } from "@/lib/chart-of-accounts-store";
import { compileFinancialStatements } from "@/lib/financial-statements";
import { getReportHubPreferences } from "@/lib/customization-hub-preferences-store";
import { useBilling } from "@/lib/billing-store";
import { useExpensesStore } from "@/lib/expenses-store";
import { compileOperationalBooks } from "@/lib/operational-books";
import { thisMonthRange } from "@/lib/report-engine";

export const Route = createFileRoute("/reports/financial-statements")({
  head: () => ({ meta: [{ title: "Financial Statements · AVS ERP" }] }),
  component: FinancialStatementsPage,
});

function paise(v: number): string {
  return `₹${(v / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function FinancialStatementsPage() {
  const accounts = useChartOfAccountsStore((s) => s.ledgerAccounts);
  const hydrate = useChartOfAccountsStore((s) => s.hydrate);
  const loading = useChartOfAccountsStore((s) => s.loading);
  const showProfit = getReportHubPreferences().showProfit;
  const invoices = useBilling((s) => s.invoices);
  const expenses = useExpensesStore((s) => s.expenses);
  const refreshExpenses = useExpensesStore((s) => s.refresh);
  const month = thisMonthRange();
  const [from, setFrom] = useState(month.from);
  const [to, setTo] = useState(month.to);

  useEffect(() => {
    void hydrate();
    void refreshExpenses();
  }, [hydrate, refreshExpenses]);

  const bundle = useMemo(() => compileFinancialStatements(accounts), [accounts]);
  const operational = useMemo(() => {
    const fromMs = new Date(from).setHours(0, 0, 0, 0);
    const toMs = new Date(to).setHours(23, 59, 59, 999);
    const expensePaise = expenses
      .filter((e) => e.date >= from && e.date <= to)
      .reduce((sum, e) => sum + e.amountPaise, 0);
    return compileOperationalBooks(invoices, expensePaise, fromMs, toMs);
  }, [invoices, expenses, from, to]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Financial Statements"
        subtitle="CoA trial balance stays as stored. Operational books dual-run from invoices and expenses — they do not write ledger_accounts."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading chart of accounts…</p>
      ) : null}

      <Tabs defaultValue="operational">
        <TabsList>
          <TabsTrigger value="operational">Operational books</TabsTrigger>
          <TabsTrigger value="trial">Trial Balance</TabsTrigger>
          <TabsTrigger value="trading">Trading Account</TabsTrigger>
          {showProfit && <TabsTrigger value="pl">Profit &amp; Loss</TabsTrigger>}
          <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
        </TabsList>

        <TabsContent value="operational" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {operational.balanced ? "In balance" : "Out of balance"} · Debit {paise(operational.debitPaise)} ·
              Credit {paise(operational.creditPaise)}
            </p>
          </div>
          <StatementTable
            title="Operational trial pack (invoices + expenses)"
            rows={operational.lines.map((line) => ({
              code: line.code,
              name: line.name,
              debit: line.debitPaise ? paise(line.debitPaise) : "—",
              credit: line.creditPaise ? paise(line.creditPaise) : "—",
            }))}
            footer={`Debit ${paise(operational.debitPaise)} · Credit ${paise(operational.creditPaise)}`}
          />
        </TabsContent>

          <TabsContent value="trial" className="mt-4">
            <StatementTable
              title="Trial Balance"
              rows={bundle.trialBalance.map((line) => ({
                code: line.code,
                name: line.name,
                debit: line.debitPaise ? paise(line.debitPaise) : "—",
                credit: line.creditPaise ? paise(line.creditPaise) : "—",
              }))}
              footer={`Debit ${paise(bundle.trialDebitPaise)} · Credit ${paise(bundle.trialCreditPaise)}`}
            />
          </TabsContent>

          <TabsContent value="trading" className="mt-4">
            <SectionCard section={bundle.tradingAccount} />
          </TabsContent>

          {showProfit && (
            <TabsContent value="pl" className="mt-4">
              <SectionCard section={bundle.profitAndLoss} />
            </TabsContent>
          )}

          <TabsContent value="bs" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard section={bundle.balanceSheet.assets} />
              <SectionCard section={bundle.balanceSheet.liabilities} />
            </div>
            <p className="text-sm font-mono mt-3">
              Net worth: {paise(bundle.balanceSheet.netWorthPaise)}
            </p>
          </TabsContent>
        </Tabs>
    </div>
  );
}

function SectionCard({
  section,
}: {
  section: {
    title: string;
    lines: Array<{ code: string; name: string; amountPaise: number }>;
    totalPaise: number;
  };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {section.lines.map((line) => (
          <div key={line.code} className="flex justify-between border-b border-border/50 py-1">
            <span>
              <span className="font-mono text-xs text-muted-foreground mr-2">{line.code}</span>
              {line.name}
            </span>
            <span className="font-mono">{paise(line.amountPaise)}</span>
          </div>
        ))}
        <div className="flex justify-between font-semibold pt-2">
          <span>Total</span>
          <span className="font-mono">{paise(section.totalPaise)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatementTable({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: Array<{ code: string; name: string; debit: string; credit: string }>;
  footer?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-2">Code</th>
              <th className="py-2">Account</th>
              <th className="py-2 text-right">Debit</th>
              <th className="py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-b border-border/40">
                <td className="py-1.5 font-mono">{row.code}</td>
                <td className="py-1.5">{row.name}</td>
                <td className="py-1.5 text-right font-mono">{row.debit}</td>
                <td className="py-1.5 text-right font-mono">{row.credit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {footer && <p className="text-xs font-mono mt-3 text-muted-foreground">{footer}</p>}
      </CardContent>
    </Card>
  );
}
