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
import { usePeople } from "@/lib/people-store";
import { mgToGrams } from "@/lib/gold";
import { paiseToRupees } from "@/lib/billing-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import type { PrintDocumentData } from "./types";

export function buildKarigarCustodyStatementData(workerId: string): PrintDocumentData | null {
  const worker = usePeople.getState().people.find((p) => p.id === workerId);
  if (!worker) return null;

  const { entries, getWorkerBalance } = useWorkerGoldBook.getState();
  const wEntries = entries
    .filter((e) => e.workerId === workerId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const summary = getWorkerBalance(workerId);
  const docNumber = `STMT-${workerId.toUpperCase().slice(-6)}`;

  let runningFine = 0;
  let runningQty = 0;
  const rows = wEntries.map((e) => {
    const isGiven = e.type === "given";
    if (isGiven) {
      runningFine += e.fineMg;
      runningQty += e.quantity;
    } else {
      runningFine -= e.fineMg;
      runningQty -= e.quantity;
    }
    return {
      dateTime: `${e.date}\n${e.time}`,
      voucherNo: e.entryNo,
      particulars: e.reference ? `${e.particulars}\nRef: ${e.reference}` : e.particulars,
      typeLabel: isGiven ? "Issued" : "Returned",
      typeLabelVariant: isGiven ? "critical" : "success",
      netWt: `${mgToGrams(e.netMg)}`,
      fineWt: e.fineMg > 0 ? `${mgToGrams(e.fineMg)}` : "—",
      qty: e.quantity > 0 ? String(e.quantity) : "—",
      balFine: `${mgToGrams(runningFine)} g`,
      balQty: `${runningQty} pcs`,
    };
  });

  return {
    docType: "karigar_custody_statement",
    docNumber,
    recordId: workerId,
    createdAt: Date.now(),
    title: "Worker Custody Ledger Statement",
    fields: {
      workerName: worker.fullName,
      workerPhone: worker.phone || "",
      cumulativeFineText:
        `Given: ${mgToGrams(summary.totalGivenFine)} g\n` +
        `Returned: ${mgToGrams(summary.totalReturnedFine)} g`,
      closingBalanceText:
        `${mgToGrams(summary.pendingFine)} g Fine Gold\n` +
        `${summary.pendingQty} pieces material qty`,
    },
    tables: { entries: rows },
    flags: {
      hasEntries: rows.length > 0,
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

export function buildCustomerLedgerStatementData(personId: string): PrintDocumentData | null {
  const person = usePeople.getState().people.find((p) => p.id === personId);
  if (!person) return null;
  const ledger = compileCustomerLedger(personId);

  const rows = ledger.rows.map((row) => ({
    date: row.date,
    voucherNo: row.voucherNo,
    typeLabel: row.type,
    // Legacy always renders this as a plain neutral-gray pill (never
    // color-varies by type value) — a static per-row variant reproduces
    // that exactly via the same badge column mechanism the custody
    // statement's Issued/Returned coloring uses.
    typeLabelVariant: "neutral",
    description: row.description,
    goldIn: row.goldInMg > 0 ? `${mgToGrams(row.goldInMg)} g` : "—",
    goldOut: row.goldOutMg > 0 ? `${mgToGrams(row.goldOutMg)} g` : "—",
    debit: row.moneyDebitPaise > 0 ? `₹${paiseToRupees(row.moneyDebitPaise)}` : "—",
    credit: row.moneyCreditPaise > 0 ? `₹${paiseToRupees(row.moneyCreditPaise)}` : "—",
    goldBal: `${mgToGrams(row.closingGoldMg)} g`,
    moneyBal: `₹${paiseToRupees(row.closingMoneyPaise)}`,
  }));

  const addressParts = [person.currentAddress, person.villageCity, person.state].filter(Boolean);

  return {
    docType: "customer_ledger_statement",
    docNumber: `CLS-${personId.toUpperCase().slice(-6)}`,
    recordId: person.id,
    createdAt: Date.now(),
    title: "Customer Ledger Statement",
    fields: {
      customerName: person.fullName,
      customerPhone: person.phone || "",
      customerEmail: person.email || "",
      customerAddress: addressParts.join(", "),
      customerGstin: person.gstin || "",
      customerPan: person.pan || "",
      statusText: person.active ? "Active" : "Inactive",
      goldBalanceLabel: `${mgToGrams(ledger.closingGoldMg)} g fine`,
      goldBalanceNarrative: GOLD_NARRATIVE(ledger.closingGoldMg),
      goldMovementText:
        `Total Recd: ${mgToGrams(ledger.totalGoldInMg)} g\n` +
        `Total Issued: ${mgToGrams(ledger.totalGoldOutMg)} g`,
      moneyBalanceLabel: `₹ ${paiseToRupees(ledger.closingMoneyPaise)}`,
      moneyBalanceNarrative: MONEY_NARRATIVE(ledger.closingMoneyPaise),
      moneyMovementText:
        `Total Debit: ₹ ${paiseToRupees(ledger.totalDebitPaise)}\n` +
        `Total Credit: ₹ ${paiseToRupees(ledger.totalCreditPaise)}`,
    },
    tables: { entries: rows },
    flags: {
      hasEmail: !!person.email,
      hasAddress: addressParts.length > 0,
      hasGstin: !!person.gstin,
      hasPan: !!person.pan,
      hasEntries: rows.length > 0,
      goldBalancePositive: ledger.closingGoldMg > 0,
      goldBalanceNegative: ledger.closingGoldMg < 0,
      moneyBalancePositive: ledger.closingMoneyPaise > 0,
      moneyBalanceNegative: ledger.closingMoneyPaise < 0,
    },
    images: {},
    balances: {},
  };
}
