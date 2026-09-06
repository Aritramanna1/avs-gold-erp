import { useState, useEffect } from "react";
import { ImageIcon } from "lucide-react";
import { getDirectR2ObjectUrl } from "@/lib/supabase-storage";

/**
 * Renders an image exclusively from Cloudflare R2 Object Storage with resilient error fallback.
 * Zero Supabase Storage egress/dependencies.
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
  const [isBroken, setIsBroken] = useState(false);

  useEffect(() => {
    setIsBroken(false);
  }, [bucket, storagePath]);

  if (!storagePath || isBroken) {
    return (
      <div className={fallbackClassName}>
        <ImageIcon className="h-6 w-6 opacity-30" />
      </div>
    );
  }

  const cleanPath = storagePath.replace(/^\/+/, "");
  const r2Url = getDirectR2ObjectUrl(bucket, cleanPath);

  if (!r2Url) {
    return (
      <div className={fallbackClassName}>
        <ImageIcon className="h-6 w-6 opacity-30" />
      </div>
    );
  }

  return (
    <img
      src={r2Url}
      alt={alt}
      className={className}
      crossOrigin="anonymous"
      loading="lazy"
      onError={() => {
        setIsBroken(true);
      }}
    />
  );
}
