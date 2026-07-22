/**
 * DocCommActions — reusable communication action bar for any ERP document.
 *
 * Renders: [Print A4] [Thermal] [PDF] [Email] [WhatsApp]
 *
 * Usage:
 *   <DocCommActions
 *     printA4Href="/orders/print/a4/123"
 *     printThermalHref="/orders/print/thermal/123"
 *     whatsapp={{ phone: customer.phone, message: "Your order #123 is ready!" }}
 *     email={{ to: customer.email, subject: "Order #123", body: "..." }}
 *     onPdf={() => window.print()}
 *   />
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Printer,
  Thermometer,
  FileDown,
  Mail,
  MessageCircle,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { isValidWaPhone } from "@/lib/wa-link";
import { sendWhatsAppText } from "@/lib/comm/send-whatsapp-text";
import { sendGenericEmail } from "@/lib/email-service";
import { toast } from "sonner";
import { useCommLog } from "@/lib/comm-log-store";
import { useCurrentBranchId } from "@/lib/branch-store";

export interface DocCommActionsProps {
  /** href for A4 print route — if omitted, button hidden */
  printA4Href?: string;
  /** href for thermal print route — if omitted, button hidden */
  printThermalHref?: string;
  /** Called when PDF button clicked (usually window.print() or jsPDF export) */
  onPdf?: () => void;
  /** WhatsApp config — if omitted, button hidden */
  whatsapp?: {
    phone: string | undefined | null;
    message: string;
  };
  /** Email config — if omitted, button hidden */
  email?: {
    to: string | undefined | null;
    subject: string;
    body: string;
  };
  /** For comm log recording */
  linkedType?:
    "invoice" | "order" | "job" | "repair" | "estimate" | "delivery_challan" | "gold_settlement";
  linkedId?: string;
  recipientLabel?: string;
  /** Layout variant */
  variant?: "row" | "column" | "compact";
  className?: string;
}

export function DocCommActions({
  printA4Href,
  printThermalHref,
  onPdf,
  whatsapp,
  email,
  linkedType,
  linkedId,
  recipientLabel = "Customer",
  variant = "row",
  className = "",
}: DocCommActionsProps) {
  const [emailSending, setEmailSending] = useState(false);
  const [emailDone, setEmailDone] = useState(false);
  const branchId = useCurrentBranchId();
  const recordComm = useCommLog((s) => s.record);

  async function handleEmail() {
    if (!email?.to) {
      toast.warning("No email address on record.");
      return;
    }
    setEmailSending(true);
    try {
      const result = await sendGenericEmail({
        to: email.to,
        subject: email.subject,
        htmlBody: `<pre style="font-family:sans-serif;white-space:pre-wrap">${email.body}</pre>`,
        textBody: email.body,
      });
      if (result.success) {
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
        toast.error(result.error || "Email delivery failed — check SMTP settings.");
      }
    } catch (e: any) {
      toast.error("Email error: " + e.message);
    } finally {
      setEmailSending(false);
    }
  }

  async function handleWhatsApp() {
    if (!whatsapp?.phone) {
      toast.warning("No phone number on record.");
      return;
    }
    // A phone that exists but isn't dialable (landline, typo, missing digits)
    // would still produce a wa.me link — one that opens WhatsApp on an unknown
    // contact and looks like it worked. Refuse it instead.
    if (!isValidWaPhone(whatsapp.phone)) {
      toast.warning(`"${whatsapp.phone}" is not a valid WhatsApp number.`);
      return;
    }
    // Through the configured provider, not a hard-coded wa.me link — this is
    // the seam OpenWA will slot into without touching this screen.
    // sendWhatsAppText records the Communication Log entry itself (message
    // id + delivery status included) — no separate recordComm() call needed.
    const result = await sendWhatsAppText({
      phone: whatsapp.phone,
      message: whatsapp.message,
      recipientName: recipientLabel,
      linkedType: linkedType as any,
      linkedId,
    });
    if (!result.ok) {
      toast.error(result.error ?? "Could not send the WhatsApp message.");
      return;
    }
    if (result.via !== "whatsapp_deep_link") {
      toast.success(`WhatsApp document sent to ${whatsapp.phone}`);
    }
  }

  const btnClass =
    variant === "compact" ? "h-7 px-2 text-[11px] gap-1" : "h-8 px-3 text-xs gap-1.5";

  const wrapClass =
    variant === "column" ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-2";

  return (
    <div className={`${wrapClass} ${className}`}>
      {printA4Href && (
        <Link to={printA4Href as any}>
          <Button variant="outline" size="sm" className={btnClass}>
            <Printer className="h-3 w-3" />
            {variant !== "compact" && "Print A4"}
          </Button>
        </Link>
      )}

      {printThermalHref && (
        <Link to={printThermalHref as any}>
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
          {variant !== "compact" && (emailDone ? "Sent" : "Email")}
        </Button>
      )}

      {whatsapp && (
        <Button
          size="sm"
          className={`${btnClass} bg-[#25D366] hover:bg-[#20bf5a] text-white border-[#25D366]`}
          onClick={() => void handleWhatsApp()}
          disabled={!isValidWaPhone(whatsapp.phone)}
          title={
            !whatsapp.phone
              ? "No phone on record"
              : isValidWaPhone(whatsapp.phone)
                ? `WhatsApp ${whatsapp.phone}`
                : `Not a valid WhatsApp number: ${whatsapp.phone}`
          }
        >
          <MessageCircle className="h-3 w-3" />
          {variant !== "compact" && "WhatsApp"}
        </Button>
      )}
    </div>
  );
}
