/**
 * WhatsAppDocMenu — one green "Send on WhatsApp" dropdown for a set of ERP
 * documents. Each item generates its PDF through the Universal Print Engine and
 * sends it via the configured WasenderAPI provider (see sendWhatsAppDocument);
 * no document generation is duplicated here.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageCircle, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { isValidWaPhone } from "@/lib/wa-link";
import { sendWhatsAppDocument } from "@/lib/comm/send-whatsapp-document";
import type { PrintDocType } from "@/lib/print-engine/types";

export interface WhatsAppDocItem {
  label: string;
  docType: PrintDocType;
  recordId: string;
  caption?: string;
}

export function WhatsAppDocMenu({
  buttonLabel,
  phone,
  recipientName,
  items,
  linkedType,
  linkedId,
}: {
  buttonLabel: string;
  phone: string | undefined | null;
  recipientName: string;
  items: WhatsAppDocItem[];
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
}) {
  const [busy, setBusy] = useState(false);
  const valid = isValidWaPhone(phone ?? "");
  if (items.length === 0) return null;

  async function send(item: WhatsAppDocItem) {
    setBusy(true);
    const t = toast.loading(`Sending ${item.label}…`);
    try {
      const res = await sendWhatsAppDocument({
        docType: item.docType,
        recordId: item.recordId,
        phone,
        caption: item.caption,
        recipientName,
        linkedType,
        linkedId,
      });
      if (!res.ok) {
        toast.error(res.error ?? "WhatsApp send failed.", { id: t });
      } else if (res.attached) {
        toast.success(`${item.label} sent on WhatsApp.`, { id: t });
      } else {
        toast.warning(`${item.label}: caption sent, PDF could not be attached.`, { id: t });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "WhatsApp send failed.", { id: t });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="h-8 gap-1.5 bg-[#25D366] hover:bg-[#20bf5a] text-white"
          disabled={!valid || busy}
          title={valid ? `WhatsApp ${phone}` : "No valid WhatsApp number on record"}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" />
          )}
          {buttonLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Send on WhatsApp</DropdownMenuLabel>
        {items.map((it) => (
          <DropdownMenuItem key={it.label} onSelect={() => void send(it)} className="gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
