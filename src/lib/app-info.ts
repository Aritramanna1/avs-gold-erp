/**
 * Single source of truth for AVS ERP product branding — About dialog,
 * login footer, page titles, print/email fallbacks. Import from here;
 * do not hardcode product names in UI.
 */
import pkg from "../../package.json";

export const APP_NAME = "AVS ERP";
export const APP_TAGLINE = "Jewellery Ecosystem";
export const APP_DESCRIPTION = "Jewellery manufacturing ERP";
export const APP_PARENT_ATTRIBUTION = "A product by AVS — Arivahly Venture Sphere";
export const COMPANY_NAME = "Arivahly Venture Sphere";
export const APP_VERSION = pkg.version;
export const COPYRIGHT = `© ${new Date().getFullYear()} ${COMPANY_NAME}`;
export const SUPPORT_EMAIL = "";
export const WEBSITE = "https://arivahly.in/";

/** Browser / document title: `Dashboard · AVS ERP` */
export function pageTitle(section?: string | null): string {
  const s = section?.trim();
  return s ? `${s} · ${APP_NAME}` : APP_NAME;
}

/**
 * Short initials for print-page titles, derived from the firm's shop name.
 * Falls back to "ERP" when unset.
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
