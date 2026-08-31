/**
 * Operational trial pack derived from posted invoices + expenses.
 * Dual-run beside CoA current_* balances until journals feed the chart of accounts.
 * Does not write ledger_accounts.
 */
import type { Invoice } from "@/lib/billing-store";
import { isConfirmedInvoice, invoiceInRange } from "@/lib/statutory-registers";

export interface OperationalBookLine {
  code: string;
  name: string;
  debitPaise: number;
  creditPaise: number;
}

export interface OperationalBooks {
  lines: OperationalBookLine[];
  debitPaise: number;
  creditPaise: number;
  balanced: boolean;
}

export function compileOperationalBooks(
  invoices: Invoice[],
  expensePaise: number,
  fromMs: number,
  toMs: number,
): OperationalBooks {
  const period = invoices.filter((inv) => isConfirmedInvoice(inv) && invoiceInRange(inv, fromMs, toMs));
  let salesPaise = 0;
  let makingPaise = 0;
  let gstPaise = 0;
  let tcsPaise = 0;
  let receivablePaise = 0;
  let adjustmentPaise = 0;
  let receiptsPaise = 0;

  for (const inv of period) {
    const making = inv.items.reduce((sum, item) => sum + Math.max(0, item.makingChargesPaise), 0);
    makingPaise += making;
    salesPaise += Math.max(0, inv.subtotalPaise - making);
    gstPaise += inv.gstPaise;
    tcsPaise += inv.tcsPaise ?? 0;
    receivablePaise += inv.grandTotalPaise;
    adjustmentPaise += Math.max(0, inv.adjustmentPaise);
    receiptsPaise += inv.paidPaise;
  }

  const exp = Math.max(0, expensePaise);
  const lines: OperationalBookLine[] = [
    { code: "DR-AR", name: "Sundry debtors (invoiced)", debitPaise: receivablePaise, creditPaise: 0 },
    { code: "DR-ADV", name: "Advances / old gold applied", debitPaise: adjustmentPaise, creditPaise: 0 },
    { code: "CR-SALES", name: "Metal / goods sales", debitPaise: 0, creditPaise: salesPaise },
    { code: "CR-MK", name: "Making charges income", debitPaise: 0, creditPaise: makingPaise },
    { code: "CR-GST", name: "Output GST", debitPaise: 0, creditPaise: gstPaise },
    { code: "CR-TCS", name: "TCS payable", debitPaise: 0, creditPaise: tcsPaise },
    { code: "DR-BANK", name: "Cash/bank receipts", debitPaise: receiptsPaise, creditPaise: 0 },
    { code: "CR-AR-CLR", name: "Debtors cleared by receipts", debitPaise: 0, creditPaise: receiptsPaise },
    { code: "DR-EXP", name: "Operating expenses", debitPaise: exp, creditPaise: 0 },
    { code: "CR-CASH", name: "Cash paid for expenses", debitPaise: 0, creditPaise: exp },
  ].filter((line) => line.debitPaise !== 0 || line.creditPaise !== 0);

  const debitPaise = lines.reduce((sum, line) => sum + line.debitPaise, 0);
  const creditPaise = lines.reduce((sum, line) => sum + line.creditPaise, 0);
  return { lines, debitPaise, creditPaise, balanced: debitPaise === creditPaise };
}
