/**
 * Unified Print Engine — Ledger Statement data builders.
 *
 * Two "running balance" statements, each keyed by a *person* id rather
 * than a record id of their own doc type (there is no karigar-custody-
 * statement or customer-ledger-statement record — the statement is
 * compiled live from that person's existing transaction history, same as
 * their legacy routes did). Own file, same reasoning as invoice-data.ts:
 * large enough (running-balance loops) to not belong inline in
 * data-mapper.ts.
 */
import { usePeople, PERSON_TYPE_LABELS } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";
import { compileCustomerLedger, groupLedgerByMonth } from "@/lib/customer-account-ledger";
import { getCaratLabel } from "@/lib/gold";
import { compileWorkerBook, type WorkerBookRow } from "@/lib/workshop-worker-books";
import { compileOutsideBook } from "@/lib/workshop-outside-books";
import { compilePolishingBook } from "@/lib/workshop-polishing-books";
import type { PartyBookRow } from "@/lib/workshop-party-books";
import { buildLedgerView, type RawLedgerEntry, type PeriodRange } from "@/lib/workshop-ledger";
import { slipNumberForEntry } from "@/lib/daily-material-slip";
import { buildJewellerPeriodView } from "@/lib/workshop-jeweller-period";
import type { PrintDocumentData } from "./types";

/** Balance sign wording shared by the row cells and the closing section. */
function goldBalWord(mg: number): string {
  return mg > 0 ? "Cr (owed to party)" : mg < 0 ? "Dr (party owes)" : "Nil";
}
function cashBalWord(paise: number): string {
  return paise > 0 ? "Dr (party owes)" : paise < 0 ? "Cr (advance)" : "Nil";
}

/** Fields a ledger transaction row exposes — shared by CustomerLedgerRow and the Jeweller period line. */
interface TxnLike {
  date: string;
  voucherNo: string;
  type: string;
  description: string;
  purity?: number;
  goldInMg: number;
  goldOutMg: number;
  moneyDebitPaise: number;
  moneyCreditPaise: number;
  closingGoldMg: number;
  closingMoneyPaise: number;
  cashGoldEquivMg?: number;
  ratePerGramPaise?: number;
}

/**
 * Manufacturing wording for the Jeweller Book's printed statement. In a
 * job-work workshop gold from a jeweller is manufacturing material received,
 * not old gold bought — display-only, mirrors the on-screen Jeweller Book.
 */
const MFG_TYPE_LABELS: Record<string, string> = {
  "Invoice Sale": "Manufacturing Bill",
  "Order Advance (Cash)": "Advance Received (Cash)",
  "Gold Deposit": "Gold Received",
  "Old Gold In": "Gold Received (Material)",
  "Gold Issued": "Gold Issued to Jeweller",
  "Advance Adj.": "Advance Adjusted",
  "Gold Adj. Offset": "Gold Adjusted on Bill",
};
function mfgLabel(type: string): string {
  return MFG_TYPE_LABELS[type] ?? type;
}
function mfgDesc(desc: string): string {
  return desc.replace(/old gold/gi, "Gold");
}

/**
 * Manufacturing Books — one purity book, one period, printed through the same
 * Print Engine (branding, page setup, profiles) every other document uses.
 *
 * The engine threads `recordId` through untouched, so it carries everything the
 * opened ledger needs, encoded as `kind~partyId~purity~from~to~periodLabel`:
 *  - kind      worker | outside | polishing (which store to compile)
 *  - partyId   the worker/outside-worker/polisher
 *  - purity    which independent purity book (never mixes with another)
 *  - from/to   the selected date window (epoch ms)
 *  - label     the human period label ("This Week (…)", custom range, …)
 *
 * The statement is compiled live from the same book + `buildLedgerView` the
 * on-screen ledger uses, so a printout can never widen the period or leak
 * another purity book's rows. A bare partyId (no `~`) is still accepted and
 * prints the whole worker book for the current financial period.
 */
const G = (mg: number) => `${mgToGrams(mg)} g`;

