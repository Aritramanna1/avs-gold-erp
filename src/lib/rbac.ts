/**
 * Role-based access control for AVS ERP.
 *
 * Roles come from public.user_roles (Supabase). The login wall in
 * <AuthGate> already blocks anonymous users from every route â€” RBAC layers
 * fine-grained action gates on top of that wall and DB RLS.
 */
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";
import { displayRoleToAppRoles, fetchAuthoritativeUserRole } from "@/lib/role-resolution";

export type AppRole =
  | "saas_admin" // Platform control-plane administrator; never a company role
  | "super_owner" // Platform administrator â€” unrestricted access to all companies, branches, system settings
  | "owner"
  | "manager"
  | "billing"
  | "vault"
  | "workshop"
  | "accountant"
  | "viewer";

export type Action =
  | "dashboard.view"
  | "dashboard.edit"
  | "customers.view"
  | "customers.create"
  | "customers.edit"
  | "customers.delete"
  | "orders.view"
  | "orders.create"
  | "orders.edit"
  | "orders.delete"
  | "billing.view"
  | "billing.create"
  | "billing.recordPayment"
  | "billing.delete"
  | "billing.print"
  | "goldLedger.view"
  | "goldLedger.create"
  | "goldLedger.edit"
  | "workerSalary.view"
  | "workerSalary.create"
  | "workerSalary.edit"
  | "reports.view"
  | "reports.export"
  | "settings.view"
  | "settings.edit"
  | "userManagement.view"
  | "userManagement.edit";

const MATRIX: Record<Action, AppRole[]> = {
  "dashboard.view": ["owner", "manager", "billing", "vault", "workshop", "accountant", "viewer"],
  "dashboard.edit": ["owner", "manager"],
  "customers.view": ["owner", "manager", "billing", "accountant", "viewer"],
  "customers.create": ["owner", "manager", "billing"],
  "customers.edit": ["owner", "manager", "billing"],
  "customers.delete": ["owner", "manager"],
  "orders.view": ["owner", "manager", "billing", "workshop", "accountant", "viewer"],
  "orders.create": ["owner", "manager", "billing"],
  "orders.edit": ["owner", "manager", "billing", "workshop"],
  "orders.delete": ["owner", "manager"],
  "billing.view": ["owner", "manager", "billing", "accountant", "viewer"],
  "billing.create": ["owner", "manager", "billing"],
  "billing.recordPayment": ["owner", "manager", "billing", "accountant"],
  "billing.delete": ["owner", "manager"],
  "billing.print": ["owner", "manager", "billing", "accountant", "viewer"],
  "goldLedger.view": ["owner", "manager", "vault", "accountant", "viewer"],
  "goldLedger.create": ["owner", "manager", "vault"],
  "goldLedger.edit": ["owner", "manager", "vault"],
  "workerSalary.view": ["owner", "manager", "accountant", "viewer"],
  "workerSalary.create": ["owner", "manager", "accountant"],
  "workerSalary.edit": ["owner", "manager", "accountant"],
  "reports.view": ["owner", "manager", "accountant", "viewer"],
  "reports.export": ["owner", "manager", "accountant"],
  "settings.view": ["owner", "manager", "viewer"],
  "settings.edit": ["owner", "manager"],
  "userManagement.view": ["owner", "manager"],
  "userManagement.edit": ["owner"],
};

export function can(roles: AppRole[] | readonly string[], action: Action): boolean {
  // Super Owner bypasses all permission checks
  if (roles.includes("super_owner")) return true;
  const allowed = MATRIX[action];
  return roles.some((r) => allowed.includes(r as AppRole));
}

/** Live roles for the currently signed-in user. Cached across remounts for instant gates. */
type RolesCache = {
  userId: string | null;
  roles: AppRole[];
  email: string | null;
  ready: boolean;
  fetchedAt: number;
};

const ROLES_TTL_MS = 5 * 60_000;
let rolesCache: RolesCache | null = null;
const rolesListeners = new Set<() => void>();

function notifyRolesListeners() {
  rolesListeners.forEach((fn) => fn());
}

export function invalidateRolesCache(): void {
  rolesCache = null;
  notifyRolesListeners();
}

function hydrateRolesFromSettings(): AppRole[] {
  const settingsRole = useSettings.getState().currentUserRole;
  if (!settingsRole) return [];
  return displayRoleToAppRoles(settingsRole);
}

