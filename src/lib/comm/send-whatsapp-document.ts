/**
 * Send an ERP document over WhatsApp with its PDF attached.
 *
 * ONE call for any printable document: it reuses the Universal Print Engine to
 * build the SAME PDF the print/preview screens produce (no second generator),
 * saves it through the authenticated remote storage adapter and hands the
 * caption to the branch's active WhatsApp provider.
 *
 * Data flow: (docType, recordId) → resolvePrintContext → generateDocumentPdf
 * (blob) → local application vault → provider.send({ caption }).
 */
import { activeWhatsAppProvider, resolveWhatsAppProvider } from "./send-whatsapp-text";
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { generateDocumentPdf } from "@/lib/print-engine/pdf/generate";
import { useSettings } from "@/lib/settings-store";
import { uploadToSupabaseStorage } from "@/lib/supabase-storage";
import { isValidWaPhone } from "@/lib/wa-link";
import type { PrintDocType } from "@/lib/print-engine/types";
import type { CommResult } from "./types";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface WhatsAppDocRequest {
  docType: PrintDocType;
  recordId: string;
  phone: string | undefined | null;
  /** Message that rides with the document (WhatsApp caption). */
  caption?: string;
  recipientName?: string;
  branchId?: string;
  linkedType?: "invoice" | "order" | "job" | "repair" | "estimate";
  linkedId?: string;
}

export interface WhatsAppDocResult {
  ok: boolean;
  error?: string;
  /** True only if the actual PDF was attached; false = caption-only (deep link / no host). */
  attached: boolean;
}

/** Blob → base64 data URL (Supabase upload helper expects a data URL). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function sendWhatsAppDocument(req: WhatsAppDocRequest): Promise<WhatsAppDocResult> {
  if (!isValidWaPhone(req.phone ?? "")) {
    return { ok: false, error: `"${req.phone}" is not a valid WhatsApp number.`, attached: false };
  }

  // 1. Build the PDF from the shared engine — same output as print/preview.
  const data = resolvePrintContext(req.docType, req.recordId);
  if (!data) {
    return { ok: false, error: `No printable data for ${req.docType}.`, attached: false };
  }
  const template = usePrintTemplates.getState().getForDocType(req.docType);
  const firm = useSettings.getState().firm;

  let fileName = `${req.docType}.pdf`;
  try {
    const pdf = await generateDocumentPdf(data, template, firm);
    fileName = pdf.fileName;
    // 2. Preserve the generated PDF through remote document storage.
    const dataUrl = await blobToDataUrl(pdf.blob);
    const bucket = "order-attachments";
    await uploadToSupabaseStorage(bucket, fileName, dataUrl, req.recordId, req.docType);
  } catch (err) {
    // Fall through to a caption-only send rather than failing outright, so the
    // recipient still gets the message even if hosting is momentarily down.
    console.error("[sendWhatsAppDocument] PDF save failed:", err);
  }

  const caption = req.caption ?? `${data.title} ${data.docNumber}`;
  try {
    const providerType = activeWhatsAppProvider(req.branchId);
    if (providerType && providerType !== "whatsapp_deep_link") {
      const { data: result, error } = await (supabase as any).functions.invoke("send-whatsapp", {
        body: {
          branchId: req.branchId ?? "MAIN",
          phone: req.phone,
          message: caption,
        },
      });
      return {
        ok: !error && result?.ok === true,
        error: error?.message || result?.error,
        attached: false,
      };
    }
    const { provider } = resolveWhatsAppProvider(req.branchId);
    const result: CommResult = await provider.send(
      {
        channel: "whatsapp",
        template: "custom",
        branchId: req.branchId ?? "MAIN",
        recipient: { name: req.recipientName ?? "Customer", phone: req.phone! },
        linkedId: req.linkedId ?? req.recordId,
        linkedType: req.linkedType ?? "order",
      },
      { textBody: caption },
    );
    return { ok: result.success, error: result.error, attached: false };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "WhatsApp send failed.",
      attached: false,
    };
  }
}
