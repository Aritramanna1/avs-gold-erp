/**
 * Canonical gold-ledger posting for invoice sales (shared by BillingModule and billing-store).
 */
import type { BillingType, Invoice } from "@/lib/billing-store";
import { useLedger } from "@/lib/ledger-store";

export function chargeModeForBillingType(
  billingType: BillingType | null | undefined,
): "job_work" | "full_value" {
  return billingType === "ready_stock" ? "full_value" : "job_work";
}

/** Posts sale / job-work delivery ledger movement for an invoice. Returns entry id when posted. */
export async function postInvoiceGoldLedgerForSale(inv: Invoice): Promise<string | undefined> {
  const totalFineMg = inv.items.reduce((sum, item) => sum + (item.fineMg ?? 0), 0);
  if (totalFineMg <= 0) return undefined;

  const isJobWorkInvoice = chargeModeForBillingType(inv.billingType) === "job_work";
  const reference = inv.orderNo ?? inv.jobNo ?? inv.invoiceNo;

  const entry = await useLedger.getState().append(
    isJobWorkInvoice
      ? {
          type: "job_work_delivery",
          netFineMg: -totalFineMg,
          deltas: { customer: -totalFineMg },
          notes: `Job-work delivery via invoice for ${inv.customerName}`,
          reference,
        }
      : {
          type: "sale",
          netFineMg: -totalFineMg,
          deltas: { finished: -totalFineMg },
          notes: `Sale via invoice for ${inv.customerName}`,
          reference,
        },
  );

  return entry.id;
}
