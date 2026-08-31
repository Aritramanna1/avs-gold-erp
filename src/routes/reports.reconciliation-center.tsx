import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { guardRoute } from "@/lib/permissions";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import {
  reconciliationSummary,
  runBalanceReconciliation,
  type ReconciliationCheck,
} from "@/lib/reconciliation/balance-reconciliation";
import { useLedger } from "@/lib/ledger-store";
import { useMoneyVoucherStore } from "@/lib/money-voucher";
import { useChartOfAccountsStore } from "@/lib/chart-of-accounts-store";
import { useStock } from "@/lib/stock-store";
import { useExpensesStore } from "@/lib/expenses-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { usePeople } from "@/lib/people-store";

export const Route = createFileRoute("/reports/reconciliation-center")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Reconciliation Center · AVS ERP" }] }),
  component: ReconciliationCenterPage,
});

function statusIcon(status: ReconciliationCheck["status"]) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function ReconciliationCenterPage() {
  const refreshLedger = useLedger((s) => s.refresh);
  const hydrateMoney = useMoneyVoucherStore((s) => s.hydrate);
  const hydrateCoA = useChartOfAccountsStore((s) => s.hydrate);
  const refreshStock = useStock((s) => s.refresh);
  const refreshExpenses = useExpensesStore((s) => s.refresh);
  const refreshSettlements = useGoldSettlement((s) => s.refresh);
  const refreshGoldBook = useWorkerGoldBook((s) => s.refresh);
  const refreshPeople = usePeople((s) => s.refresh);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      refreshLedger(),
      hydrateMoney(),
      hydrateCoA(),
      refreshStock(),
      refreshExpenses(),
      refreshSettlements(),
      refreshGoldBook(),
      refreshPeople(),
    ])
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setTick((t) => t + 1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    refreshLedger,
    hydrateMoney,
    hydrateCoA,
    refreshStock,
    refreshExpenses,
    refreshSettlements,
    refreshGoldBook,
    refreshPeople,
  ]);

  const checks = useMemo(() => runBalanceReconciliation(), [tick, loading]);
  const summary = useMemo(() => reconciliationSummary(checks), [checks]);

  async function handleRefresh() {
    setLoading(true);
    await Promise.all([
      refreshLedger(),
      hydrateMoney(),
      hydrateCoA(),
      refreshStock(),
      refreshExpenses(),
      refreshSettlements(),
      refreshGoldBook(),
      refreshPeople(),
    ]).catch(() => undefined);
    setLoading(false);
    setTick((t) => t + 1);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Reconciliation Center"
        subtitle="Cross-module balance checks — Ledger source of truth vs operational modules, stock, and cash book."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <SourceOfTruthBadge variant="report" />
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-1" />
              {loading ? "Refreshing…" : "Refresh checks"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Badge variant="outline" className="gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {summary.ok} OK
        </Badge>
        <Badge variant="outline" className="gap-1">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> {summary.warn} Review
        </Badge>
        <Badge variant="outline" className="gap-1">
          <XCircle className="h-3.5 w-3.5 text-destructive" /> {summary.fail} Fail
        </Badge>
      </div>

      <div className="rounded-lg border divide-y">
        {checks.map((check) => (
          <div key={check.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="mt-0.5">{statusIcon(check.status)}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{check.title}</div>
              <div className="text-xs text-muted-foreground mt-1 grid sm:grid-cols-3 gap-2">
                <span>
                  Expected: <strong>{check.expected}</strong>
                </span>
                <span>
                  Actual: <strong>{check.actual}</strong>
                </span>
                <span>
                  Variance: <strong>{check.variance}</strong>
                </span>
              </div>
              {check.detail ? (
                <p className="text-xs text-muted-foreground mt-2">{check.detail}</p>
              ) : null}
            </div>
            {check.explainRoute ? (
              <Button variant="link" size="sm" className="shrink-0 px-0" asChild>
                <Link to={check.explainRoute}>Explain →</Link>
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
