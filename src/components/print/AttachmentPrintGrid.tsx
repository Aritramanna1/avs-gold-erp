import { useState, useEffect } from "react";
import { listAttachments } from "@/lib/fileUpload";
import { FileText, Loader2 } from "lucide-react";

interface AttachmentPrintGridProps {
  relatedTable: string;
  relatedRecordId: string;
}

/**
 * High-contrast print grid for displaying file attachment references on archival/inkjet copies
 */
export function AttachmentPrintGrid({ relatedTable, relatedRecordId }: AttachmentPrintGridProps) {
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!relatedRecordId) return;
      setLoading(true);
      try {
        const data = await listAttachments(relatedTable, relatedRecordId);
        setAttachments(data);
      } catch (err) {
        console.error("Failed to load attachments for print:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [relatedTable, relatedRecordId]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 justify-center py-3 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Fetching attached KYC/receipts...
      </div>
    );
  }

  if (attachments.length === 0) return null;

  return (
    <div className="mt-6 border-t border-black/10 pt-4 print:border-black/20 break-inside-avoid">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-black/80 mb-2">
        Attached Verification Documents &amp; Photos
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {attachments.map((file) => {
          const isImage = file.mime_type?.startsWith("image/");
          return (
            <div
              key={file.id}
              className="border border-black/10 rounded-lg p-2 bg-white flex flex-col items-center justify-between text-center max-w-[160px]"
            >
              {isImage ? (
                <div className="h-14 w-full bg-muted/20 border border-black/10 rounded flex items-center justify-center overflow-hidden mb-1">
                  <img
                    src={file.file_url}
                    alt={file.original_file_name}
                    className="h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="h-14 w-full bg-black/5 rounded flex items-center justify-center mb-1">
                  <FileText className="h-6 w-6 text-black/40" />
                </div>
              )}
              <div className="w-full">
                <p className="text-[9px] font-mono text-black font-semibold truncate block">
                  {file.original_file_name}
                </p>
                <p className="text-[8px] text-black/60 font-mono">
                  {file.notes || `${(file.file_size / 1024 / 1024).toFixed(2)} MB`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
