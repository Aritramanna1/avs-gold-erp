import { useState, useEffect, useCallback, useRef } from "react";
import {
  uploadFileToHostinger,
  listAttachments,
  softDeleteAttachment,
  type UploadModule,
} from "@/lib/fileUpload";
import { compressImage } from "@/lib/image-compression";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload as UploadIcon,
  FileText,
  Image as ImageIcon,
  Trash2,
  FileDown,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface AttachmentUploaderProps {
  module: UploadModule;
  relatedTable: string;
  relatedRecordId: string;
  branchId?: string | null;
  onUploadSuccess?: () => void;
}

export function AttachmentUploader({
  module,
  relatedTable,
  relatedRecordId,
  branchId,
  onUploadSuccess,
}: AttachmentUploaderProps) {
  const { t } = useLanguage();
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: number;
    compressedSize: number;
    optimized: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load attachments on mount or record ID change
  const loadAttachments = useCallback(async () => {
    if (!relatedRecordId) return;
    setLoading(true);
    try {
      const data = await listAttachments(relatedTable, relatedRecordId);
      setAttachments(data);
    } catch (err) {
      console.error("Failed to load attachments:", err);
    } finally {
      setLoading(false);
    }
  }, [relatedTable, relatedRecordId]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  async function processSelectedFile(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File is too large! Maximum allowed size is 15MB.");
      return;
    }

    if (file.type.startsWith("image/")) {
      setOptimizing(true);
      try {
        const result = await compressImage(file);
        setSelectedFile(result.file);
        setPreviewUrl(URL.createObjectURL(result.file));
        setCompressionStats({
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          optimized: result.optimized,
        });
        if (result.optimized) {
          const savings = Math.round((1 - result.compressedSize / result.originalSize) * 100);
          toast.success(`Image optimized! Saved ${savings}% space.`);
        }
      } catch (err: any) {
        toast.error("Failed to optimize image: " + err.message);
      } finally {
        setOptimizing(false);
      }
    } else {
      setSelectedFile(file);
      setPreviewUrl(null);
      setCompressionStats(null);
    }
  }

  // Handle file selections
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  }

  // Handle Drag & Drop
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  }

  // Execute Upload
  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);

    try {
      await uploadFileToHostinger({
        file: selectedFile,
        module,
        relatedTable,
        relatedRecordId,
        relatedModule: module,
        branchId,
        notes: notes.trim() || null,
      });

      toast.success("File uploaded and saved successfully!");
      setSelectedFile(null);
      setPreviewUrl(null);
      setCompressionStats(null);
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Reload lists and trigger callbacks
      await loadAttachments();
      onUploadSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "File upload failed.");
    } finally {
      setUploading(false);
    }
  }

  // Soft deletion handler
  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this attachment?")) return;

    try {
      await softDeleteAttachment(id);
      toast.success("Attachment deleted successfully.");
      await loadAttachments();
      onUploadSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete attachment.");
    }
  }

  const isImageFile = (mimeType: string) => mimeType.startsWith("image/");

  return (
    <div className="space-y-4">
      {/* File Drop zone & Setup form */}
      <div className="grid md:grid-cols-2 gap-4">
        <label
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="relative group border-2 border-dashed border-border hover:border-gold/50 rounded-lg p-5 flex flex-col items-center justify-center bg-card/40 transition-all cursor-pointer select-none"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
          />

          <UploadIcon className="h-8 w-8 text-muted-foreground group-hover:text-gold group-hover:scale-110 duration-200 mb-2" />

          {optimizing ? (
            <div className="text-center space-y-1.5">
              <Loader2 className="h-6 w-6 text-gold animate-spin mx-auto animate-duration-500" />
              <span className="text-xs font-medium text-gold block">Optimizing image...</span>
            </div>
          ) : selectedFile ? (
            <div className="text-center">
              <span className="text-xs font-mono font-medium block text-gold truncate max-w-[200px]">
                {selectedFile.name}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </span>
              {compressionStats?.optimized && (
                <span className="text-[9px] bg-gold/15 text-gold px-1.5 py-0.5 rounded font-mono mt-1 inline-block">
                  {Math.round(compressionStats.originalSize / 1024)} KB &rarr;{" "}
                  {Math.round(compressionStats.compressedSize / 1024)} KB
                </span>
              )}
            </div>
          ) : (
            <div className="text-center space-y-1">
              <span className="text-xs font-medium block">Drag & Drop file here</span>
              <span className="text-[10px] text-muted-foreground block">
                or click to search computer (15MB limit)
              </span>
            </div>
          )}
        </label>

        {/* Selected file info / Notes input */}
        <div className="space-y-3">
          {previewUrl && (
            <div className="h-20 w-32 rounded border border-border bg-muted/30 overflow-hidden flex items-center justify-center relative">
              <img src={previewUrl} alt="Selected preview" className="h-full w-full object-cover" />
            </div>
          )}

          {selectedFile && !previewUrl && (
            <div className="h-10 px-3 rounded border border-border bg-muted/25 flex items-center gap-2 text-xs">
              <FileText className="h-4 w-4 text-gold shrink-0" />
              <div className="truncate font-mono">{selectedFile.name}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">File Description / Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aadhaar proof, worker face photo, logo tag etc..."
              className="text-xs h-8"
              disabled={!selectedFile}
            />
          </div>

          <div className="flex gap-2 justify-end">
            {selectedFile && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={uploading}
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setCompressionStats(null);
                  setNotes("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Clear
              </Button>
            )}
            <Button
              size="sm"
              className="text-xs gap-1"
              disabled={!selectedFile || uploading}
              onClick={handleUpload}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <UploadIcon className="h-3 w-3" /> Save Attachment
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Existing uploaded attachments section */}
      <div className="border border-border/65 bg-background/20 rounded-lg p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gold mb-2.5">
          Saved Attachments
        </h4>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 justify-center">
            <Loader2 className="h-3 w-3 animate-spin text-gold" /> Loading attachments...
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center text-[11px] text-muted-foreground py-6">
            No files uploaded yet for this record.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {attachments.map((file) => (
              <Card
                key={file.id}
                className="p-2 flex items-center justify-between gap-3 border border-border bg-card/20 hover:bg-card/45 duration-100 group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isImageFile(file.mime_type) ? (
                    <div className="h-10 w-10 shrink-0 rounded overflow-hidden border border-border bg-muted flex items-center justify-center">
                      <img
                        src={file.file_url}
                        alt="Thumbnail"
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded border border-border bg-muted/40 grid place-items-center">
                      <FileText className="h-5 w-5 text-gold/80" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p
                      className="font-mono text-[11px] font-semibold text-foreground truncate max-w-[150px] sm:max-w-[200px]"
                      title={file.original_file_name}
                    >
                      {file.original_file_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(file.file_size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {file.notes && (
                      <p className="text-[10px] italic text-gold/70 truncate max-w-[150px]">
                        Note: {file.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded text-muted-foreground hover:text-gold hover:bg-gold/5 transition"
                    title="Open live URL"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                    onClick={() => handleDelete(file.id)}
                    title="Delete attachment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
