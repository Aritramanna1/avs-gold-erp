/**
 * Centralized Automatic & Document-Aware Communication Engine
 *
 * Implements:
 * 1. Primary Automatic Channel: Email (dispatched immediately whenever recipient email exists)
 * 2. Idempotency & Deduplication: Prevents email storms on retry/double-events
 * 3. High-Fidelity PDF Document Attachments: Generates full-format A4/A5 PDF documents
 * 4. Zero-Config AVS Fallback: Works out-of-the-box via AVS Company Mail or Tenant SMTP
 * 5. Complete Audit Trail: Records every delivery status, provider, and error into communication audit log.
 */
import { useEmailConfigStore, type AutomaticEventKey } from "./email-config-store";
import { useCommunicationAuditStore } from "./communication-audit-store";
import { resolvePrintContext } from "@/lib/print-engine/data-mapper";
import { usePrintTemplates } from "@/lib/print-engine/template-store";
import { useSettings } from "@/lib/settings-store";
import { sendGenericEmail } from "@/lib/email-service";
import { renderEmailTemplate, type EmailTemplateType, type EmailTemplateVariables } from "./email-templates";
import type { PrintDocType } from "@/lib/print-engine/types";

export interface AutomaticBusinessEvent {
  eventKey: AutomaticEventKey;
  branchId?: string;
  recipient: {
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  docType?: PrintDocType;
  recordId?: string;
  documentNumber?: string;
  variables?: Record<string, string | number>;
  pdfBlob?: Blob;
  customPdfName?: string;
}

export interface AutomaticDispatchResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  emailId?: string;
  error?: string;
  auditId?: string;
}

// In-memory idempotency cache: deduplicates identical dispatches within 10 minutes
const recentDispatches = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function getDedupeKey(event: AutomaticBusinessEvent): string {
  const docId = event.documentNumber || event.recordId || "generic";
  const email = (event.recipient.email || "no_email").toLowerCase().trim();
  return `${event.eventKey}::${docId}::${email}`;
}

function isDuplicate(key: string): boolean {
  const lastTime = recentDispatches.get(key);
  if (!lastTime) return false;
  if (Date.now() - lastTime < DEDUPE_WINDOW_MS) {
    return true;
  }
  recentDispatches.delete(key);
  return false;
}

function markDispatched(key: string): void {
  recentDispatches.set(key, Date.now());
  if (recentDispatches.size > 500) {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    for (const [k, ts] of recentDispatches.entries()) {
      if (ts < cutoff) recentDispatches.delete(k);
    }
  }
}

/** Convert blob to bare base64 for email attachment transport */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      // Node/Test environment fallback
      blob.arrayBuffer().then((buf) => {
        const base64 = Buffer.from(buf).toString("base64");
        resolve(base64);
      }).catch(reject);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result as string;
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function mapEventToTemplate(eventKey: AutomaticEventKey): EmailTemplateType {
  switch (eventKey) {
    case "invoice_created":
      return "invoice_ready";
    case "order_created":
      return "order_confirmation";
    case "order_assigned":
      return "document_ready";
    case "order_delayed":
      return "order_delayed";
    case "order_delivered":
      return "order_delivered";
    case "payment_received":
    case "advance_receipt":
    case "gold_receipt":
      return "payment_receipt";
    case "settlement":
      return "settlement_receipt";
    case "credit_note":
      return "credit_note";
    case "document_cancelled":
      return "document_cancelled";
    case "financial_report":
      return "financial_report";
    default:
      return "document_ready";
  }
}

/**
 * Single, central entry point for all automatic document-aware business communications.
 * Non-blocking: never fails or rolls back the parent business transaction.
 */
