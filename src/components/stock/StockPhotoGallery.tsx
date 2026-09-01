import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAttachments,
  getAttachmentUrl,
  invalidateAttachmentUrl,
  type AttachmentEntityType,
} from "@/lib/attachments-store";
import { useStock } from "@/lib/stock-store";
import { toast } from "sonner";

const ENTITY_TYPE: AttachmentEntityType = "stock";
const PHOTO_PREFIX = "product_photo_";

function isProductPhotoKey(docKey: string): boolean {
  return docKey.startsWith(PHOTO_PREFIX);
}

type PhotoEntry = {
  docKey: string;
  thumbnail?: string;
  fileName?: string;
};

export function StockPhotoGallery({ stockId }: { stockId: string }) {
  const listForEntity = useAttachments((s) => s.listForEntity);
  const saveWithFile = useAttachments((s) => s.saveWithFile);
  const clear = useAttachments((s) => s.clear);
  const updateStock = useStock((s) => s.update);
  const primaryImagePath = useStock((s) => s.items.find((i) => i.id === stockId)?.imageStoragePath);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const photos: PhotoEntry[] = useMemo(() => {
    return listForEntity(ENTITY_TYPE, stockId)
      .filter(({ docKey, rec }) => isProductPhotoKey(docKey) && rec.filed)
      .map(({ docKey, rec }) => ({
        docKey,
        thumbnail: rec.thumbnailDataUrl,
        fileName: rec.fileName,
      }))
      .sort((a, b) => a.docKey.localeCompare(b.docKey));
  }, [listForEntity, stockId]);

  const loadPreviews = useCallback(async () => {
    const next: Record<string, string> = {};
    for (const photo of photos) {
      const url = await getAttachmentUrl(ENTITY_TYPE, stockId, photo.docKey);
      if (url) next[photo.docKey] = url;
    }
    setPreviewUrls(next);
  }, [photos, stockId]);

  useEffect(() => {
    void loadPreviews();
  }, [loadPreviews]);

  async function syncPrimaryImage(path: string | undefined) {
    await updateStock(stockId, { imageStoragePath: path });
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      let primaryPath: string | undefined;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        const docKey = `${PHOTO_PREFIX}${crypto.randomUUID()}`;
        const saved = await saveWithFile(ENTITY_TYPE, stockId, docKey, file, {
          filed: true,
          note: "Ready stock product photo",
        });
        if (!primaryPath && saved.storagePath) primaryPath = saved.storagePath;
      }
      if (primaryPath) {
        const item = useStock.getState().items.find((i) => i.id === stockId);
        if (!item?.imageStoragePath) await syncPrimaryImage(primaryPath);
      }
      await loadPreviews();
      toast.success("Photo(s) uploaded to secure storage");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(docKey: string) {
    const rec = useAttachments.getState().get(ENTITY_TYPE, stockId, docKey);
    clear(ENTITY_TYPE, stockId, docKey);
    invalidateAttachmentUrl(ENTITY_TYPE, stockId, docKey);
    const item = useStock.getState().items.find((i) => i.id === stockId);
    if (item?.imageStoragePath && rec?.storagePath === item.imageStoragePath) {
      const remaining = listForEntity(ENTITY_TYPE, stockId).find(
        ({ docKey: k, rec: r }) => isProductPhotoKey(k) && k !== docKey && r.filed && r.storagePath,
      );
      await syncPrimaryImage(remaining?.rec.storagePath);
    }
    setPreviewUrls((prev) => {
      const next = { ...prev };
      delete next[docKey];
      return next;
    });
    toast.success("Photo removed");
  }

  async function handleSetPrimary(docKey: string) {
    const rec = useAttachments.getState().get(ENTITY_TYPE, stockId, docKey);
    if (!rec?.storagePath) return;
    await syncPrimaryImage(rec.storagePath);
    toast.success("Primary thumbnail updated");
  }

  return (
    <div
      data-testid="stock-photo-gallery"
      className="rounded-md border border-border bg-card p-5 space-y-4"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-gold" />
          <h3 className="font-serif text-lg text-gold">Product Photos</h3>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Add photos
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Images are stored in Cloudflare R2 via the central storage adapter. Upload one or many
        product photos for tags, billing, and catalog display.
      </p>

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-border bg-background/30 p-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-gold/40 hover:bg-gold/5 transition"
        >
          <ImagePlus className="h-8 w-8 opacity-40" />
          <span className="text-sm">No product photos yet — click to upload</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo) => {
            const src = previewUrls[photo.docKey] ?? photo.thumbnail;
            const rec = useAttachments.getState().get(ENTITY_TYPE, stockId, photo.docKey);
            const isPrimary = !!primaryImagePath && rec?.storagePath === primaryImagePath;
            return (
              <div
                key={photo.docKey}
                className="group relative aspect-square rounded-lg border border-border overflow-hidden bg-muted/30"
              >
                {src ? (
                  <img
                    src={src}
                    alt={photo.fileName ?? "Product"}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                  {!isPrimary && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      title="Set as primary thumbnail"
                      onClick={() => void handleSetPrimary(photo.docKey)}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-7 w-7 ml-auto"
                    title="Delete photo"
                    onClick={() => void handleDelete(photo.docKey)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {isPrimary && (
                  <span className="absolute top-1.5 left-1.5 rounded bg-gold/90 text-[9px] font-semibold px-1.5 py-0.5 text-background">
                    Primary
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
