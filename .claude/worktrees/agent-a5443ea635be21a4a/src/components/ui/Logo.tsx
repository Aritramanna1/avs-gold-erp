import type { ImgHTMLAttributes } from "react";
import { useSettings } from "@/lib/settings-store";

interface LogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  /**
   * Whether to use the SVG vector format (best for digital displays/dashboard)
   * or the PNG format (best for certain legacy print formats).
   * Defaults to 'svg'.
   */
  variant?: "svg" | "png";
  alt?: string;
}

/**
 * Logo component that renders the dynamic firm logo or default asset.
 */
export function Logo({ variant = "svg", alt, className, ...props }: LogoProps) {
  const { firm } = useSettings();
  const src = firm.logoUrl || (variant === "svg" ? "/assets/logo.svg" : "/assets/logo.png");
  const fallbackAlt = firm.shopName || "Jewellery ERP";

  return (
    <img
      src={src}
      alt={alt || fallbackAlt}
      className={className}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
}
