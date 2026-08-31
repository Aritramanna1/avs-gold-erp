import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { getAttachmentSignedUrl } from "@/lib/supabase-storage";

export function StockListThumbnail({
  imageStoragePath,
  alt,
}: {
  imageStoragePath?: string;
  alt: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!imageStoragePath) {
      setUrl(null);
      return;
    }
    void getAttachmentSignedUrl("stock-assets", imageStoragePath).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [imageStoragePath]);

  if (!url) {
    return (
      <div className="h-12 w-12 rounded-md border border-border bg-muted/40 grid place-items-center shrink-0">
        <Package className="h-5 w-5 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className="h-12 w-12 rounded-md border border-border object-cover shrink-0"
    />
  );
}
