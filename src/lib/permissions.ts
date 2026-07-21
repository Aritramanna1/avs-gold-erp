import { useSettings } from "@/lib/settings-store";
import { useBranch } from "@/lib/branch-store";
import { redirect } from "@tanstack/react-router";

/**
 * Route-level RBAC permission matrix.
 *
 * Roles are matched via string equality to the `role` field stored on each
 * user record in `app_settings.data.users[]`.
 *
 * Hierarchy (highest → lowest):
 *   Super Owner > Administrator > CEO (View Only) > Branch Manager
 *   > Workshop Manager | Retail Staff | Manufacturing Staff | Accountant
 *   > Sales Executive | CRM Executive
 */

export const ROLES = {
  SUPER_OWNER: "Super Owner",
  ADMINISTRATOR: "Administrator",
  CEO: "CEO (View Only)",
  BRANCH_MANAGER: "Branch Manager",
  WORKSHOP_MANAGER: "Workshop Manager",
  RETAIL_STAFF: "Retail Staff",
  MANUFACTURING_STAFF: "Manufacturing Staff",
  ACCOUNTANT: "Accountant",
  SALES_EXECUTIVE: "Sales Executive",
  CRM_EXECUTIVE: "CRM Executive",
} as const;

type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles that bypass every module check. "Owner" is a legacy alias for Super Owner. */
const SUPER_ROLES: string[] = [ROLES.SUPER_OWNER, ROLES.ADMINISTRATOR, "Owner"];

/**
 * Map of route path prefix → roles allowed to navigate to it.
 * A more-specific prefix takes precedence over a shorter one (longest match wins).
 *
 * "All" means every authenticated role is allowed (omit from the map or list
 * explicitly — handled in `hasRoutePermission`).
 */
const ROUTE_ACL: Record<string, Role[]> = {
  "/dashboard/ceo": [ROLES.CEO],
  "/dashboard": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.WORKSHOP_MANAGER,
    ROLES.RETAIL_STAFF,
    ROLES.MANUFACTURING_STAFF,
    ROLES.ACCOUNTANT,
    ROLES.SALES_EXECUTIVE,
    ROLES.CRM_EXECUTIVE,
  ],
  "/orders": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.WORKSHOP_MANAGER,
    ROLES.RETAIL_STAFF,
    ROLES.SALES_EXECUTIVE,
  ],
  "/billing": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.RETAIL_STAFF,
    ROLES.ACCOUNTANT,
  ],
  "/manufacturing": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.WORKSHOP_MANAGER,
    ROLES.MANUFACTURING_STAFF,
  ],
  "/workshop": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.WORKSHOP_MANAGER,
    ROLES.MANUFACTURING_STAFF,
  ],
  "/melt": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.MANUFACTURING_STAFF,
  ],
  "/repair": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.RETAIL_STAFF,
  ],
  "/people": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.ACCOUNTANT,
    ROLES.SALES_EXECUTIVE,
    ROLES.CRM_EXECUTIVE,
  ],
  "/ledger": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.ACCOUNTANT,
  ],
  "/reports": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.ACCOUNTANT,
  ],
  "/attendance": [ROLES.SUPER_OWNER, ROLES.ADMINISTRATOR, ROLES.CEO, ROLES.BRANCH_MANAGER],
  "/stock": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.RETAIL_STAFF,
    ROLES.MANUFACTURING_STAFF,
  ],
  "/catalog": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.RETAIL_STAFF,
    ROLES.MANUFACTURING_STAFF,
  ],
  "/barcode": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.RETAIL_STAFF,
    ROLES.MANUFACTURING_STAFF,
  ],
  "/communications": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.CRM_EXECUTIVE,
  ],
  "/whatsapp": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.CRM_EXECUTIVE,
  ],
  "/expenses": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.ACCOUNTANT,
  ],
  "/settings": [ROLES.SUPER_OWNER, ROLES.ADMINISTRATOR],
  "/branches": [ROLES.SUPER_OWNER, ROLES.ADMINISTRATOR],
  "/invite": [ROLES.SUPER_OWNER, ROLES.ADMINISTRATOR],
  "/hardware": [ROLES.SUPER_OWNER, ROLES.ADMINISTRATOR, ROLES.BRANCH_MANAGER],
  "/help": [
    ROLES.SUPER_OWNER,
    ROLES.ADMINISTRATOR,
    ROLES.CEO,
    ROLES.BRANCH_MANAGER,
    ROLES.WORKSHOP_MANAGER,
    ROLES.RETAIL_STAFF,
    ROLES.MANUFACTURING_STAFF,
    ROLES.ACCOUNTANT,
    ROLES.SALES_EXECUTIVE,
    ROLES.CRM_EXECUTIVE,
  ],
};

