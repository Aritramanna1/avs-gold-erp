import { Button } from "@/components/ui/button";
import { Share2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  shareBusinessDocument,
  SHARE_INITIATED_TOAST,
} from "@/lib/native/share-business-document";
import { nativeShareAvailable } from "@/lib/native/share";
import type { PrintDocType } from "@/lib/print-engine/types";
import type { CommLinkedType } from "@/lib/comm-log-store";

export function ShareDocumentButton({
  title,
  text,
  docType,
  recordId,
  fileName,
  linkedType,
  linkedId,
  recipientPhone,
  recipientLabel,
  label = "Share",
  className,
}: {
  title: string;
  text?: string;
  docType?: PrintDocType;
  recordId?: string;
  fileName?: string;
  linkedType?: CommLinkedType;
  linkedId?: string;
  recipientPhone?: string;
  recipientLabel?: string;
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  if (!nativeShareAvailable()) return null;

  async function share() {
    setBusy(true);
    try {
      const result = await shareBusinessDocument({
        title,
        text,
        docType,
        recordId,
        fileName,
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className ?? "h-8 px-3 text-xs gap-1.5"}
      onClick={() => void share()}
      disabled={busy}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
