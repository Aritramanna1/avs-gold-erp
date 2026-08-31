import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { useAttachmentUrl } from "@/lib/attachments-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import {
  compileWorkerBook,
  type WorkerPurityBook,
  type WorkerBookRow,
} from "@/lib/workshop-worker-books";
import { mgToGrams } from "@/lib/gold";
import { slipNumberForEntry } from "@/lib/daily-material-slip";
import { exportToXLSX } from "@/lib/report-engine";
import { buildLedgerView, type RawLedgerEntry, type PeriodRange } from "@/lib/workshop-ledger";
import {
  useLedgerPeriod,
  LedgerPeriodPicker,
  LedgerStatementTable,
  LinkedOrders,
  ledgerViewToSheet,
} from "@/components/workshop/ledger-view";
import {
  ArrowLeft,
  BookOpen,
  Printer,
  Hammer,
  Scale,
  User,
  Phone,
  MapPin,
  Sheet,
  ChevronRight,
} from "lucide-react";

/** Date + time (HH:MM) for a worker entry — every transaction is timestamped. */
function entryDateTime(date: string, time: string): string {
  return time ? `${date} ${time.slice(0, 5)}` : date;
}

/** Newest-first stored rows → chronological raw ledger entries. */
function workerRowsToChrono(rows: WorkerBookRow[]): RawLedgerEntry[] {
  return [...rows].reverse().map((r) => ({
    ts: r.entry.createdAt,
    date: entryDateTime(r.entry.date, r.entry.time),
    refNo: r.entry.entryNo,
    slipNo: slipNumberForEntry(r.entry),
    description: r.entry.particulars,
    orderNo: r.entry.orderNo,
    receivedMg: r.returnedFineMg,
    issuedMg: r.issuedFineMg,
    runningBalanceMg: r.runningBalanceMg,
    previousBalanceMg: r.previousBalanceMg,
  }));
}

export const Route = createFileRoute("/workshop/worker-book/$workerId")({
  head: () => ({ meta: [{ title: "Worker Book · Manufacturing Books · AVS Gold ERP" }] }),
  component: WorkerBookPage,
});

/**
 * Workshop — one worker's read-only book.
 *
 * Displays the worker's gold-book ledger and per-purity balances. No entry,
 * edit or delete here — corrections happen in the Worker Gold Book transaction
 * module. Balances stay in their own purity (no conversion), mirroring the
 * physical worker book: Issued → Returned → Difference (pending), per purity.
 */
