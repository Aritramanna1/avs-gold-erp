import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { getDirectR2ObjectUrl } from "@/lib/supabase-storage";

/**
 * Renders an image from Cloudflare R2 via the storage proxy.
 * Resolves persistent, direct URLs with instant loading and resilient error fallback.
 */
export function R2ObjectImage({
  bucket,
  storagePath,
  alt,
  className = "object-contain max-w-full max-h-full m-auto",
  fallbackClassName = "w-full h-full grid place-items-center text-muted-foreground",
}: {
  bucket: string;
  storagePath?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!storagePath || broken) {
    return (
      <div className={fallbackClassName}>
        <ImageIcon className="h-6 w-6 opacity-30" />
      </div>
    );
  }

  const resolvedUrl = getDirectR2ObjectUrl(bucket, storagePath);
  if (!resolvedUrl) {
    return (
      <div className={fallbackClassName}>
        <ImageIcon className="h-6 w-6 opacity-30" />
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className={className}
      crossOrigin="anonymous"
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}
