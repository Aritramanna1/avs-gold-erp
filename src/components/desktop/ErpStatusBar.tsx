import { APP_NAME, APP_VERSION } from "@/lib/app-info";
import { useSettings } from "@/lib/settings-store";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useRoles } from "@/lib/rbac";

/** Persistent status strip — desktop / laptop (single line, no duplicate session panel). */
export function ErpStatusBar() {
  const firm = useSettings((s) => s.firm);
  const role = useSettings((s) => s.currentUserRole);
  const { email } = useRoles();
  const branchId = useSettings((s) => s.selectedBranchId);
  const branches = useSettings((s) => s.branches);
  const branch = branches.find((b) => b.id === branchId);
  const { isOnline } = useNetworkStatus();
  const fy = (() => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    return m >= 3 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
  })();

  return (
    <footer
      className="hidden lg:flex shrink-0 items-center gap-3 px-3 py-1 border-t border-border bg-muted/50 text-[10px] text-muted-foreground font-medium tracking-wide"
      role="status"
      aria-label="Application status"
    >
      <span>{isOnline ? "Online" : "Offline queue"}</span>
      <span className="text-border">|</span>
      <span className="truncate">Company: {firm?.shopName || APP_NAME}</span>
      <span className="text-border">|</span>
      <span>FY: {fy}</span>
      <span className="text-border">|</span>
      <span className="truncate">User: {email?.split("@")[0] || "—"}</span>
      <span className="text-border">|</span>
      <span>Role: {role || "—"}</span>
      {branch ? (
        <>
          <span className="text-border">|</span>
          <span className="truncate">Branch: {branch.name}</span>
        </>
      ) : null}
      <span className="ml-auto">Version: {APP_VERSION}</span>
      <span className="text-border">|</span>
      <span className="text-emerald-700 dark:text-emerald-400">Ready</span>
    </footer>
  );
}
