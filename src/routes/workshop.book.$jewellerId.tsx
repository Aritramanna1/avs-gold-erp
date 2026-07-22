import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { useOrders, ORDER_STATUS_LABELS } from "@/lib/orders-store";
import { useJobCards, JOB_STATUS_LABELS } from "@/lib/jobcards-store";
import { useMfgBills, MFG_BILL_STATUS_LABELS } from "@/lib/manufacturing-bill-store";
import { useBilling, paiseToRupees } from "@/lib/billing-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { compileJewellerBook } from "@/lib/workshop-books";
import { formatWeight, getCaratLabel, mgToGrams } from "@/lib/gold";
import {
  buildJewellerPeriodView,
  type JewellerLedgerLine,
  type JewellerPeriodView,
} from "@/lib/workshop-jeweller-period";
import { exportToXLSX } from "@/lib/report-engine";
import { useLedgerPeriod, LedgerPeriodPicker } from "@/components/workshop/ledger-view";
import { GoldBalanceBadge } from "@/components/gold-balance-badge";
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  FileText,
  History,
  Printer,
  Scale,
  Hammer,
  Coins,
  Search,
  Sheet,
} from "lucide-react";

export const Route = createFileRoute("/workshop/book/$jewellerId")({
  head: () => ({ meta: [{ title: "Jeweller Book · Manufacturing Books · AVS Gold ERP" }] }),
  component: JewellerBookPage,
});

/**
 * One jeweller's book — the digital form of the physical ledger page kept for
 * them today: who they are, the gold they gave us, the gold we issued, every
 * order and the job cards under it, the manufacturing bills, the settlements,
 * and one chronological ledger with running gold and cash balances.
 */
