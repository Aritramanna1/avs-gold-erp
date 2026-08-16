/**
 * Bank Reconciliation — Jewellery ERP treasury control (NOT Platform Owner billing).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useBankReconciliation } from "@/lib/bank-reconciliation-store";
import {
  ensureChartOfAccountsLoaded,
  useChartOfAccountsStore,
} from "@/lib/chart-of-accounts-store";
import { guardRoute } from "@/lib/permissions";
import { Landmark, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/treasury/bank-reconciliation")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Bank Reconciliation · Ornexa ERP" }] }),
  component: BankReconciliationPage,
});

function rs(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function BankReconciliationPage() {
  const { sessions, loading, hydrate, createSession, reconcile } = useBankReconciliation();
  const accounts = useChartOfAccountsStore((s) => s.ledgerAccounts.filter((a) => a.isCashOrBank));
  const [bankCode, setBankCode] = useState("");
  const [periodFrom, setPeriodFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statementRs, setStatementRs] = useState("");
  const [bookRs, setBookRs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void ensureChartOfAccountsLoaded();
    void hydrate();
  }, [hydrate]);

  async function handleCreate() {
    const statementBalancePaise = Math.round((parseFloat(statementRs) || 0) * 100);
    const bookBalancePaise = Math.round((parseFloat(bookRs) || 0) * 100);
    if (!bankCode) {
      toast.error("Select a bank account.");
      return;
    }
    setSaving(true);
    try {
      await createSession({
        bankAccountCode: bankCode,
        periodFrom,
        periodTo,
        statementBalancePaise,
        bookBalancePaise,
        clearedEntries: [],
        notes: null,
      });
      toast.success("Reconciliation session opened.");
      setStatementRs("");
      setBookRs("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Match bank statement balances to cash/bank ledger for period close."
        backTo="/treasury/vouchers"
        backLabel="Treasury"
      />

      <div className="rounded-md border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Landmark className="h-4 w-4" /> New Session
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Bank account</Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>From</Label>
              <Input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Statement balance (₹)</Label>
            <Input value={statementRs} onChange={(e) => setStatementRs(e.target.value)} />
          </div>
          <div>
            <Label>Book balance (₹)</Label>
            <Input value={bookRs} onChange={(e) => setBookRs(e.target.value)} />
          </div>
        </div>
        <Button disabled={saving} onClick={() => void handleCreate()}>
          Open Reconciliation
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Sessions</h3>
        {loading && sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No reconciliation sessions yet.</p>
        ) : (
          sessions.map((s) => {
            const variance = s.statementBalancePaise - s.bookBalancePaise;
            return (
              <div
                key={s.id}
                className="rounded-md border p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="font-semibold">{s.bankAccountCode}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {s.periodFrom} → {s.periodTo} · Statement {rs(s.statementBalancePaise)} · Book{" "}
                    {rs(s.bookBalancePaise)} · Variance {rs(variance)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{s.status}</Badge>
                  {s.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        void reconcile(s.id, "Reconciled from treasury workspace.").then(() =>
                          toast.success("Marked reconciled."),
                        )
                      }
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Reconcile
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
