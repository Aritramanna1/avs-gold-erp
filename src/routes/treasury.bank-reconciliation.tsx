/**
 * Bank Reconciliation — match statement to cash/bank book vouchers.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  useBankReconciliation,
  computeSessionBook,
  type ClearedEntry,
} from "@/lib/bank-reconciliation-store";
import {
  ensureChartOfAccountsLoaded,
  useChartOfAccountsStore,
} from "@/lib/chart-of-accounts-store";
import { useMoneyVoucherStore } from "@/lib/money-voucher";
import { guardRoute } from "@/lib/permissions";
import { Landmark, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTableKeyboardNav } from "@/hooks/use-table-keyboard-nav";

export const Route = createFileRoute("/treasury/bank-reconciliation")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Bank Reconciliation · AVS ERP" }] }),
  component: BankReconciliationPage,
});

function rs(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function BankReconciliationPage() {
  const { sessions, loading, error, hydrate, createSession, updateCleared, reconcile, postBankCharge, importStatementCsv, autoMatchStatement } =
    useBankReconciliation();
  const moneyEntries = useMoneyVoucherStore((s) => s.entries);
  const ledgerAccounts = useChartOfAccountsStore((s) => s.ledgerAccounts);
  const accounts = useMemo(
    () => ledgerAccounts.filter((a) => a.isCashOrBank && a.isActive),
    [ledgerAccounts],
  );
  const [bankCode, setBankCode] = useState("");
  const [periodFrom, setPeriodFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [statementRs, setStatementRs] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [reconNotes, setReconNotes] = useState("");
  const [chargeRs, setChargeRs] = useState("");
  const [chargeNarration, setChargeNarration] = useState("Bank charges");
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    void ensureChartOfAccountsLoaded();
    void hydrate();
  }, [hydrate]);

  const previewBook = useMemo(() => {
    if (!bankCode) return { bookPaise: 0, lines: [] as ReturnType<typeof computeSessionBook>["lines"] };
    return computeSessionBook(bankCode, periodFrom, periodTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCode, periodFrom, periodTo, moneyEntries]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const sessionLines = useMemo(() => {
    if (!activeSession) return [];
    return computeSessionBook(
      activeSession.bankAccountCode,
      activeSession.periodFrom,
      activeSession.periodTo,
    ).lines;
  }, [activeSession, moneyEntries]);

  const clearedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const c of activeSession?.clearedEntries ?? []) {
      m.set(c.voucherId, c.cleared);
    }
    return m;
  }, [activeSession]);

  const toggleClear = useCallback(
    async (voucherId: string, voucherNumber: string, amountPaise: number) => {
      if (!activeSession || activeSession.status !== "open") return;
      const next: ClearedEntry[] = [...activeSession.clearedEntries];
      const idx = next.findIndex((c) => c.voucherId === voucherId);
      if (idx >= 0) {
        next[idx] = { ...next[idx], cleared: !next[idx].cleared };
      } else {
        next.push({ voucherId, voucherNumber, amountPaise, cleared: true });
      }
      try {
        await updateCleared(activeSession.id, next);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update cleared lines.");
      }
    },
    [activeSession, updateCleared],
  );

  const { focusedIndex, onKeyDown: onTableKeyDown, setFocusedIndex } = useTableKeyboardNav({
    rowCount: sessionLines.length,
    onEnter: (i) => {
      const line = sessionLines[i];
      if (!line) return;
      const amt = line.cashDebitPaise || line.cashCreditPaise;
      void toggleClear(line.id, line.voucherNumber, amt);
    },
  });

  async function handleCreate() {
    const statementBalancePaise = Math.round((parseFloat(statementRs) || 0) * 100);
    if (!bankCode) {
      toast.error("Select a bank account.");
      return;
    }
    setSaving(true);
    try {
      const session = await createSession({
        bankAccountCode: bankCode,
        periodFrom,
        periodTo,
        statementBalancePaise,
      });
      toast.success("Reconciliation session opened.");
      setStatementRs("");
      setActiveSessionId(session.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create session.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReconcile() {
    if (!activeSession) return;
    try {
      await reconcile(activeSession.id, reconNotes.trim() || undefined);
      toast.success("Marked reconciled.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reconcile.");
    }
  }

  async function handleBankCharge() {
    if (!activeSession) return;
    const amountPaise = Math.round((parseFloat(chargeRs) || 0) * 100);
    if (amountPaise <= 0) {
      toast.error("Enter a valid charge amount.");
      return;
    }
    const result = await postBankCharge({
      bankAccountCode: activeSession.bankAccountCode,
      amountPaise,
      narration: chargeNarration,
      sessionId: activeSession.id,
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Bank charge posted.");
    setChargeRs("");
  }

  async function handleImportCsv(file: File) {
    if (!activeSession || activeSession.status !== "open") return;
    setImportBusy(true);
    try {
      const text = await file.text();
      const result = await importStatementCsv(activeSession.id, text);
      if (result.imported === 0) {
        toast.error(result.errors[0] ?? "No statement rows imported.");
        return;
      }
      toast.success(`Imported ${result.imported} statement line(s).`);
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} row(s) skipped — check CSV format.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import statement.");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleAutoMatch() {
    if (!activeSession || activeSession.status !== "open") return;
    setImportBusy(true);
    try {
      const matched = await autoMatchStatement(activeSession.id);
      toast.success(matched > 0 ? `Auto-matched ${matched} line(s).` : "No new matches found.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto-match failed.");
    } finally {
      setImportBusy(false);
    }
  }

  const bookNow = activeSession
    ? computeSessionBook(
        activeSession.bankAccountCode,
        activeSession.periodFrom,
        activeSession.periodTo,
      ).bookPaise
    : previewBook.bookPaise;
  const statementPaise = activeSession?.statementBalancePaise ?? 0;
  const variance = statementPaise - bookNow;
  const uncleared = sessionLines.filter((l) => !clearedMap.get(l.id));

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Match bank statement closing to cash/bank book vouchers. Book balance is computed from the ledger."
        backTo="/treasury/vouchers"
        backLabel="Receipts & Payments"
      />

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Could not load sessions</p>
                <p className="text-muted-foreground mt-0.5">{error}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => void hydrate()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4" /> New Session
          </CardTitle>
          <CardDescription>
            Book balance updates automatically from vouchers for the selected account and period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bank-account">Bank / cash account</Label>
              <select
                id="bank-account"
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
              >
                <option value="">Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              {accounts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No cash/bank accounts yet.{" "}
                  <Link to="/control/accounts" className="underline">
                    Open Chart of Accounts
                  </Link>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="period-from">From</Label>
                <Input
                  id="period-from"
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="period-to">To</Label>
                <Input
                  id="period-to"
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="statement-bal">Statement closing (₹)</Label>
              <Input
                id="statement-bal"
                inputMode="decimal"
                value={statementRs}
                onChange={(e) => setStatementRs(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Book closing (computed)</Label>
              <div className="h-9 flex items-center rounded-md border bg-muted/40 px-3 text-sm font-medium">
                {bankCode ? rs(previewBook.bookPaise) : "—"}
              </div>
            </div>
          </div>
          <Button disabled={saving || !bankCode} onClick={() => void handleCreate()}>
            Open Reconciliation
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Sessions</h3>
        {loading && sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : sessions.length === 0 && !error ? (
          <p className="text-xs text-muted-foreground">No reconciliation sessions yet.</p>
        ) : (
          sessions.map((s) => {
            const v = s.statementBalancePaise - s.bookBalancePaise;
            return (
              <button
                key={s.id}
                type="button"
                className={`w-full text-left rounded-md border p-4 flex items-center justify-between gap-4 hover:bg-muted/40 ${
                  activeSessionId === s.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setActiveSessionId(s.id)}
              >
                <div>
                  <div className="font-semibold">{s.bankAccountCode}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {s.periodFrom} → {s.periodTo} · Statement {rs(s.statementBalancePaise)} · Book{" "}
                    {rs(s.bookBalancePaise)} · Variance {rs(v)}
                  </div>
                </div>
                <Badge variant="outline">{s.status}</Badge>
              </button>
            );
          })
        )}
      </div>

      {activeSession && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Session · {activeSession.bankAccountCode}
            </CardTitle>
            <CardDescription>
              Statement {rs(statementPaise)} · Book {rs(bookNow)} · Variance{" "}
              <span className={variance === 0 ? "text-green-700" : "text-amber-700"}>
                {rs(variance)}
              </span>
              {uncleared.length > 0 && ` · ${uncleared.length} uncleared`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="rounded-md border overflow-x-auto"
              tabIndex={0}
              onKeyDown={onTableKeyDown}
              role="grid"
              aria-label="Bank voucher lines"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="p-2 w-10">✓</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Voucher</th>
                    <th className="p-2">Party / Narration</th>
                    <th className="p-2 text-right">Debit</th>
                    <th className="p-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-muted-foreground text-center text-xs">
                        No vouchers for this account in the period.
                      </td>
                    </tr>
                  ) : (
                    sessionLines.map((line, i) => {
                      const cleared = !!clearedMap.get(line.id);
                      const amt = line.cashDebitPaise || line.cashCreditPaise;
                      return (
                        <tr
                          key={line.id}
                          className={`border-b cursor-pointer ${
                            focusedIndex === i ? "bg-primary/10" : ""
                          } ${cleared ? "opacity-70" : ""}`}
                          onClick={() => {
                            setFocusedIndex(i);
                            void toggleClear(line.id, line.voucherNumber, amt);
                          }}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={cleared}
                              readOnly
                              aria-label={`Clear ${line.voucherNumber}`}
                            />
                          </td>
                          <td className="p-2 whitespace-nowrap">{line.voucherDate}</td>
                          <td className="p-2 font-mono text-xs">{line.voucherNumber}</td>
                          <td className="p-2">
                            {line.counterpartyName ||
                              (typeof line.metadata.narration === "string"
                                ? line.metadata.narration
                                : "—")}
                          </td>
                          <td className="p-2 text-right">
                            {line.cashDebitPaise ? rs(line.cashDebitPaise) : ""}
                          </td>
                          <td className="p-2 text-right">
                            {line.cashCreditPaise ? rs(line.cashCreditPaise) : ""}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {activeSession.status === "open" && (
              <>
                <div className="rounded-md border p-4 space-y-3 bg-muted/20">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
                    <div className="space-y-1.5">
                      <Label htmlFor="stmt-csv">Import bank statement (CSV)</Label>
                      <Input
                        id="stmt-csv"
                        type="file"
                        accept=".csv,text/csv"
                        disabled={importBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleImportCsv(file);
                          e.target.value = "";
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Columns: Date, Narration, Debit/Credit (or Amount), optional Balance.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={importBusy || (activeSession.statementLines?.length ?? 0) === 0}
                      onClick={() => void handleAutoMatch()}
                    >
                      Auto-match statement
                    </Button>
                  </div>
                  {(activeSession.statementLines?.length ?? 0) > 0 && (
                    <div className="rounded-md border overflow-x-auto max-h-48">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left">
                            <th className="p-2">Date</th>
                            <th className="p-2">Narration</th>
                            <th className="p-2 text-right">Debit</th>
                            <th className="p-2 text-right">Credit</th>
                            <th className="p-2">Matched</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSession.statementLines.map((line) => (
                            <tr key={line.id} className="border-b">
                              <td className="p-2 whitespace-nowrap">{line.date}</td>
                              <td className="p-2">{line.narration}</td>
                              <td className="p-2 text-right">
                                {line.debitPaise ? rs(line.debitPaise) : ""}
                              </td>
                              <td className="p-2 text-right">
                                {line.creditPaise ? rs(line.creditPaise) : ""}
                              </td>
                              <td className="p-2 font-mono">
                                {line.matchedVoucherId ? "✓" : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="grid sm:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label>Bank charge (₹)</Label>
                    <Input
                      inputMode="decimal"
                      value={chargeRs}
                      onChange={(e) => setChargeRs(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label>Narration</Label>
                    <Input
                      value={chargeNarration}
                      onChange={(e) => setChargeNarration(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" onClick={() => void handleBankCharge()}>
                    Post bank charge
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Reconcile notes (required if variance / uncleared)</Label>
                  <Textarea
                    value={reconNotes}
                    onChange={(e) => setReconNotes(e.target.value)}
                    rows={2}
                    placeholder="Explain remaining variance or uncleared items…"
                  />
                </div>
                <Button className="gap-1" onClick={() => void handleReconcile()}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark reconciled
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

