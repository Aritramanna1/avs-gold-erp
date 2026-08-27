/**
 * Canonical public site URL — set VITE_PUBLIC_APP_URL at build time.
 * Change one env var when moving to a new domain (no code changes).
 * Production builds never emit localhost for public links.
 */
import { getProductionPublicOrigin } from "@/lib/public-origin";

export function getPublicSiteOrigin(): string {
  return getProductionPublicOrigin();
}

export function publicSiteUrl(path = "/"): string {
  const origin = getPublicSiteOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export const PUBLIC_SITE_NAME = "AVS ERP";
export const PUBLIC_SITE_TAGLINE = "Jewellery Manufacturing ERP";
