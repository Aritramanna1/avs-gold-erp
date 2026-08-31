import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { Button } from "@/components/ui/button";
import {
  accountBalanceTotals,
  fmtOfflineCash,
  fmtOfflineWt,
  type AccountBalanceRow,
} from "@/lib/jewellery-books-reports";
import { fetchAccountBalances } from "@/lib/jewellery-books-query";
import { exportToCSV } from "@/lib/report-engine";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/reports/account-balance")({
  validateSearch: (s: Record<string, unknown>): { variant?: "1" | "2" } => ({
    variant: s.variant === "2" ? "2" : "1",
  }),
  head: () => ({ meta: [{ title: "Account Balance · AVS ERP" }] }),
  component: AccountBalancePage,
});

function AccountBalancePage() {
  const { variant } = Route.useSearch();
  const is2 = variant === "2";
  const [rows, setRows] = useState<AccountBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAccountBalances(is2 ? "2" : "1")
      .then((r) => {
        if (!cancelled) setRows(r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load balances");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [is2]);

  const totals = useMemo(() => accountBalanceTotals(rows), [rows]);

  function handleCSV() {
    exportToCSV(is2 ? "account-balance-2.csv" : "account-balance.csv", [
      ["No", "Name", "Phone", "Jama Wt", "Return Wt", "Nave Wt", "Cash", "Anamat", "Fine"],
      ...rows.map((r, i) => [
        String(i + 1),
        r.partyName,
        r.phone,
        fmtOfflineWt(r.jamaWtMg),
        fmtOfflineWt(r.returnWtMg),
        fmtOfflineWt(r.naveWtMg),
        fmtOfflineCash(r.cashPaise),
        fmtOfflineCash(r.anamatPaise),
        fmtOfflineWt(r.fineMg),
      ]),
      [
        "",
        "TOTAL",
        "",
        fmtOfflineWt(totals.jamaWtMg),
        fmtOfflineWt(totals.returnWtMg),
        fmtOfflineWt(totals.naveWtMg),
        fmtOfflineCash(totals.cashPaise),
        fmtOfflineCash(totals.anamatPaise),
        fmtOfflineWt(totals.fineMg),
      ],
    ]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={is2 ? "Account Balance 2" : "Account Balance"}
        subtitle={
          loading
            ? "Loading party balances from server…"
            : "Offline-style party balance — Jama / Return / Nave / Cash / Anamat / Fine (server RPC)"
        }
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <SourceOfTruthBadge variant="report" />
            <Button variant={is2 ? "outline" : "default"} size="sm" asChild>
              <Link to="/reports/account-balance" search={{ variant: "1" }}>
                Balance 1
              </Link>
            </Button>
            <Button variant={is2 ? "default" : "outline"} size="sm" asChild>
              <Link to="/reports/account-balance" search={{ variant: "2" }}>
                Balance 2
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCSV} disabled={!rows.length}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to="/reports/account-balance-print/$variant" params={{ variant: is2 ? "2" : "1" }}>
                <Printer className="h-4 w-4" /> Print
              </Link>
            </Button>
          </div>
        }
      />

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="overflow-x-auto rounded border border-border bg-background print:border-0">
        <table className="w-full text-[11px] md:text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b-2 border-foreground/80 bg-muted/30">
              <th className="px-1.5 py-1.5 text-left font-bold whitespace-nowrap">No</th>
              <th className="px-1.5 py-1.5 text-left font-bold whitespace-nowrap">Name</th>
              <th className="px-1.5 py-1.5 text-left font-bold whitespace-nowrap">Phone</th>
              <th className="px-1.5 py-1.5 text-right font-bold whitespace-nowrap">Jama Wt</th>
              <th className="px-1.5 py-1.5 text-right font-bold whitespace-nowrap">Return Wt</th>
              <th className="px-1.5 py-1.5 text-right font-bold whitespace-nowrap">Nave Wt</th>
              <th className="px-1.5 py-1.5 text-right font-bold whitespace-nowrap">Cash</th>
              <th className="px-1.5 py-1.5 text-right font-bold whitespace-nowrap">Anamat</th>
              <th className="px-1.5 py-1.5 text-right font-bold whitespace-nowrap">Fine</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  No party balances to show
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.partyId} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-1.5 py-1 font-mono tabular-nums">{i + 1}</td>
                  <td className="px-1.5 py-1 font-medium whitespace-nowrap max-w-[14rem] truncate">
                    {r.partyName}
                  </td>
                  <td className="px-1.5 py-1 font-mono whitespace-nowrap">{r.phone}</td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums">
                    {fmtOfflineWt(r.jamaWtMg)}
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums">
                    {fmtOfflineWt(r.returnWtMg)}
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums">
                    {fmtOfflineWt(r.naveWtMg)}
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums">
                    {fmtOfflineCash(r.cashPaise)}
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums">
                    {fmtOfflineCash(r.anamatPaise)}
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums font-semibold">
                    {fmtOfflineWt(r.fineMg)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-foreground/80 font-bold bg-muted/40">
                <td className="px-1.5 py-1.5" colSpan={3} />
                <td className="px-1.5 py-1.5 text-right font-mono">
                  {fmtOfflineWt(totals.jamaWtMg)}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono">
                  {fmtOfflineWt(totals.returnWtMg)}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono">
                  {fmtOfflineWt(totals.naveWtMg)}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono">
                  {fmtOfflineCash(totals.cashPaise)}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono">
                  {fmtOfflineCash(totals.anamatPaise)}
                </td>
                <td className="px-1.5 py-1.5 text-right font-mono">
                  {fmtOfflineWt(totals.fineMg)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Weights in grams (3 decimals). Cash / Anamat in whole ₹. Sourced via get_account_balances RPC
        (not truncated client cache).
      </p>
    </div>
  );
}
