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

const PORTAL_WORKSPACE_TYPES: WorkspaceType[] = ["customer", "supplier", "karigar"];

export function isPortalWorkspaceType(type: WorkspaceType): boolean {
  return PORTAL_WORKSPACE_TYPES.includes(type);
}

/** Invited portal users (Karigar / Customer / Supplier) — no ERP or trial workspace. */
export function isPortalOnlyContext(ctx: AuthorizationContext): boolean {
  if (ctx.is_platform_owner) return false;
  if (ctx.workspaces.length === 0) return false;
  const hasInternal = ctx.workspaces.some(
    (w) => w.workspace_type === "erp" || w.workspace_type === "ceo" || w.membership_kind === "internal",
  );
  if (hasInternal) return false;
  return ctx.workspaces.some((w) => isPortalWorkspaceType(w.workspace_type));
}

export function portalOnlyHomeRoute(ctx: AuthorizationContext): string | null {
  if (!isPortalOnlyContext(ctx)) return null;
  const active = activeType(ctx);
  if (isPortalWorkspaceType(active)) return workspaceHomeRoute(active);
  const first = ctx.workspaces.find((w) => isPortalWorkspaceType(w.workspace_type));
  return first ? workspaceHomeRoute(first.workspace_type) : null;
}

export function isPortalPath(pathname: string): boolean {
  return (
    isCustomerPortalPath(pathname) ||
    isSupplierPortalPath(pathname) ||
    isKarigarPortalPath(pathname)
  );
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
  return (
    pathname === "/platform" ||
    pathname.startsWith("/platform/") ||
    pathname === "/saas-admin" ||
    pathname.startsWith("/saas-admin/")
  );
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
    pathname === "/request-access" ||
    pathname === "/onboarding" ||
    pathname === "/setup" ||
    pathname === "/login" ||
    pathname === "/verify" ||
    pathname.startsWith("/verify/") ||
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
    return ctx.is_platform_owner;
  }

  // Portal invitees stay in their portal space only — never ERP, CEO, or platform.
  if (isPortalOnlyContext(ctx)) {
    if (isCustomerPortalPath(pathname)) {
      return hasWorkspaceType(ctx, "customer") && activeType(ctx) === "customer";
    }
    if (isSupplierPortalPath(pathname)) {
      return hasWorkspaceType(ctx, "supplier") && activeType(ctx) === "supplier";
    }
    if (isKarigarPortalPath(pathname)) {
      return hasWorkspaceType(ctx, "karigar") && activeType(ctx) === "karigar";
    }
    return false;
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

  if (ctx.is_platform_owner) {
    return false;
  }

  if (isErpPath(pathname) || pathname.startsWith("/dashboard")) {
    if (!hasWorkspaceType(ctx, "erp")) return false;
    return activeType(ctx) === "erp";
  }

  return hasWorkspaceType(ctx, "erp") && activeType(ctx) === "erp";
}

export function pickDefaultRoute(ctx: AuthorizationContext): string {
  if (ctx.is_platform_owner) return "/platform";
  const portalHome = portalOnlyHomeRoute(ctx);
  if (portalHome) return portalHome;
  const active = activeType(ctx);
  if (active === "customer" || active === "supplier" || active === "karigar") {
    return workspaceHomeRoute(active);
  }
  const route = (ctx.default_route || "").trim() || "/app";
  // Marketing / auth URLs must never be treated as a workspace home — AuthGate
  // would navigate to them forever while still classifying the path as public
  // (React #185 max update depth).
  if (
    route === "/" ||
    route.startsWith("/login") ||
    route.startsWith("/pricing") ||
    route.startsWith("/product") ||
    route.startsWith("/workflows") ||
    route.startsWith("/support") ||
    route.startsWith("/solutions") ||
    route.startsWith("/features") ||
    route.startsWith("/about") ||
    route.startsWith("/blog") ||
    route.startsWith("/contact") ||
    route.startsWith("/faq") ||
    route.startsWith("/website") ||
    route.startsWith("/downloads") ||
    route.startsWith("/whats-new") ||
    route.startsWith("/tutorials")
  ) {
    return workspaceHomeRoute(activeType(ctx));
  }
  return route;
}
