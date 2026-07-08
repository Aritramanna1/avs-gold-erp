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
