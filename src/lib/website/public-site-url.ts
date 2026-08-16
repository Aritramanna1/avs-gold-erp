/**
 * Canonical public site URL — set VITE_PUBLIC_APP_URL at build time.
 * Change one env var when moving to a new domain (no code changes).
 */
export function getPublicSiteOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "https://maatarajewellers.shop";
}

export function publicSiteUrl(path = "/"): string {
  const origin = getPublicSiteOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export const PUBLIC_SITE_NAME = "Ornexa";
export const PUBLIC_SITE_TAGLINE = "Jewellery Ecosystem ERP";