function WorkerBookPage() {
  const { workerId } = useParams({ from: "/workshop/worker-book/$workerId" });
  const people = usePeople((s) => s.people);
  const entries = useWorkerGoldBook((s) => s.entries);
  // Profile photo pulled from the People module's KYC vault (same source the
  // People screens use), so the book opens as the worker's full profile.
  const photoUrl = useAttachmentUrl("person", workerId, "photo");

  const book = useMemo(
    () => compileWorkerBook(workerId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workerId, people, entries],
  );

  // Physical-book behaviour: open the worker first, then pick ONE purity book.
  // null = the book shelf (cards); a purity number = that book's ledger.
  const [openPurity, setOpenPurity] = useState<number | null>(null);
  // Ledgers are shared by period, not dumped whole — one period governs both
  // the on-screen statement and the Excel export.
  const period = useLedgerPeriod();

  if (!book) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center space-y-3">
        <h1 className="font-serif text-2xl text-gold">Worker not found</h1>
        <Link to="/workshop/worker-books" className="text-gold underline text-sm">
          Back to Worker Books
        </Link>
      </div>
    );
  }

  const { worker } = book;
  const openBook =
    openPurity !== null ? book.purityBooks.find((b) => b.purity === openPurity) : null;

  function handleExcel() {
    exportWorkerBookXlsx(worker.fullName, book!.purityBooks, period.range);
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4">
        <Link
          to="/workshop/worker-books"
          className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-gold transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Worker Books
        </Link>
      </div>

      <div className="erp-surface rounded-md border border-border bg-card p-5 mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {/* Worker profile photo from the People/KYC vault. */}
          <div className="h-20 w-20 rounded-md border border-border bg-muted/40 overflow-hidden shrink-0 grid place-items-center">
            {photoUrl ? (
              <img src={photoUrl} alt={worker.fullName} className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-serif text-3xl text-gold flex items-center gap-2">
              <BookOpen className="h-7 w-7" /> {worker.fullName}
            </h1>
            <div className="text-sm text-muted-foreground mt-1">
              {PERSON_TYPE_LABELS[worker.type]}
            </div>
            <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
              {worker.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3 w-3" /> {worker.phone}
                  {worker.altPhone ? ` · ${worker.altPhone}` : ""}
                </span>
              )}
              {(worker.villageCity || worker.currentAddress) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />{" "}
                  {[worker.villageCity, worker.state].filter(Boolean).join(", ") ||
                    worker.currentAddress}
                </span>
              )}
            </div>
            <Link
              to="/people/$id"
              params={{ id: worker.id }}
              className="text-[11px] text-gold hover:underline mt-1 inline-block"
            >
              View full profile / KYC →
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Corrections live in the transaction module, not here. */}
          <Link to="/workshop/gold-book">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Hammer className="h-4 w-4" /> Enter Transactions
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleExcel}
            disabled={book.purityBooks.length === 0}
          >
            <Sheet className="h-4 w-4" /> Export to Excel
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Each purity is an independent book with its own running balance — 22K, 18K and Fine never
        share a ledger, exactly like the physical worker books. Open a book to read its entries.
        Each shows the <span className="text-gold">current payable gold</span> only; salary,
        advances and deductions are handled by the Payment module.
      </p>

      {book.purityBooks.length === 0 ? (
        <div className="erp-surface rounded-md border border-dashed border-border bg-card/40 p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 font-serif text-xl text-gold">No books yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            A purity book opens once this worker is issued gold in that purity.
          </p>
        </div>
      ) : openBook ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => setOpenPurity(null)}
              className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-gold transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> All books for {worker.fullName}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <LedgerPeriodPicker period={period} />
              {/* Export/print scoped to THIS book and THIS period only. */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => exportWorkerBookXlsx(worker.fullName, [openBook], period.range)}
              >
                <Sheet className="h-4 w-4" /> Export
              </Button>
              <Link
                to="/workshop/gold-book-print/$workerId"
                params={{ workerId: worker.id }}
                search={{
                  kind: "worker",
                  purity: openBook.purity,
                  from: period.range.from,
                  to: period.range.to,
                  plabel: period.range.label,
                }}
              >
                <Button size="sm" className="gap-1.5 text-xs bg-gold text-black hover:bg-gold/90">
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </Link>
            </div>
          </div>
          <WorkerBookLedger pb={openBook} range={period.range} />
        </div>
      ) : (
        // The book shelf: one card per purity, opened on click — like reaching
        // for a specific physical book rather than laying them all open.
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {book.purityBooks.map((pb) => (
            <button
              key={pb.purity}
              onClick={() => setOpenPurity(pb.purity)}
              data-testid={`worker-book-card-${pb.purity}`}
              className="text-left erp-surface rounded-md border border-border bg-card p-5 hover:border-gold/50 hover:bg-gold/5 transition-colors group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="font-serif text-lg text-gold flex items-center gap-2">
                  <Scale className="h-5 w-5" /> {pb.label} Book
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-gold" />
              </div>
              <div className="mt-3 text-2xl font-mono text-gold font-bold">
                {mgToGrams(pb.currentBalanceMg)} <span className="text-sm">g fine</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Current payable</div>
              <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
                <span>Issued: {mgToGrams(pb.issuedFineMg)} g</span>
                <span>Returned: {mgToGrams(pb.returnedFineMg)} g</span>
                <span>Wastage: {mgToGrams(pb.wastageMg)} g</span>
                <span>{pb.rows.length} entries</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One purity book's running ledger for the chosen period — shown only when that
 * book is opened. Records transactions and balances only: gold received, gold
 * issued and the running balance, with automatic weekly/monthly Opening and
 * Closing Balance lines. Wastage and other deductions are NOT computed here —
 * that is the Payment module's job.
 */
function WorkerBookLedger({ pb, range }: { pb: WorkerPurityBook; range: PeriodRange }) {
  const view = buildLedgerView(workerRowsToChrono(pb.rows), range);
  return (
    <section
      className="erp-surface rounded-md border border-border bg-card overflow-hidden"
      data-testid={`worker-purity-book-${pb.purity}`}
    >
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-muted/20">
        <div className="font-serif text-lg text-gold flex items-center gap-2">
          <Scale className="h-5 w-5" /> {pb.label} Book
          <span className="text-[11px] font-normal text-muted-foreground">· {range.label}</span>
        </div>
        <Badge
          variant="outline"
          className={`font-mono ${
            pb.currentBalanceMg > 0
              ? "border-gold/40 text-gold"
              : "border-emerald-500/40 text-emerald-300"
          }`}
        >
          Current balance: {mgToGrams(pb.currentBalanceMg)} g fine
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 text-xs">
        <MiniStat k="Gold Issued (period)" v={`${mgToGrams(view.totalIssuedMg)} g`} />
        <MiniStat k="Gold Received (period)" v={`${mgToGrams(view.totalReceivedMg)} g`} />
        {/* The manufacturing difference: gold issued − gold returned. Raw ledger
            figure only — no wastage/salary/deduction maths (Payment module). */}
        <MiniStat
          k="Difference (Issued − Received)"
          v={`${mgToGrams(view.totalIssuedMg - view.totalReceivedMg)} g`}
          tone="gold"
        />
        <MiniStat k="Opening Balance" v={`${mgToGrams(view.openingBalanceMg)} g`} />
        <MiniStat k="Closing Balance" v={`${mgToGrams(view.closingBalanceMg)} g`} tone="gold" />
      </div>

      <LinkedOrders orders={pb.linkedOrders} />
      <LedgerStatementTable view={view} />
    </section>
  );
}

/**
 * Export every purity book to a .xlsx workbook — one sheet per purity, each the
 * CHOSEN PERIOD's statement (Opening Balance, transactions, weekly/monthly
 * closings, Closing Balance), not the entire book. Records transactions and
 * balances only — no wastage/deduction columns.
 */
function exportWorkerBookXlsx(
  name: string,
  purityBooks: WorkerPurityBook[],
  range: PeriodRange,
): void {
  const sheets: Record<string, (string | number)[][]> = {};
  for (const pb of purityBooks) {
    const view = buildLedgerView(workerRowsToChrono(pb.rows), range);
    // Sheet names cap at 31 chars and can't contain some punctuation — the
    // caret label ("22K (916)") is safe once "/" etc. are stripped.
    const sheetName = pb.label.replace(/[\\/?*[\]:]/g, "-").slice(0, 28) || String(pb.purity);
    sheets[sheetName] = [
      ["Manufacturing Books"],
      [name],
      [`${pb.label} Book`],
      [`Report Period: ${range.label}`],
      [],
      ...ledgerViewToSheet(view),
    ];
  }
  const safe = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  void exportToXLSX(`worker-book-${safe}.xlsx`, sheets);
}

function MiniStat({ k, v, tone }: { k: string; v: string; tone?: "gold" }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`font-mono text-sm ${tone === "gold" ? "text-gold" : ""}`}>{v}</div>
    </div>
  );
}
