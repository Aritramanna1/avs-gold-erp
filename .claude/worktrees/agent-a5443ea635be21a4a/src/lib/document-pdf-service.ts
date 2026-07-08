/**
 * Document PDF Service
 *
 * Full pipeline:
 *   1. Resolve document data from stores
 *   2. Generate PDF blob (jsPDF)
 *   3. Upload to Hostinger → get public URL
 *   4. Save URL in Supabase attachments table
 *   5. Return public URL
 *
 * Falls back gracefully: if Hostinger is not configured, returns null so callers
 * can degrade to sending the ERP print URL or plain text.
 */
import { useSettings } from "@/lib/settings-store";
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { useRepairs } from "@/lib/repair-store";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { uploadToHostingerServer } from "@/lib/hostinger-client";
import { saveAttachmentMetadata } from "@/lib/hostinger-storage";
import { generateDocumentPdf, type PdfDocumentType } from "@/lib/pdf/document-pdf-generator";
import type { CommRequest } from "@/lib/comm/types";

function linkedTypeToPdfType(linkedType: CommRequest["linkedType"]): PdfDocumentType {
  if (linkedType === "invoice") return "invoice";
  if (linkedType === "order") return "order";
  if (linkedType === "repair") return "repair";
  if (linkedType === "job") return "manufacturing_bill";
  if (linkedType === "estimate") return "invoice";
  return "invoice";
}

function resolveDocumentData(req: CommRequest): any {
  const { linkedType, linkedId } = req;

  if (linkedType === "invoice" || linkedType === "estimate") {
    return useBilling.getState().invoices.find((i) => i.id === linkedId) ?? null;
  }
  if (linkedType === "order") {
    return useOrders.getState().orders.find((o) => o.id === linkedId) ?? null;
  }
  if (linkedType === "repair") {
    return useRepairs.getState().repairs.find((r) => r.id === linkedId) ?? null;
  }
  if (linkedType === "job") {
    const s = useMfgBills.getState() as any;
    const list: any[] = s.bills ?? s.mfgBills ?? s.items ?? [];
    return list.find((b: any) => b.id === linkedId) ?? null;
  }
  return null;
}

/** Returns the Hostinger PDF URL, or null if unavailable / Hostinger not configured. */
export async function getOrCreateDocumentPdfUrl(req: CommRequest): Promise<string | null> {
  try {
    const firm = useSettings.getState().firm;

    if (!firm.hostingerUploadUrl?.trim()) {
      return null;
    }

    const docData = resolveDocumentData(req);
    if (!docData) return null;

    const pdfType = linkedTypeToPdfType(req.linkedType);
    const { blob, fileName } = await generateDocumentPdf(pdfType, docData, firm);

    const result = await uploadToHostingerServer(blob, fileName, "invoices", req.linkedId);

    await saveAttachmentMetadata({
      filePath: result.filePath,
      fileUrl: result.fileUrl,
      fileName: result.fileName,
      originalFileName: fileName,
      mimeType: "application/pdf",
      fileSize: blob.size,
      relatedModule: "billing-attachments",
      relatedTable: req.linkedType === "order" ? "orders" : "invoices",
      relatedRecordId: req.linkedId,
      branchId: req.branchId,
      notes: `Auto-generated PDF for WhatsApp sharing`,
      docKey: `pdf_share_${req.template}`,
      storageProvider: "hostinger",
    });

    return result.fileUrl;
  } catch (err) {
    console.warn("[DocumentPdfService] PDF generation/upload failed:", err);
    return null;
  }
}
