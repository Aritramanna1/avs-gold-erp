import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { guardRoute } from "@/lib/permissions";
import { PageHeader } from "@/components/app-shell";
import { ReportShell } from "@/components/reports/ReportShell";
import { Button } from "@/components/ui/button";
import {
  computeBalances,
  MOVEMENT_LABELS,
  fetchFirmLedgerBalances,
  useLedger,
  type LedgerEntry,
  type BalanceSheet,
} from "@/lib/ledger-store";
import { mgToGrams } from "@/lib/gold";
import { resolveGoldLedgerEntryRoute } from "@/lib/ledger-voucher-routes";
import { resolveNarrationForDisplay } from "@/lib/ledger-narration";
import {
  exportToCSV,
  rangeForPeriod,
  thisMonthRange,
  triggerPrint,
  type DateRange,
  type ReportPeriod,
} from "@/lib/report-engine";
import { fetchGoldLedgerPage } from "@/lib/ledger-pagination";

export const Route = createFileRoute("/reports/gold-ledger")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Gold Ledger Report · AVS ERP" }] }),
  component: GoldLedgerReportPage,
});

function GoldLedgerReportPage() {
  const storeEntries = useLedger((s) => s.entries);
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [customRange, setCustomRange] = useState<DateRange>(thisMonthRange());
  const [pageRows, setPageRows] = useState<LedgerEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [pageTick, setPageTick] = useState(0);
  const [firmBalance, setFirmBalance] = useState<BalanceSheet | null>(null);
  const pageSize = 100;

  const reloadPage = useCallback(() => {
    setPageTick((n) => n + 1);
  }, []);

  const dateRange = useMemo(
    () => rangeForPeriod(period, customRange),
    [period, customRange],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchFirmLedgerBalances()
      .then(({ balances }) => {
        if (!cancelled) setFirmBalance(balances);
      })
      .catch(() => {
        if (!cancelled) setFirmBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pageTick]);

  useEffect(() => {
    let cancelled = false;
    void     fetchGoldLedgerPage({
      from: dateRange.from,
      to: dateRange.to,
      limit: pageSize,
      offset,
    })
      .then((res) => {
        if (!cancelled) {
          setPageRows(res.rows);
          setTotal(res.total);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPageRows(null);
          const msg =
            err instanceof Error && /57014|timeout|timed out/i.test(err.message)
              ? "Ledger query timed out — showing cached rows. Retry or narrow the date range."
              : "Could not load server page — showing cached rows.";
          setLoadError(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange.from, dateRange.to, offset, pageTick]);

  const entries = pageRows ?? storeEntries.filter((e) => {
    const d = new Date(e.createdAt).toISOString().slice(0, 10);
    return d >= dateRange.from && d <= dateRange.to;
  });

  const balance = useMemo(
    () => firmBalance ?? computeBalances(storeEntries),
    [firmBalance, storeEntries],
  );
  const periodBalance = useMemo(() => computeBalances(entries), [entries]);

  function handleExport() {
    exportToCSV("gold-ledger-report.csv", [
      ["Date", "Type", "Narration", "Fine mg", "Net mg"],
      ...entries.map((e) => [
        new Date(e.createdAt).toLocaleDateString("en-IN"),
        MOVEMENT_LABELS[e.type] ?? e.type,
        resolveNarrationForDisplay({ notes: e.notes, reference: e.reference }),
        String(e.fineMg ?? e.netFineMg),
        String(e.netFineMg),
      ]),
    ]);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Gold Ledger Report"
        subtitle="Canonical gold ledger movements with opening/closing bucket context — paginated from server when available."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/ledger">Open Gold Vault</Link>
          </Button>
        }
      />
      <ReportShell
        title="Gold ledger register"
        variant="ledger"
        period={period}
        onPeriodChange={(p) => {
          setPeriod(p);
          setOffset(0);
        }}
        customRange={customRange}
        onCustomRangeChange={(r) => {
          setCustomRange(r);
          setOffset(0);
        }}
        openingLabel={`Firm vault fine: ${mgToGrams(balance.buckets.vault)} g · Balanced: ${balance.balanced ? "Yes" : "No"}`}
        closingLabel={`Period net fine movement: ${mgToGrams(periodBalance.ledgerTotal)} mg`}
        onRefresh={() => reloadPage()}
        onExport={handleExport}
        onPrint={() => void triggerPrint("Gold Ledger Report", dateRange)}
        footer={
          pageRows
            ? total >= 0
              ? `Showing ${offset + 1}–${Math.min(offset + pageSize, total)} of ${total} rows (server page)`
              : `Showing ${offset + 1}–${offset + entries.length} rows (server page — total count deferred)`
            : `${entries.length} rows (client filter)`
        }
      >
        {loadError ? (
          <div className="mb-3 rounded-sm border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            {loadError}
          </div>
        ) : null}
        <div data-testid="report-print-source" className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-3">Date</th>
                <th className="text-left px-3">Type</th>
                <th className="text-left px-3">Narration</th>
                <th className="text-right px-3">Fine (g)</th>
                <th className="text-right px-3">Net (g)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((e) => {
                const route = resolveGoldLedgerEntryRoute(e);
                return (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="py-2 px-3 whitespace-nowrap">
                      {new Date(e.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-3">{MOVEMENT_LABELS[e.type] ?? e.type}</td>
                    <td className="px-3 max-w-md truncate">
                      {route ? (
                        <Link to={route} className="text-primary hover:underline">
                          {resolveNarrationForDisplay({
                            notes: e.notes,
                            reference: e.reference,
                          })}
                        </Link>
                      ) : (
                        resolveNarrationForDisplay({ notes: e.notes, reference: e.reference })
                      )}
                    </td>
                    <td className="text-right px-3 font-mono">
                      {mgToGrams(e.fineMg ?? Math.abs(e.netFineMg))}
                    </td>
                    <td className="text-right px-3 font-mono">{mgToGrams(e.netFineMg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pageRows && (total < 0 ? entries.length >= pageSize : total > pageSize) ? (
          <div className="flex gap-2 mt-3 no-print">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - pageSize))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={total >= 0 ? offset + pageSize >= total : entries.length < pageSize}
              onClick={() => setOffset((o) => o + pageSize)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </ReportShell>
    </div>
  );
}
