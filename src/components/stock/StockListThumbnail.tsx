import { useState } from "react";
import { Package } from "lucide-react";
import { getDirectR2ObjectUrl } from "@/lib/supabase-storage";

export function StockListThumbnail({
  imageStoragePath,
  alt,
}: {
  imageStoragePath?: string;
  alt: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!imageStoragePath || broken) {
    return (
      <div className="h-12 w-12 rounded-md border border-border bg-muted/40 grid place-items-center shrink-0">
        <Package className="h-5 w-5 text-muted-foreground/50" />
      </div>
    );
  }

  const url = getDirectR2ObjectUrl("stock-assets", imageStoragePath);
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
      crossOrigin="anonymous"
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-12 w-12 rounded-md border border-border object-contain bg-background/50 p-0.5 shrink-0"
    />
  );
}
