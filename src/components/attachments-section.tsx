import { Paperclip } from "lucide-react";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";
import { useAttachments, type AttachmentEntityType } from "@/lib/attachments-store";

export type AttachmentSlot = { key: string; label: string };

/**
 * Standard Photos & Files card for any detail page.
 * Uses the shared AttachmentPlaceholderModal under the hood.
 */
export function AttachmentsSection({
  entityType,
  entityId,
  slots,
  title = "Photos & Files",
  description,
  onFiled,
}: {
  entityType: AttachmentEntityType;
  entityId: string;
  slots: AttachmentSlot[];
  title?: string;
  description?: string;
  /** Fired after a slot is saved with filed=true — e.g. to log an audit-trail entry. */
  onFiled?: (slot: AttachmentSlot) => void;
}) {
  const items = useAttachments((s) => s.items);
  return (
    <div className="rounded-md border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-gold" />
        <h3 className="font-serif text-lg text-gold">{title}</h3>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="grid sm:grid-cols-2 gap-2">
        {slots.map((slot) => {
          const rec = items[`${entityType}:${entityId}:${slot.key}`];
          const filed = !!rec?.filed;
          return (
            <div
              key={slot.key}
              className={`rounded-lg border p-3 flex items-center justify-between gap-2 ${
                filed ? "border-gold/40 bg-gold/5" : "border-dashed border-border bg-background/30"
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm">{slot.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {filed
                    ? rec?.note
                      ? `Filed · ${rec.note}`
                      : "Filed in paper register"
                    : "Not on file"}
                </div>
              </div>
              <AttachmentButton
                entityType={entityType}
                entityId={entityId}
                docKey={slot.key}
                docLabel={slot.label}
                onSaved={(next) => next.filed && onFiled?.(slot)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
