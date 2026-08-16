/**
 * Unified workspace / role switcher — only shows backend-granted contexts.
 */
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthorizationContext } from "@/lib/identity/authorization-context-store";
import type { AuthorizedWorkspace } from "@/lib/identity/authorization-types";
import { DEFAULT_PLATFORM_SEARCH } from "@/lib/platform-search";
import { toast } from "sonner";

const WORKSPACE_LABELS: Record<string, string> = {
  platform: "Platform Owner",
  erp: "Main ERP",
  ceo: "CEO Portal",
  customer: "Customer",
  supplier: "Supplier",
  karigar: "Karigar",
};

function labelFor(ws: AuthorizedWorkspace): string {
  if (ws.workspace_type === "platform") return WORKSPACE_LABELS.platform;
  const roleLabel = WORKSPACE_LABELS[ws.workspace_type] ?? ws.workspace_type;
  return `${ws.organization_name} — ${roleLabel}`;
}

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const { context, loading, switchWorkspace } = useAuthorizationContext();

  const groups = useMemo(() => {
    if (!context) return [];
    const byOrg = new Map<string, AuthorizedWorkspace[]>();
    for (const ws of context.workspaces) {
      const key = ws.organization_id ?? "platform";
      if (!byOrg.has(key)) byOrg.set(key, []);
      byOrg.get(key)!.push(ws);
    }
    return [...byOrg.entries()];
  }, [context]);

  const active = context?.workspaces.find((w) => w.is_active);
  const switchableCount = context?.workspaces.length ?? 0;

  if (!context || switchableCount <= 1) return null;

  async function onSelect(ws: AuthorizedWorkspace) {
    if (ws.is_active) return;
    try {
      const route = await switchWorkspace(ws);
      if (route.startsWith("/platform")) {
        void navigate({ to: "/platform", search: DEFAULT_PLATFORM_SEARCH, replace: true });
      } else {
        void navigate({ to: route as "/", replace: true });
      }
      toast.success(`Switched to ${labelFor(ws)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch workspace");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className="gap-2 max-w-[220px] border-gold/30"
          disabled={loading}
        >
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-gold" />
          <span className="truncate text-xs font-medium">
            {active ? labelFor(active) : "Switch workspace"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Switch workspace / role
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {groups.map(([orgKey, items]) => (
          <div key={orgKey}>
            {items.length > 1 && orgKey !== "platform" && (
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide py-1">
                {items[0]?.organization_name}
              </DropdownMenuLabel>
            )}
            {items.map((ws) => (
              <DropdownMenuItem
                key={ws.workspace_key}
                className="flex items-center gap-2 text-sm"
                onClick={() => void onSelect(ws)}
              >
                {ws.is_active ? (
                  <Check className="h-3.5 w-3.5 text-gold shrink-0" />
                ) : (
                  <span className="w-3.5" />
                )}
                <span className="truncate">{labelFor(ws)}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
