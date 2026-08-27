/**
 * MTJ ERP — Customer Account & Gold Ledger Compiler
 *
 * This utility compiles a unified, bank-statement-like running ledger for a specific customer,
 * tracking both cash (Monetary Ledger) and gold (Gold Ledger) independently but chronologically.
 */

import { useBilling, type Invoice, type PaymentRecord } from "./billing-store";
import { useOrders, type Order } from "./orders-store";
import { useGoldSettlement } from "./gold-settlement-store";
import { useMfgBills } from "./manufacturing-bill-store";
import { useJobCards } from "./jobcards-store";
import { useDeliveryChallans } from "./billing-documents-store";
import { usePeople } from "./people-store";
import { fineGoldMg, fineGoldMgFromTouchPercent, mgToGrams, parsePurity } from "./gold";
import {
  getPartyOpeningBalanceRows,
  hasAuthoritativePartyOpeningBalances,
} from "./party-opening-balances";
import { resolveLedgerVoucherRoute } from "./ledger-voucher-routes";

/**
 * Where a ledger row came from. Explicit so the Workshop books can relabel /
 * group by origin, and so the upcoming Payment module has a named slot
 * ("payment") to post into without the compiler having to guess from text.
 */
export type LedgerSource =
  | "settlement"
  | "order"
  | "invoice"
  | "payment"
  | "manufacturing_bill"
  | "delivery_challan"
  | "opening_balance";

export interface CustomerLedgerRow {
  id: string;
  ts: number;
  date: string;
  voucherNo: string;
  type: string;
  description: string;
  /** Origin module of this row. Defaults are set per producer below. */
  source: LedgerSource;
  /** Canonical entity id for drill-down navigation */
  sourceEntityId?: string;
  /** Pre-resolved in-app route */
  sourceRoute?: string | null;

  // Metal Details (optional)
  grossMg?: number;
  lessMg?: number;
  netMg?: number;
  purity?: number;
  fineMg?: number;

  // Cash-settled-in-gold (optional) — when a cash movement is settled against a
  // gold rate, we record the rate used that day and how much gold that cash
  // represents, so the book always shows the gold value of a cash settlement.
  ratePerGramPaise?: number;
  cashGoldEquivMg?: number;

  // Ledger Flows
  goldInMg: number;
  goldOutMg: number;
  moneyDebitPaise: number;
  moneyCreditPaise: number;

  // Running Balances (computed dynamically after sorting)
  closingGoldMg: number;
  closingMoneyPaise: number;
}

export interface CustomerLedgerSummary {
  rows: CustomerLedgerRow[];
  openingGoldMg: number;
  closingGoldMg: number;
  totalGoldInMg: number;
  totalGoldOutMg: number;

  openingMoneyPaise: number;
  closingMoneyPaise: number;
  totalDebitPaise: number;
  totalCreditPaise: number;

  goldAdvanceMg: number; // gold customer has sitting in the shop as credit
  goldCreditOwedMg: number; // gold customer owes us
  moneyDuePaise: number; // cash customer owes us
  moneyAdvancePaise: number; // cash customer has as advance credit
}

