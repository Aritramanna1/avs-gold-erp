/**
 * Canonical Route: /reports/financial-statements
 * Trial Balance, Trading Account, P&L, and Balance Sheet from chart of accounts.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChartOfAccountsStore } from "@/lib/chart-of-accounts-store";
import { compileFinancialStatements } from "@/lib/financial-statements";
import { getReportHubPreferences } from "@/lib/customization-hub-preferences-store";

export const Route = createFileRoute("/reports/financial-statements")({
  head: () => ({ meta: [{ title: "Financial Statements · AVS Gold ERP" }] }),
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

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const bundle = useMemo(() => compileFinancialStatements(accounts), [accounts]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Financial Statements"
        subtitle="Trial Balance, Trading Account, Profit & Loss, and Balance Sheet compiled from ledger accounts."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading chart of accounts…</p>
      ) : (
        <Tabs defaultValue="trial">
          <TabsList>
            <TabsTrigger value="trial">Trial Balance</TabsTrigger>
            <TabsTrigger value="trading">Trading Account</TabsTrigger>
            {showProfit && <TabsTrigger value="pl">Profit &amp; Loss</TabsTrigger>}
            <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
          </TabsList>

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
      )}
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
