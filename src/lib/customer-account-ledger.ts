/**
 * MTJ ERP — Customer Account & Gold Ledger Compiler
 *
 * This utility compiles a unified, bank-statement-like running ledger for a specific customer,
 * tracking both cash (Monetary Ledger) and gold (Gold Ledger) independently but chronologically.
 */

import { useBilling, type Invoice, type PaymentRecord } from "./billing-store";
import { useOrders, type Order } from "./orders-store";
import { useGoldSettlement } from "./gold-settlement-store";
import { fineGoldMg, mgToGrams, parsePurity } from "./gold";

export interface CustomerLedgerRow {
  id: string;
  ts: number;
  date: string;
  voucherNo: string;
  type: string;
  description: string;

  // Metal Details (optional)
  grossMg?: number;
  lessMg?: number;
  netMg?: number;
  purity?: number;
  fineMg?: number;

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

  const rawRows: Omit<CustomerLedgerRow, "closingGoldMg" | "closingMoneyPaise">[] = [];

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
      grossMg: gross > 0 ? gross : undefined,
      lessMg: less > 0 ? less : undefined,
      netMg: net > 0 ? net : undefined,
      purity: purityVal,
      fineMg: calculatedFine > 0 ? calculatedFine : undefined,
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

    // A. Cash Advance
    if (o.advance?.cashPaise > 0) {
      rawRows.push({
        id: `${o.id}-cash-adv`,
        ts: ts,
        date: dateStr,
        voucherNo: o.orderNo,
        type: "Order Advance (Cash)",
        description: `Cash advance for Order ${o.orderNo} · ${o.item.itemName}`,
        goldInMg: 0,
        goldOutMg: 0,
        moneyDebitPaise: 0,
        moneyCreditPaise: o.advance.cashPaise,
      });
    }

    // B. Gold Advance / Old Gold
    if (o.advance?.goldFineMg > 0) {
      const isOld = o.advance.goldKind === "old_gold";
      const label = isOld ? "Old Gold Received" : "Gold Advance Received";
      rawRows.push({
        id: `${o.id}-gold-adv`,
        ts: ts + 1, // small offset to display cash advance then gold advance
        date: dateStr,
        voucherNo: o.orderNo,
        type: isOld ? "Old Gold In" : "Gold Deposit",
        description: `${label} for Order ${o.orderNo} · ${o.item.itemName} (${o.advance.goldApplyMode === "apply" ? "Direct Apply" : "Custody Credit"})`,
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

  // --- 4. CHRONOLOGICAL SORTING & RUNNING BALANCE COMPUTATION ---
  rawRows.sort((a, b) => {
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

  for (const r of rawRows) {
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
