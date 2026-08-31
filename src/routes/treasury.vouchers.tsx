/**
 * Receipts & Payments — money in/out posts through money-voucher spine.
 * Journal / Contra remain treasury CoA transfers (no party required).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/design-system";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ensureChartOfAccountsLoaded,
  useChartOfAccountsStore,
} from "@/lib/chart-of-accounts-store";
import {
  ensureTransactionTypesLoaded,
  postUniversalTransaction,
  useTransactionTypesStore,
} from "@/lib/transaction-types-store";
import {
  postMoneyVoucher,
  useMoneyVoucherStore,
  MONEY_PAYMENT_MODES,
  type MoneyVoucherKind,
} from "@/lib/money-voucher";
import { PAYMENT_MODE_LABELS, type PaymentMode } from "@/lib/billing-store";
import { PartySearchSelect } from "@/components/party-search-select";
import { usePeople } from "@/lib/people-store";
import { CompanyCashLedgerTable } from "@/components/ledger/CompanyCashLedgerTable";
import {
  compileCompanyCashLedger,
  companyCashLedgerOpeningPaise,
} from "@/lib/company-cash-ledger";
import { ProgressiveDisclosure } from "@/components/ui/progressive-disclosure";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";

export const Route = createFileRoute("/treasury/vouchers")({
  validateSearch: (s) =>
    z.object({ tab: z.enum(["receipt", "payment", "journal", "contra"]).optional() }).parse(s),
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Receipts & Payments · AVS ERP" }] }),
  component: TreasuryVouchersPage,
});

type VoucherKind = "receipt" | "payment" | "journal" | "contra";

const VOUCHER_CODES: Record<VoucherKind, string> = {
  receipt: "CASH_RECEIPT",
  payment: "CASH_PAYMENT",
  journal: "JOURNAL_VOUCHER",
  contra: "CONTRA_VOUCHER",
};

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
  const [sheetOpen, setSheetOpen] = useState(Boolean(tabFromUrl));
  const [amount, setAmount] = useState("");
  const [partyId, setPartyId] = useState("");
  const [method, setMethod] = useState<PaymentMode>("cash");
  const [narration, setNarration] = useState("");
  const [reference, setReference] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [posting, setPosting] = useState(false);

  const moneyEntries = useMoneyVoucherStore((s) => s.entries);
  const moneyLoading = useMoneyVoucherStore((s) => s.loading);
  const moneyError = useMoneyVoucherStore((s) => s.error);
  const hydrateMoney = useMoneyVoucherStore((s) => s.hydrate);

  const { ledgerAccounts, hydrated: coaHydrated } = useChartOfAccountsStore();
  const { transactionTypes, isHydrated: txHydrated } = useTransactionTypesStore();

  const cashAccounts = useMemo(
    () => ledgerAccounts.filter((a) => a.isActive && a.isCashOrBank),
    [ledgerAccounts],
  );
  const activeAccounts = useMemo(() => ledgerAccounts.filter((a) => a.isActive), [ledgerAccounts]);

  const treasuryTypes = useMemo(
    () =>
      transactionTypes.filter((t) =>
        ["CASH_RECEIPT", "CASH_PAYMENT", "JOURNAL_VOUCHER", "CONTRA_VOUCHER"].includes(t.code),
      ),
    [transactionTypes],
  );

  const cashLedgerRows = useMemo(() => compileCompanyCashLedger(), [moneyEntries, ledgerAccounts]);
  const cashOpeningPaise = useMemo(
    () => companyCashLedgerOpeningPaise(),
    [moneyEntries, ledgerAccounts],
  );

  useEffect(() => {
    if (tabFromUrl) {
      setTab(tabFromUrl);
      setSheetOpen(true);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    void ensureChartOfAccountsLoaded();
    void ensureTransactionTypesLoaded();
    void hydrateMoney();
    void usePeople.getState().refresh();
  }, [hydrateMoney]);

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

    setPosting(true);
    try {
      if (tab === "receipt" || tab === "payment") {
        if (!partyId) {
          toast.error("Party is required for receipts and payments.");
          return;
        }
        const accountId = cashAccountId || undefined;
        const result = await postMoneyVoucher({
          kind: tab as MoneyVoucherKind,
          partyId,
          amountPaise: paise,
          method,
          cashOrBankAccountId: accountId,
          narration: narration.trim() || undefined,
          reference: reference.trim() || undefined,
          source: "treasury_voucher",
          sourceId: `tv_${tab}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        });
        if (!result.posted) {
          toast.error(result.error ?? "Voucher posting failed.");
          return;
        }
        toast.success(
          `${tab === "receipt" ? "Payment Received" : "Payment Made"} · ${result.voucherNumber}`,
        );
      } else if (tab === "journal") {
        if (!debitAccountId || !creditAccountId) {
          toast.error("Select debit and credit accounts.");
          return;
        }
        if (!narration.trim()) {
          toast.error("Narration is required for journal vouchers.");
          return;
        }
        // Journal: when either side is cash/bank, post matching debit + credit amounts
        // so company cash book can attribute both legs. Non-cash↔non-cash keeps amount
        // on debit with credit=0 and both CoA ids in metadata (existing report readers).
        const debitIsCash = cashAccounts.some((a) => a.id === debitAccountId);
        const creditIsCash = cashAccounts.some((a) => a.id === creditAccountId);
        const journalSourceId = `tj_${Date.now()}`;
        const voucherNumber = makeVoucherNumber(def.prefix);

        if (debitIsCash || creditIsCash) {
          if (debitIsCash) {
            const debitLeg = await postUniversalTransaction({
              transactionCode: code,
              voucherNumber: `${voucherNumber}-DR`,
              cashDebitPaise: paise,
              cashCreditPaise: 0,
              metadata: {
                voucherKind: "journal",
                journalLeg: "debit",
                narration: narration.trim(),
                debit_account_id: debitAccountId,
                credit_account_id: creditAccountId,
                cash_or_bank_account_id: debitAccountId,
                journal_amount_paise: paise,
                source: "treasury_journal",
                sourceId: `${journalSourceId}_dr`,
                journalGroupId: journalSourceId,
              },
            });
            if (debitLeg.error || !debitLeg.entryId) {
              toast.error(debitLeg.error ?? "Journal debit posting failed.");
              return;
            }
          }
          if (creditIsCash) {
            const creditLeg = await postUniversalTransaction({
              transactionCode: code,
              voucherNumber: `${voucherNumber}-CR`,
              cashDebitPaise: 0,
              cashCreditPaise: paise,
              metadata: {
                voucherKind: "journal",
                journalLeg: "credit",
                narration: narration.trim(),
                debit_account_id: debitAccountId,
                credit_account_id: creditAccountId,
                cash_or_bank_account_id: creditAccountId,
                journal_amount_paise: paise,
                source: "treasury_journal",
                sourceId: `${journalSourceId}_cr`,
                journalGroupId: journalSourceId,
              },
            });
            if (creditLeg.error || !creditLeg.entryId) {
              toast.error(creditLeg.error ?? "Journal credit posting failed.");
              return;
            }
          }
          // Non-cash opposite side: store metadata-only companion when one side is cash
          if (debitIsCash !== creditIsCash) {
            /* cash leg already posted above; CoA non-cash tracked in metadata */
          }
        } else {
          const result = await postUniversalTransaction({
            transactionCode: code,
            voucherNumber,
            cashDebitPaise: paise,
            cashCreditPaise: 0,
            metadata: {
              voucherKind: "journal",
              narration: narration.trim(),
              debit_account_id: debitAccountId,
              credit_account_id: creditAccountId,
              journal_amount_paise: paise,
              source: "treasury_journal",
              sourceId: journalSourceId,
            },
          });
          if (result.error || !result.entryId) {
            toast.error(result.error ?? "Journal posting failed.");
            return;
          }
        }
        toast.success("Journal voucher posted.");
        await hydrateMoney();
      } else {
        if (!fromAccountId || !toAccountId) {
          toast.error("Select from and to accounts.");
          return;
        }
        if (fromAccountId === toAccountId) {
          toast.error("From and to accounts must differ.");
          return;
        }
        const contraSourceId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const voucherNumber = makeVoucherNumber(def.prefix);
        // Double-entry cash/bank legs: credit FROM, debit TO (Offline contra behaviour).
        const creditLeg = await postUniversalTransaction({
          transactionCode: code,
          voucherNumber: `${voucherNumber}-OUT`,
          cashDebitPaise: 0,
          cashCreditPaise: paise,
          metadata: {
            voucherKind: "contra",
            contraLeg: "from",
            narration: narration.trim() || `Contra out → ${toAccountId}`,
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            cash_or_bank_account_id: fromAccountId,
            contra_amount_paise: paise,
            source: "treasury_contra",
            sourceId: `${contraSourceId}_from`,
            contraGroupId: contraSourceId,
          },
        });
        if (creditLeg.error || !creditLeg.entryId) {
          toast.error(creditLeg.error ?? "Contra (from) posting failed.");
          return;
        }
        const debitLeg = await postUniversalTransaction({
          transactionCode: code,
          voucherNumber: `${voucherNumber}-IN`,
          cashDebitPaise: paise,
          cashCreditPaise: 0,
          metadata: {
            voucherKind: "contra",
            contraLeg: "to",
            narration: narration.trim() || `Contra in ← ${fromAccountId}`,
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            cash_or_bank_account_id: toAccountId,
            contra_amount_paise: paise,
            source: "treasury_contra",
            sourceId: `${contraSourceId}_to`,
            contraGroupId: contraSourceId,
          },
        });
        if (debitLeg.error || !debitLeg.entryId) {
          toast.error(debitLeg.error ?? "Contra (to) posting failed.");
          return;
        }
        toast.success(`Contra voucher posted · ${voucherNumber}`);
        await hydrateMoney();
      }

      setAmount("");
      setPartyId("");
      setNarration("");
      setReference("");
      setSheetOpen(false);
    } finally {
      setPosting(false);
    }
  }

  function openSheet(kind: VoucherKind) {
    setTab(kind);
    const cash = cashAccounts[0];
    if (cash) setCashAccountId(cash.id);
    if (kind === "journal") {
      setDebitAccountId(activeAccounts[0]?.id ?? "");
      setCreditAccountId(activeAccounts[1]?.id ?? "");
    } else if (kind === "contra") {
      setFromAccountId(cashAccounts[0]?.id ?? "");
      setToAccountId(cashAccounts[1]?.id ?? cashAccounts[0]?.id ?? "");
    }
    setSheetOpen(true);
  }

  const voucherForm = (
    <>
      {!coaHydrated || !txHydrated ? (
        <p className="text-sm text-muted-foreground">Loading accounts and voucher types…</p>
      ) : (
        <>
          {treasuryTypes.length < 4 && (
            <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Receipt, payment, journal, or contra types are still loading. Reload this page. If the
              form stays empty, open Customization → Transactions and reset standard presets.
            </p>
          )}
          {cashAccounts.length === 0 && (
            <p className="mb-3 text-sm text-amber-700">
              No cash or bank ledger is set up. Add one under Chart of Accounts, then return here.
            </p>
          )}
          <Tabs value={tab} onValueChange={(v) => setTab(v as VoucherKind)}>
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto gap-1">
              <TabsTrigger value="receipt" className="gap-1 text-xs py-2">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                Receive
              </TabsTrigger>
              <TabsTrigger value="payment" className="gap-1 text-xs py-2">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Pay
              </TabsTrigger>
              <TabsTrigger value="journal" className="gap-1 text-xs py-2">
                <BookOpen className="h-3.5 w-3.5" />
                Journal
              </TabsTrigger>
              <TabsTrigger value="contra" className="gap-1 text-xs py-2">
                <Repeat className="h-3.5 w-3.5" />
                Contra
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tv-amount">Amount (₹)</Label>
                <Input
                  id="tv-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10000"
                  inputMode="decimal"
                />
              </div>

              {(tab === "receipt" || tab === "payment") && (
                <>
                  <PartySearchSelect
                    value={partyId}
                    onChange={(id) => setPartyId(id)}
                    required
                    label="Party"
                  />
                  <ProgressiveDisclosure
                    title="Payment details & notes"
                    hint="Method, cash/bank account, reference, and narration."
                  >
                    <div className="space-y-1.5">
                      <Label>Payment method</Label>
                      <Select value={method} onValueChange={(v) => setMethod(v as PaymentMode)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONEY_PAYMENT_MODES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {PAYMENT_MODE_LABELS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Cash / Bank account</Label>
                      <Select
                        value={cashAccountId || undefined}
                        onValueChange={setCashAccountId}
                      >
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
                    <div className="space-y-1.5">
                      <Label htmlFor="tv-ref">Reference</Label>
                      <Input
                        id="tv-ref"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Cheque no / UTR / slip"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tv-narration-basic">Narration</Label>
                      <Textarea
                        id="tv-narration-basic"
                        value={narration}
                        onChange={(e) => setNarration(e.target.value)}
                        rows={2}
                        placeholder="Optional note for this voucher"
                      />
                    </div>
                  </ProgressiveDisclosure>
                </>
              )}

              {tab === "contra" && (
                <>
                  <div className="space-y-1.5">
                    <Label>From Account</Label>
                    <Select value={fromAccountId || undefined} onValueChange={setFromAccountId}>
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
                  <div className="space-y-1.5">
                    <Label>To Account</Label>
                    <Select value={toAccountId || undefined} onValueChange={setToAccountId}>
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
              )}

              {tab === "journal" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Debit Account</Label>
                    <Select value={debitAccountId || undefined} onValueChange={setDebitAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Credit Account</Label>
                    <Select value={creditAccountId || undefined} onValueChange={setCreditAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {(tab === "journal" || tab === "contra") && (
                <div className="space-y-1.5">
                  <Label htmlFor="tv-narration">
                    Narration{tab === "journal" ? " *" : ""}
                  </Label>
                  <Textarea
                    id="tv-narration"
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder="Purpose of this voucher"
                    rows={2}
                  />
                </div>
              )}

              <Button
                className="w-full min-h-[44px]"
                disabled={posting || treasuryTypes.length < 4}
                onClick={() => void handlePost()}
              >
                {posting ? "Posting…" : tab === "receipt" ? "Receive Payment" : tab === "payment" ? "Make Payment" : "Post Voucher"}
              </Button>
            </div>
          </Tabs>
        </>
      )}
    </>
  );

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Receipts & Payments"
        subtitle="Receive or pay money against any party. Posts to cash/bank and party ledgers together."
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button size="sm" variant="ghost" asChild>
              <Link to="/treasury/bank-reconciliation">Bank reconciliation</Link>
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => openSheet("receipt")}>
              <ArrowDownLeft className="h-3.5 w-3.5" /> Receive
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openSheet("payment")}>
              <ArrowUpRight className="h-3.5 w-3.5" /> Pay
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openSheet("journal")}>
              <BookOpen className="h-3.5 w-3.5" /> Journal
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openSheet("contra")}>
              <Repeat className="h-3.5 w-3.5" /> Contra
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base">Company Cash Book</CardTitle>
              <SourceOfTruthBadge variant="ledger" />
            </div>
            <CardDescription>
              Same register as Cash Book — Dr/Cr, running balance, narration, party, and source module.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/treasury/cash-book" search={{}}>Open Cash Book</Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => void hydrateMoney()}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {moneyError && (
            <p className="text-sm text-destructive mb-3">{moneyError}</p>
          )}
          {moneyLoading && cashLedgerRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <CompanyCashLedgerTable
              rows={cashLedgerRows}
              showOpeningFooter
              openingPaise={cashOpeningPaise}
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Landmark className="h-4 w-4" /> New Voucher
            </SheetTitle>
            <SheetDescription>
              Party is required for Receive and Pay. Cash/bank and party ledgers update together.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">{voucherForm}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
