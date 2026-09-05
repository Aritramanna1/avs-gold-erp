/**
 * Canonical public site URL — set VITE_PUBLIC_APP_URL at build time.
 * Change one env var when moving to a new domain (no code changes).
 */
export function getPublicSiteOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (origin && !/localhost|127\.0\.0\.1/i.test(origin)) return origin;
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured;
  if (origin) return origin;
  return "https://erp.arivahly.in";
}

/** Origin for invite links in email/SMS — never localhost (recipients are external). */
export function getPublicInviteOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured;
  return "https://erp.arivahly.in";
}

export function publicSiteUrl(path = "/"): string {
  const origin = getPublicSiteOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export const PUBLIC_SITE_NAME = "AVS ERP";
export const PUBLIC_SITE_TAGLINE = "Jewellery Ecosystem ERP";
