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

export function isInvoicePrintDocType(docType: PrintDocType): boolean {
  return INVOICE_PRINT_DOC_TYPES.has(docType);
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
