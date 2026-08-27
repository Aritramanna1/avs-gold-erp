/**
 * Public origin for QR / document share links.
 * Never embed localhost in production builds.
 */
export function isLocalOrDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    );
  } catch {
    return true;
  }
}

/** Known production fallback when env/origin is unsafe in PROD. */
const PRODUCTION_PUBLIC_FALLBACK = "https://maatarajewellers.shop";

/**
 * Canonical public site origin for QR codes and share links.
 * Prefer VITE_PUBLIC_APP_URL; refuse localhost in production builds.
 */
export function getProductionPublicOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "";
  if (configured) {
    if (import.meta.env.PROD && isLocalOrDevOrigin(configured)) {
      console.warn(
        "[public-origin] VITE_PUBLIC_APP_URL is local in production build — using firm public fallback.",
      );
      return PRODUCTION_PUBLIC_FALLBACK;
    }
    return configured;
  }
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (import.meta.env.PROD && isLocalOrDevOrigin(origin)) {
      return PRODUCTION_PUBLIC_FALLBACK;
    }
    return origin;
  }
  return PRODUCTION_PUBLIC_FALLBACK;
}

export function publicDocumentUrl(path: string): string {
  const origin = getProductionPublicOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
