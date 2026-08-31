import { currentAppSurface } from "@/lib/app-surface";
import { erpOrigin, portalOrigin } from "@/lib/public-origin";

/** Canonical public URL for Supabase Auth redirects (OAuth + email links). */
export function getAuthRedirectUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const surface = currentAppSurface();
  const envKey =
    surface === "portal" ? "VITE_PUBLIC_PORTAL_URL" : "VITE_PUBLIC_APP_URL";
  const configured = import.meta.env[envKey]?.trim().replace(/\/$/, "");
  const fallback =
    surface === "portal"
      ? portalOrigin()
      : surface === "marketing"
        ? import.meta.env.VITE_PUBLIC_MARKETING_URL?.trim().replace(/\/$/, "") ||
          window.location.origin
        : erpOrigin();
  const base = configured || fallback || window.location.origin;
  return `${base.replace(/\/$/, "")}${normalized}`;
}
