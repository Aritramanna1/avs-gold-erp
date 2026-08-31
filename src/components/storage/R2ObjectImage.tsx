import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { getAttachmentSignedUrl } from "@/lib/supabase-storage";

/**
 * Renders an image from Cloudflare R2 via the authenticated storage proxy.
 * Replaces legacy Supabase Storage `getPublicUrl()` calls.
 */
export function R2ObjectImage({
  bucket,
  storagePath,
  alt,
  className = "object-cover w-full h-full",
  fallbackClassName = "w-full h-full grid place-items-center text-muted-foreground",
}: {
  bucket: string;
  storagePath?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!storagePath);

  useEffect(() => {
    let cancelled = false;
    if (!storagePath) {
      setUrl(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void getAttachmentSignedUrl(bucket, storagePath)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, storagePath]);

  if (!storagePath || (!url && !loading)) {
    return (
      <div className={fallbackClassName}>
        <ImageIcon className="h-6 w-6 opacity-30" />
      </div>
    );
  }

  if (loading && !url) {
    return <div className={fallbackClassName} />;
  }

  return <img src={url ?? undefined} alt={alt} className={className} />;
}
