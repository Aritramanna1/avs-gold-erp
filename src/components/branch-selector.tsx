import { useMemo } from "react";
import { useSettings } from "@/lib/settings-store";
import { useRoles } from "@/lib/rbac";
import { useTenantContext } from "@/lib/identity/tenant-context-store";
import { MapPin, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BranchSelector() {
  const { branches, selectedBranchId, setSelectedBranchId, users, firm } = useSettings();
  const { roles, email, ready } = useRoles();
  const { activeOrganizationId } = useTenantContext();

  const currentFirmId = activeOrganizationId || firm?.id;

  const currentUser = email
    ? users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    : null;
  const userBranchId = currentUser?.branchId;

  // Filter branches strictly for the active business/tenant and deduplicate
  const activeBranches = useMemo(() => {
    let list = branches.filter((b) => b.active);
    if (currentFirmId) {
      const firmScoped = list.filter((b) => (b.firmId || (b as any).firm_id) === currentFirmId);
      if (firmScoped.length > 0) {
        list = firmScoped;
      } else {
        const unassigned = list.filter((b) => !b.firmId && !(b as any).firm_id);
        if (unassigned.length > 0) {
          list = unassigned;
        }
      }
    }
    const seen = new Set<string>();
    return list.filter((b) => {
      const key = `${b.id}-${b.code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [branches, currentFirmId]);

  const activeBranchId = userBranchId || selectedBranchId || "MAIN";
  const currentBranch =
    activeBranches.find((b) => b.id === activeBranchId) ||
    activeBranches[0] ||
    branches.find((b) => b.id === activeBranchId) ||
    branches[0];

  // Checks if user is owner/manager to allow switching
  const canSwitch =
    ready && !userBranchId && (roles.includes("owner") || roles.includes("manager"));

  if (!currentBranch) return null;

  return (
    <div className="flex items-center gap-2 shrink-0" id="branch-selector-container">
      <span className="hidden 2xl:inline text-xs font-mono text-muted-foreground">
        Current Branch:
      </span>
      {canSwitch && activeBranches.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/80 hover:border-gold/40 hover:bg-gold/5 transition-all text-xs cursor-pointer focus:outline-none select-none">
            <MapPin className="h-3.5 w-3.5 text-gold" />
            <span className="font-semibold text-foreground">{currentBranch.name}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-popover text-popover-foreground border-border"
          >
            <div className="px-2 py-1.5 text-[10px] uppercase font-semibold text-muted-foreground border-b border-border/40 mb-1">
              Switch Branch Location
            </div>
            {activeBranches.map((b) => (
              <DropdownMenuItem
                key={b.id}
                id={`branch-select-item-${b.id}`}
                onClick={() => setSelectedBranchId(b.id)}
                className={`text-xs cursor-pointer flex items-center justify-between ${
                  b.id === selectedBranchId
                    ? "text-gold font-semibold bg-gold/5"
                    : "text-popover-foreground"
                }`}
              >
                <span>
                  {b.name} ({b.code})
                </span>
                {b.isDefault && (
                  <span className="text-[9px] uppercase bg-gold/15 text-gold px-1 py-0.5 rounded">
                    Default
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background/60 text-xs">
          <MapPin className="h-3.5 w-3.5 text-gold/60" />
          <span className="font-semibold text-muted-foreground">{currentBranch.name}</span>
        </div>
      )}
    </div>
  );
}
