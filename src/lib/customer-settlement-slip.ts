/**
 * Customer Settlement Slip — data assembly.
 *
 * A strictly customer-facing document: every field here is something a
 * customer already knows or can verify (their own product, weight, purity,
 * gold rate, what they paid). It deliberately carries NONE of the internal
 * manufacturing fields (material consumption, internal gold issues, worker/
 * outside labour, manufacturing cost, recovery, scrap, overloss, internal
 * profit) — those live exclusively on ManufacturingBill, a completely
 * separate record type this file never reads from.
 *
 * Reuses the existing Invoice + compileCustomerLedger() engines rather than
 * inventing a new settlement record — "Previous Gold Balance" and "Closing
 * Balance" are read straight from the customer's own running ledger, at the
 * exact point this invoice/settlement occurred in it.
 */
import type { Invoice } from "./billing-store";
import { computeInvoicePaymentSummary } from "./billing-store";
import { compileCustomerLedger } from "./customer-account-ledger";

export interface CustomerSettlementSlipItem {
  description: string;
  grossMg: number;
  netMg: number;
  purity: number;
  wastageMg: number;
  pcs: number;
}

export interface CustomerSettlementSlipData {
  customerName: string;
  settlementNo: string;
  date: number;
  items: CustomerSettlementSlipItem[];
  previousGoldBalanceMg: number;
  goldUsedFineMg: number;
  goldReceivedFineMg: number;
  closingGoldBalanceMg: number;
  goldRatePerGramPaise: number;
  cashReceivedPaise: number;
  closingSettlementPaise: number;
}

/**
 * Builds a Customer Settlement Slip from an existing Invoice. Pure function
 * — no writes, safe to call any number of times (e.g. re-printing a slip).
 */
export function buildCustomerSettlementSlipData(invoice: Invoice): CustomerSettlementSlipData {
  const items: CustomerSettlementSlipItem[] = invoice.items.map((it) => ({
    description: it.itemName,
    grossMg: it.grossMg,
    netMg: it.netMg,
    purity: it.purity,
    wastageMg: Math.max(0, it.grossMg - it.netMg),
    pcs: 1,
  }));

  const goldUsedFineMg = invoice.items.reduce((s, it) => s + it.fineMg, 0);
  const paymentSummary = computeInvoicePaymentSummary(invoice);
  const goldReceivedFineMg = paymentSummary.totalGoldReceivedFineMg;

  const ledger = compileCustomerLedger(invoice.customerId);
  const firstIdx = ledger.rows.findIndex((r) => r.voucherNo === invoice.invoiceNo);
  const previousGoldBalanceMg = firstIdx > 0 ? ledger.rows[firstIdx - 1].closingGoldMg : 0;
  const relatedRows = ledger.rows.filter((r) => r.voucherNo === invoice.invoiceNo);
  const closingGoldBalanceMg =
    relatedRows.length > 0
      ? relatedRows[relatedRows.length - 1].closingGoldMg
      : previousGoldBalanceMg;

  const goldRatePerGramPaise = invoice.items[0]?.goldRatePerGramPaise ?? 0;

  return {
    customerName: invoice.customerName,
    settlementNo: invoice.invoiceNo,
    date: invoice.createdAt,
    items,
    previousGoldBalanceMg,
    goldUsedFineMg,
    goldReceivedFineMg,
    closingGoldBalanceMg,
    goldRatePerGramPaise,
    cashReceivedPaise: paymentSummary.totalCashReceivedPaise,
    closingSettlementPaise: invoice.balancePaise,
  };
}