export function useRoles(): { roles: AppRole[]; email: string | null; ready: boolean } {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    rolesListeners.add(bump);
    return () => {
      rolesListeners.delete(bump);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(force = false) {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      const userId = user?.id || null;
      const userEmail = user?.email || null;

      if (!userId) {
        rolesCache = {
          userId: null,
          roles: [],
          email: null,
          ready: true,
          fetchedAt: Date.now(),
        };
        if (!cancelled) notifyRolesListeners();
        return;
      }

      const cacheHit =
        rolesCache &&
        rolesCache.userId === userId &&
        rolesCache.ready &&
        Date.now() - rolesCache.fetchedAt < ROLES_TTL_MS;

      // Instant: AuthGate already stamped currentUserRole into settings.
      if (!force && (!rolesCache || rolesCache.userId !== userId || !rolesCache.ready)) {
        const seed = hydrateRolesFromSettings();
        if (seed.length > 0) {
          rolesCache = {
            userId,
            roles: seed,
            email: userEmail,
            ready: true,
            fetchedAt: Date.now(),
          };
          if (!cancelled) notifyRolesListeners();
        }
      }

      if (cacheHit && !force) {
        // Soft background refresh — do not flip ready=false.
        void refreshAuthoritative(userId, userEmail);
        return;
      }

      await refreshAuthoritative(userId, userEmail);
    }

    async function refreshAuthoritative(userId: string, userEmail: string | null) {
      const finalRoles = new Set<AppRole>();
      const profileRole = await fetchAuthoritativeUserRole(userId, userEmail ?? "");
      const settingsRole = useSettings.getState().currentUserRole;
      const displayRole = profileRole ?? settingsRole;
      if (displayRole) {
        displayRoleToAppRoles(displayRole).forEach((r) => finalRoles.add(r));
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        if (error) {
          console.error("[useRoles] user_roles query returned error:", error);
        } else if (data) {
          data.forEach((row) => {
            const mapped = displayRoleToAppRoles(String(row.role));
            if (mapped.length) mapped.forEach((r) => finalRoles.add(r));
            else finalRoles.add(row.role as AppRole);
          });
        }
      } catch (err) {
        console.error("[useRoles] user_roles query threw exception:", err);
      }

      if (cancelled) return;
      rolesCache = {
        userId,
        roles: finalRoles.size > 0 ? [...finalRoles] : hydrateRolesFromSettings(),
        email: userEmail,
        ready: true,
        fetchedAt: Date.now(),
      };
      notifyRolesListeners();
    }

    void load();

    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === "TOKEN_REFRESHED") return;
      if (evt === "SIGNED_IN" || evt === "SIGNED_OUT" || evt === "USER_UPDATED") {
        rolesCache = null;
        void load(true);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  void tick;

  if (rolesCache?.ready) {
    return { roles: rolesCache.roles, email: rolesCache.email, ready: true };
  }

  // Synchronous seed from AuthGate settings so RequireAction is nearly instant.
  const seed = hydrateRolesFromSettings();
  if (seed.length > 0) {
    return { roles: seed, email: rolesCache?.email ?? null, ready: true };
  }

  return { roles: [], email: null, ready: false };
}

/** Convenience hook returning a `can()` checker bound to the current user. */
export function useCan(): {
  can: (a: Action) => boolean;
  ready: boolean;
  roles: AppRole[];
  email: string | null;
} {
  const { roles, email, ready } = useRoles();
  const users = useSettings((s) => s.users);

  const checkCan = (action: Action): boolean => {
    if (!email) return false;

    const matchedUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    // Super Owner â€” unrestricted platform access
    if (matchedUser?.isSuperOwner) return true;
    if (matchedUser?.role === "Super Owner") return true;
    // Owner — unrestricted within their company
    if (matchedUser?.role === "Owner") return true;
    if (matchedUser) {
      if (!matchedUser.active) return false;

      // Customizable checkbox permission check with mapping
      const key = action.replace(".", "_");
      if (matchedUser.permissions && matchedUser.permissions[key] !== undefined) {
        return matchedUser.permissions[key];
      }
    }

    // SETTINGS-02: profile/user_roles may already resolve to owner even when
    // settings.users[] email match misses (stale cache / empty stub).
    if (
      (roles.includes("owner") || roles.includes("super_owner")) &&
      (action === "userManagement.view" ||
        action === "userManagement.edit" ||
        action === "settings.view" ||
        action === "settings.edit")
    ) {
      return true;
    }

    return can(roles, action);
  };

  return {
    roles,
    email,
    ready,
    can: checkCan,
  };
}