export function compileCustomerLedger(customerId: string): CustomerLedgerSummary {
  const invoices = useBilling.getState().invoices;
  const orders = useOrders.getState().orders;
  const settlements = useGoldSettlement.getState().settlements;
  const people = usePeople.getState().people;

  const rawRows: Omit<CustomerLedgerRow, "closingGoldMg" | "closingMoneyPaise">[] = [];

  // --- 0. PROCESS AUTHORITATIVE OPENING BALANCES ---
  const person = people.find((p) => p.id === customerId);
  const authoritativeOpening = hasAuthoritativePartyOpeningBalances(customerId);

  if (authoritativeOpening) {
    for (const pob of getPartyOpeningBalanceRows(customerId)) {
      if (pob.cashDebitPaise > 0 || pob.cashCreditPaise > 0) {
        rawRows.push({
          id: `op_cash_pob_${pob.id}`,
          ts: 0,
          date: pob.asOfDate || "Opening",
          voucherNo: "OP-CASH",
          type: "Opening Cash Balance",
          description: pob.notes || "Opening cash balance (migration authority)",
          source: "opening_balance",
          goldInMg: 0,
          goldOutMg: 0,
          moneyDebitPaise: pob.cashDebitPaise,
          moneyCreditPaise: pob.cashCreditPaise,
        });
      }
      if (pob.fineGoldDebitMg > 0 || pob.fineGoldCreditMg > 0) {
        rawRows.push({
          id: `op_gold_pob_${pob.id}`,
          ts: 0,
          date: pob.asOfDate || "Opening",
          voucherNo: "OP-GOLD",
          type: "Opening Gold Balance",
          description: pob.notes || "Opening gold balance (migration authority)",
          source: "opening_balance",
          fineMg: pob.fineGoldDebitMg || pob.fineGoldCreditMg,
          goldInMg: pob.fineGoldCreditMg,
          goldOutMg: pob.fineGoldDebitMg,
          moneyDebitPaise: 0,
          moneyCreditPaise: 0,
        });
      }
    }
  } else if (person) {
    // Cash Opening Balance
    if (person.cashOpeningBalancePaise && person.cashOpeningBalancePaise > 0) {
      const isReceivable = person.cashOpeningType !== "payable";
      rawRows.push({
        id: `op_cash_${person.id}`,
        ts: 0,
        date: "Opening",
        voucherNo: "OP-CASH",
        type: "Opening Cash Balance",
        description: person.openingBalanceNotes || "Opening cash balance brought forward",
        source: "opening_balance",
        goldInMg: 0,
        goldOutMg: 0,
        moneyDebitPaise: isReceivable ? person.cashOpeningBalancePaise : 0,
        moneyCreditPaise: !isReceivable ? person.cashOpeningBalancePaise : 0,
      });
    }

    // Gold Opening Balance
    if (person.goldOpeningFineMg || person.goldOpeningGrossMg) {
      const fineMg =
        person.goldOpeningFineMg ||
        fineGoldMgFromTouchPercent(person.goldOpeningGrossMg || 0, person.goldOpeningTouch || 91.6);
      const isReceivable = person.goldOpeningType !== "payable";
      if (fineMg > 0) {
        rawRows.push({
          id: `op_gold_${person.id}`,
          ts: 0,
          date: "Opening",
          voucherNo: "OP-GOLD",
          type: "Opening Gold Balance",
          description: `Opening gold balance (${person.goldOpeningTouch || 91.6}% Touch)`,
          source: "opening_balance",
          grossMg: person.goldOpeningGrossMg,
          fineMg: fineMg,
          goldInMg: !isReceivable ? fineMg : 0,
          goldOutMg: isReceivable ? fineMg : 0,
          moneyDebitPaise: 0,
          moneyCreditPaise: 0,
        });
      }
    }
  }

  // --- 1. PROCESS DIRECT GOLD SETTLEMENTS & CASH TRANSACTIONS ---
  const customerSettlements = settlements.filter(
    (s) => s.party_type === "customer" && s.party_id === customerId,
  );

  for (const s of customerSettlements) {
    const ts = new Date(s.settlement_date).getTime();
    const dateStr = new Date(s.settlement_date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const purityVal = s.purity || 916;
    const gross = s.gross_mg || 0;
    const net = s.net_mg || 0;
    const less = s.wastage_mg || 0; // standard wastage / less
    const calculatedFine = s.net_mg > 0 ? fineGoldMg(s.net_mg, purityVal) : 0;

    let goldIn = 0;
    let goldOut = 0;
    let moneyDebit = 0;
    let moneyCredit = 0;

    // A cash settlement carries the gold rate used that day; convert the cash to
    // its gold weight at that rate so the book shows what gold the cash bought /
    // paid off. rate is paise-per-gram, weights are mg. Guard rate > 0.
    const ratePerGramPaise = s.rate_per_gram_paise || 0;
    const cashPaiseForEquiv = s.amount_paise || s.cash_entry_paise || 0;
    const cashGoldEquivMg =
      ratePerGramPaise > 0 && cashPaiseForEquiv > 0
        ? Math.round((cashPaiseForEquiv / ratePerGramPaise) * 1000)
        : 0;

    let typeStr = "Gold Transaction";
    let descStr = s.notes || "Direct Customer Gold Entry";

    switch (s.settlement_type) {
      case "gold_received":
        goldIn = calculatedFine || s.gold_entry_mg || 0;
        typeStr = "Gold Deposit";
        descStr = s.notes || "Gold deposited by customer";
        break;
      case "gold_given":
        goldOut = calculatedFine || s.gold_entry_mg || 0;
        typeStr = "Gold Issued";
        descStr = s.notes || "Gold returned/issued to customer";
        break;
      case "gold_shortfall_receivable":
        goldOut = calculatedFine || s.gold_entry_mg || 0;
        typeStr = "Gold Shortfall (Customer Owes)";
        descStr = s.notes || "Gold payment shortfall — customer owes this gold";
        break;
      case "cash_received_against_gold":
        moneyCredit = s.amount_paise || s.cash_entry_paise || 0;
        typeStr = "Receipt Payment";
        descStr = s.notes || "Cash payment received against gold credit";
        break;
      case "cash_paid_against_gold":
        moneyDebit = s.amount_paise || s.cash_entry_paise || 0;
        typeStr = "Payment Paid";
        descStr = s.notes || "Cash paid to customer for metal";
        break;
      case "cash_advance_gold_credit":
        // Cash paid in becomes an actual GOLD-balance credit, converted at
        // that day's rate — not a money-balance entry. cashGoldEquivMg is
        // the same gross*purity-free rupee/rate conversion used everywhere
        // else in this file; here it IS the ledger movement, not just a
        // reference figure shown alongside a money line.
        goldIn = cashGoldEquivMg;
        typeStr = "Gold Credit (Cash Advance)";
        descStr = s.notes || "Cash advance converted to gold credit at day's rate";
        break;
      case "wastage_adjustment":
        goldOut = calculatedFine;
        typeStr = "Wastage Adj.";
        descStr = s.notes || "Metal adjusted for wastage";
        break;
      case "overloss_adjustment":
        goldOut = calculatedFine;
        typeStr = "Overloss Adj.";
        descStr = s.notes || "Metal adjusted for overloss";
        break;
      case "final_settlement":
        typeStr = "Settlement";
        goldOut = calculatedFine;
        moneyCredit = s.amount_paise || 0;
        break;
    }

    rawRows.push({
      id: s.id,
      ts,
      date: dateStr,
      voucherNo: s.id.slice(0, 8).toUpperCase(),
      type: typeStr,
      description: descStr,
      source: "settlement",
      sourceEntityId: s.id,
      grossMg: gross > 0 ? gross : undefined,
      lessMg: less > 0 ? less : undefined,
      netMg: net > 0 ? net : undefined,
      purity: purityVal,
      fineMg: calculatedFine > 0 ? calculatedFine : undefined,
      ratePerGramPaise: ratePerGramPaise > 0 ? ratePerGramPaise : undefined,
      // Only meaningful for cash movements — a gold-in/out row already has its
      // own fine weight, so we don't double it up with a cash equivalent.
      cashGoldEquivMg:
        cashGoldEquivMg > 0 && goldIn === 0 && goldOut === 0 ? cashGoldEquivMg : undefined,
      goldInMg: goldIn,
      goldOutMg: goldOut,
      moneyDebitPaise: moneyDebit,
      moneyCreditPaise: moneyCredit,
    });
  }

  // --- 2. PROCESS ORDERS (ADVANCES & DEPOSITS) ---
  const customerOrders = orders.filter(
    (o) => o.customerId === customerId && o.status !== "draft" && o.status !== "cancelled",
  );

  for (const o of customerOrders) {
    const ts = o.createdAt;
    const dateStr = new Date(o.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Milestone: the order itself. A zero-value audit row so the book's
    // chronological history starts at "Order placed", not at the first money
    // movement. ts-1 so it sits just before this order's advances.
    rawRows.push({
      id: `${o.id}-created`,
      ts: ts - 1,
      date: dateStr,
      voucherNo: o.orderNo,
      type: "Order Created",
      description: `Order placed · ${o.item.itemName}${o.item.quantity ? ` × ${o.item.quantity}` : ""}`,
      source: "order",
      purity: o.item.purity || undefined,
      goldInMg: 0,
      goldOutMg: 0,
      moneyDebitPaise: 0,
      moneyCreditPaise: 0,
    });

    // A. Cash Advance
    if (o.advance?.cashPaise > 0) {
      rawRows.push({
        id: `${o.id}-cash-adv`,
        ts: ts,
        date: dateStr,
        voucherNo: o.orderNo,
        type: "Order Advance (Cash)",
        description: `Cash advance for Order ${o.orderNo} · ${o.item.itemName}`,
        source: "order",
        goldInMg: 0,
        goldOutMg: 0,
        moneyDebitPaise: 0,
        moneyCreditPaise: o.advance.cashPaise,
      });
    }

    // B. Gold Advance / Old Gold
    if (o.advance?.goldFineMg > 0) {
      const isOld = o.advance.goldKind === "old_gold";
      const label = isOld ? "Gold Received from Customer" : "Gold Advance Received";
      rawRows.push({
        id: `${o.id}-gold-adv`,
        ts: ts + 1, // small offset to display cash advance then gold advance
        date: dateStr,
        voucherNo: o.orderNo,
        type: isOld ? "Old Gold In" : "Gold Deposit",
        description: `${label} for Order ${o.orderNo} · ${o.item.itemName} (${o.advance.goldApplyMode === "apply" ? "Direct Apply" : "Custody Credit"})`,
        source: "order",
        grossMg: o.advance.goldGrossMg,
        purity: o.advance.goldPurity,
        fineMg: o.advance.goldFineMg,
        goldInMg: o.advance.goldFineMg,
        goldOutMg: 0,
        moneyDebitPaise: 0,
        moneyCreditPaise: 0, // value in cash is handled when the invoice is generated
      });
    }
  }

  // --- 3. PROCESS INVOICES (SALES, CREDIT SALES, PAYMENTS) ---
  const customerInvoices = invoices.filter(
    (i) => i.customerId === customerId && i.status !== "draft" && i.status !== "cancelled",
  );

  for (const i of customerInvoices) {
    const ts = i.createdAt;
    const dateStr = new Date(i.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // A. Invoice Sale Entry
    // The total value of items before the order advance adjustments.
    const totalTaxablePaise = i.subtotalPaise + i.gstPaise;

    rawRows.push({
      id: `${i.id}-sale`,
      ts: ts,
      date: dateStr,
      voucherNo: i.invoiceNo,
      type: "Invoice Sale",
      description: `Billed Invoice ${i.invoiceNo} · ${i.items.map((it) => it.itemName).join(", ")}`,
      source: "invoice",
      sourceEntityId: i.id,
      goldInMg: 0,
      goldOutMg: 0,
      moneyDebitPaise: totalTaxablePaise,
      moneyCreditPaise: 0,
    });

    // B. Order Adjustments (Advances/Old Gold consumed during billing)
    if (i.orderAdjustment) {
      const adj = i.orderAdjustment;

      // Cash Advance Offset
      if (adj.cashAdvancePaise > 0) {
        rawRows.push({
          id: `${i.id}-cash-adj`,
          ts: ts + 1,
          date: dateStr,
          voucherNo: i.invoiceNo,
          type: "Advance Adj.",
          description: `Advance cash adjusted for Invoice ${i.invoiceNo}`,
          source: "invoice",
          goldInMg: 0,
          goldOutMg: 0,
          moneyDebitPaise: 0,
          moneyCreditPaise: adj.cashAdvancePaise,
        });
      }

      // Gold Advance/Old Gold Offset
      if (adj.goldFineMg > 0) {
        const isOld = adj.goldKind === "old_gold";
        rawRows.push({
          id: `${i.id}-gold-adj`,
          ts: ts + 2,
          date: dateStr,
          voucherNo: i.invoiceNo,
          type: "Gold Adj. Offset",
          description: `${isOld ? "Old Gold" : "Gold Advance"} adjusted against Invoice ${i.invoiceNo}`,
          source: "invoice",
          grossMg: adj.goldGrossMg,
          purity: adj.goldPurity,
          fineMg: adj.goldFineMg,
          goldInMg: 0,
          goldOutMg: adj.goldFineMg, // consumes gold from balance
          moneyDebitPaise: 0,
          moneyCreditPaise: adj.goldValuePaise, // credits cash balance
        });
      }
    }

    // C. Invoice Payments
    for (const p of i.payments) {
      // Ignore outstanding placeholders
      if (p.mode === "outstanding") continue;

      let goldIn = 0;
      let goldOut = 0;
      let desc = p.notes || `Payment received (${p.mode.replace("_", " ")})`;

      if (p.mode === "gold_exchange" && p.goldFineMg) {
        goldIn = p.goldFineMg;
        desc = `Old gold exchanged at counter: ${mgToGrams(p.goldGrossMg || 0)} g @ ${p.goldPurity ?? "Standard"} (fine ${mgToGrams(p.goldFineMg)} g)`;
      } else if (p.mode === "customer_gold_credit" && p.goldFineMg) {
        goldOut = p.goldFineMg;
        desc = `Payment adjusted from customer gold balance: ${mgToGrams(p.goldFineMg)} g fine`;
      }

      rawRows.push({
        id: p.id,
        ts: p.ts,
        date: new Date(p.ts).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        voucherNo: i.invoiceNo,
        type: `Payment (${p.mode === "gold_exchange" ? "Gold In" : p.mode === "customer_gold_credit" ? "Gold Credit Use" : p.mode.toUpperCase()})`,
        description: desc,
        source: "payment",
        grossMg: p.goldGrossMg,
        purity: p.goldPurity,
        fineMg: p.goldFineMg,
        goldInMg: goldIn,
        goldOutMg: goldOut,
        moneyDebitPaise: 0,
        moneyCreditPaise: p.amountPaise,
      });
    }
  }

  // --- 3b. JOB CARDS (MILESTONE) ---
  // A job card opening is a bench milestone in the jeweller's history — gold
  // issued to the karigar sits in the WORKER book, not here, so this row is a
  // zero-value audit marker only.
  const customerJobs = useJobCards.getState().jobs.filter((j) => j.customerId === customerId);
  for (const j of customerJobs) {
    rawRows.push({
      id: `${j.id}-jobcard`,
      ts: j.createdAt,
      date: new Date(j.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      voucherNo: j.jobNo,
      type: "Job Card Created",
      description: `Job card opened · ${j.itemName}${j.karigarName ? ` · ${j.karigarName}` : ""}`,
      source: "order",
      purity: j.purity || undefined,
      goldInMg: 0,
      goldOutMg: 0,
      moneyDebitPaise: 0,
      moneyCreditPaise: 0,
    });
  }

  // --- 4. MANUFACTURING BILLS (JEWELLERY DELIVERED + MAKING CHARGES) ---
  // Auto-derived, never hand-entered: the manufacturing bill is a business
  // event in its own module, and the ledger simply reflects it. This is the
  // only producer of the "jewellery delivered" gold-out movement — without it
  // a jeweller's gold would look permanently held even after their pieces
  // shipped. Purity is always the finished piece's own purity.
  const customerBills = useMfgBills
    .getState()
    .bills.filter((b) => b.customerId === customerId && b.status !== "draft");

  for (const b of customerBills) {
    const ts = b.finalisedAt ?? b.createdAt;
    const dateStr = new Date(ts).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Milestone: the manufacturing bill was raised. Zero-value audit row at
    // creation time (distinct from the delivery/charges rows below, which land
    // when the piece actually ships).
    rawRows.push({
      id: `${b.id}-billed`,
      ts: b.createdAt - 1,
      date: new Date(b.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      voucherNo: b.billNo,
      type: "Manufacturing Bill Generated",
      description: `Manufacturing bill raised · ${b.itemName}`,
      source: "manufacturing_bill",
      purity: b.finishedPurity || undefined,
      goldInMg: 0,
      goldOutMg: 0,
      moneyDebitPaise: 0,
      moneyCreditPaise: 0,
    });

    // Finished jewellery handed to the jeweller — gold OUT at the finished
    // purity. postMfgGoldLedger posts to the firm-wide gold_ledger, a DIFFERENT
    // store from the settlements this compiler reads, so there is no double
    // count here.
    if (b.finishedFineMg > 0) {
      rawRows.push({
        id: `${b.id}-delivered`,
        ts,
        date: dateStr,
        voucherNo: b.billNo,
        type: "Jewellery Delivered",
        description: `Finished ${b.itemName} delivered · Bill ${b.billNo}`,
        source: "manufacturing_bill",
        grossMg: b.finishedGrossMg || undefined,
        purity: b.finishedPurity,
        fineMg: b.finishedFineMg,
        goldInMg: 0,
        goldOutMg: b.finishedFineMg,
        moneyDebitPaise: 0,
        moneyCreditPaise: 0,
      });
    }

    // Making / manufacturing charges the jeweller owes — money DEBIT. Skipped
    // when a delivery invoice exists, because the billing invoice already
    // posts that money (section 3) and we must not bill it twice.
    if (!b.deliveryInvoiceId && b.netMfgCostPaise > 0) {
      rawRows.push({
        id: `${b.id}-charges`,
        ts: ts + 1,
        date: dateStr,
        voucherNo: b.billNo,
        type: "Manufacturing Charges",
        description: `Making & manufacturing charges · Bill ${b.billNo}`,
        source: "manufacturing_bill",
        goldInMg: 0,
        goldOutMg: 0,
        moneyDebitPaise: b.netMfgCostPaise,
        moneyCreditPaise: 0,
      });
    }
  }

  // --- 4b. DELIVERY CHALLANS ---
  const challans = useDeliveryChallans
    .getState()
    .challans.filter((c) => c.customerId === customerId && c.status === "issued");

  for (const c of challans) {
    const ts = c.createdAt;
    const dateStr = new Date(ts).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Sum the fine gold out from the items
    let goldOutMg = 0;
    let grossMg = 0;
    for (const item of c.items) {
      goldOutMg += item.fineMg;
      grossMg += item.grossMg;
    }

    if (goldOutMg > 0) {
      rawRows.push({
        id: c.id,
        ts,
        date: dateStr,
        voucherNo: c.challanNo,
        type: "Delivery Challan Issued",
        description: `Gold issued via Challan ${c.challanNo} · ${c.purpose.replace(/_/g, " ")}`,
        source: "delivery_challan",
        grossMg: grossMg > 0 ? grossMg : undefined,
        fineMg: goldOutMg,
        goldInMg: 0,
        goldOutMg: goldOutMg,
        moneyDebitPaise: 0,
        moneyCreditPaise: 0,
      });
    }
  }

  // --- 5. CHRONOLOGICAL SORTING & RUNNING BALANCE COMPUTATION ---
  const enrichedRows = rawRows.map((row) => {
    const sourceEntityId = row.sourceEntityId ?? deriveSourceEntityId(row);
    return {
      ...row,
      sourceEntityId,
      sourceRoute: resolveLedgerVoucherRoute({
        source: row.source,
        sourceEntityId,
        voucherNo: row.voucherNo,
        customerId,
      }),
    };
  });
  return summariseLedgerRows(enrichedRows);
}

function deriveSourceEntityId(row: { id: string }): string {
  const suffixes = [
    "-created",
    "-cash-adv",
    "-gold-adv",
    "-sale",
    "-cash-adj",
    "-gold-adj",
    "-billed",
    "-delivered",
    "-charges",
    "-jobcard",
    "-payment",
    "-op_cash",
    "-op_gold",
  ];
  for (const suffix of suffixes) {
    if (row.id.includes(suffix)) {
      return row.id.slice(0, row.id.indexOf(suffix));
    }
  }
  return row.id;
}

/**
 * Sort raw ledger rows chronologically and strike the running gold + cash
 * balances. Extracted so the Workshop books can feed in EXTRA rows (e.g. the
 * Payment module's contributions, via workshop-ledger-sources) and get a single
 * correct balance where payments and settlements interleave — rather than the
 * books re-implementing this loop and drifting from it.
 */
export function summariseLedgerRows(
  rawRows: Omit<CustomerLedgerRow, "closingGoldMg" | "closingMoneyPaise">[],
): CustomerLedgerSummary {
  const sorted = [...rawRows].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return a.id.localeCompare(b.id);
  });

  const rows: CustomerLedgerRow[] = [];
  let runningGold = 0;
  let runningMoney = 0;

  let totalGoldIn = 0;
  let totalGoldOut = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  for (const r of sorted) {
    runningGold += r.goldInMg - r.goldOutMg;
    runningMoney += r.moneyDebitPaise - r.moneyCreditPaise;

    totalGoldIn += r.goldInMg;
    totalGoldOut += r.goldOutMg;
    totalDebit += r.moneyDebitPaise;
    totalCredit += r.moneyCreditPaise;

    rows.push({
      ...r,
      closingGoldMg: runningGold,
      closingMoneyPaise: runningMoney,
    });
  }

  return {
    rows,
    openingGoldMg: 0,
    closingGoldMg: runningGold,
    totalGoldInMg: totalGoldIn,
    totalGoldOutMg: totalGoldOut,

    openingMoneyPaise: 0,
    closingMoneyPaise: runningMoney,
    totalDebitPaise: totalDebit,
    totalCreditPaise: totalCredit,

    goldAdvanceMg: runningGold > 0 ? runningGold : 0,
    goldCreditOwedMg: runningGold < 0 ? Math.abs(runningGold) : 0,
    moneyDuePaise: runningMoney > 0 ? runningMoney : 0,
    moneyAdvancePaise: runningMoney < 0 ? Math.abs(runningMoney) : 0,
  };
}

export interface LedgerMonthSection {
  key: string; // "2026-01"
  label: string; // "January 2026"
  openingGoldMg: number;
  openingMoneyPaise: number;
  closingGoldMg: number;
  closingMoneyPaise: number;
  rows: CustomerLedgerRow[];
}

/**
 * Split a compiled ledger into calendar-month sections for accounting: each
 * month opens with the balance carried forward from the previous month's close
 * and ends with that month's own closing balance. Pure over the already-struck
 * running balances — it never re-computes them, so a month boundary can never
 * drift from the flat ledger. Input rows must be chronological (as produced by
 * summariseLedgerRows / compileCustomerLedger).
 */
export function groupLedgerByMonth(rows: CustomerLedgerRow[]): LedgerMonthSection[] {
  const sections: LedgerMonthSection[] = [];
  let prevGold = 0;
  let prevMoney = 0;
  for (const r of rows) {
    const d = new Date(r.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    let sec = sections[sections.length - 1];
    if (!sec || sec.key !== key) {
      sec = {
        key,
        label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
        openingGoldMg: prevGold,
        openingMoneyPaise: prevMoney,
        closingGoldMg: prevGold,
        closingMoneyPaise: prevMoney,
        rows: [],
      };
      sections.push(sec);
    }
    sec.rows.push(r);
    sec.closingGoldMg = r.closingGoldMg;
    sec.closingMoneyPaise = r.closingMoneyPaise;
    prevGold = r.closingGoldMg;
    prevMoney = r.closingMoneyPaise;
  }
  return sections;
}

/**
 * Outstanding gold owed BACK to the jeweller (they gave more gold than has
 * been returned as finished goods / consumed on invoices), plus lifetime
 * received/returned totals. Thin extraction over compileCustomerLedger() —
 * NOT a second gold-balance computation. In this manufacturing/job-work
 * model, "outstandingFineMg" is the workshop's gold liability to the party,
 * i.e. compileCustomerLedger's goldAdvanceMg.
 */
export function getPartyGoldBalance(customerId: string): {
  outstandingFineMg: number;
  receivedFineMg: number;
  returnedFineMg: number;
} {
  const summary = compileCustomerLedger(customerId);
  return {
    outstandingFineMg: summary.goldAdvanceMg,
    receivedFineMg: summary.totalGoldInMg,
    returnedFineMg: summary.totalGoldOutMg,
  };
}

/**
 * Outstanding cash the jeweller owes the workshop, plus lifetime received
 * total. Thin extraction over compileCustomerLedger() — NOT a second cash
 * ledger; the running-cash-total loop above remains the single
 * implementation.
 */
export function getPartyCashBalance(customerId: string): {
  outstandingPaise: number;
  receivedPaise: number;
} {
  const summary = compileCustomerLedger(customerId);
  return {
    outstandingPaise: summary.moneyDuePaise,
    receivedPaise: summary.totalCreditPaise,
  };
}
