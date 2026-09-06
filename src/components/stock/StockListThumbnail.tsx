import { useState, useEffect } from "react";
import { Package } from "lucide-react";
import { getDirectR2ObjectUrl, getSupabasePublicStorageUrl } from "@/lib/supabase-storage";

export function StockListThumbnail({
  imageStoragePath,
  alt,
}: {
  imageStoragePath?: string;
  alt: string;
}) {
  const [attempt, setAttempt] = useState<"r2" | "supabase" | "broken">("r2");

  useEffect(() => {
    setAttempt("r2");
  }, [imageStoragePath]);

  if (!imageStoragePath || attempt === "broken") {
    return (
      <div className="h-12 w-12 rounded-md border border-border bg-muted/40 grid place-items-center shrink-0">
        <Package className="h-5 w-5 text-muted-foreground/50" />
      </div>
    );
  }

  const cleanPath = imageStoragePath.replace(/^\/+/, "");
  const r2Url = getDirectR2ObjectUrl("stock-assets", cleanPath);
  const supabaseFallbackUrl = getSupabasePublicStorageUrl("stock-assets", cleanPath);
  const currentSrc = attempt === "r2" ? r2Url : supabaseFallbackUrl;

  if (!currentSrc) {
    return (
      <div className="h-12 w-12 rounded-md border border-border bg-muted/40 grid place-items-center shrink-0">
        <Package className="h-5 w-5 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      crossOrigin="anonymous"
      loading="lazy"
      onError={() => {
        if (attempt === "r2" && supabaseFallbackUrl && supabaseFallbackUrl !== r2Url) {
          setAttempt("supabase");
        } else {
          setAttempt("broken");
        }
      }}
      className="h-12 w-12 rounded-md border border-border object-contain bg-background/50 p-0.5 shrink-0"
    />
  );
}
