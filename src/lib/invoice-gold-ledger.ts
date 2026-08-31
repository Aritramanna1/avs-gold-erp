/**
 * Canonical gold-ledger posting for invoice sales (shared by BillingModule and billing-store).
 */
import type { BillingType, Invoice } from "@/lib/billing-store";
import { useLedger, computeBalances } from "@/lib/ledger-store";
import { mgToGrams } from "@/lib/gold";

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
  const entries = useLedger.getState().entries;
  const balances = computeBalances(entries);

  if (isJobWorkInvoice) {
    // Job-work delivery from vault — live Gold Vault stock (ledger) same as Transaction Module.
    const { assertVaultGoldIssueAvailable } = await import("@/lib/vault-gold-stock");
    const grossMg = inv.items.reduce((sum, item) => sum + (item.netMg ?? item.grossMg ?? 0), 0);
    const purity =
      inv.items.find((i) => (i.purity ?? 0) > 0)?.purity ?? inv.items[0]?.purity ?? 916;
    assertVaultGoldIssueAvailable({
      entries,
      purityPermille: purity,
      fineMg: totalFineMg,
      grossMg: grossMg > 0 ? grossMg : totalFineMg,
    });
  } else {
    const finishedMg = balances.buckets.finished ?? 0;
    if (totalFineMg > finishedMg) {
      throw new Error(
        `Insufficient finished gold stock. Need ${mgToGrams(totalFineMg)} g fine; finished has ${mgToGrams(finishedMg)} g. Invoice gold was not posted.`,
      );
    }
  }

  const entry = await useLedger.getState().append(
    isJobWorkInvoice
      ? {
          type: "job_work_delivery",
          netFineMg: -(totalFineMg + totalFineMg),
          deltas: { vault: -totalFineMg, customer: -totalFineMg },
          notes: `Job-work delivery via invoice for ${inv.customerName}`,
          reference,
          customerId: inv.customerId,
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
