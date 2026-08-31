/**
 * Aurum host map — implement on CVsE73i6 source only.
 * marketing = public + CMS (/platform/website)
 * ERP = firm ERP + Platform Owner management
 * portal = customer / karigar / supplier only
 * maatarajewellers.shop is never a deploy target.
 */

export const CANONICAL_ERP_ORIGIN = "https://aurum.arivahly.in";
export const CANONICAL_PORTAL_ORIGIN = "https://aurumportal.arivahly.in";
export const CANONICAL_MARKETING_ORIGIN = "https://aurum.arivahly.in";

function stripSlash(value: string): string {
  return value.replace(/\/$/, "");
}

/** True when marketing and ERP share one origin (unified Aurum deploy). */
export function isUnifiedAurumOrigin(): boolean {
  return stripSlash(erpOrigin()) === stripSlash(marketingOrigin());
}

function envOrigin(key: "VITE_PUBLIC_APP_URL" | "VITE_PUBLIC_PORTAL_URL" | "VITE_PUBLIC_MARKETING_URL"): string | null {
  const raw = import.meta.env[key]?.trim();
  if (!raw) return null;
  return stripSlash(raw);
}

export function erpOrigin(): string {
  return envOrigin("VITE_PUBLIC_APP_URL") ?? CANONICAL_ERP_ORIGIN;
}

export function portalOrigin(): string {
  return envOrigin("VITE_PUBLIC_PORTAL_URL") ?? CANONICAL_PORTAL_ORIGIN;
}

export function marketingOrigin(): string {
  return envOrigin("VITE_PUBLIC_MARKETING_URL") ?? CANONICAL_MARKETING_ORIGIN;
}

function withPath(origin: string, pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${stripSlash(origin)}${path}`;
}

export function erpAppUrl(pathname: string): string {
  return withPath(erpOrigin(), pathname);
}

export function portalAppUrl(pathname: string): string {
  return withPath(portalOrigin(), pathname);
}

export function marketingAppUrl(pathname: string): string {
  return withPath(marketingOrigin(), pathname);
}

export function isLocalOrDevOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    );
  } catch {
    return false;
  }
}

export function isErpHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "aurum.arivahly.in" || h === "www.aurum.arivahly.in") return true;
  return (
    h === "aurum.erp.arivahly.in" ||
    h === "www.aurum.erp.arivahly.in" ||
    h === "erp.aurum.arivahly.in" ||
    h === "www.erp.aurum.arivahly.in"
  );
}

export function isPortalHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === "aurumportal.arivahly.in" || h === "www.aurumportal.arivahly.in";
}

export function isMarketingHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === "aurum.arivahly.in" || h === "www.aurum.arivahly.in";
}

export function isPlatformCmsPath(pathname: string): boolean {
  return pathname === "/platform/website" || pathname.startsWith("/platform/website/");
}

export function isPlatformManagementPath(pathname: string): boolean {
  if (!pathname.startsWith("/platform")) return false;
  return !isPlatformCmsPath(pathname);
}

const PORTAL_PATH_PREFIXES = [
  "/customer-portal",
  "/karigar-portal",
  "/supplier-portal",
  "/customer-login",
  "/karigar-login",
  "/supplier-login",
];

export function isPortalRolePath(pathname: string): boolean {
  return PORTAL_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isFirmErpLandingPath(pathname: string): boolean {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/mtg" ||
    pathname.startsWith("/mtg/") ||
    pathname.startsWith("/workshop") ||
    pathname.startsWith("/manufacturing") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/stock") ||
    pathname.startsWith("/ledger") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/control") ||
    pathname.startsWith("/catalog")
  );
}

export function isErpEntryPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/trial/start" ||
    pathname === "/request-access" ||
    isFirmErpLandingPath(pathname) ||
    isPlatformManagementPath(pathname)
  );
}

export function isPublicVerifyPath(pathname: string): boolean {
  return pathname === "/verify" || pathname.startsWith("/verify/");
}

export function isPublicDocumentSharePath(pathname: string): boolean {
  return pathname === "/doc" || pathname.startsWith("/doc/");
}

export function crossHostRedirectForPath(pathname: string): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase();
  if (isLocalOrDevOrigin(window.location.origin)) return null;

  const unified = isUnifiedAurumOrigin();

  if (isPublicVerifyPath(pathname) || isPublicDocumentSharePath(pathname)) {
    if (!isMarketingHostname(host) && !isErpHostname(host)) return marketingAppUrl(pathname);
    return null;
  }
  if (isPlatformCmsPath(pathname)) {
    if (!isMarketingHostname(host) && !isErpHostname(host)) return marketingAppUrl(pathname);
    return null;
  }
  if (isPlatformManagementPath(pathname)) {
    if (unified) {
      if (!isErpHostname(host) && !isMarketingHostname(host)) return erpAppUrl(pathname);
      return null;
    }
    if (!isErpHostname(host)) return erpAppUrl(pathname);
    return null;
  }
  if (isPortalRolePath(pathname)) {
    if (!isPortalHostname(host)) return portalAppUrl(pathname);
    return null;
  }
  if (
    isFirmErpLandingPath(pathname) ||
    pathname === "/login" ||
    pathname === "/trial/start" ||
    pathname === "/request-access"
  ) {
    if (unified) {
      if (!isErpHostname(host) && !isMarketingHostname(host)) return erpAppUrl(pathname);
      return null;
    }
    if (!isErpHostname(host)) return erpAppUrl(pathname);
    return null;
  }
  return null;
}
