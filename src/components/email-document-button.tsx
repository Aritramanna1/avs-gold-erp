/**
 * Shared "Email document" control — recipient, subject, branded preview,
 * optional PDF attach via Universal Print Engine + send-document-email.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sendGenericEmail } from "@/lib/email-service";
import { wrapBrandedEmailHtml } from "@/lib/comm/branded-email-shell";
import { sendDocumentEmail } from "@/lib/comm/send-document-email";
import type { PrintDocType } from "@/lib/print-engine/types";
import { fetchTenantEmailAccounts } from "@/lib/comm/platform/tenant-email-store";
import { PLATFORM_EMAIL_BRAND } from "@/lib/comm/default-email-brand";
import { loadPlatformEmailSettings } from "@/lib/platform-email-settings";

export interface EmailDocumentButtonProps {
  defaultTo?: string | null;
  subject: string;
  body: string;
  /** When set, offers "Attach PDF" using the print engine. */
  document?: {
    docType: PrintDocType;
    recordId: string;
  };
  /** Compact trigger for report toolbars. */
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
  label?: string;
  className?: string;
}

export function EmailDocumentButton({
  defaultTo,
  subject: defaultSubject,
  body: defaultBody,
  document,
  size = "sm",
  variant = "outline",
  label = "Email",
  className,
}: EmailDocumentButtonProps) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo ?? "");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [attachPdf, setAttachPdf] = useState(Boolean(document));
  const [sending, setSending] = useState(false);
  const [fromLabel, setFromLabel] = useState("Company mailbox (auto)");

  useEffect(() => {
    if (!open) return;
    setTo(defaultTo ?? "");
    setSubject(defaultSubject);
    setBody(defaultBody);
    void fetchTenantEmailAccounts().then(async (accounts) => {
      const def = accounts.find((a) => a.isDefault && a.isActive) ?? accounts.find((a) => a.isActive) ?? accounts[0];
      if (def) {
        setFromLabel(
          def.displayName
            ? `${def.displayName} <${def.fromEmail}>`
            : def.fromEmail,
        );
      } else {
        try {
          const plat = await loadPlatformEmailSettings();
          const from = plat.fromEmail?.trim() || PLATFORM_EMAIL_BRAND.supportEmail;
          setFromLabel(`Platform fallback: ${from} (firm mailbox not configured)`);
        } catch {
          setFromLabel(
            `Platform fallback: ${PLATFORM_EMAIL_BRAND.supportEmail} (firm mailbox not configured)`,
          );
        }
      }
    });
  }, [open, defaultTo, defaultSubject, defaultBody]);

  const previewHtml = useMemo(
    () =>
      wrapBrandedEmailHtml({
        title: subject || "Message",
        innerHtml: `<p style="white-space:pre-wrap;line-height:1.5">${body
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</p>`,
      }),
    [subject, body],
  );

  async function handleSend() {
    if (!to.includes("@")) {
      toast.error("Enter a valid recipient email.");
      return;
    }
    setSending(true);
    try {
      if (attachPdf && document) {
        const result = await sendDocumentEmail({
          docType: document.docType,
          recordId: document.recordId,
          to,
          subject,
          message: body,
        });
        if (!result.ok) {
          toast.error(result.error || "Failed to email document PDF.");
          return;
        }
      } else {
        const result = await sendGenericEmail({
          to,
          subject,
          htmlBody: previewHtml,
          textBody: body,
        });
        if (!result.success) {
          toast.error(result.error || "Failed to send email.");
          return;
        }
      }
      toast.success(`Email sent to ${to}`);
      setOpen(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size={size} variant={variant} className={className}>
          <Mail className="h-4 w-4 mr-1.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email document</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">From (company mailbox)</Label>
            <Input value={fromLabel} readOnly className="bg-muted/40 text-xs" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">To</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          {document ? (
            <div className="flex items-center gap-2">
              <Switch checked={attachPdf} onCheckedChange={setAttachPdf} />
              <span className="text-sm">Attach PDF from print engine</span>
            </div>
          ) : null}
          <div className="rounded-md border border-border overflow-hidden">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1 bg-muted/40">
              Branded preview
            </div>
            <iframe
              title="Email preview"
              className="w-full h-48 bg-white"
              srcDoc={previewHtml}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSend()} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
