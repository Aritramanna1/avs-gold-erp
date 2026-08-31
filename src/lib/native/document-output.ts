/**
 * Canonical native document output: Print Engine PDF → cache file →
 * preview / print / download / share. Image share rasterizes that same PDF
 * (never a separate WhatsApp/HTML screenshot layout).
 */
import { isNativeApp } from "@/lib/native/platform";
import { writeCacheFile, writeDocumentsFile } from "@/lib/native/filesystem";
import type { ShareOutcome } from "@/lib/native/share";
import { printPdfNative, sharePdfBlob } from "@/lib/native/print-mobile";
import { documentShareCaption, reportShareCaption } from "@/lib/native/share-caption";
import { hapticSuccess } from "@/lib/native/haptics";
import type { PrintDocType } from "@/lib/print-engine/types";
import type { PrintSize } from "@/components/print/PrintLayout";
import type { ReportPdfInput } from "@/lib/print-engine/pdf/report";

export interface GeneratedPdf {
  blob: Blob;
  fileName: string;
  title: string;
  caption: string;
  printSize?: PrintSize | string;
}

export async function generatePrintEnginePdf(
  docType: PrintDocType,
  recordId: string,
): Promise<GeneratedPdf | null> {
  const { hydratePrintEngineStores } = await import("@/lib/print-engine/print-engine-bootstrap");
  await hydratePrintEngineStores();

  if (docType === "platform_tax_invoice") {
    const { ensurePlatformPrintDoc } = await import("@/lib/platform-print-store");
    await ensurePlatformPrintDoc(recordId);
  }

  const { isInvoicePrintDocType, ensureBillingInvoiceForPrint } = await import(
    "@/lib/billing-print-prep"
  );
  if (isInvoicePrintDocType(docType)) {
    const inv = await ensureBillingInvoiceForPrint(recordId);
    if (
      !inv &&
      (docType === "gst_invoice" ||
        docType === "retail_invoice" ||
        docType === "invoice_quote_preview")
    ) {
      return null;
    }
  }

  const { resolvePrintContext } = await import("@/lib/print-engine/data-mapper");
  const raw = resolvePrintContext(docType, recordId);
  if (!raw) return null;

  // Same attachment enrichment PrintEngine preview uses — required so PDF
  // has KYC / reference / line photos, not empty image slots.
  try {
    const { pullAttachments } = await import("@/lib/data-loader");
    await pullAttachments();
  } catch {
    /* non-fatal */
  }
  const { enrichPrintDocumentData } = await import("@/lib/print-engine/attachment-images");
  const data = await enrichPrintDocumentData(raw);

  const { usePrintTemplates } = await import("@/lib/print-engine/template-store");
  const { usePrintProfiles } = await import("@/lib/print-engine/profile-store");
  const { applyPrintProfileForDoc } = await import("@/lib/print-engine/print-profile-apply");
  const profile = usePrintProfiles.getState().getForDocType(docType);
  applyPrintProfileForDoc(docType, profile.paperSize);
  const template = usePrintTemplates.getState().getForDocType(docType, profile.paperSize);
  const { useSettings } = await import("@/lib/settings-store");
  const { generateDocumentPdf } = await import("@/lib/print-engine/pdf/generate");
  const { firm, branding } = useSettings.getState();
  const { resolveBrandedFirm } = await import("@/lib/print-engine/print-theme");
  const brandedFirm = resolveBrandedFirm(firm, branding, template);
  const pdf = await generateDocumentPdf(data, template, brandedFirm);
  const party =
    typeof data.fields.customerName === "string"
      ? data.fields.customerName
      : typeof data.fields.workerName === "string"
        ? data.fields.workerName
        : undefined;
  return {
    blob: pdf.blob,
    fileName: pdf.fileName.endsWith(".pdf") ? pdf.fileName : `${pdf.fileName}.pdf`,
    title: data.title,
    caption: documentShareCaption({
      docLabel: data.title,
      docNo: data.docNumber,
      partyName: party,
    }),
    printSize: profile.paperSize,
  };
}

/** Same UPE template as PDF — rasterized hi-res PNG for native WhatsApp image share. */
export async function generatePrintEngineImage(
  docType: PrintDocType,
  recordId: string,
): Promise<GeneratedPdf | null> {
  const pdf = await generatePrintEnginePdf(docType, recordId);
  if (!pdf) return null;
  const { rasterizePdfToPng } = await import("@/lib/print-engine/pdf/rasterize");
  const img = await rasterizePdfToPng(pdf.blob, {
    scale: 2.5,
    fileNameBase: pdf.fileName.replace(/\.pdf$/i, ""),
  });
  return {
    blob: img.blob,
    fileName: img.fileName,
    title: pdf.title,
    caption: pdf.caption,
    printSize: pdf.printSize,
  };
}

export async function downloadPdfBlob(
  blob: Blob,
  fileName: string,
): Promise<{ saved: boolean; uri?: string }> {
  const safeName = fileName.replace(/[<>:"|?*]/g, "-");
  if (isNativeApp()) {
    const written = await writeDocumentsFile(safeName, blob);
    await hapticSuccess();
    return { saved: !!written, uri: written?.uri };
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 250);
  return { saved: true };
}

export async function printPdfBlob(
  blob: Blob,
  opts?: { title?: string; fileName?: string; printSize?: PrintSize | string },
): Promise<void> {
  await printPdfNative(blob, opts);
}

export async function sharePdfBlobCanonical(
  blob: Blob,
  opts: { title: string; fileName: string; caption?: string },
): Promise<ShareOutcome> {
  await sharePdfBlob(blob, opts.fileName, opts.title, opts.caption);
  try {
    const { useCommLog } = await import("@/lib/comm-log-store");
    useCommLog.getState().record({
      kind: "share_initiated",
      templateKind: "custom",
      templateName: opts.title,
      target: "customer",
      recipientLabel: "Recipient",
      recipientPhone: "",
      linkedType: "document",
      linkedId: opts.fileName,
      body: opts.caption ?? opts.title,
    });
  } catch {
    /* logging is best-effort */
  }
  return { initiated: true, shared: true };
}

/** Open the canonical PDF preview modal (same bytes as download/print). */
export async function previewCanonicalPdf(pdf: GeneratedPdf): Promise<void> {
  const { usePrintEngine } = await import("@/lib/print-engine");
  usePrintEngine.getState().triggerPrint("", pdf.title, {
    pdfBlob: pdf.blob,
    pdfFileName: pdf.fileName,
    shareCaption: pdf.caption,
  });
}

export async function previewPrintEngineDocument(
  docType: PrintDocType,
  recordId: string,
): Promise<boolean> {
  const pdf = await generatePrintEnginePdf(docType, recordId);
  if (!pdf) return false;
  await previewCanonicalPdf(pdf);
  return true;
}

export async function previewStructuredReport(input: ReportPdfInput): Promise<void> {
  const { generateReportPdf } = await import("@/lib/print-engine/pdf/report");
  const pdf = await generateReportPdf(input);
  await previewCanonicalPdf({
    blob: pdf.blob,
    fileName: pdf.fileName,
    title: input.title,
    caption: reportShareCaption({ title: input.title, from: input.from, to: input.to }),
  });
}

export async function cachePdfForPreview(
  blob: Blob,
  fileName: string,
): Promise<{ blobUrl: string; fileUri?: string }> {
  const blobUrl = URL.createObjectURL(blob);
  if (!isNativeApp()) return { blobUrl };
  const cached = await writeCacheFile(fileName, blob);
  return { blobUrl, fileUri: cached?.uri };
}