/**
 * Returns true if `role` is allowed to navigate to `path`.
 * Super roles bypass all checks. Print/public sub-paths are always allowed
 * because AuthGate already verified the session.
 */
/**
 * Routes restricted to an exact role set, even for super roles. The CEO
 * Dashboard is deliberately CEO-only: owners/admins do not see it. Checked
 * BEFORE the super-role bypass below.
 */
const EXCLUSIVE_ROUTES: Record<string, Role[]> = {
  "/dashboard/ceo": [ROLES.CEO],
};

export function hasRoutePermission(role: string | null | undefined, path: string): boolean {
  if (!role) return false;

  // The first setup account is the Super Owner and is never constrained by a
  // route ACL, including routes that are exclusive for ordinary roles.
  if (role === ROLES.SUPER_OWNER || role === "Owner") return true;

  for (const prefix of Object.keys(EXCLUSIVE_ROUTES)) {
    if (path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")) {
      return (EXCLUSIVE_ROUTES[prefix] as string[]).includes(role);
    }
  }

  if (SUPER_ROLES.includes(role)) return true;

  // Planned manufacturing entries intentionally remain navigable so their
  // professional Coming Soon pages are visible instead of hidden or disabled.
  if (path === "/coming-soon" || path.startsWith("/coming-soon/")) return true;

  // Find the longest matching prefix
  const prefixes = Object.keys(ROUTE_ACL).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")) {
      return (ROUTE_ACL[prefix] as string[]).includes(role);
    }
  }

  // Root/index — allow all authenticated users
  if (path === "/" || path === "") return true;

  // First-Time Setup — must stay reachable by every authenticated role, not
  // just super-roles. index.tsx hard-redirects "/" -> "/setup" when the firm
  // isn't configured yet; without this, a non-super-role's first login would
  // loop forever (guardRoute denies /setup -> bounces to "/" -> "/" redirects
  // back to /setup -> denied again).
  if (path === "/setup" || path.startsWith("/setup/") || path.startsWith("/setup?")) return true;

  // Unknown routes — deny
  return false;
}

/** Write permissions: CEO is view-only; all other non-super roles can write in their modules. */
export function canWrite(role: string | null | undefined): boolean {
  if (!role) return false;
  return role !== ROLES.CEO;
}

/** Admin-only operations (user management, settings, branches). */
export function canAdmin(role: string | null | undefined): boolean {
  if (!role) return false;
  return SUPER_ROLES.includes(role);
}

/**
 * Branch isolation (SAD §7). A user may only reach the branch assigned to
 * them; super roles (Owner/Administrator/Super Owner) reach every branch.
 * Call once per session — on login and on session restore — so every
 * branch-scoped store query is filtered by the branches this user may see.
 */
export function applyUserBranchAccess(user: {
  role: string;
  branchId: string | null;
  isSuperOwner?: boolean;
}): void {
  const global = !!user.isSuperOwner || SUPER_ROLES.includes(user.role);
  const ids = global ? [] : user.branchId ? [user.branchId] : [];
  useBranch.getState().setAccessible(ids, [], global);
}

/** Returns a human-readable label for a role, with the highest privilege noted. */
export function roleLabel(role: string): string {
  return role;
}

/**
 * Throws a TanStack Router redirect to "/" when the current user's role does
 * not have permission for `pathname`. Import and call this in `beforeLoad`.
 *
 * Uses dynamic require to avoid circular-import issues between router and stores.
 *
 * IMPORTANT: `beforeLoad` runs as soon as the router resolves the URL, which
 * happens independently of (and typically before) AuthGate's async session
 * check finishes hydrating `currentUserRole`. On a fresh page load/reload,
 * `currentUserRole` is briefly `null` even for a fully authorized user — if
 * this function treated that as "denied", every deep link/reload/bookmark to
 * a protected route would bounce to the dashboard before the role ever had a
 * chance to load. AuthGate is the real authorization boundary (it forcibly
 * signs out and shows the login screen for any account that isn't allowed),
 * so this guard only needs to act once a role is actually known — a null
 * role here means "not resolved yet", not "denied".
 */
export function guardRoute(pathname: string): void {
  const role: string | null = useSettings.getState().currentUserRole;
  if (role !== null && !hasRoutePermission(role, pathname)) {
    throw redirect({ to: "/" });
  }
}
