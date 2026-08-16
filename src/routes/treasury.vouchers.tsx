/**
 * Treasury Vouchers — Receipt, Payment, Journal, Contra
 * Posts to universal_ledger_entries via rpc_post_universal_transaction.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Landmark, ArrowDownLeft, ArrowUpRight, BookOpen, Repeat } from "lucide-react";
import { toast } from "sonner";
import { guardRoute } from "@/lib/permissions";
import {
  ensureChartOfAccountsLoaded,
  useChartOfAccountsStore,
} from "@/lib/chart-of-accounts-store";
import {
  ensureTransactionTypesLoaded,
  postUniversalTransaction,
  useTransactionTypesStore,
} from "@/lib/transaction-types-store";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export const Route = createFileRoute("/treasury/vouchers")({
  validateSearch: (s) =>
    z.object({ tab: z.enum(["receipt", "payment", "journal", "contra"]).optional() }).parse(s),
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Treasury Vouchers · Ornexa ERP" }] }),
  component: TreasuryVouchersPage,
});

type VoucherKind = "receipt" | "payment" | "journal" | "contra";

const VOUCHER_CODES: Record<VoucherKind, string> = {
  receipt: "CASH_RECEIPT",
  payment: "CASH_PAYMENT",
  journal: "JOURNAL_VOUCHER",
  contra: "CONTRA_VOUCHER",
};

interface LedgerEntryRow {
  id: string;
  voucher_number: string;
  voucher_date: string;
  counterparty_name: string | null;
  cash_debit_paise: number;
  cash_credit_paise: number;
  metadata: Record<string, unknown> | null;
  universal_transaction_definitions?: { code: string; name: string } | null;
}

function rupeesToPaise(input: string): number {
  const n = Number(input.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) throw new Error("Enter a valid amount in rupees.");
  return Math.round(n * 100);
}

function formatRs(paise: number): string {
  return `₹ ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function makeVoucherNumber(prefix: string): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${stamp}-${rand}`;
}

function TreasuryVouchersPage() {
  const { tab: tabFromUrl } = Route.useSearch();
  const [tab, setTab] = useState<VoucherKind>(tabFromUrl ?? "receipt");
  const [amount, setAmount] = useState("");
  const [partyName, setPartyName] = useState("");
  const [narration, setNarration] = useState("");
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [posting, setPosting] = useState(false);
  const [entries, setEntries] = useState<LedgerEntryRow[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const { ledgerAccounts, hydrated: coaHydrated } = useChartOfAccountsStore();
  const { transactionTypes, isHydrated: txHydrated } = useTransactionTypesStore();

  const cashAccounts = useMemo(
    () => ledgerAccounts.filter((a) => a.isActive && a.isCashOrBank),
    [ledgerAccounts],
  );
  const activeAccounts = useMemo(() => ledgerAccounts.filter((a) => a.isActive), [ledgerAccounts]);

  const treasuryTypes = useMemo(
    () =>
      transactionTypes.filter(
        (t) =>
          t.category === "treasury" &&
          ["CASH_RECEIPT", "CASH_PAYMENT", "JOURNAL_VOUCHER", "CONTRA_VOUCHER"].includes(t.code),
      ),
    [transactionTypes],
  );

  useEffect(() => {
    if (tabFromUrl) setTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    void ensureChartOfAccountsLoaded();
    void ensureTransactionTypesLoaded();
    void refreshEntries();
  }, []);

  async function refreshEntries() {
    setLoadingEntries(true);
    try {
      const { data, error } = await supabase
        .from("universal_ledger_entries" as never)
        .select(
          "id,voucher_number,voucher_date,counterparty_name,cash_debit_paise,cash_credit_paise,metadata,universal_transaction_definitions(code,name)",
        )
        .order("voucher_date", { ascending: false })
        .limit(25);
      if (error) throw error;
      const rows = (data ?? []) as unknown as LedgerEntryRow[];
      setEntries(
        rows.filter((r) => {
          const code = r.universal_transaction_definitions?.code;
          return code && Object.values(VOUCHER_CODES).includes(code);
        }),
      );
    } catch (err: unknown) {
      console.warn("[treasury] load entries:", err);
    } finally {
      setLoadingEntries(false);
    }
  }

  function accountLabel(id: string): string {
    const acc = ledgerAccounts.find((a) => a.id === id);
    return acc ? `${acc.code} — ${acc.name}` : id;
  }

  async function handlePost() {
    const code = VOUCHER_CODES[tab];
    const def = transactionTypes.find((t) => t.code === code);
    if (!def) {
      toast.error(`Transaction type ${code} is not configured. Open Customization → Transactions.`);
      return;
    }

    let paise: number;
    try {
      paise = rupeesToPaise(amount);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid amount.");
      return;
    }

    let cashDebit = 0;
    let cashCredit = 0;
    const metadata: Record<string, unknown> = { voucherKind: tab, narration: narration.trim() };

    if (tab === "receipt") {
      if (!debitAccountId || !creditAccountId) {
        toast.error("Select debit (cash/bank) and credit accounts.");
        return;
      }
      cashDebit = paise;
      metadata.debit_account_id = debitAccountId;
      metadata.credit_account_id = creditAccountId;
    } else if (tab === "payment") {
      if (!debitAccountId || !creditAccountId) {
        toast.error("Select debit and credit (cash/bank) accounts.");
        return;
      }
      cashCredit = paise;
      metadata.debit_account_id = debitAccountId;
      metadata.credit_account_id = creditAccountId;
    } else if (tab === "journal") {
      if (!debitAccountId || !creditAccountId) {
        toast.error("Select debit and credit accounts.");
        return;
      }
      if (!narration.trim()) {
        toast.error("Narration is required for journal vouchers.");
        return;
      }
      cashDebit = paise;
      cashCredit = paise;
      metadata.debit_account_id = debitAccountId;
      metadata.credit_account_id = creditAccountId;
    } else {
      if (!fromAccountId || !toAccountId) {
        toast.error("Select from and to accounts.");
        return;
      }
      if (fromAccountId === toAccountId) {
        toast.error("From and to accounts must differ.");
        return;
      }
      cashDebit = paise;
      cashCredit = paise;
      metadata.from_account_id = fromAccountId;
      metadata.to_account_id = toAccountId;
    }

    setPosting(true);
    const result = await postUniversalTransaction({
      transactionCode: code,
      voucherNumber: makeVoucherNumber(def.prefix),
      counterpartyName: partyName.trim() || undefined,
      cashDebitPaise: cashDebit,
      cashCreditPaise: cashCredit,
      metadata,
    });
    setPosting(false);

    if (result.error || !result.entryId) {
      toast.error(result.error ?? "Voucher posting failed.");
      return;
    }

    toast.success(`${def.name} posted.`);
    setAmount("");
    setPartyName("");
    setNarration("");
    void refreshEntries();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Treasury Vouchers"
        subtitle="Post receipt, payment, journal, and contra vouchers to the universal ledger."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Voucher</CardTitle>
            <CardDescription>
              Double-entry money postings use chart-of-accounts references in voucher metadata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!coaHydrated || !txHydrated ? (
              <p className="text-sm text-muted-foreground">
                Loading accounts and transaction types…
              </p>
            ) : treasuryTypes.length < 4 ? (
              <p className="text-sm text-amber-600">
                Treasury transaction types are missing. Visit Customization → Transactions and reset
                standard presets, or reload the app after migration.
              </p>
            ) : (
              <Tabs value={tab} onValueChange={(v) => setTab(v as VoucherKind)}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="receipt" className="gap-1 text-xs">
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                    Receipt
                  </TabsTrigger>
                  <TabsTrigger value="payment" className="gap-1 text-xs">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Payment
                  </TabsTrigger>
                  <TabsTrigger value="journal" className="gap-1 text-xs">
                    <BookOpen className="h-3.5 w-3.5" />
                    Journal
                  </TabsTrigger>
                  <TabsTrigger value="contra" className="gap-1 text-xs">
                    <Repeat className="h-3.5 w-3.5" />
                    Contra
                  </TabsTrigger>
                </TabsList>

                <div className="mt-4 space-y-3">
                  <div>
                    <Label>Amount (₹)</Label>
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="10000"
                      inputMode="decimal"
                    />
                  </div>

                  {(tab === "receipt" || tab === "payment") && (
                    <div>
                      <Label>Party Name (optional)</Label>
                      <Input
                        value={partyName}
                        onChange={(e) => setPartyName(e.target.value)}
                        placeholder="Customer / supplier name"
                      />
                    </div>
                  )}

                  {tab === "contra" ? (
                    <>
                      <div>
                        <Label>From Account</Label>
                        <Select value={fromAccountId} onValueChange={setFromAccountId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {cashAccounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} — {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>To Account</Label>
                        <Select value={toAccountId} onValueChange={setToAccountId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {cashAccounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} — {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label>
                          {tab === "receipt"
                            ? "Debit Account (Cash/Bank)"
                            : tab === "payment"
                              ? "Debit Account (Expense/Party)"
                              : "Debit Account"}
                        </Label>
                        <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {(tab === "receipt" ? cashAccounts : activeAccounts).map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} — {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>
                          {tab === "payment"
                            ? "Credit Account (Cash/Bank)"
                            : tab === "receipt"
                              ? "Credit Account (Party/Income)"
                              : "Credit Account"}
                        </Label>
                        <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {(tab === "payment" ? cashAccounts : activeAccounts).map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} — {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div>
                    <Label>Narration</Label>
                    <Textarea
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                      placeholder="Purpose of this voucher"
                      rows={2}
                    />
                  </div>

                  <Button className="w-full" disabled={posting} onClick={() => void handlePost()}>
                    {posting ? "Posting…" : "Post Voucher"}
                  </Button>
                </div>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Treasury Vouchers</CardTitle>
              <CardDescription>
                Last 25 posted receipt, payment, journal, and contra entries.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => void refreshEntries()}>
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loadingEntries ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No treasury vouchers posted yet.</p>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-y-auto">
                {entries.map((e) => {
                  const code = e.universal_transaction_definitions?.code ?? "";
                  const meta = e.metadata ?? {};
                  const debitId = String(meta.debit_account_id ?? meta.from_account_id ?? "");
                  const creditId = String(meta.credit_account_id ?? meta.to_account_id ?? "");
                  const netPaise = e.cash_debit_paise || e.cash_credit_paise;
                  return (
                    <div key={e.id} className="rounded-md border p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-medium">{e.voucher_number}</span>
                        <Badge variant="outline">{code.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.voucher_date).toLocaleString("en-IN")}
                        {e.counterparty_name ? ` · ${e.counterparty_name}` : ""}
                      </div>
                      <div className="font-semibold">{formatRs(netPaise)}</div>
                      {debitId && (
                        <div className="text-xs text-muted-foreground">
                          Dr {accountLabel(debitId)}
                          {creditId ? ` · Cr ${accountLabel(creditId)}` : ""}
                        </div>
                      )}
                      {meta.narration ? (
                        <div className="text-xs italic">{String(meta.narration)}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
