/**
 * Build-time app surface — marketing | erp | portal.
 * VITE_APP_SURFACE is set per dist in scripts/build-surfaces.mjs.
 */
import {
  isErpEntryPath,
  isFirmErpLandingPath,
  isPlatformCmsPath,
  isPlatformManagementPath,
  isPortalRolePath,
} from "@/lib/public-origin";

export type AppSurface = "marketing" | "erp" | "portal" | "aurum";

const MARKETING_PUBLIC_PREFIXES = [
  "/about",
  "/contact",
  "/pricing",
  "/features",
  "/downloads",
  "/legal",
  "/privacy",
  "/terms",
  "/verify",
  "/doc",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/otp-login",
  "/trial/start",
  "/request-access",
];

const MARKETING_EXACT = new Set([
  "/",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/otp-login",
  "/verify",
  "/privacy",
  "/terms",
  "/trial/start",
  "/request-access",
]);

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function currentAppSurface(): AppSurface {
  const raw = import.meta.env.VITE_APP_SURFACE?.trim().toLowerCase();
  if (raw === "marketing" || raw === "erp" || raw === "portal" || raw === "aurum") return raw;
  return "erp";
}

export function surfaceDefaultPath(surface: AppSurface = currentAppSurface()): string {
  switch (surface) {
    case "marketing":
    case "aurum":
      return "/";
    case "portal":
      return "/";
    case "erp":
    default:
      return "/login";
  }
}

export function isMarketingSurfacePath(pathname: string): boolean {
  if (MARKETING_EXACT.has(pathname)) return true;
  if (isPlatformCmsPath(pathname)) return true;
  if (matchesPrefix(pathname, MARKETING_PUBLIC_PREFIXES)) return true;
  if (pathname.startsWith("/invite") && pathname !== "/invite/accept") return true;
  return false;
}

export function isErpSurfacePath(pathname: string): boolean {
  if (isErpEntryPath(pathname)) return true;
  if (pathname.includes("/print") || pathname.includes("-print")) return true;
  if (pathname.startsWith("/workshop/receive-slip/") || pathname.startsWith("/workshop/filings-slip/"))
    return true;
  if (pathname.startsWith("/mobile")) return true;
  if (pathname.startsWith("/mtg")) return true;
  return false;
}

export function isPortalSurfacePath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/auth/callback" || pathname.startsWith("/auth/callback")) return true;
  if (pathname === "/otp-login") return true;
  if (isPortalRolePath(pathname)) return true;
  if (pathname === "/invite/accept" || pathname.startsWith("/invite/accept")) return true;
  return false;
}

export function isRouteAllowedOnSurface(
  pathname: string,
  surface: AppSurface = currentAppSurface(),
): boolean {
  switch (surface) {
    case "aurum":
      return isMarketingSurfacePath(pathname) || isErpSurfacePath(pathname);
    case "marketing":
      return isMarketingSurfacePath(pathname);
    case "erp":
      return isErpSurfacePath(pathname);
    case "portal":
      return isPortalSurfacePath(pathname);
    default:
      return true;
  }
}
