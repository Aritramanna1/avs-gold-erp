import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mgToGrams } from "@/lib/gold";
import { exportToXLSX } from "@/lib/report-engine";
import type { PartyPurityBook, PartyBookRow } from "@/lib/workshop-party-books";
import { buildLedgerView, type RawLedgerEntry, type PeriodRange } from "@/lib/workshop-ledger";
import {
  useLedgerPeriod,
  LedgerPeriodPicker,
  LedgerStatementTable,
  LinkedOrders,
  ledgerViewToSheet,
} from "@/components/workshop/ledger-view";
import { BookOpen, Printer, Scale, Sheet } from "lucide-react";

/** Newest-first stored rows → chronological raw ledger entries the view layer reads. */
function toChrono(rows: PartyBookRow[]): RawLedgerEntry[] {
  return [...rows].reverse().map((r) => ({
    ts: r.txn.ts,
    date: r.txn.date,
    refNo: r.txn.txnNo,
    description: r.txn.particulars,
    orderNo: r.txn.orderNo,
    receivedMg: r.returnedFineMg,
    issuedMg: r.issuedFineMg,
    runningBalanceMg: r.runningBalanceMg,
    previousBalanceMg: r.previousBalanceMg,
  }));
}

/**
 * Read-only per-purity book sections, shared by every party book kind (Outside
 * Worker, Polishing — and the shape Worker Books use). Each purity is its own
 * independent running ledger; balances are never mixed across purities.
 *
 * These books only record transactions and running balances. Salary, wastage
 * and other deductions are the Payment module's job, never computed here.
 */
export function PartyPurityBooksView({
  purityBooks,
  issuedLabel = "Gold Issued",
  receivedLabel = "Gold Received",
  partyName,
  partyId,
  kind,
}: {
  purityBooks: PartyPurityBook[];
  issuedLabel?: string;
  receivedLabel?: string;
  /** When given, shows an "Export to Excel" button that names the file. */
  partyName?: string;
  /** Party id + book kind wire the per-book "Print" link (scoped to one book). */
  partyId?: string;
  kind?: "outside" | "polishing";
}) {
  const period = useLedgerPeriod();

  if (purityBooks.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 p-12 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 font-serif text-xl text-gold">No books yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          A purity book opens once gold is issued in that purity.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LedgerPeriodPicker period={period} />
        {partyName && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() =>
              exportPartyBooksXlsx(partyName, purityBooks, period.range, issuedLabel, receivedLabel)
            }
          >
            <Sheet className="h-4 w-4" /> Export to Excel
          </Button>
        )}
      </div>

      {purityBooks.map((pb) => {
        const view = buildLedgerView(toChrono(pb.rows), period.range);
        return (
          <section
            key={pb.purity}
            className="rounded-md border border-border bg-card overflow-hidden"
            data-testid={`party-purity-book-${pb.purity}`}
          >
            <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-muted/20">
              <div className="font-serif text-lg text-gold flex items-center gap-2">
                <Scale className="h-5 w-5" /> {pb.label} Book
                <span className="text-[11px] font-normal text-muted-foreground">
                  · {period.range.label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={`font-mono ${
                    pb.currentBalanceMg > 0
                      ? "border-gold/40 text-gold"
                      : "border-emerald-500/40 text-emerald-300"
                  }`}
                >
                  Current payable: {mgToGrams(pb.currentBalanceMg)} g fine
                </Badge>
                {partyName && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() =>
                      exportPartyBooksXlsx(
                        partyName,
                        [pb],
                        period.range,
                        issuedLabel,
                        receivedLabel,
                      )
                    }
                  >
                    <Sheet className="h-4 w-4" /> Export
                  </Button>
                )}
                {partyId && kind && (
                  <Link
                    to="/workshop/gold-book-print/$workerId"
                    params={{ workerId: partyId }}
                    search={{
                      kind,
                      purity: pb.purity,
                      from: period.range.from,
                      to: period.range.to,
                      plabel: period.range.label,
                    }}
                  >
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs bg-gold text-black hover:bg-gold/90"
                    >
                      <Printer className="h-4 w-4" /> Print
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 text-xs">
              <MiniStat
                k={`${receivedLabel} (period)`}
                v={`${mgToGrams(view.totalReceivedMg)} g`}
              />
              <MiniStat k={`${issuedLabel} (period)`} v={`${mgToGrams(view.totalIssuedMg)} g`} />
              <MiniStat k="Opening Balance" v={`${mgToGrams(view.openingBalanceMg)} g`} />
              <MiniStat
                k="Closing Balance"
                v={`${mgToGrams(view.closingBalanceMg)} g`}
                tone="gold"
              />
            </div>

            <LinkedOrders orders={pb.linkedOrders} />
            <LedgerStatementTable
              view={view}
              receivedLabel={receivedLabel}
              issuedLabel={issuedLabel}
            />
          </section>
        );
      })}
    </div>
  );
}

/** One .xlsx sheet per purity book — the chosen period's statement, not the whole book. */
function exportPartyBooksXlsx(
  name: string,
  purityBooks: PartyPurityBook[],
  range: PeriodRange,
  issuedLabel: string,
  receivedLabel: string,
): void {
  const sheets: Record<string, (string | number)[][]> = {};
  for (const pb of purityBooks) {
    const view = buildLedgerView(toChrono(pb.rows), range);
    const sheetName = pb.label.replace(/[\\/?*[\]:]/g, "-").slice(0, 28) || String(pb.purity);
    sheets[sheetName] = [
      ["Manufacturing Books"],
      [name],
      [`${pb.label} Book`],
      [`Report Period: ${range.label}`],
      [],
      ...ledgerViewToSheet(view, receivedLabel, issuedLabel),
    ];
  }
  const safe = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  void exportToXLSX(`book-${safe}.xlsx`, sheets);
}

function MiniStat({ k, v, tone }: { k: string; v: string; tone?: "gold" }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className={`font-mono text-sm ${tone === "gold" ? "text-gold" : ""}`}>{v}</div>
    </div>
  );
}
