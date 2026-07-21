import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Camera, Paperclip, CheckCircle2, Trash2, Upload, FileText, Loader2 } from "lucide-react";
import {
  useAttachments,
  type AttachmentEntityType,
  generateImageThumbnail,
  getAttachmentUrl,
} from "@/lib/attachments-store";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  uploadToHostinger,
  saveAttachmentMetadata,
  type HostingerModule,
} from "@/lib/hostinger-storage";
import { uploadFileToSupabase, getBucketForEntityType } from "@/lib/supabase-storage";
import { isOfflineMode } from "@/lib/deployment-mode";

export type AttachmentPlaceholderModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entityType: AttachmentEntityType;
  entityId: string;
  docKey: string;
  docLabel: string;
  /** Optional callback fired after save so callers can sync external boolean stores (e.g. People KYC). */
  onSaved?: (next: {
    filed: boolean;
    note: string;
    fileName?: string;
    fileDataUrl?: string;
    thumbnailDataUrl?: string;
  }) => void;
};

const HELP =
  "Physical File Register — MTJ documents and photographs are hosted physically on fast Hostinger servers and indexed securely on Supabase.";

// Utility to translate page/entity keys to physical Hostinger subdirectories
function mapToHostingerModule(entityType: string, docKey: string): HostingerModule {
  const ek = `${entityType}:${docKey}`.toLowerCase();

  if (ek.includes("logo")) return "firm-logos";
  if (
    docKey.includes("kyc") ||
    docKey.includes("aadhaar") ||
    docKey.includes("pan") ||
    docKey.includes("id")
  ) {
    return "kyc-documents";
  }
  if (entityType === "person") return "customer-documents";
  if (entityType === "worker") return "worker-documents";
  if (entityType === "catalog") return "catalog";
  if (entityType === "repair" || docKey.includes("repair")) return "repair-photos";

  if (
    entityType === "expense" ||
    docKey.includes("expense") ||
    docKey.includes("withdrawal") ||
    docKey.includes("bill")
  ) {
    return "expense-attachments";
  }
  if (
    docKey.includes("settlement") ||
    docKey.includes("gold-settlement") ||
    docKey.includes("proof")
  ) {
    return "gold-settlement-proofs";
  }
  if (
    docKey.includes("pay") ||
    docKey.includes("bill") ||
    docKey.includes("invoice") ||
    entityType === "billing"
  ) {
    return "billing-attachments";
  }

  return "order-attachments"; // Safe fallback directory
}

