/**
 * DocCommActions — reusable communication action bar for any ERP document.
 * Document share uses three modes from the same UPE template:
 * Share as Image · Share as PDF · Send via WhatsApp
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Printer,
  Thermometer,
  FileDown,
  Mail,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { sendGenericEmail } from "@/lib/email-service";
import { wrapBrandedEmailHtml } from "@/lib/comm/branded-email-shell";
import { sendDocumentEmail } from "@/lib/comm/send-document-email";
import { toast } from "sonner";
import { useCommLog } from "@/lib/comm-log-store";
import { EmailSentShareFollowup } from "@/components/comm/EmailSentShareFollowup";
import { DocumentShareModeBar } from "@/components/comm/DocumentShareModeBar";
import type { PrintDocType } from "@/lib/print-engine/types";

export interface DocCommActionsProps {
  printA4Href?: string;
  printThermalHref?: string;
  onPdf?: () => void;
  whatsapp?: {
    phone: string | undefined | null;
    message: string;
  };
  email?: {
    to: string | undefined | null;
    subject: string;
    body: string;
  };
  /** When set, email attaches the Universal Print Engine PDF for this document. */
  emailDocument?: {
    docType: PrintDocType;
    recordId: string;
  };
  linkedType?:
    | "invoice"
    | "order"
    | "job"
    | "repair"
    | "estimate"
    | "portal_invitation"
    | "delivery_challan"
    | "credit_note"
    | "debit_note"
    | "gold_settlement";
  linkedId?: string;
  recipientLabel?: string;
  variant?: "row" | "column" | "compact";
  className?: string;
  shareDocument?: {
    docType: PrintDocType;
    recordId: string;
    title?: string;
  };
}

export function DocCommActions({
  printA4Href,
  printThermalHref,
  onPdf,
  whatsapp,
  email,
  emailDocument,
  linkedType,
  linkedId,
  recipientLabel = "Customer",
  variant = "row",
  className = "",
  shareDocument,
}: DocCommActionsProps) {
  const [emailSending, setEmailSending] = useState(false);
  const [emailDone, setEmailDone] = useState(false);
  const recordComm = useCommLog((s) => s.record);

  async function handleEmail() {
    if (!email?.to) {
      toast.warning("No email address on record.");
      return;
    }
    setEmailSending(true);
    try {
      let ok = false;
      let err: string | undefined;
      if (emailDocument) {
        const docResult = await sendDocumentEmail({
          docType: emailDocument.docType,
          recordId: emailDocument.recordId,
          to: email.to,
          subject: email.subject,
          message: email.body,
        });
        ok = docResult.ok;
        err = docResult.error;
      } else {
        const result = await sendGenericEmail({
          to: email.to,
          subject: email.subject,
          htmlBody: wrapBrandedEmailHtml({
            title: email.subject,
            innerHtml: `<pre style="font-family:sans-serif;white-space:pre-wrap;line-height:1.5">${email.body}</pre>`,
          }),
          textBody: email.body,
        });
        ok = result.success;
        err = result.error;
      }
      if (ok) {
        setEmailDone(true);
        toast.success(`Email sent to ${email.to}`);
        if (linkedType && linkedId) {
          recordComm({
            kind: "manually_sent",
            templateKind: "custom",
            templateName: email.subject,
            target: "customer",
            recipientLabel,
            recipientPhone: email.to,
            linkedType,
            linkedId,
            body: email.body,
          });
        }
        setTimeout(() => setEmailDone(false), 3000);
      } else {
        toast.error(err || "Email delivery failed — check company email settings.");
      }
    } catch (e: unknown) {
      toast.error("Email error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEmailSending(false);
    }
  }

  const btnClass =
    variant === "compact" ? "h-7 px-2 text-[11px] gap-1" : "h-8 px-3 text-xs gap-1.5";

  const wrapClass =
    variant === "column" ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2";

  return (
    <div className={`${wrapClass} ${className}`}>
      {printA4Href && (
        <Link to={printA4Href as never}>
          <Button variant="outline" size="sm" className={btnClass}>
            <Printer className="h-3 w-3" />
            {variant !== "compact" && "Print A4"}
          </Button>
        </Link>
      )}

      {printThermalHref && (
        <Link to={printThermalHref as never}>
          <Button variant="outline" size="sm" className={btnClass}>
            <Thermometer className="h-3 w-3" />
            {variant !== "compact" && "Thermal"}
          </Button>
        </Link>
      )}

      {onPdf && (
        <Button variant="outline" size="sm" className={btnClass} onClick={onPdf}>
          <FileDown className="h-3 w-3" />
          {variant !== "compact" && "PDF"}
        </Button>
      )}

      {email && (
        <Button
          variant="outline"
          size="sm"
          className={`${btnClass} ${emailDone ? "border-success text-success" : ""}`}
          onClick={handleEmail}
          disabled={emailSending || !email.to}
          title={email.to ? `Send to ${email.to}` : "No email address on record"}
        >
          {emailSending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : emailDone ? (
            <CheckCircle className="h-3 w-3" />
          ) : (
            <Mail className="h-3 w-3" />
          )}
          {variant !== "compact" && (emailDone ? "Email sent ✓" : "Email")}
        </Button>
      )}

      <EmailSentShareFollowup
        visible={emailDone}
        title={shareDocument?.title ?? "Share document"}
        text={whatsapp?.message}
        docType={shareDocument?.docType}
        recordId={shareDocument?.recordId}
        linkedType={linkedType}
        linkedId={linkedId}
        recipientPhone={whatsapp?.phone ?? undefined}
        recipientLabel={recipientLabel}
      />

      {shareDocument && (
        <DocumentShareModeBar
          docType={shareDocument.docType}
          recordId={shareDocument.recordId}
          title={shareDocument.title}
          caption={whatsapp?.message}
          phone={whatsapp?.phone}
          recipientLabel={recipientLabel}
          linkedType={linkedType}
          linkedId={linkedId}
          variant={variant === "compact" ? "compact" : "row"}
        />
      )}
    </div>
  );
}
