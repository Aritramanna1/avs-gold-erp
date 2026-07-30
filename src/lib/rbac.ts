/**
 * Role-based access control for MTJ ERP.
 *
 * Roles come from public.user_roles (Supabase). The login wall in
 * <AuthGate> already blocks anonymous users from every route — RBAC layers
 * fine-grained action gates on top of that wall and DB RLS.
 */
import { useEffect, useState } from "react";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";
import { isLocalFirstMode } from "@/lib/deployment-mode";
import { getLocalSessionUser } from "@/lib/local-auth";
import { ROLES } from "@/lib/permissions";

export type AppRole =
  | "saas_admin" // Platform control-plane administrator; never a company role
  | "super_owner" // Platform administrator — unrestricted access to all companies, branches, system settings
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

/**
 * Maps a local_users role label (the "Super Owner"/"Branch Manager"/... strings
 * used by permissions.ts) onto this module's fine-grained AppRole set. Offline
 * mode has no user_roles table to read, so the mapping lives here.
 */
function mapLocalRole(role: string, isSuperOwner: boolean): AppRole[] {
  if (isSuperOwner || role === ROLES.SUPER_OWNER || role === ROLES.ADMINISTRATOR) {
    return ["super_owner"];
  }
  switch (role) {
    case ROLES.CEO:
      return ["viewer"];
    case ROLES.BRANCH_MANAGER:
      return ["manager", "billing", "vault", "workshop", "accountant"];
    case ROLES.WORKSHOP_MANAGER:
    case ROLES.MANUFACTURING_STAFF:
      return ["workshop", "vault"];
    case ROLES.ACCOUNTANT:
      return ["accountant"];
    case ROLES.RETAIL_STAFF:
    case ROLES.SALES_EXECUTIVE:
      return ["billing"];
    default:
      return ["viewer"];
  }
}

export function can(roles: AppRole[] | readonly string[], action: Action): boolean {
  // Super Owner bypasses all permission checks
  if (roles.includes("super_owner")) return true;
  const allowed = MATRIX[action];
  return roles.some((r) => allowed.includes(r as AppRole));
}

/** Live roles for the currently signed-in user. Empty array while loading or signed-out. */
export function useRoles(): { roles: AppRole[]; email: string | null; ready: boolean } {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Offline mode (SAD §17): local_users is the sole source of roles —
      // never query Supabase's user_roles table or its auth session.
      if (isLocalFirstMode()) {
        const localUser = await getLocalSessionUser();
        if (cancelled) return;
        setEmail(localUser?.email ?? null);
        setRoles(localUser ? mapLocalRole(localUser.role, localUser.isSuperOwner) : []);
        setReady(true);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      const userId = user?.id;
      const userEmail = user?.email || null;

      if (!userId) {
        if (!cancelled) {
          setRoles([]);
          setEmail(null);
          setReady(true);
        }
        return;
      }

      if (!cancelled) {
        setEmail(userEmail);
      }

      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (cancelled) return;

      const dbRoles = (data ?? []).map((r) => r.role as AppRole);

      // Look up defined users from store as fallback or overriding role authority
      const registeredUsers = useSettings.getState().users;
      const matched = registeredUsers.find(
        (ru) => ru.email.toLowerCase() === userEmail?.toLowerCase(),
      );

      const finalRoles: AppRole[] = [];

      // Map any existing DB roles or fallback matching
      dbRoles.forEach((r) => {
        const rLower = r.toLowerCase();
        if (rLower === "saas_admin" || rLower === "saas admin") {
          if (!finalRoles.includes("saas_admin")) finalRoles.push("saas_admin");
        } else if (
          rLower.includes("owner") ||
          rLower.includes("manager") ||
          rLower.includes("admin") ||
          rLower.includes("accountant")
        ) {
          const ownerSuite: AppRole[] = ["owner", "manager", "vault", "workshop", "accountant"];
          ownerSuite.forEach((role) => {
            if (!finalRoles.includes(role)) finalRoles.push(role);
          });
        } else if (
          rLower.includes("billing") ||
          rLower.includes("counter") ||
          rLower.includes("assistant")
        ) {
          if (!finalRoles.includes("billing")) finalRoles.push("billing");
        } else {
          if (!finalRoles.includes(r)) finalRoles.push(r);
        }
      });

      if (matched && matched.active) {
        const roleLabel = matched.role.toLowerCase();
        if (roleLabel === "saas_admin" || roleLabel === "saas admin") {
          if (!finalRoles.includes("saas_admin")) finalRoles.push("saas_admin");
        } else if (
          roleLabel.includes("owner") ||
          roleLabel.includes("manager") ||
          roleLabel.includes("admin")
        ) {
          const ownerSuite: AppRole[] = ["owner", "manager", "vault", "workshop", "accountant"];
          ownerSuite.forEach((role) => {
            if (!finalRoles.includes(role)) finalRoles.push(role);
          });
        } else if (
          roleLabel.includes("counter") ||
          roleLabel.includes("assistant") ||
          roleLabel.includes("billing")
        ) {
          if (!finalRoles.includes("billing")) finalRoles.push("billing");
        } else {
          if (!finalRoles.includes("viewer")) finalRoles.push("viewer");
        }
      }

      // Default fallback if no roles
      if (finalRoles.length === 0) {
        if (dbRoles.length > 0) {
          dbRoles.forEach((r) => finalRoles.push(r));
        } else {
          finalRoles.push("viewer");
        }
      }

      setRoles(finalRoles.length > 0 ? finalRoles : ["viewer"]);
      setReady(true);
    }
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === "SIGNED_IN" || evt === "SIGNED_OUT" || evt === "USER_UPDATED") {
        setReady(false);
        void load();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { roles, email, ready };
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

    // Super Owner — unrestricted platform access
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

    return can(roles, action);
  };

  return {
    roles,
    email,
    ready,
    can: checkCan,
  };
}
