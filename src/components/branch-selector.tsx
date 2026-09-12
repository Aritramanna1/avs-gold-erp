import { useMemo } from "react";
import { useSettings } from "@/lib/settings-store";
import { useRoles } from "@/lib/rbac";
import { useTenantContext } from "@/lib/identity/tenant-context-store";
import { MapPin, ChevronDown, Building2, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function BranchSelector() {
  const { branches, selectedBranchId, setSelectedBranchId, users, firm } = useSettings();
  const { roles, email, ready } = useRoles();
  const {
    memberships,
    activeOrganizationId,
    switching,
    switchBusiness,
  } = useTenantContext();

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
    const isAritraManna =
      email?.toLowerCase().includes("aritramanna") ||
      email?.toLowerCase().includes("aritra.manna");

    if (isAritraManna && list.length > 1) {
      const primary =
        list.find((b) => b.isDefault) ||
        list.find((b) => String(b.code || "").toUpperCase() === "MAIN") ||
        list[0];
      list = [primary];
    }

    const seen = new Set<string>();
    return list.filter((b) => {
      const key = `${b.id}-${b.code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [branches, currentFirmId, email]);

  const activeBranchId = userBranchId || selectedBranchId || "MAIN";
  const currentBranch =
    activeBranches.find((b) => b.id === activeBranchId) ||
    activeBranches[0] ||
    branches.find((b) => b.id === activeBranchId) ||
    branches[0];

  // Checks if user is owner/manager to allow switching
  const canSwitch =
    ready && !userBranchId && (roles.includes("owner") || roles.includes("manager"));

  const hasMultipleBranches = activeBranches.length > 1;
  const hasMultipleBusinesses = memberships.length > 1;

  if (!currentBranch) return null;

  async function handleSwitchBusiness(orgId: string, orgName: string) {
    if (orgId === activeOrganizationId || switching) return;
    try {
      await switchBusiness(orgId);
      toast.success(`Switched to ${orgName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch business");
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0" id="branch-selector-container">
      {canSwitch && (hasMultipleBranches || hasMultipleBusinesses) ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/80 hover:border-gold/40 hover:bg-gold/5 transition-all text-xs cursor-pointer focus:outline-none select-none">
            <MapPin className="h-3.5 w-3.5 text-gold shrink-0" />
            <span className="font-semibold text-foreground max-w-[150px] truncate">
              {currentBranch.name}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-60 bg-popover text-popover-foreground border-border"
          >
            {hasMultipleBranches && (
              <>
                <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1.5">
                  Branches
                </DropdownMenuLabel>
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
              </>
            )}

            {hasMultipleBusinesses && (
              <>
                {hasMultipleBranches && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1.5">
                  Switch Business
                </DropdownMenuLabel>
                {memberships.map((m) => (
                  <DropdownMenuItem
                    key={m.membership_id}
                    disabled={switching}
                    onClick={() => void handleSwitchBusiness(m.organization_id, m.organization_name)}
                    className="text-xs cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-gold shrink-0" />
                      <span className="truncate">{m.organization_name}</span>
                    </div>
                    {m.organization_id === activeOrganizationId ? (
                      <Check className="h-3.5 w-3.5 text-gold shrink-0" />
                    ) : switching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background/60 text-xs">
          <MapPin className="h-3.5 w-3.5 text-gold/60 shrink-0" />
          <span className="font-semibold text-muted-foreground max-w-[150px] truncate">{currentBranch.name}</span>
        </div>
      )}
    </div>
  );
}
