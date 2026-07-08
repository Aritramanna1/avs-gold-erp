import { useSettings } from "@/lib/settings-store";
import { hasRoutePermission, canWrite, canAdmin } from "@/lib/permissions";

export interface Permissions {
  role: string | null;
  /** Can navigate to the given path? */
  can: (path: string) => boolean;
  /** Can perform write/create/edit/delete operations? (CEO is view-only) */
  canWrite: boolean;
  /** Can access admin-only sections (Settings, Branches, Users)? */
  canAdmin: boolean;
}

export function usePermissions(): Permissions {
  const role = useSettings((s) => s.currentUserRole);
  return {
    role,
    can: (path: string) => hasRoutePermission(role, path),
    canWrite: canWrite(role),
    canAdmin: canAdmin(role),
  };
}
