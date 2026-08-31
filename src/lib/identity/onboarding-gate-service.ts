/**
 * Assisted setup (/onboarding) runs once per tenant — first login only.
 * Completion is persisted in app_settings.firm.assisted_setup_completed_at.
 */
import { useSettings } from "@/lib/settings-store";
import { usePeople } from "@/lib/people-store";
import { useOrders } from "@/lib/orders-store";
import { isAdminLikeRole } from "@/lib/role-resolution";
import { isErpPath, isPlatformPath, isPortalPath } from "@/lib/identity/route-access";

const EXEMPT_PATHS = new Set(["/onboarding", "/setup", "/request-access", "/trial/start"]);

export function isOnboardingExemptPath(pathname: string): boolean {
  if (EXEMPT_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/trial/")) return true;
  if (isPublicAuthPath(pathname)) return true;
  return false;
}

function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/invite/") ||
    pathname === "/otp-login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  );
}

/** Server-persisted flag — authoritative for "onboarding already done". */
export function hasAssistedSetupCompleted(): boolean {
  const firm = useSettings.getState().firm;
  if (firm.assisted_setup_completed_at) return true;
  const mig = firm.tenant_migration_status;
  if (mig && mig !== "NOT_STARTED") return true;
  return false;
}

/** Tenants with live operational data completed onboarding implicitly. */
export function isEstablishedWorkshopTenant(): boolean {
  if (hasAssistedSetupCompleted()) return true;
  if (usePeople.getState().people.length > 0) return true;
  if (useOrders.getState().orders.length > 0) return true;
  return false;
}

export function markAssistedSetupComplete(): void {
  if (hasAssistedSetupCompleted()) return;
  const ts = new Date().toISOString();
  useSettings.getState().setFirm({ assisted_setup_completed_at: ts });
}

/** ERP owners/admins only — invited staff skip the firm setup wizard. */
export function canRunAssistedSetup(role: string | null | undefined): boolean {
  return isAdminLikeRole(role ?? "");
}

/**
 * True when an authenticated ERP user should be sent to /onboarding once.
 * Call only after critical + background boot (people/orders loaded).
 */
export function shouldRedirectToAssistedSetup(pathname: string, role: string | null | undefined): boolean {
  if (isOnboardingExemptPath(pathname)) return false;
  if (isPlatformPath(pathname) || isPortalPath(pathname)) return false;
  if (!isErpPath(pathname) && pathname !== "/app" && pathname !== "/") return false;
  if (!canRunAssistedSetup(role)) return false;
  if (isEstablishedWorkshopTenant()) return false;
  return true;
}
