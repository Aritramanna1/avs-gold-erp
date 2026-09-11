/**
 * Ensures an invoice is loaded and verification-ready before print/PDF/share.
 */
import { fetchBillingInvoiceById } from "@/lib/billing-query";
import { useBilling, type Invoice } from "@/lib/billing-store";
import { ensureInvoiceVerification } from "@/lib/document-verification";
import type { PrintDocType } from "@/lib/printlog-store";

const INVOICE_PRINT_DOC_TYPES = new Set<PrintDocType>([
  "gst_invoice",
  "retail_invoice",
  "payment_receipt",
  "invoice_quote_preview",
]);

export const CUSTOMER_LEDGER_DOC_TYPES = new Set<PrintDocType>([
  "customer_ledger_statement",
  "customer_unpaid_invoices",
  "customer_paid_invoices",
  "karigar_custody_statement",
]);

export function isInvoicePrintDocType(docType: PrintDocType): boolean {
  return INVOICE_PRINT_DOC_TYPES.has(docType);
}

export function isCustomerLedgerDocType(docType: PrintDocType): boolean {
  return CUSTOMER_LEDGER_DOC_TYPES.has(docType);
}

export async function ensureBillingInvoiceForPrint(recordId: string): Promise<Invoice | null> {
  let inv = useBilling.getState().invoices.find((row) => row.id === recordId) ?? null;
  if (!inv) {
    inv = await fetchBillingInvoiceById(recordId);
    if (inv) {
      useBilling.setState((state) => ({
        invoices: state.invoices.some((row) => row.id === inv!.id)
          ? state.invoices.map((row) => (row.id === inv!.id ? inv! : row))
          : [inv!, ...state.invoices],
      }));
    }
  }
  if (!inv) return null;

  if (
    inv.status !== "draft" &&
    inv.status !== "cancelled" &&
    !inv.verificationPublicToken
  ) {
    try {
      const verified = await ensureInvoiceVerification(inv);
      if (verified.verificationPublicToken !== inv.verificationPublicToken) {
        const { createRepository } = await import("@/lib/repositories/base-repository");
        const invoiceRepository = createRepository<Invoice>("invoices");
        await invoiceRepository.save(verified);
        useBilling.setState((state) => ({
          invoices: state.invoices.map((row) => (row.id === verified.id ? verified : row)),
        }));
        inv = verified;
      }
    } catch (err) {
      console.warn("[billing-print] ensureInvoiceVerification failed:", err);
    }
  }

  return inv;
}

export async function ensureCustomerLedgerForPrint(recordId: string): Promise<void> {
  const personId = recordId.split("~")[0];
  const { usePeople } = await import("@/lib/people-store");
  const { useBilling } = await import("@/lib/billing-store");
  const { useOrders } = await import("@/lib/orders-store");
  const { useGoldSettlement } = await import("@/lib/gold-settlement-store");
  const { useMfgBills } = await import("@/lib/manufacturing-bill-store");
  const { useJobCards } = await import("@/lib/jobcards-store");
  const { useWorkerGoldBook } = await import("@/lib/worker-gold-book-store");
  const { useWorkers } = await import("@/lib/workers-store");
  const { useMoneyVoucherStore } = await import("@/lib/money-voucher");
  const { useLedger } = await import("@/lib/ledger-store");
  const { useDeliveryChallans } = await import("@/lib/billing-documents-store");

  await Promise.allSettled([
    usePeople.getState().refresh(),
    useBilling.getState().refresh(),
    useOrders.getState().refresh(),
    useGoldSettlement.getState().refresh(),
    useMfgBills.getState().refresh(),
    useJobCards.getState().refresh(),
    useWorkerGoldBook.getState().refresh?.(),
    useWorkers.getState().refresh?.(),
    useMoneyVoucherStore.getState().hydrate(),
    useLedger.getState().refresh(),
    useDeliveryChallans.getState().refresh?.(),
  ]);
}
