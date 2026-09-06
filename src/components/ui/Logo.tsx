import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { useSettings } from "@/lib/settings-store";
import { getAttachmentSignedUrl } from "@/lib/supabase-storage";

interface LogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  /**
   * Whether to use the SVG vector format (best for digital displays/dashboard)
   * or the PNG format (best for certain legacy print formats).
   * Defaults to 'svg'.
   */
  variant?: "svg" | "png";
  alt?: string;
}

// Re-signed slightly inside getAttachmentSignedUrl's own 45-minute cache
// window, so a Logo instance that stays mounted for a whole session (e.g.
// the sidebar) keeps picking up a fresh signed URL before the cached one's
// Refresh the local object URL if the component remains mounted for a long
// hour on every screen and every printed document that renders it.
const REFRESH_INTERVAL_MS = 40 * 60 * 1000;

/**
 * Logo component that renders the dynamic firm logo or default asset.
 */
export function Logo({ variant = "svg", alt, className, ...props }: LogoProps) {
  const { firm } = useSettings();
  const fallbackSrc = variant === "svg" ? "/assets/logo.svg" : "/assets/logo.png";
  const [resolvedSrc, setResolvedSrc] = useState(firm.logoUrl || fallbackSrc);

  useEffect(() => {
    if (!firm.logoStoragePath) {
      setResolvedSrc(firm.logoUrl || fallbackSrc);
      return;
    }
    let cancelled = false;
    const resign = (forceRefresh = false) => {
      getAttachmentSignedUrl("firm-assets", firm.logoStoragePath!, forceRefresh).then((url) => {
        if (!cancelled && url) setResolvedSrc(url);
      });
    };
    resign();
    const interval = setInterval(() => resign(true), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [firm.logoStoragePath, firm.logoUrl, fallbackSrc]);

  const fallbackAlt = firm.shopName || "AVS ERP";

  return (
    <img
      src={resolvedSrc}
      alt={alt || fallbackAlt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (resolvedSrc !== fallbackSrc) {
          setResolvedSrc(fallbackSrc);
        }
      }}
      {...props}
    />
  );
}
