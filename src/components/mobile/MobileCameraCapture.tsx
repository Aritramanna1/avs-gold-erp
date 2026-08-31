import { useCallback, useState } from "react";
import { Camera, ImagePlus, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { capturePhoto, capturedPhotoToFile, type CapturedPhoto } from "@/lib/native/camera";
import { toast } from "sonner";

export interface MobileCameraCaptureProps {
  label?: string;
  onUploaded?: (result: { previewUrl: string; fileName: string }) => void;
  /** Caller handles upload — receives File after capture */
  onCapture?: (file: File, previewUrl: string) => Promise<void>;
}

/**
 * First-class mobile camera flow: capture → preview → upload via caller/R2 adapter.
 */
export function MobileCameraCapture({
  label = "Photo",
  onUploaded,
  onCapture,
}: MobileCameraCaptureProps) {
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleCapture = useCallback(async (galleryOnly = false) => {
    try {
      const captured = await capturePhoto({
        rear: true,
        allowGallery: galleryOnly,
      });
      setPhoto(captured);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not capture photo.");
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!photo) return;
    setUploading(true);
    try {
      const file = await capturedPhotoToFile(photo);
      if (onCapture) {
        await onCapture(file, photo.previewUrl);
      }
      onUploaded?.({ previewUrl: photo.previewUrl, fileName: photo.fileName });
      toast.success(`${label} saved.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
      return;
    } finally {
      setUploading(false);
    }
  }, [photo, label, onCapture, onUploaded]);

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {photo ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(null)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {photo ? (
        <div className="space-y-3">
          <img
            src={photo.previewUrl}
            alt="Preview"
            className="w-full max-h-64 object-contain rounded-md border border-border bg-muted/30"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCapture()}>
              <RotateCcw className="h-4 w-4 mr-1" /> Retake
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-gold text-black hover:bg-gold/90"
              disabled={uploading}
              onClick={() => void handleUpload()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Save photo
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-[var(--touch-target)] flex-col gap-1 h-auto py-3"
            onClick={() => void handleCapture(false)}
          >
            <Camera className="h-5 w-5 text-gold" />
            <span className="text-xs">Take photo</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[var(--touch-target)] flex-col gap-1 h-auto py-3"
            onClick={() => void handleCapture(true)}
          >
            <ImagePlus className="h-5 w-5 text-gold" />
            <span className="text-xs">Gallery</span>
          </Button>
        </div>
      )}
    </div>
  );
}
