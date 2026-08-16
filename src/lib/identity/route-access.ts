import type { AuthorizationContext, WorkspaceType } from "@/lib/identity/authorization-types";

const ERP_PREFIXES = [
  "/app",
  "/people",
  "/orders",
  "/workshop",
  "/manufacturing",
  "/stock",
  "/billing",
  "/ledger",
  "/reports",
  "/settings",
  "/control",
  "/treasury",
  "/communications",
  "/whatsapp",
  "/hardware",
  "/help",
  "/branches",
  "/expenses",
  "/attendance",
  "/catalog",
  "/barcode",
  "/conversion",
  "/melt",
  "/refinery",
  "/repair",
  "/assistant",
];

function hasWorkspaceType(ctx: AuthorizationContext, type: WorkspaceType): boolean {
  return ctx.workspaces.some((w) => w.workspace_type === type);
}

function activeType(ctx: AuthorizationContext): WorkspaceType {
  return ctx.active_workspace?.workspace_type ?? "erp";
}

export function workspaceHomeRoute(type: WorkspaceType): string {
  switch (type) {
    case "platform":
      return "/platform";
    case "ceo":
      return "/dashboard/ceo";
    case "customer":
      return "/customer-portal";
    case "supplier":
      return "/supplier-portal";
    case "karigar":
      return "/karigar-portal";
    default:
      return "/app";
  }
}

export function isErpPath(pathname: string): boolean {
  if (pathname === "/app" || pathname.startsWith("/app/")) return true;
  return ERP_PREFIXES.filter((p) => p !== "/app").some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isPlatformPath(pathname: string): boolean {
  return pathname === "/platform" || pathname.startsWith("/platform/");
}

export function isCustomerPortalPath(pathname: string): boolean {
  return pathname === "/customer-portal" || pathname.startsWith("/customer-portal/");
}

export function isSupplierPortalPath(pathname: string): boolean {
  return pathname === "/supplier-portal" || pathname.startsWith("/supplier-portal/");
}

export function isKarigarPortalPath(pathname: string): boolean {
  return pathname === "/karigar-portal" || pathname.startsWith("/karigar-portal/");
}

export function isCeoPath(pathname: string): boolean {
  return pathname === "/dashboard/ceo" || pathname.startsWith("/dashboard/ceo/");
}

/** Public auth pages — no authorization context required. */
export function isPublicAuthPath(pathname: string): boolean {
  return (
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/auth/callback" ||
    pathname === "/otp-login" ||
    pathname.startsWith("/invite") ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/trial/start" ||
    pathname === "/login" ||
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/doc/")
  );
}

/** Legacy portal login URLs redirect to unified login (handled in routes). */
export function isLegacyPortalLoginPath(pathname: string): boolean {
  return (
    pathname === "/customer-login" ||
    pathname === "/supplier-login" ||
    pathname === "/karigar-login"
  );
}

/**
 * Server-backed authorization matrix for route mounting.
 * Returns false → render 404 (do not leak route existence via redirects).
 */
export function canAccessPath(ctx: AuthorizationContext | null, pathname: string): boolean {
  if (!ctx) return false;
  if (isPublicAuthPath(pathname) || isLegacyPortalLoginPath(pathname)) return true;

  if (isPlatformPath(pathname)) {
    return ctx.is_platform_owner && activeType(ctx) === "platform";
  }

  if (isCustomerPortalPath(pathname)) {
    return hasWorkspaceType(ctx, "customer") && activeType(ctx) === "customer";
  }
  if (isSupplierPortalPath(pathname)) {
    return hasWorkspaceType(ctx, "supplier") && activeType(ctx) === "supplier";
  }
  if (isKarigarPortalPath(pathname)) {
    return hasWorkspaceType(ctx, "karigar") && activeType(ctx) === "karigar";
  }
  if (isCeoPath(pathname)) {
    return hasWorkspaceType(ctx, "ceo") && activeType(ctx) === "ceo";
  }

  if (isErpPath(pathname) || pathname.startsWith("/dashboard")) {
    if (ctx.is_platform_owner && activeType(ctx) === "platform") return false;
    if (!hasWorkspaceType(ctx, "erp")) return false;
    return activeType(ctx) === "erp";
  }

  // Platform owners off-platform console: block tenant data routes
  if (ctx.is_platform_owner && activeType(ctx) === "platform") {
    return false;
  }

  return hasWorkspaceType(ctx, "erp") && activeType(ctx) === "erp";
}

export function pickDefaultRoute(ctx: AuthorizationContext): string {
  if (ctx.is_platform_owner) {
    const onlyPlatform =
      ctx.workspaces.length === 1 && ctx.workspaces[0]?.workspace_type === "platform";
    if (onlyPlatform || !ctx.workspaces.some((w) => w.workspace_type === "erp")) {
      return "/platform";
    }
  }
  return ctx.default_route || "/app";
}
