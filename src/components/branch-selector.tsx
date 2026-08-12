import { useSettings } from "@/lib/settings-store";
import { useRoles } from "@/lib/rbac";
import { MapPin, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BranchSelector() {
  const { branches, selectedBranchId, setSelectedBranchId, users } = useSettings();
  const { roles, email, ready } = useRoles();

  const currentUser = email
    ? users.find((u) => u.email.toLowerCase() === email.toLowerCase())
    : null;
  const userBranchId = currentUser?.branchId;

  const activeBranchId = userBranchId || selectedBranchId || "MAIN";
  const currentBranch = branches.find((b) => b.id === activeBranchId) || branches[0];
  const activeBranches = branches.filter((b) => b.active);

  // Checks if user is owner/manager to allow switching
  const canSwitch =
    ready && !userBranchId && (roles.includes("owner") || roles.includes("manager"));

  if (!currentBranch) return null;

  return (
    <div className="flex items-center gap-2 shrink-0" id="branch-selector-container">
      <span className="hidden lg:inline text-xs font-mono text-muted-foreground">
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
