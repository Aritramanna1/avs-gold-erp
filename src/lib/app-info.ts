/**
 * Single source of truth for AVS Gold ERP product branding — the About
 * dialog, login screen footer, and any future surface that needs the
 * product name/company/copyright should import from here rather than each
 * hardcoding its own copy of the same strings.
 */
import pkg from "../../package.json";

export const APP_NAME = "AVS Gold ERP";
export const APP_TAGLINE = "Powered by Arivahly Venture Sphere";
export const APP_DESCRIPTION = "Professional Jewellery Manufacturing ERP";
export const COMPANY_NAME = "Arivahly Venture Sphere";
export const APP_VERSION = pkg.version;
export const COPYRIGHT = `© ${new Date().getFullYear()} ${COMPANY_NAME}`;
export const SUPPORT_EMAIL = "support@your-domain.com";
export const WEBSITE = "https://your-domain.com";

/**
 * Short initials for print-page titles (e.g. "Print · AVS ERP"), derived from
 * the firm's configured shop name. Falls back to the first 3 letters, then to
 * "ERP", when the name has no space-separated words (or isn't set yet) —
 * used identically across every print route's `head()`, so it lives here
 * once instead of copy-pasted per file.
 */
export function shortShopName(shopName: string | undefined | null): string {
  return (
    shopName
      ?.split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase() ||
    shopName?.slice(0, 3).toUpperCase() ||
    "ERP"
  );
}