export function AttachmentPlaceholderModal({
  open,
  onOpenChange,
  title,
  entityType,
  entityId,
  docKey,
  docLabel,
  onSaved,
}: AttachmentPlaceholderModalProps) {
  const existing = useAttachments((s) => s.items[`${entityType}:${entityId}:${docKey}`]);
  const save = useAttachments((s) => s.save);
  const saveWithFile = useAttachments((s) => s.saveWithFile);
  const clear = useAttachments((s) => s.clear);

  const [filed, setFiled] = useState(false);
  const [note, setNote] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState("");
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileMissing, setFileMissing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset local state whenever the modal opens for a (possibly different) record.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setFiled(!!existing?.filed);
    setNote(existing?.note ?? "");
    setFileName(existing?.fileName ?? "");
    setThumbnailDataUrl(existing?.thumbnailDataUrl ?? "");
    setSelectedFile(null);
    setFileMissing(false);

    // Bytes live in the local vault, not in the row, so the preview has to be
    // read back asynchronously. getAttachmentUrl() falls back to the legacy
    // inlined base64 for records created before the vault existed.
    setFileDataUrl("");
    void getAttachmentUrl(entityType, entityId, docKey)
      .then((url) => {
        if (!cancelled) setFileDataUrl(url ?? "");
      })
      .catch((err) => {
        console.warn("[AttachmentModal] Failed to load stored file:", err);
        if (!cancelled) setFileMissing(!!existing?.filed);
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    entityType,
    entityId,
    docKey,
    existing?.filed,
    existing?.note,
    existing?.fileName,
    existing?.checksum,
    existing?.thumbnailDataUrl,
  ]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size limits exceeded (Max 10MB allowed).");
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);
      setFiled(true); // Auto-mark as filed/uploaded
      setFileMissing(false);

      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        setFileDataUrl(result);

        if (file.type.startsWith("image/")) {
          try {
            const thumb = await generateImageThumbnail(file, 240);
            setThumbnailDataUrl(thumb);
          } catch (err) {
            console.warn("Failed to generate thumbnail:", err);
            setThumbnailDataUrl("");
          }
        } else {
          setThumbnailDataUrl("");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsUploading(true);

    try {
      // 1. LOCAL FIRST, ALWAYS. The bytes go into the encrypted local vault and
      //    the attachment row records a reference to them. This is the durable
      //    write — it needs no network, in any deployment mode, and once it
      //    returns the document survives restart/logout/restore. Everything
      //    below is replication, not storage.
      if (selectedFile) {
        await saveWithFile(entityType, entityId, docKey, selectedFile, {
          filed: true,
          note: note.trim(),
        });
      } else {
        // Metadata-only edit (note / filed toggle) on an existing record.
        save(entityType, entityId, docKey, { filed, note: note.trim(), fileName });
      }

      // 2. Cloud replication — best-effort, and deliberately non-fatal. A failed
      //    upload must never fail the save or discard the file: the bytes are
      //    already durable on disk. Offline mode skips it entirely.
      let cloudFailed = false;
      if (selectedFile && !isOfflineMode()) {
        try {
          const bucket = getBucketForEntityType(entityType);
          const module = mapToHostingerModule(entityType, docKey);
          const previousPath = existing?.storagePath;

          const { filePath, signedUrl } = await uploadFileToSupabase(
            bucket,
            selectedFile,
            entityId,
            docKey,
          );

          // Replacing an existing file — remove the old storage object so it
          // doesn't linger as an orphaned blob in the bucket.
          if (previousPath && previousPath !== filePath) {
            const { error: removeError } = await supabase.storage
              .from(bucket)
              .remove([previousPath]);
            if (removeError) {
              console.warn(
                "[AttachmentModal] Failed to remove previous storage object:",
                removeError,
              );
            }
          }

          await saveAttachmentMetadata({
            filePath,
            fileUrl: signedUrl,
            fileName: selectedFile.name,
            originalFileName: selectedFile.name,
            mimeType: selectedFile.type || "application/octet-stream",
            fileSize: selectedFile.size,
            relatedModule: module,
            relatedTable: entityType,
            relatedRecordId: entityId,
            notes: note.trim(),
            docKey,
            thumbnailDataUrl: thumbnailDataUrl || undefined,
            storageProvider: "supabase",
          });

          save(entityType, entityId, docKey, { storagePath: filePath, bucket });
        } catch (err) {
          cloudFailed = true;
          console.warn("[AttachmentModal] Cloud replication failed; file is safe locally:", err);
        }
      }

      const rec = useAttachments.getState().items[`${entityType}:${entityId}:${docKey}`];
      onSaved?.({
        filed: rec?.filed ?? filed,
        note: note.trim(),
        fileName: rec?.fileName ?? fileName,
        thumbnailDataUrl: rec?.thumbnailDataUrl,
      });

      if (cloudFailed) {
        toast.warning("Saved locally. Cloud upload failed — it will sync when back online.");
      } else {
        toast.success(
          isOfflineMode() ? "Attachment saved locally." : "Attachment saved and uploaded securely.",
        );
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error("[AttachmentModal Save Error]:", err);
      toast.error(err.message || "Failed to save attachment.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = async () => {
    setIsUploading(true);
    try {
      // Find matching metadata record and delete in Supabase
      const key = `${entityType}:${entityId}:${docKey}`;
      await supabase.from("attachments").delete().eq("id", key);

      // Remove the underlying storage object so nothing is left orphaned in the
      // bucket. Offline attachments have no bucket object — only the local row.
      if (existing?.storagePath && !isOfflineMode()) {
        const bucket = getBucketForEntityType(entityType);
        const { error: removeError } = await supabase.storage
          .from(bucket)
          .remove([existing.storagePath]);
        if (removeError) {
          console.warn("[AttachmentModal] Failed to remove storage object:", removeError);
        }
      }

      clear(entityType, entityId, docKey);
      setFileName("");
      setFileDataUrl("");
      setSelectedFile(null);
      setFileMissing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onSaved?.({ filed: false, note: "" });
      toast.success("Documents cleared from database and storage references.");
      onOpenChange(false);
    } catch (err: any) {
      console.error("[AttachmentModal Clear Error]:", err);
      toast.error("Process failed to clear database records.");
    } finally {
      setIsUploading(false);
    }
  };

  const isImage = !!(
    // Vaulted files resolve to a `blob:` URL that carries no type hint, so the
    // record's stored mimeType is what decides — checked first for that reason.
    existing?.mimeType?.startsWith("image/") ||
    fileDataUrl.startsWith("data:image/") ||
    fileDataUrl.toLowerCase().match(/\.(jpg|jpeg|png|webp)/) ||
    (selectedFile && selectedFile.type.startsWith("image/"))
  );

  return (
    <Dialog open={open} onOpenChange={(val) => !isUploading && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-lg text-gold">
            <Paperclip className="h-5 w-5" /> {title}
          </DialogTitle>
          <DialogDescription className="leading-relaxed text-xs text-muted-foreground">
            {HELP}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Document / Registry Item
                </div>
                <div className="font-medium text-foreground">{docLabel}</div>
              </div>
              {filed ? (
                <Badge className="bg-success/20 text-success hover:bg-success/20 border border-success/40">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                </Badge>
              ) : (
                <Badge variant="outline" className="border-dashed">
                  <Camera className="h-3 w-3 mr-1" /> No file loaded
                </Badge>
              )}
            </div>
          </div>

          {/* Interactive File Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Digital Copy
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={isUploading}
              accept="image/*,application/pdf,.doc,.docx"
              className="hidden"
              id={`file-picker-${docKey}`}
              data-testid="attachment-file-input"
            />

            {fileDataUrl ? (
              <div className="rounded-lg border border-border p-3 bg-secondary/30 flex flex-col items-center justify-center gap-3 relative group">
                {isImage ? (
                  <div className="max-h-48 rounded overflow-hidden shadow-sm border border-border/60 bg-white flex items-center justify-center">
                    {fileMissing ? (
                      <div className="p-8 text-center text-xs text-red-500 font-medium font-mono">
                        File missing on storage server
                      </div>
                    ) : (
                      <img
                        src={fileDataUrl}
                        alt="Attachment preview"
                        referrerPolicy="no-referrer"
                        onError={() => setFileMissing(true)}
                        className="object-contain max-h-40 w-auto"
                        data-testid="attachment-preview"
                      />
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-full bg-primary/10">
                    <FileText className="h-10 w-10 text-gold" />
                  </div>
                )}

                <div className="text-center">
                  <div className="text-xs font-medium text-foreground max-w-[320px] truncate">
                    {fileName || "Attached Document"}
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => {
                        setFileName("");
                        setFileDataUrl("");
                        setSelectedFile(null);
                        setFileMissing(false);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-xs text-destructive hover:underline mt-1 bg-transparent border-0 cursor-pointer p-0"
                    >
                      Remove file
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border/80 rounded-xl py-6 px-4 bg-card/20 hover:bg-card/40 hover:border-gold/30 transition-all text-center cursor-pointer flex flex-col items-center gap-2 group"
              >
                <div className="p-2.5 rounded-full bg-sidebar-accent/80 group-hover:scale-110 transition-transform">
                  <Upload className="h-5 w-5 text-muted-foreground group-hover:text-gold" />
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground">
                    Click to upload file, image or PDF
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Supports PNG, JPG, PDF, DOC, DOCX up to 10MB
                  </div>
                </div>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              id={`filed-${docKey}`}
              type="checkbox"
              disabled={isUploading}
              checked={filed}
              onChange={(e) => setFiled(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-gold focus:ring-gold"
            />
            <label
              htmlFor={`filed-${docKey}`}
              className="text-sm font-medium text-foreground cursor-pointer select-none"
            >
              Mark as logged in Physical File Register
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Ref Notes / Coordinates
            </label>
            <Textarea
              value={note}
              disabled={isUploading}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bound book page 14, cabinet 2 shelf B"
              className="mt-1"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {(existing?.filed || existing?.note || existing?.fileName) && !isUploading && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="mr-auto text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Clear all
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={isUploading}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            disabled={isUploading}
            onClick={handleSave}
            data-testid="attachment-save"
            className="bg-gold text-stone-950 font-semibold hover:bg-gold-light"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Uploading...
              </>
            ) : (
              "Save Register"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Convenience button + filed badge that opens the shared modal.
 */
export function AttachmentButton({
  entityType,
  entityId,
  docKey,
  docLabel,
  title,
  onSaved,
  size = "sm",
  variant = "ghost",
  className,
}: {
  entityType: AttachmentEntityType;
  entityId: string;
  docKey: string;
  docLabel: string;
  title?: string;
  onSaved?: (next: {
    filed: boolean;
    note: string;
    fileName?: string;
    fileDataUrl?: string;
  }) => void;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "secondary" | "ghost" | "outline";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rec = useAttachments((s) => s.items[`${entityType}:${entityId}:${docKey}`]);
  const filed = !!rec?.filed;
  return (
    <>
      <Button
        type="button"
        size={size}
        variant={filed ? "secondary" : variant}
        onClick={() => setOpen(true)}
        className={className}
        data-testid={`attachment-btn-${docKey}`}
      >
        {filed ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-success" /> Filed
          </>
        ) : (
          <>
            <Camera className="h-3.5 w-3.5 mr-1" /> Add / Attach
          </>
        )}
      </Button>
      <AttachmentPlaceholderModal
        open={open}
        onOpenChange={setOpen}
        title={title ?? `${docLabel}`}
        entityType={entityType}
        entityId={entityId}
        docKey={docKey}
        docLabel={docLabel}
        onSaved={onSaved}
      />
    </>
  );
}
