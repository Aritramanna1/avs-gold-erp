import { Button } from "@/components/ui/button";
import { CheckCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  shareBusinessDocument,
  SHARE_INITIATED_TOAST,
} from "@/lib/native/share-business-document";
import type { PrintDocType } from "@/lib/print-engine/types";
import type { CommLinkedType } from "@/lib/comm-log-store";

export function EmailSentShareFollowup({
  visible,
  title,
  text,
  docType,
  recordId,
  linkedType,
  linkedId,
  recipientPhone,
  recipientLabel,
}: {
  visible: boolean;
  title: string;
  text?: string;
  docType?: PrintDocType;
  recordId?: string;
  linkedType?: CommLinkedType;
  linkedId?: string;
  recipientPhone?: string;
  recipientLabel?: string;
}) {
  if (!visible) return null;

  async function share() {
    const result = await shareBusinessDocument({
      title,
      text,
      docType,
      recordId,
      linkedType,
      linkedId,
      recipientPhone,
      recipientLabel,
    });
    if (!result.initiated) {
      toast.error(result.error ?? "Could not open share sheet.");
      return;
    }
    toast.message(SHARE_INITIATED_TOAST);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle className="h-3.5 w-3.5" /> Email sent ✓
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-[11px] gap-1"
        onClick={() => void share()}
      >
        <Share2 className="h-3 w-3" /> Share on WhatsApp
      </Button>
    </div>
  );
}