function workerChrono(rows: WorkerBookRow[]): RawLedgerEntry[] {
  return [...rows].reverse().map((r) => ({
    ts: r.entry.createdAt,
    // Date + time (HH:MM) — every printed transaction is timestamped.
    date: r.entry.time ? `${r.entry.date} ${r.entry.time.slice(0, 5)}` : r.entry.date,
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

function partyChrono(rows: PartyBookRow[]): RawLedgerEntry[] {
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

export function buildKarigarCustodyStatementData(recordId: string): PrintDocumentData | null {
  // kind~partyId~purity~from~to~label — a bare id (legacy links) means the
  // whole worker book, all purities, all time.
  const [kindRaw, partyIdRaw, purityRaw, fromRaw, toRaw, ...labelParts] = recordId.split("~");
  const hasParams = partyIdRaw !== undefined;
  const kind = hasParams ? kindRaw : "worker";
  const partyId = hasParams ? partyIdRaw : recordId;

  const party = usePeople.getState().people.find((p) => p.id === partyId);
  if (!party) return null;

  const issuedLabel = kind === "worker" ? "Gold Issued" : "Gold Sent";
  const receivedLabel = "Gold Received";

  // Compile the requested book, then narrow to the ONE requested purity.
  let chrono: RawLedgerEntry[] | null = null;
  let bookLabel = "";
  let currentBalanceMg = 0;
  const purity = purityRaw !== undefined ? Number(purityRaw) : NaN;

  if (kind === "worker") {
    const book = compileWorkerBook(partyId);
    const pbs = book?.purityBooks ?? [];
    const pb = Number.isNaN(purity) ? pbs[0] : pbs.find((b) => b.purity === purity);
    if (pb) {
      chrono = workerChrono(pb.rows);
      bookLabel = pb.label;
      currentBalanceMg = pb.currentBalanceMg;
    }
  } else {
    const book = kind === "outside" ? compileOutsideBook(partyId) : compilePolishingBook(partyId);
    const pbs = book?.purityBooks ?? [];
    const pb = Number.isNaN(purity) ? pbs[0] : pbs.find((b) => b.purity === purity);
    if (pb) {
      chrono = partyChrono(pb.rows);
      bookLabel = pb.label;
      currentBalanceMg = pb.currentBalanceMg;
    }
  }
  if (!chrono) return null;

  // Period window: explicit from/to when passed, else the whole book.
  const from = fromRaw ? Number(fromRaw) : 0;
  const to = toRaw ? Number(toRaw) : Date.now();
  const periodLabel = labelParts.length ? labelParts.join("~") : "All Time";
  const range: PeriodRange = { from, to, label: periodLabel };
  const view = buildLedgerView(chrono, range);

  const rows = view.lines.map((l) => {
    // Closing lines carry that week's/month's totals; transactions their own.
    const recv = l.kind === "txn" ? l.receivedMg : (l.periodReceivedMg ?? 0);
    const issd = l.kind === "txn" ? l.issuedMg : (l.periodIssuedMg ?? 0);
    return {
      date: l.date || "—",
      voucherNo: l.slipNo ? `${l.refNo || ""}\n${l.slipNo}` : l.refNo || "",
      particulars: l.orderNo ? `${l.description} · ${l.orderNo}` : l.description,
      received: recv ? G(recv) : "—",
      issued: issd ? G(issd) : "—",
      balance: G(l.balanceMg),
    };
  });

  const roleLabel = PERSON_TYPE_LABELS[party.type] ?? "";
  const docNumber = `STMT-${partyId.toUpperCase().slice(-6)}`;

  return {
    docType: "karigar_custody_statement",
    docNumber,
    recordId: partyId,
    createdAt: Date.now(),
    // Matches the template's own declared name ("Worker Custody Statement
    // (Default)" in default-templates.ts) for the worker book specifically —
    // outside/polishing books keep the generic Manufacturing Books heading.
    title:
      kind === "worker"
        ? "Worker Custody Ledger Statement"
        : "Manufacturing Books — Ledger Statement",
    fields: {
      moduleName: "Manufacturing Books",
      partyName: party.fullName,
      partyRole: roleLabel,
      bookLabel: `${bookLabel} Book`,
      periodLabel,
      receivedLabelText: receivedLabel,
      issuedLabelText: issuedLabel,
      openingBalanceText: G(view.openingBalanceMg),
      closingBalanceText: G(view.closingBalanceMg),
      movementText:
        `${receivedLabel}: ${G(view.totalReceivedMg)}\n` +
        `${issuedLabel}: ${G(view.totalIssuedMg)}`,
      currentPayableText: `${G(currentBalanceMg)} fine (current)`,
    },
    tables: { entries: rows },
    flags: {
      hasEntries: view.txnCount > 0,
    },
    images: {},
    balances: {},
  };
}

const GOLD_NARRATIVE = (closingGoldMg: number) =>
  closingGoldMg > 0
    ? "Shop owes Customer Gold (Advance Deposit)"
    : closingGoldMg < 0
      ? "Customer owes Shop Gold (Gold Credit Sale)"
      : "Gold account is fully settled";

const MONEY_NARRATIVE = (closingMoneyPaise: number) =>
  closingMoneyPaise > 0
    ? "Outstanding Balance (Customer owes us cash)"
    : closingMoneyPaise < 0
      ? "Credit Advance Balance (Shop owes customer cash)"
      : "Monetary account is fully settled";

export function buildCustomerLedgerStatementData(recordId: string): PrintDocumentData | null {
  // Optional period scoping: "id~from~to~label". A bare id (People's own Print
  // Ledger) keeps the whole-lifetime, month-grouped statement unchanged. The
  // Jeweller Book passes a period so the printed statement covers ONLY it.
  const [personId, fromRaw, toRaw, ...labelParts] = recordId.split("~");
  const hasPeriod = fromRaw !== undefined && toRaw !== undefined;
  const person = usePeople.getState().people.find((p) => p.id === personId);
  if (!person) return null;
  const ledger = compileCustomerLedger(personId);

  type Row = Record<string, string>;
  const rows: Row[] = [];

  // Balances shown in the account cards + closing — lifetime by default, the
  // selected period when a range is supplied.
  let openGoldMg = 0;
  let openMoneyPaise = 0;
  let recdGoldMg = ledger.totalGoldInMg;
  let issdGoldMg = ledger.totalGoldOutMg;
  let debitPaise = ledger.totalDebitPaise;
  let creditPaise = ledger.totalCreditPaise;
  let closeGoldMg = ledger.closingGoldMg;
  let closeMoneyPaise = ledger.closingMoneyPaise;
  let periodLabel = "";

  const balRow = (
    kind: "Opening" | "Closing",
    date: string,
    description: string,
    goldMg: number,
    moneyPaise: number,
  ): Row => ({
    date,
    voucherNo: "",
    typeLabel: kind,
    typeLabelVariant: kind === "Opening" ? "success" : "warning",
    description,
    purity: "—",
    goldIn: "—",
    goldOut: "—",
    debit: "—",
    credit: "—",
    goldBal: `${mgToGrams(goldMg)} g`,
    moneyBal: `₹${paiseToRupees(moneyPaise)}`,
  });

  // A transaction row (shared by the monthly and the period path — both carry
  // the same fields). In the period path the wording is scrubbed of retail
  // "old gold" (this path is the Jeweller Book's; People never sets a period).
  const txnRow = (row: TxnLike, mfg: boolean): Row => {
    const equiv =
      row.cashGoldEquivMg && row.ratePerGramPaise
        ? `\n≈ ${mgToGrams(row.cashGoldEquivMg)} g @ ₹${paiseToRupees(row.ratePerGramPaise)}/g`
        : "";
    return {
      date: row.date,
      voucherNo: row.voucherNo,
      typeLabel: mfg ? mfgLabel(row.type) : row.type,
      typeLabelVariant: "neutral",
      description: mfg ? mfgDesc(row.description) : row.description,
      purity: row.purity ? getCaratLabel(row.purity) : "—",
      goldIn: row.goldInMg > 0 ? `${mgToGrams(row.goldInMg)} g` : "—",
      goldOut: row.goldOutMg > 0 ? `${mgToGrams(row.goldOutMg)} g` : "—",
      debit: row.moneyDebitPaise > 0 ? `₹${paiseToRupees(row.moneyDebitPaise)}` : "—",
      credit: row.moneyCreditPaise > 0 ? `₹${paiseToRupees(row.moneyCreditPaise)}${equiv}` : "—",
      goldBal: `${mgToGrams(row.closingGoldMg)} g`,
      moneyBal: `₹${paiseToRupees(row.closingMoneyPaise)}`,
    };
  };

  if (hasPeriod) {
    const range: PeriodRange = {
      from: Number(fromRaw),
      to: Number(toRaw),
      label: labelParts.length ? labelParts.join("~") : "All Time",
    };
    periodLabel = range.label;
    const view = buildJewellerPeriodView(ledger.rows, range);
    for (const l of view.lines) {
      if (l.kind === "txn") {
        rows.push(txnRow(l, true));
      } else if (l.isSummary) {
        // Closing line — full segment summary (Received/Issued/Debit/Credit + balances).
        rows.push({
          date: l.date,
          voucherNo: "",
          typeLabel: "Closing",
          typeLabelVariant: "warning",
          description: mfgDesc(l.description),
          purity: "—",
          goldIn: l.goldInMg > 0 ? `${mgToGrams(l.goldInMg)} g` : "—",
          goldOut: l.goldOutMg > 0 ? `${mgToGrams(l.goldOutMg)} g` : "—",
          debit: l.moneyDebitPaise > 0 ? `₹${paiseToRupees(l.moneyDebitPaise)}` : "—",
          credit: l.moneyCreditPaise > 0 ? `₹${paiseToRupees(l.moneyCreditPaise)}` : "—",
          goldBal: `${mgToGrams(l.closingGoldMg)} g`,
          moneyBal: `₹${paiseToRupees(l.closingMoneyPaise)}`,
        });
      } else {
        rows.push(
          balRow("Opening", l.date, mfgDesc(l.description), l.closingGoldMg, l.closingMoneyPaise),
        );
      }
    }
    const s = view.summary;
    openGoldMg = s.openingGoldMg;
    openMoneyPaise = s.openingMoneyPaise;
    recdGoldMg = s.totalGoldInMg;
    issdGoldMg = s.totalGoldOutMg;
    debitPaise = s.totalDebitPaise;
    creditPaise = s.totalCreditPaise;
    closeGoldMg = s.closingGoldMg;
    closeMoneyPaise = s.closingMoneyPaise;
  } else {
    // Whole ledger, grouped into calendar months (People's statement) — a
    // Closing at each month end and an Opening carried into the next.
    const months = groupLedgerByMonth(ledger.rows);
    for (const m of months) {
      rows.push(
        balRow(
          "Opening",
          "",
          `Opening Balance — ${m.label} (carried forward)`,
          m.openingGoldMg,
          m.openingMoneyPaise,
        ),
      );
      for (const row of m.rows) rows.push(txnRow(row, false));
      rows.push(
        balRow("Closing", "", `Closing Balance — ${m.label}`, m.closingGoldMg, m.closingMoneyPaise),
      );
    }
  }

  // Outstanding, in plain accounting wording, for the final Closing section.
  const goldOutstanding =
    ledger.goldAdvanceMg > 0
      ? `${mgToGrams(ledger.goldAdvanceMg)} g fine owed to party`
      : ledger.goldCreditOwedMg > 0
        ? `${mgToGrams(ledger.goldCreditOwedMg)} g fine party owes`
        : "Gold settled";
  const cashOutstanding =
    ledger.moneyDuePaise > 0
      ? `₹${paiseToRupees(ledger.moneyDuePaise)} due from party`
      : ledger.moneyAdvancePaise > 0
        ? `₹${paiseToRupees(ledger.moneyAdvancePaise)} advance held`
        : "Cash settled";

  const addressParts = [person.currentAddress, person.villageCity, person.state].filter(Boolean);

  return {
    docType: "customer_ledger_statement",
    docNumber: `CLS-${personId.toUpperCase().slice(-6)}`,
    recordId: person.id,
    createdAt: Date.now(),
    // Period-scoped prints (Jeweller Book) name the period in the title; the
    // whole-ledger print (People) keeps its plain title.
    title: hasPeriod ? `Ledger Statement — ${periodLabel}` : "Customer Ledger Statement",
    fields: {
      customerName: person.fullName,
      customerPhone: person.phone || "",
      customerEmail: person.email || "",
      customerAddress: addressParts.join(", "),
      customerGstin: person.gstin || "",
      customerPan: person.pan || "",
      statusText: person.active ? "Active" : "Inactive",
      goldBalanceLabel: `${mgToGrams(closeGoldMg)} g fine`,
      goldBalanceNarrative: GOLD_NARRATIVE(closeGoldMg),
      goldMovementText:
        (hasPeriod ? `Opening: ${mgToGrams(openGoldMg)} g\n` : "") +
        `Total Recd: ${mgToGrams(recdGoldMg)} g\n` +
        `Total Issued: ${mgToGrams(issdGoldMg)} g`,
      moneyBalanceLabel: `₹ ${paiseToRupees(closeMoneyPaise)}`,
      moneyBalanceNarrative: MONEY_NARRATIVE(closeMoneyPaise),
      moneyMovementText:
        (hasPeriod ? `Opening: ₹ ${paiseToRupees(openMoneyPaise)}\n` : "") +
        `Total Debit: ₹ ${paiseToRupees(debitPaise)}\n` +
        `Total Credit: ₹ ${paiseToRupees(creditPaise)}`,
      // Final Closing Balance section printed at the end of the statement.
      closingGoldText: `${mgToGrams(closeGoldMg)} g fine\n${goldBalWord(closeGoldMg)}`,
      closingCashText: `₹ ${paiseToRupees(closeMoneyPaise)}\n${cashBalWord(closeMoneyPaise)}`,
      closingOutstandingText: `${goldOutstanding}\n${cashOutstanding}`,
    },
    tables: { entries: rows },
    flags: {
      hasEmail: !!person.email,
      hasAddress: addressParts.length > 0,
      hasGstin: !!person.gstin,
      hasPan: !!person.pan,
      hasEntries: rows.length > 0,
      goldBalancePositive: closeGoldMg > 0,
      goldBalanceNegative: closeGoldMg < 0,
      moneyBalancePositive: closeMoneyPaise > 0,
      moneyBalanceNegative: closeMoneyPaise < 0,
    },
    images: {},
    balances: {},
  };
}
