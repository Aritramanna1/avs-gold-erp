import type { AppRole } from "@/lib/rbac";
import type { StaffRoleTemplate } from "@/lib/staff-role-types";

const VALID_APP_ROLES = new Set<AppRole>([
  "owner",
  "manager",
  "billing",
  "vault",
  "workshop",
  "accountant",
  "viewer",
]);

/** Map a display role label to Supabase `user_roles` entries. */
export function mapDisplayRoleToAppRoles(
  displayRole: string,
  templates?: StaffRoleTemplate[],
): AppRole[] {
  const normalized = displayRole.trim().toLowerCase();
  const fromTemplate = templates?.find((t) => t.label.trim().toLowerCase() === normalized);
  if (fromTemplate?.appRoles?.length) {
    return fromTemplate.appRoles.filter((r) => VALID_APP_ROLES.has(r));
  }

  if (normalized.includes("super owner") || normalized.includes("administrator")) {
    return ["owner", "manager"];
  }
  if (normalized.includes("ceo")) return ["viewer"];
  if (normalized.includes("branch manager")) return ["manager"];
  if (normalized.includes("workshop")) return ["workshop", "vault"];
  if (normalized.includes("accountant")) return ["accountant", "billing"];
  if (
    normalized.includes("retail") ||
    normalized.includes("sales") ||
    normalized.includes("counter")
  ) {
    return ["billing"];
  }
  if (normalized.includes("crm")) return ["billing", "manager"];
  if (normalized.includes("manufacturing")) return ["workshop"];
  return ["viewer"];
}
