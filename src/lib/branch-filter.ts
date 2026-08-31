import { useCallback, useMemo } from "react";
import { useSettings } from "@/lib/settings-store";
import { useRoles } from "@/lib/rbac";

export function useBranchFilter() {
  const { selectedBranchId, branches, users } = useSettings();
  const { roles, email, ready } = useRoles();

  const currentUser = useMemo(
    () =>
      email
        ? users.find((u) => u.email.toLowerCase() === email.toLowerCase())
        : null,
    [email, users],
  );
  const userBranchId = currentUser?.branchId;

  // Owners and managers are privileged UNLESS they are locked to a specific branch
  const isPrivileged =
    ready && !userBranchId && (roles.includes("owner") || roles.includes("manager"));

  const activeBranchId = userBranchId || selectedBranchId || "MAIN";

  const filter = useCallback(
    <T extends { branchId?: string; branch_id?: string }>(items: T[]): T[] => {
      return items.filter((item) => {
        const bid = item.branchId || item.branch_id || "MAIN";
        return bid === activeBranchId;
      });
    },
    [activeBranchId],
  );

  return useMemo(
    () => ({ filter, selectedBranchId: activeBranchId, isPrivileged, branches }),
    [filter, activeBranchId, isPrivileged, branches],
  );
}

