import type { AppRole } from "@/lib/rbac";
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { useSettings } from "@/lib/settings-store";

/** Stable lowercase key for comparing display roles from user_profiles / app_settings. */
export function normalizeRoleKey(role: string): string {
  return role
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Maps the authoritative display role (user_profiles.role) to internal AppRole
 * capabilities. Never silently downgrade unknown roles to viewer — infer from labels.
 */
export function displayRoleToAppRoles(displayRole: string): AppRole[] {
  const key = normalizeRoleKey(displayRole);
  const roles = new Set<AppRole>();

  if (key === "saas_admin" || key === "saasadmin") {
    roles.add("saas_admin");
    return [...roles];
  }

  if (
    key.includes("super_owner") ||
    key === "superowner" ||
    key === "owner" ||
    key.includes("firm_owner")
  ) {
    ["owner", "manager", "vault", "workshop", "accountant", "billing"].forEach((r) =>
      roles.add(r as AppRole),
    );
    return [...roles];
  }

  if (key.includes("administrator") || key.includes("admin") || key.includes("branch_manager")) {
    ["owner", "manager", "vault", "workshop", "accountant"].forEach((r) => roles.add(r as AppRole));
    return [...roles];
  }

  if (key.includes("accountant")) {
    roles.add("accountant");
    roles.add("viewer");
    return [...roles];
  }

  if (
    key.includes("workshop") ||
    key.includes("manufacturing") ||
    key === "vault" ||
    key.includes("karigar")
  ) {
    roles.add("workshop");
    roles.add("vault");
    roles.add("viewer");
    return [...roles];
  }

  if (
    key.includes("billing") ||
    key.includes("retail") ||
    key.includes("sales") ||
    key.includes("counter") ||
    key.includes("crm")
  ) {
    roles.add("billing");
    roles.add("viewer");
    return [...roles];
  }

  if (key.includes("ceo") || key.includes("view_only")) {
    roles.add("viewer");
    return [...roles];
  }

  if (key.includes("manager")) {
    roles.add("manager");
    roles.add("viewer");
    return [...roles];
  }

  // Preserve custom pilot labels that still imply operational access.
  if (key.includes("staff") || key.includes("executive")) {
    roles.add("billing");
    roles.add("viewer");
    return [...roles];
  }

  roles.add("viewer");
  return [...roles];
}

export function isAdminLikeRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const key = normalizeRoleKey(role);
  return (
    key === "saas_admin" ||
    key.includes("super_owner") ||
    key === "owner" ||
    key.includes("administrator") ||
    key.includes("branch_manager") ||
    (key.includes("admin") && !key.includes("saas"))
  );
}

export function isWorkshopLikeRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const key = normalizeRoleKey(role);
  return (
    key.includes("workshop") ||
    key.includes("manufacturing") ||
    key === "vault" ||
    key.includes("karigar")
  );
}

export function isBillingLikeRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const key = normalizeRoleKey(role);
  return (
    key.includes("billing") ||
    key.includes("accountant") ||
    key.includes("retail") ||
    key.includes("sales")
  );
}

/** Authoritative role from user_profiles; falls back to app_settings users directory. */
export async function fetchAuthoritativeUserRole(
  authId: string,
  email: string,
): Promise<string | null> {
  try {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("auth_id", authId)
      .maybeSingle();
    if (!error && profile?.role) return profile.role;
  } catch (err) {
    console.warn("[role-resolution] user_profiles lookup failed:", err);
  }

  const matched = useSettings
    .getState()
    .users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return matched?.role ?? null;
}

export async function syncCurrentUserRoleFromProfile(): Promise<string | null> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  const email = authData?.user?.email;
  if (!userId || !email) return null;

  const role = await fetchAuthoritativeUserRole(userId, email);
  if (role && role !== useSettings.getState().currentUserRole) {
    useSettings.getState().setCurrentUserRole(role);
  }
  return role;
}
