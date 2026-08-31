/**
 * Business switcher — desktop header + mobile account sheet.
 * One identity, many authorized businesses; server verifies every switch.
 */
import { useEffect, useState } from "react";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import { useTenantContext } from "@/lib/identity/tenant-context-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function subscriptionBadge(status?: string | null) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "active" || s === "trial") return "text-emerald-500";
  if (s === "grace_period" || s === "past_due") return "text-amber-500";
  return "text-muted-foreground";
}

export function BusinessSwitcher({ compact = false }: { compact?: boolean }) {
  const {
    memberships,
    activeOrganizationId,
    activeOrganizationName,
    loading,
    switching,
    loadMemberships,
    switchBusiness,
  } = useTenantContext();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  if (loading || memberships.length <= 1) return null;

  async function handleSwitch(orgId: string, orgName: string) {
    if (orgId === activeOrganizationId || switching) return;
    try {
      await switchBusiness(orgId);
      toast.success(`Switched to ${orgName}`);
      setSheetOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch business");
    }
  }

  const list = (
    <div className="py-1">
      <p className="px-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        Switch Business
      </p>
      {memberships.map((m) => (
        <button
          key={m.membership_id}
          type="button"
          disabled={switching}
          onClick={() => void handleSwitch(m.organization_id, m.organization_name)}
          className={cn(
            "w-full flex items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-muted/60 transition-colors",
            m.organization_id === activeOrganizationId && "bg-muted/40",
          )}
        >
          <Building2 className="h-4 w-4 mt-0.5 text-gold shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{m.organization_name}</p>
            <p className={cn("text-[10px] capitalize", subscriptionBadge(m.subscription_status))}>
              {m.subscription_status ?? "—"}
              {m.portal_type ? ` · ${m.portal_type}` : m.role ? ` · ${m.role}` : ""}
            </p>
          </div>
          {m.organization_id === activeOrganizationId ? (
            <Check className="h-4 w-4 text-gold shrink-0" />
          ) : switching ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          ) : null}
        </button>
      ))}
    </div>
  );

  if (compact) {
    return (
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs font-normal">
            <Building2 className="h-3.5 w-3.5 text-gold" />
            <span className="max-w-[120px] truncate">{activeOrganizationName ?? "Business"}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-lg">
          <SheetHeader>
            <SheetTitle className="text-left text-base">Switch Business</SheetTitle>
          </SheetHeader>
          {list}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 border-border/80 text-xs font-normal"
        >
          <Building2 className="h-3.5 w-3.5 text-gold" />
          <span className="max-w-[160px] truncate">
            {activeOrganizationName ?? "Select business"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Your Businesses
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.membership_id}
            disabled={switching}
            onClick={() => void handleSwitch(m.organization_id, m.organization_name)}
            className="flex items-start gap-2 cursor-pointer"
          >
            <Building2 className="h-4 w-4 mt-0.5 text-gold" />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{m.organization_name}</p>
              <p className={cn("text-[10px] capitalize", subscriptionBadge(m.subscription_status))}>
                {m.subscription_status ?? "—"}
              </p>
            </div>
            {m.organization_id === activeOrganizationId ? (
              <Check className="h-4 w-4 text-gold" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Full-screen business selector shown after login when multiple memberships exist.
 */
export function BusinessSelectorScreen() {
  const { memberships, switching, switchBusiness, loading } = useTenantContext();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <h1 className="font-serif text-2xl">Choose Business</h1>
          <p className="text-sm text-muted-foreground">
            Your account has access to multiple firms. Select one to continue.
          </p>
        </div>
        <div className="space-y-2">
          {memberships.map((m) => (
            <button
              key={m.membership_id}
              type="button"
              disabled={switching}
              onClick={() => void switchBusiness(m.organization_id)}
              className="w-full flex items-center gap-3 rounded-md border border-border bg-card p-4 text-left hover:border-gold/40 transition-colors"
            >
              <Building2 className="h-5 w-5 text-gold shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{m.organization_name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {m.subscription_status ?? "—"}
                  {m.role ? ` · ${m.role}` : ""}
                </p>
              </div>
              {switching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
