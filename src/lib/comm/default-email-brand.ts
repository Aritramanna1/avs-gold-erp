/**
 * Platform defaults for system / SaaS emails (trial, plan, billing).
 * Email clients need absolute HTTPS image URLs — prefer PNG over SVG.
 */

export const DEFAULT_PLATFORM_APP_ORIGIN = "https://maatarajewellers.shop";

/** Full-colour AVS ERP wordmark suitable for email clients */
export const DEFAULT_EMAIL_LOGO_PATH = "/assets/ornexa-logo-full.png";

export const PLATFORM_EMAIL_BRAND = {
  productName: "AVS ERP",
  productLine: "AVS ERP by Arivahly Venture Sphere",
  supportEmail: "sales@arivahly.in",
  primaryColor: "#0F172A",
  goldAccent: "#C8A24B",
  ink: "#1E293B",
  muted: "#64748B",
} as const;

export function resolvePlatformAppOrigin(explicit?: string | null): string {
  const raw = (explicit || DEFAULT_PLATFORM_APP_ORIGIN).trim();
  return raw.replace(/\/$/, "") || DEFAULT_PLATFORM_APP_ORIGIN;
}

/** Absolute logo URL always — never empty for system mail chrome. */
export function resolvePlatformEmailLogoUrl(opts?: {
  logoUrl?: string | null;
  appOrigin?: string | null;
}): string {
  const custom = (opts?.logoUrl ?? "").trim();
  if (custom.startsWith("https://") || custom.startsWith("http://")) return custom;
  if (custom.startsWith("/")) {
    return `${resolvePlatformAppOrigin(opts?.appOrigin)}${custom}`;
  }
  if (custom) return custom;
  return `${resolvePlatformAppOrigin(opts?.appOrigin)}${DEFAULT_EMAIL_LOGO_PATH}`;
}