export async function dispatchAutomaticBusinessEvent(
  event: AutomaticBusinessEvent,
): Promise<AutomaticDispatchResult> {
  const config = useEmailConfigStore.getState();
  const firm = useSettings.getState().firm;
  const dedupeKey = getDedupeKey(event);

  // 1. Check if Email Automation is enabled
  if (!config.autoEmailEnabled) {
    return { ok: true, skipped: true, reason: "email_automation_disabled" };
  }

  // 2. Check if this specific business event toggle is enabled
  if (config.eventToggles && config.eventToggles[event.eventKey] === false) {
    return { ok: true, skipped: true, reason: `event_${event.eventKey}_disabled` };
  }

  // 3. Prevent duplicate email storms
  if (isDuplicate(dedupeKey)) {
    return { ok: true, skipped: true, reason: "duplicate_event_suppressed" };
  }

  // 4. Verify valid recipient email exists
  const rawEmail = event.recipient.email?.trim();
  const hasValidEmail = rawEmail && rawEmail.includes("@") && rawEmail.includes(".");

  if (!hasValidEmail) {
    // Record "skipped_no_email" in audit trail without error
    const auditEntry = await useCommunicationAuditStore.getState().recordEntry({
      eventKey: event.eventKey,
      recipientEmail: null,
      recipientPhone: event.recipient.phone || null,
      recipientName: event.recipient.name,
      documentType: event.docType || "Business Document",
      documentNumber: event.documentNumber || event.recordId || "—",
      attachmentName: null,
      channel: "email",
      status: "skipped_no_email",
      provider: "none",
      errorMessage: "No valid recipient email address on file",
    });

    return {
      ok: true,
      skipped: true,
      reason: "no_email_address_available",
      auditId: auditEntry.id,
    };
  }

  // 5. Generate Full Document PDF Attachment
  let attachmentPayload: { filename: string; contentBase64: string; contentType: string } | null = null;

  if (config.attachFullDocumentPdf) {
    try {
      if (event.pdfBlob) {
        const base64 = await blobToBase64(event.pdfBlob);
        attachmentPayload = {
          filename: event.customPdfName || `${event.documentNumber || "Document"}.pdf`,
          contentBase64: base64,
          contentType: "application/pdf",
        };
      } else if (event.docType && event.recordId) {
        const printData = resolvePrintContext(event.docType, event.recordId);
        if (printData) {
          const template = usePrintTemplates.getState().getForDocType(event.docType);
          const { generateDocumentPdf } = await import("@/lib/print-engine/pdf/generate");
          const pdf = await generateDocumentPdf(printData, template, firm);
          const base64 = await blobToBase64(pdf.blob);
          attachmentPayload = {
            filename: pdf.fileName || `${printData.docNumber || "document"}.pdf`,
            contentBase64: base64,
            contentType: "application/pdf",
          };
        }
      }
    } catch (pdfErr) {
      console.warn(`[AutoComm] Could not generate attachment for ${event.docType}/${event.recordId}:`, pdfErr);
    }
  }

  // 6. Render Branded Email Template
  const templateKey = mapEventToTemplate(event.eventKey);
  const templateVars: EmailTemplateVariables = {
    firmName: firm?.shopName || "Maa Tara Jewellers",
    recipientName: event.recipient.name,
    recipientEmail: rawEmail,
    documentType: event.docType?.replace(/_/g, " ").toUpperCase() || "Document",
    documentNumber: event.documentNumber || event.recordId || "—",
    amountFormatted: event.variables?.amount ? `₹ ${event.variables.amount}` : undefined,
    reasonText: event.variables?.reason ? String(event.variables.reason) : undefined,
    revisedDate: event.variables?.revisedDate ? String(event.variables.revisedDate) : undefined,
    parentInvoiceNo: event.variables?.parentInvoiceNo ? String(event.variables.parentInvoiceNo) : undefined,
    auditReference: event.variables?.auditReference ? String(event.variables.auditReference) : undefined,
    goldEquivalent: event.variables?.goldEquivalent ? String(event.variables.goldEquivalent) : undefined,
    reportTitle: event.variables?.reportTitle ? String(event.variables.reportTitle) : undefined,
    reportPeriod: event.variables?.reportPeriod ? String(event.variables.reportPeriod) : undefined,
    actionUrl: event.variables?.actionUrl ? String(event.variables.actionUrl) : undefined,
  };

  const rendered = renderEmailTemplate(templateKey, templateVars);

  // 7. Dispatch Email
  const providerName =
    config.senderMode === "tenant_credentials" ? "tenant_smtp" : "avs_company_mail";

  const emailResult = await sendGenericEmail({
    to: rawEmail,
    subject: rendered.subject,
    htmlBody: rendered.html,
    textBody: rendered.text,
    attachments: attachmentPayload ? [attachmentPayload] : undefined,
  });

  markDispatched(dedupeKey);

  // 8. Record to Communication Audit Log
  const auditEntry = await useCommunicationAuditStore.getState().recordEntry({
    eventKey: event.eventKey,
    recipientEmail: rawEmail,
    recipientPhone: event.recipient.phone || null,
    recipientName: event.recipient.name,
    documentType: event.docType || "Business Document",
    documentNumber: event.documentNumber || event.recordId || "—",
    attachmentName: attachmentPayload?.filename || null,
    channel: "email",
    status: emailResult.success ? "sent" : "failed",
    provider: providerName,
    errorMessage: emailResult.error || null,
  });

  return {
    ok: emailResult.success,
    emailId: auditEntry.id,
    auditId: auditEntry.id,
    error: emailResult.error,
  };
}
