/**
 * Email an ERP document with its PDF attached — the email counterpart of
 * send-whatsapp-document.ts. Reuses the Universal Print Engine PDF (no second
 * generator) and the existing email transport (`sendGenericEmail`, which now
 * carries attachments for Resend/SendGrid).
 *
 * Flow: (docType, recordId) → resolvePrintContext → generateDocumentPdf (blob)
 * → base64 → sendGenericEmail({ attachments }).
 */
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { generateDocumentPdf } from "@/lib/print-engine/pdf/generate";
import { useSettings } from "@/lib/settings-store";
import { sendGenericEmail } from "@/lib/email-service";
import type { PrintDocType } from "@/lib/print-engine/types";

export interface DocumentEmailRequest {
  docType: PrintDocType;
  recordId: string;
  to: string | undefined | null;
  subject?: string;
  message?: string;
}

/** Blob → bare base64 (no data: prefix), which the email APIs expect. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result as string;
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function sendDocumentEmail(
  req: DocumentEmailRequest,
): Promise<{ ok: boolean; error?: string }> {
  if (!req.to || !req.to.includes("@")) {
    return { ok: false, error: "No valid email address." };
  }
  const data = resolvePrintContext(req.docType, req.recordId);
  if (!data) return { ok: false, error: `No printable data for ${req.docType}.` };

  const template = usePrintTemplates.getState().getForDocType(req.docType);
  const firm = useSettings.getState().firm;
  const pdf = await generateDocumentPdf(data, template, firm);
  const contentBase64 = await blobToBase64(pdf.blob);

  const subject = req.subject ?? `${data.title} ${data.docNumber}`;
  const body = req.message ?? `Please find attached: ${data.title} ${data.docNumber}.`;
  const result = await sendGenericEmail({
    to: req.to,
    subject,
    htmlBody: `<p style="font-family:sans-serif">${body}</p>`,
    textBody: body,
    attachments: [{ filename: pdf.fileName, contentBase64, contentType: "application/pdf" }],
  });
  return { ok: result.success, error: result.error };
}