function JewellerBookPage() {
  const { jewellerId } = useParams({ from: "/workshop/book/$jewellerId" });

  // Subscribed so a posting made anywhere in the ERP updates this book live.
  const people = usePeople((s) => s.people);
  const orders = useOrders((s) => s.orders);
  const jobs = useJobCards((s) => s.jobs);
  const bills = useMfgBills((s) => s.bills);
  const invoices = useBilling((s) => s.invoices);
  const settlements = useGoldSettlement((s) => s.settlements);

  const book = useMemo(
    () => compileJewellerBook(jewellerId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jewellerId, people, orders, jobs, bills, invoices, settlements],
  );

  const [ledgerQuery, setLedgerQuery] = useState("");
  // Ledgers are shared by period, not dumped whole — one period governs the
  // on-screen statement, the Excel export AND the printed statement.
  const period = useLedgerPeriod();

  // Period statement: opening carried forward, transactions with automatic
  // weekly/monthly closings, and the eight-figure period summary. Same engine
  // shape the Worker Book uses, extended to gold + cash.
  const view = useMemo(
    () => (book ? buildJewellerPeriodView(book.ledger.rows, period.range) : null),
    [book, period.range],
  );

  if (!book || !view) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-3">
        <h1 className="font-serif text-2xl text-gold">Jeweller not found</h1>
        <p className="text-sm text-muted-foreground">This party may have been removed.</p>
        <Link to="/workshop" className="text-gold underline text-sm">
          Back to Jeweller Books
        </Link>
      </div>
    );
  }

  const { jeweller, ledger } = book;

  function handleExcel() {
    exportJewellerPeriodXlsx(jeweller.fullName, view!, period.range.label);
  }

  // Filter hides matching transaction lines only; opening/closing lines and
  // every balance are read straight from the period view, never re-struck.
  const q = ledgerQuery.trim().toLowerCase();
  const visibleLines =
    q === ""
      ? view.lines
      : view.lines.filter(
          (l) =>
            l.kind !== "txn" ||
            `${l.date} ${l.voucherNo} ${l.type} ${l.description}`.toLowerCase().includes(q),
        );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4">
        <Link
          to="/workshop"
          className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Jeweller Books
        </Link>
      </div>

      {/* ── Book cover: who this book belongs to ─────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-gold flex items-center gap-2">
            <BookOpen className="h-7 w-7" /> {jeweller.fullName}
          </h1>
          <div className="text-sm text-muted-foreground mt-1">
            {PERSON_TYPE_LABELS[jeweller.type]}
            {jeweller.phone ? ` · ${jeweller.phone}` : ""}
            {jeweller.villageCity ? ` · ${jeweller.villageCity}` : ""}
          </div>
          {jeweller.currentAddress && (
            <div className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              {jeweller.currentAddress}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/people/$id" params={{ id: jeweller.id }}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="h-4 w-4" /> Jeweller File
            </Button>
          </Link>
          {/* Print/export the complete ledger — the existing customer ledger
              statement document, printed through the unified Print Engine (page
              setup, PDF export and all). No second print path. */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleExcel}
            disabled={ledger.rows.length === 0}
          >
            <Sheet className="h-4 w-4" /> Export to Excel
          </Button>
          {/* Print scoped to the SELECTED period (from/to/label ride in the
              search params the print route decodes) — not the whole book. */}
          <Link
            to="/people/ledger-print/$id"
            params={{ id: jeweller.id }}
            search={{
              from: period.range.from,
              to: period.range.to,
              plabel: period.range.label,
            }}
          >
            <Button size="sm" className="gap-1.5 text-xs bg-gold text-black hover:bg-gold/90">
              <Printer className="h-4 w-4" /> Print Ledger
            </Button>
          </Link>
        </div>
      </div>

      {/* ── The balances the jeweller actually asks about ────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Stat k="Gold received" v={`${formatWeight(book.goldReceivedMg)}`} hint="Fine, lifetime" />
        <Stat
          k="Gold issued"
          v={`${formatWeight(book.goldIssuedMg)}`}
          hint="Fine, back to jeweller"
        />
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Scale className="h-3 w-3" /> Outstanding gold
          </div>
          <div className="mt-2">
            <GoldBalanceBadge heldMg={book.goldHeldMg} owedMg={book.goldOwedMg} />
          </div>
        </div>
        <Stat
          k="Outstanding cash"
          v={
            book.cashDuePaise > 0
              ? `₹${paiseToRupees(book.cashDuePaise)}`
              : book.cashAdvancePaise > 0
                ? `₹${paiseToRupees(book.cashAdvancePaise)}`
                : "—"
          }
          hint={
            book.cashDuePaise > 0
              ? "Owed to us"
              : book.cashAdvancePaise > 0
                ? "Advance with us"
                : "Settled"
          }
          tone={book.cashDuePaise > 0 ? "red" : undefined}
        />
        <Stat
          k="Ledger entries"
          v={String(ledger.rows.length)}
          hint={`${book.deliveredPieces} delivered · ${book.openOrders} open orders`}
        />
      </div>

      <Tabs defaultValue="ledger">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="ledger" className="gap-2">
            <History className="h-4 w-4" /> Ledger ({ledger.rows.length})
          </TabsTrigger>
          <TabsTrigger value="settlements" className="gap-2">
            <Coins className="h-4 w-4" /> Settlements ({book.settlements.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Chronological ledger with running balances ─────────────────── */}
        <TabsContent value="ledger">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter ledger by reference, type or note…"
                value={ledgerQuery}
                onChange={(e) => setLedgerQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
                data-testid="ledger-filter"
              />
            </div>
            <LedgerPeriodPicker period={period} />
          </div>

          <PeriodSummary view={view} label={period.range.label} />

          {view.txnCount === 0 ? (
            <Empty
              title={q ? "No matching entries" : "Nothing in this period"}
              body={
                q
                  ? "No ledger rows match that filter."
                  : "No gold or cash movement in the selected period. Pick a wider range."
              }
            />
          ) : (
            <PeriodLedgerTable lines={visibleLines} label={period.range.label} />
          )}
        </TabsContent>

        {/* ── Orders, each with the job cards it spawned ─────────────────── */}
        <TabsContent value="orders">
          {book.orders.length === 0 ? (
            <Empty title="No orders yet" body="Orders placed by this jeweller will appear here." />
          ) : (
            <div className="space-y-3">
              {book.orders.map((o) => {
                const orderJobs = book.jobCards.filter((j) => j.orderId === o.id);
                const orderBills = book.bills.filter((b) => b.orderId === o.id);
                return (
                  <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to="/workshop/gold-book"
                          className="font-mono text-xs text-gold hover:underline"
                        >
                          {o.orderNo}
                        </Link>
                        <div className="text-sm mt-0.5">
                          {o.item.itemName} · {o.item.purity}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Placed {new Date(o.createdAt).toLocaleDateString("en-IN")}
                          {o.advance?.goldFineMg
                            ? ` · Gold in: ${formatWeight(o.advance.goldFineMg)} fine`
                            : ""}
                          {o.advance?.cashPaise
                            ? ` · Cash advance: ₹${paiseToRupees(o.advance.cashPaise)}`
                            : ""}
                        </div>
                      </div>
                      <Badge variant="outline" className="border-gold/40 text-gold">
                        {ORDER_STATUS_LABELS[o.status]}
                      </Badge>
                    </div>

                    {/* Manufacturing progress for this order: its job cards. */}
                    {orderJobs.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                        {orderJobs.map((j) => (
                          <Link
                            key={j.id}
                            to="/workshop/$id"
                            params={{ id: j.id }}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs hover:text-gold"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Hammer className="h-3 w-3" />
                              <span className="font-mono">{j.jobNo}</span>
                              <span className="text-muted-foreground">
                                {j.karigarName ?? "Unassigned"}
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              {JOB_STATUS_LABELS[j.status]}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {orderBills.length > 0 && (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Billed:{" "}
                        {orderBills.map((b) => (
                          <Link
                            key={b.id}
                            to="/billing"
                            className="font-mono text-gold hover:underline mr-2"
                          >
                            {b.billNo}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Manufacturing bills (the job-work bill, not a retail invoice) ─ */}
        <TabsContent value="bills">
          {book.bills.length === 0 ? (
            <Empty
              title="No manufacturing bills yet"
              body="A bill is raised when a finished piece is billed to this jeweller."
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Bill No</th>
                      <th className="text-left px-4 py-3 font-medium">Item</th>
                      <th className="text-left px-4 py-3 font-medium">Karigar</th>
                      <th className="text-right px-4 py-3 font-medium">Gold issued</th>
                      <th className="text-right px-4 py-3 font-medium">Finished</th>
                      <th className="text-right px-4 py-3 font-medium">Net cost</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.bills.map((b) => (
                      <tr key={b.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <Link
                            to="/billing"
                            className="font-mono text-xs text-gold hover:underline"
                          >
                            {b.billNo}
                          </Link>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(b.createdAt).toLocaleDateString("en-IN")}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {b.itemName}
                          <div className="text-[10px] text-muted-foreground">{b.orderNo}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">{b.karigarName ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {formatWeight(b.goldIssuedFineMg)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {formatWeight(b.finishedFineMg)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          ₹{paiseToRupees(b.netMfgCostPaise)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">
                            {MFG_BILL_STATUS_LABELS[b.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Gold and cash settlements posted against this jeweller ─────── */}
        <TabsContent value="settlements">
          {book.settlements.length === 0 ? (
            <Empty
              title="No settlements yet"
              body="Gold deposits, gold returns and cash settlements appear here."
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-right px-4 py-3 font-medium">Net weight</th>
                      <th className="text-right px-4 py-3 font-medium">Purity</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                      <th className="text-left px-4 py-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.settlements.map((s) => (
                      <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {new Date(s.settlement_date).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {mfgDescription(s.settlement_type.replace(/_/g, " "))}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {s.net_mg ? `${formatWeight(s.net_mg)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {s.purity ? `${s.purity}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          {s.amount_paise ? `₹${paiseToRupees(s.amount_paise)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {s.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ k, v, hint, tone }: { k: string; v: string; hint?: string; tone?: "red" }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`mt-1 font-mono text-lg ${tone === "red" ? "text-red-300" : ""}`}>{v}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

/** Gold balance as "12.345 g Cr/Dr" — negative = Dr (we owe the jeweller). */
function goldStr(mg: number): string {
  return `${formatWeight(Math.abs(mg))} ${mg < 0 ? "Dr" : "Cr"}`;
}
/** Cash balance as "₹1,200 Dr/Cr" — positive = Dr (jeweller owes us). */
function cashStr(paise: number): string {
  return `₹${paiseToRupees(Math.abs(paise))} ${paise > 0 ? "Dr" : "Cr"}`;
}

/**
 * The eight period figures the owner reads: gold and cash opening → closing,
 * with received/issued and debit/credit totals — all for the SELECTED period,
 * carried forward as the next period's opening.
 */
function PeriodSummary({ view, label }: { view: JewellerPeriodView; label: string }) {
  const s = view.summary;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
        Period Summary · {label}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SumStat k="Opening Gold Balance" v={goldStr(s.openingGoldMg)} />
        <SumStat k="Total Gold Received" v={`${mgToGrams(s.totalGoldInMg)} g`} />
        <SumStat k="Total Gold Issued" v={`${mgToGrams(s.totalGoldOutMg)} g`} />
        <SumStat k="Closing Gold Balance" v={goldStr(s.closingGoldMg)} tone="gold" />
        <SumStat k="Opening Cash Balance" v={cashStr(s.openingMoneyPaise)} />
        <SumStat k="Total Debit" v={`₹${paiseToRupees(s.totalDebitPaise)}`} />
        <SumStat k="Total Credit" v={`₹${paiseToRupees(s.totalCreditPaise)}`} />
        <SumStat k="Closing Cash Balance" v={cashStr(s.closingMoneyPaise)} tone="gold" />
      </div>
    </div>
  );
}

function SumStat({ k, v, tone }: { k: string; v: string; tone?: "gold" }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`mt-0.5 font-mono text-sm ${tone === "gold" ? "text-gold" : ""}`}>{v}</div>
    </div>
  );
}

/**
 * The period statement: opening carried forward, transactions with automatic
 * weekly/monthly Closing→Opening breaks, and a final Closing Balance. Every
 * balance is read from the compiled ledger, never re-struck here.
 */
function PeriodLedgerTable({ lines, label }: { lines: JewellerLedgerLine[]; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/30 border-b border-border font-serif text-base text-gold">
        Ledger Statement · {label}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium">Transaction Date</th>
              <th className="text-left px-3 py-2.5 font-medium">Reference No.</th>
              <th className="text-left px-3 py-2.5 font-medium">Transaction Description</th>
              <th className="text-left px-3 py-2.5 font-medium">Purity</th>
              <th className="text-right px-3 py-2.5 font-medium">Gold Received</th>
              <th className="text-right px-3 py-2.5 font-medium">Gold Issued</th>
              <th className="text-right px-3 py-2.5 font-medium">Running Gold Balance</th>
              <th className="text-right px-3 py-2.5 font-medium">Debit</th>
              <th className="text-right px-3 py-2.5 font-medium">Credit</th>
              <th className="text-right px-3 py-2.5 font-medium">Cash Balance</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) =>
              l.kind === "txn" ? <TxnRow key={l.id} r={l} /> : <BalanceRow key={l.id} l={l} />,
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Opening line (carried-forward balances only) or a weekly/monthly/final
 * closing line. A closing is a FULL summary: that segment's Gold Received &
 * Issued, Debit & Credit, and both running balances — never just the balance.
 */
function BalanceRow({ l }: { l: JewellerLedgerLine }) {
  if (!l.isSummary) {
    return (
      <tr className="border-t border-border bg-muted/10 italic">
        <td className="px-3 py-2 whitespace-nowrap text-xs">{l.date}</td>
        <td className="px-3 py-2" />
        <td className="px-3 py-2 text-xs" colSpan={4}>
          {l.description}
        </td>
        <td className="px-3 py-2 text-right font-mono text-xs text-gold">
          {goldStr(l.closingGoldMg)}
        </td>
        <td className="px-3 py-2" colSpan={2} />
        <td className="px-3 py-2 text-right font-mono text-xs text-gold">
          {cashStr(l.closingMoneyPaise)}
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
      <td className="px-3 py-2 whitespace-nowrap text-xs">{l.date}</td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2 text-xs" colSpan={2}>
        {l.description}
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs text-emerald-300">
        {l.goldInMg ? `${formatWeight(l.goldInMg)}` : "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs text-amber-300">
        {l.goldOutMg ? `${formatWeight(l.goldOutMg)}` : "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs text-gold">
        {goldStr(l.closingGoldMg)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs">
        {l.moneyDebitPaise ? `₹${paiseToRupees(l.moneyDebitPaise)}` : "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs">
        {l.moneyCreditPaise ? `₹${paiseToRupees(l.moneyCreditPaise)}` : "—"}
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs text-gold">
        {cashStr(l.closingMoneyPaise)}
      </td>
    </tr>
  );
}

function TxnRow({ r }: { r: JewellerLedgerLine }) {
  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <td className="px-3 py-2.5 whitespace-nowrap text-xs">{r.date}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-gold">{r.voucherNo}</td>
      <td className="px-3 py-2.5">
        <div className="text-xs font-medium">{manufacturingLabel(r.type)}</div>
        <div className="text-[11px] text-muted-foreground">{mfgDescription(r.description)}</div>
      </td>
      <td className="px-3 py-2.5">
        {r.purity ? (
          <Badge variant="outline" className="text-[10px] border-gold/40 text-gold">
            {getCaratLabel(r.purity)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs text-emerald-300">
        {r.goldInMg ? `${formatWeight(r.goldInMg)}` : "—"}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs text-amber-300">
        {r.goldOutMg ? `${formatWeight(r.goldOutMg)}` : "—"}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">
        {formatWeight(Math.abs(r.closingGoldMg))}
        <span className="text-[10px] text-muted-foreground ml-1">
          {r.closingGoldMg < 0 ? "Dr" : "Cr"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">
        {r.moneyDebitPaise ? `₹${paiseToRupees(r.moneyDebitPaise)}` : "—"}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">
        {r.moneyCreditPaise ? `₹${paiseToRupees(r.moneyCreditPaise)}` : "—"}
        {r.cashGoldEquivMg && r.ratePerGramPaise ? (
          <div className="text-[10px] text-muted-foreground font-normal">
            ≈ {formatWeight(r.cashGoldEquivMg)} @ ₹{paiseToRupees(r.ratePerGramPaise)}/g
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-xs">
        ₹{paiseToRupees(Math.abs(r.closingMoneyPaise))}
        <span className="text-[10px] text-muted-foreground ml-1">
          {r.closingMoneyPaise > 0 ? "Dr" : "Cr"}
        </span>
      </td>
    </tr>
  );
}

/** g value as a plain number for spreadsheet cells (3 dp, no unit). */
function gNum(mg: number): number {
  return Number(mgToGrams(mg));
}

/**
 * Export the SELECTED PERIOD's jeweller statement to a .xlsx workbook: opening
 * carried forward, transactions, automatic weekly/monthly closings, final
 * closing, and a Summary sheet with the eight period figures. Period-scoped —
 * it never dumps the whole book.
 */
function exportJewellerPeriodXlsx(name: string, view: JewellerPeriodView, label: string): void {
  const header = [
    "Transaction Date",
    "Reference No.",
    "Type",
    "Transaction Description",
    "Purity",
    "Gold Received (g)",
    "Gold Issued (g)",
    "Running Gold Balance (g)",
    "Gold Dr/Cr",
    "Debit (₹)",
    "Credit (₹)",
    "Equiv Gold (g)",
    "Cash Balance (₹)",
    "Cash Dr/Cr",
  ];
  const rows: (string | number)[][] = [
    ["Manufacturing Books — Jeweller Ledger"],
    [name],
    [`Report Period: ${label}`],
    [],
    header,
  ];

  for (const l of view.lines) {
    if (l.kind === "txn") {
      rows.push([
        l.date,
        l.voucherNo,
        manufacturingLabel(l.type),
        mfgDescription(l.description),
        l.purity ? getCaratLabel(l.purity) : "",
        l.goldInMg ? gNum(l.goldInMg) : "",
        l.goldOutMg ? gNum(l.goldOutMg) : "",
        gNum(Math.abs(l.closingGoldMg)),
        l.closingGoldMg < 0 ? "Dr" : "Cr",
        l.moneyDebitPaise ? l.moneyDebitPaise / 100 : "",
        l.moneyCreditPaise ? l.moneyCreditPaise / 100 : "",
        l.cashGoldEquivMg ? gNum(l.cashGoldEquivMg) : "",
        Math.abs(l.closingMoneyPaise) / 100,
        l.closingMoneyPaise > 0 ? "Dr" : "Cr",
      ]);
    } else {
      // Closing lines carry the segment's Received/Issued/Debit/Credit totals;
      // opening lines carry only the carried-forward balances.
      rows.push([
        l.date,
        "",
        l.kind === "opening" ? "Opening" : "Closing",
        l.description,
        "",
        l.isSummary && l.goldInMg ? gNum(l.goldInMg) : "",
        l.isSummary && l.goldOutMg ? gNum(l.goldOutMg) : "",
        gNum(Math.abs(l.closingGoldMg)),
        l.closingGoldMg < 0 ? "Dr" : "Cr",
        l.isSummary && l.moneyDebitPaise ? l.moneyDebitPaise / 100 : "",
        l.isSummary && l.moneyCreditPaise ? l.moneyCreditPaise / 100 : "",
        "",
        Math.abs(l.closingMoneyPaise) / 100,
        l.closingMoneyPaise > 0 ? "Dr" : "Cr",
      ]);
    }
  }

  const s = view.summary;
  const summary: (string | number)[][] = [
    ["Jeweller Ledger — Period Summary", name],
    ["Report Period", label],
    [],
    [
      "Opening Gold Balance (g)",
      gNum(Math.abs(s.openingGoldMg)),
      s.openingGoldMg < 0 ? "Dr" : "Cr",
    ],
    ["Total Gold Received (g)", gNum(s.totalGoldInMg)],
    ["Total Gold Issued (g)", gNum(s.totalGoldOutMg)],
    [
      "Closing Gold Balance (g)",
      gNum(Math.abs(s.closingGoldMg)),
      s.closingGoldMg < 0 ? "Dr" : "Cr",
    ],
    [],
    [
      "Opening Cash Balance (₹)",
      Math.abs(s.openingMoneyPaise) / 100,
      s.openingMoneyPaise > 0 ? "Dr" : "Cr",
    ],
    ["Total Debit (₹)", s.totalDebitPaise / 100],
    ["Total Credit (₹)", s.totalCreditPaise / 100],
    [
      "Closing Cash Balance (₹)",
      Math.abs(s.closingMoneyPaise) / 100,
      s.closingMoneyPaise > 0 ? "Dr" : "Cr",
    ],
  ];

  const safe = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  void exportToXLSX(`jeweller-ledger-${safe}.xlsx`, { Ledger: rows, Summary: summary });
}

/**
 * Manufacturing wording for ledger row types. The shared ledger compiler speaks
 * a retail-ish dialect ("Invoice Sale", "Old Gold"); a job-work workshop reads
 * its book in manufacturing terms — gold is manufacturing material received, not
 * old gold bought. Display-only — the underlying row type is unchanged.
 */
const MFG_LABELS: Record<string, string> = {
  "Invoice Sale": "Manufacturing Bill",
  "Order Advance (Cash)": "Advance Received (Cash)",
  "Gold Deposit": "Gold Received",
  "Old Gold In": "Gold Received (Material)",
  "Gold Issued": "Gold Issued to Jeweller",
  "Advance Adj.": "Advance Adjusted",
  "Gold Adj. Offset": "Gold Adjusted on Bill",
};

function manufacturingLabel(type: string): string {
  return MFG_LABELS[type] ?? type;
}

/**
 * Scrub retail "old gold" wording from a row's free-text description — in a
 * manufacturing book, gold received from a jeweller is manufacturing material
 * (bar/coin), never old gold bought. Display-only; the stored row is unchanged.
 */
function mfgDescription(desc: string): string {
  return desc.replace(/old gold/gi, "Gold");
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
      <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 font-serif text-xl text-gold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
