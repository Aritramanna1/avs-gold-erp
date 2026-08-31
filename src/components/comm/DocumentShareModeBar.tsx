/**
 * Document delivery modes from the same Universal Print Engine template:
 * Share as Image · Share as PDF · Email (firm mailbox → platform fallback) ·
 * WhatsApp (only when Official API / OpenWA is configured).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, FileText, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  shareBusinessDocument,
  SHARE_INITIATED_TOAST,
} from "@/lib/native/share-business-document";
import { sendWhatsAppDocument } from "@/lib/comm/send-whatsapp-document";
import { isValidWaPhone } from "@/lib/wa-link";
import { useCurrentBranchId } from "@/lib/branch-store";
import { useCommLog, type CommLinkedType } from "@/lib/comm-log-store";
import { isWhatsAppApiConfigured } from "@/lib/comm/whatsapp-mode-router";
import { EmailDocumentButton } from "@/components/email-document-button";
import type { PrintDocType } from "@/lib/print-engine/types";

export interface DocumentShareModeBarProps {
  docType: PrintDocType;
  recordId: string;
  title?: string;
  caption?: string;
  phone?: string | null;
  /** Pre-fill email dialog when party email is known. */
  emailTo?: string | null;
  recipientLabel?: string;
  linkedType?: CommLinkedType;
  linkedId?: string;
  variant?: "row" | "compact";
  className?: string;
  /** Hide image/PDF when false (default true). */
  showFileShares?: boolean;
  /** Company email (always available; uses platform From if firm mailbox missing). */
  showEmail?: boolean;
  /**
   * WhatsApp button visibility.
   * - `true` / `false`: force
   * - `"auto"` (default): only when Official WhatsApp API or OpenWA is configured
   */
  showWhatsApp?: boolean | "auto";
}

export function DocumentShareModeBar({
  docType,
  recordId,
  title = "Document",
  caption,
  phone,
  emailTo,
  recipientLabel = "Customer",
  linkedType,
  linkedId,
  variant = "row",
  className = "",
  showFileShares = true,
  showEmail = true,
  showWhatsApp = "auto",
}: DocumentShareModeBarProps) {
  const [busy, setBusy] = useState<"image" | "pdf" | "wa" | null>(null);
  const [waApiReady, setWaApiReady] = useState(false);
  const branchId = useCurrentBranchId();
  const recordComm = useCommLog((s) => s.record);
  const btnClass = variant === "compact" ? "h-7 px-2 text-[11px] gap-1" : "h-8 px-3 text-xs gap-1.5";

  useEffect(() => {
    if (showWhatsApp !== "auto") return;
    setWaApiReady(isWhatsAppApiConfigured(branchId));
  }, [showWhatsApp, branchId]);

  const whatsappVisible =
    showWhatsApp === true || (showWhatsApp === "auto" && waApiReady);

  async function shareFormat(format: "image" | "pdf") {
    setBusy(format);
    try {
      const result = await shareBusinessDocument({
        title,
        text: caption,
        docType,
        recordId,
        format,
        linkedType,
        linkedId,
        recipientPhone: phone ?? undefined,
        recipientLabel,
        branchId,
      });
      if (!result.initiated) {
        toast.error(result.error ?? "Could not share document.");
        return;
      }
      if (result.downloaded) {
        toast.success(
          format === "image"
            ? "Image downloaded (desktop). Attach it from Downloads if needed."
            : "PDF downloaded (desktop). Attach it from Downloads if needed.",
        );
      } else {
        toast.message(SHARE_INITIATED_TOAST);
      }
    } finally {
      setBusy(null);
    }
  }

  async function sendWhatsApp() {
    setBusy("wa");
    try {
      const result = await sendWhatsAppDocument({
        docType,
        recordId,
        phone,
        caption,
        recipientName: recipientLabel,
        branchId,
        linkedType: linkedType as "invoice" | "order" | "job" | "repair" | "estimate" | undefined,
        linkedId,
      });
      if (!result.ok) {
        toast.error(result.error ?? "WhatsApp send failed.");
        return;
      }
      if (result.deliveryStatus === "share_initiated") {
        toast.message(SHARE_INITIATED_TOAST);
      } else if (result.deliveryStatus === "deep_link_opened") {
        toast.message(
          result.error ??
            (result.attached
              ? "WhatsApp opened with a secure document link."
              : "WhatsApp opened."),
        );
      } else if (result.deliveryStatus === "queued") {
        toast.success("Document queued with WhatsApp provider.");
      } else {
        toast.success("WhatsApp request accepted.");
      }
      if (linkedType && linkedId) {
        recordComm({
          kind: "manually_sent",
          templateKind: "custom",
          templateName: title,
          target: "customer",
          recipientLabel,
          recipientPhone: phone ?? "",
          linkedType,
          linkedId,
          body: caption ?? title,
          deliveryStatus: result.deliveryStatus as never,
        });
      }
    } finally {
      setBusy(null);
    }
  }

  const emailSubject = `${title}${caption ? ` — ${caption}` : ""}`;
  const emailBody = `Please find attached ${title}.\n\nRegards`;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      data-testid="document-share-mode-bar"
    >
      {showFileShares && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={btnClass}
            disabled={busy !== null}
            onClick={() => void shareFormat("image")}
            title="On-device share — high-resolution image from the print template"
            data-testid="share-as-image"
          >
            {busy === "image" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
            {variant !== "compact" && "Share as Image"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={btnClass}
            disabled={busy !== null}
            onClick={() => void shareFormat("pdf")}
            title="On-device share — PDF from the print template"
            data-testid="share-as-pdf"
          >
            {busy === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {variant !== "compact" && "Share as PDF"}
          </Button>
        </>
      )}
      {showEmail && (
        <EmailDocumentButton
          defaultTo={emailTo}
          subject={emailSubject}
          body={emailBody}
          document={{ docType, recordId }}
          size="sm"
          variant="outline"
          label={variant === "compact" ? "Email" : "Email PDF"}
          className={btnClass}
        />
      )}
      {whatsappVisible && (
        <Button
          type="button"
          size="sm"
          className={`${btnClass} bg-[#25D366] hover:bg-[#20bf5a] text-white border-[#25D366]`}
          disabled={busy !== null}
          onClick={() => void sendWhatsApp()}
          title={
            phone && isValidWaPhone(phone)
              ? "Send via configured WhatsApp API"
              : "Send via configured WhatsApp API (add phone for direct delivery)"
          }
          data-testid="send-via-whatsapp"
        >
          {busy === "wa" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" />
          )}
          {variant !== "compact" && "Send via WhatsApp"}
        </Button>
      )}
    </div>
  );
}
