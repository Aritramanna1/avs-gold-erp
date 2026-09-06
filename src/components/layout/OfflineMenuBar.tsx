import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  navigationGroups,
  itemRouteKey,
  collectNavLeaves,
  filterNavGroupsByPermission,
  isNavFolder,
  findGroupForPath,
  type NavItemDef,
} from "@/lib/navigation-groups";
import { hasRoutePermission } from "@/lib/permissions";
import { useSettings } from "@/lib/settings-store";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTerminology } from "@/lib/terminology-engine-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const STORAGE_KEY = "avs_offline_menu_active_v2";

function isItemActive(
  pathname: string,
  search: Record<string, unknown>,
  item: NavItemDef,
  visibleLeaves: NavItemDef[],
): boolean {
  if (!item.to) return false;
  const to = item.to;
  const matches =
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
  if (!matches) return false;
  if (item.search) {
    return Object.entries(item.search).every(([k, v]) => String(search[k] ?? "") === v);
  }
  const hasMoreSpecific = visibleLeaves.some(
    (candidate) =>
      candidate.to === to &&
      candidate.search &&
      Object.entries(candidate.search).every(([k, v]) => String(search[k] ?? "") === v),
  );
  if (hasMoreSpecific) return false;
  return !visibleLeaves.some(
    (candidate) =>
      !!candidate.to &&
      candidate.to !== to &&
      candidate.to.length > to.length &&
      (pathname === candidate.to || pathname.startsWith(`${candidate.to}/`)),
  );
}

function folderContainsActive(
  folder: NavItemDef,
  pathname: string,
  search: Record<string, unknown>,
  visibleLeaves: NavItemDef[],
): boolean {
  return collectNavLeaves(folder.children ?? []).some((leaf) =>
    isItemActive(pathname, search, leaf, visibleLeaves),
  );
}

/**
 * Classic Offline / Jwelly Ace menubar:
 * Top menu → dropdown → nested submenu (▸) → leaf form only.
 * Example: Utility → Cheque → Print | Register | Checkbook.
 */
import { useWorkflowEngine, type BusinessMode } from "@/lib/workflow-engine";
import { Factory, ShoppingBag, Sparkles } from "lucide-react";

export function OfflineMenuBar({ className = "" }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({
    select: (s) => (s.location.search ?? {}) as Record<string, unknown>,
  });
  const navigate = useNavigate();
  const role = useSettings((s) => s.currentUserRole);
  const { t } = useLanguage();
  const tTerm = useTerminology((s) => s.tTerm);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { config: wfConfig, patch: patchWf } = useWorkflowEngine();

  const filteredGroups = useMemo(
    () =>
      filterNavGroupsByPermission(navigationGroups, (to) => hasRoutePermission(role, to)),
    [role, wfConfig.mode],
  );

  const flatVisible = useMemo(
    () => filteredGroups.flatMap((g) => collectNavLeaves(g.items)),
    [filteredGroups],
  );

  const routeGroup = useMemo(
    () => findGroupForPath(pathname, search, filteredGroups),
    [pathname, search, filteredGroups],
  );

  const [activeGroupId, setActiveGroupId] = useState<string>(() => {
    if (typeof window === "undefined") return "master";
    try {
      return localStorage.getItem(STORAGE_KEY) || "master";
    } catch {
      return "master";
    }
  });

  useEffect(() => {
    if (!routeGroup) return;
    setActiveGroupId(routeGroup.id);
    try {
      localStorage.setItem(STORAGE_KEY, routeGroup.id);
    } catch {
      /* ignore */
    }
  }, [routeGroup?.id]);

  function handleModeSwitch(newMode: BusinessMode) {
    patchWf({ mode: newMode });
    const label =
      newMode === "manufacturing_only"
        ? "Manufacturing Strictly (Retail CRM hidden)"
        : newMode === "retail_only"
          ? "Retail Showroom Only (Workshop hidden)"
          : "Full Combined Suite";
    toast.success(`Operational Mode: ${label}`);
  }

  function itemLabel(item: NavItemDef): string {
    const termKey =
      item.to === "/people" && item.search?.tab === "customers"
        ? "party_customer"
        : item.to === "/people" && item.search?.tab === "vendors"
          ? "party_supplier"
          : item.to === "/people" && item.search?.tab === "karigars"
            ? "worker_artisan"
            : item.to === "/ledger"
              ? "account_ledger"
              : item.i18nKey === "item_job_cards"
                ? "job_card"
                : undefined;
    const translated = t(`navigation.${item.i18nKey}`);
    const raw =
      translated === `navigation.${item.i18nKey}` || translated.startsWith("navigation.")
        ? item.label
        : translated;
    return termKey ? tTerm(termKey, raw) : raw;
  }

  function openLeaf(item: NavItemDef) {
    if (!item.to) return;
    void navigate({ to: item.to, search: item.search });
    setOpenMenuId(null);
    setActiveGroupId(
      filteredGroups.find((g) =>
        collectNavLeaves(g.items).some((l) => itemRouteKey(l) === itemRouteKey(item)),
      )?.id ?? activeGroupId,
    );
  }

  function renderNodes(nodes: NavItemDef[]) {
    return nodes.map((node) => {
      if (isNavFolder(node)) {
        const openish = folderContainsActive(node, pathname, search, flatVisible);
        return (
          <div key={itemRouteKey(node)}>
            {node.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={`text-xs ${openish ? "text-gold font-semibold" : ""}`}
              >
                {itemLabel(node)}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[12rem] p-1">
                {renderNodes(node.children!)}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </div>
        );
      }

      const active = isItemActive(pathname, search, node, flatVisible);
      return (
        <div key={itemRouteKey(node)}>
          {node.separatorBefore ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            className={`text-xs cursor-pointer ${active ? "bg-gold/15 text-gold font-semibold" : ""}`}
            onSelect={(e) => {
              e.preventDefault();
              openLeaf(node);
            }}
          >
            {itemLabel(node)}
          </DropdownMenuItem>
        </div>
      );
    });
  }

  return (
    <div
      className={`shrink-0 border-b border-border bg-card ${className}`}
      data-nav="offline-menu"
      id="offline-menu-bar"
    >
      <div className="flex items-center justify-between gap-2 pr-2">
        <nav
          className="flex items-stretch gap-0 overflow-x-auto scrollbar-none"
          aria-label="Offline ERP main menu"
          role="menubar"
        >
          {filteredGroups.map((group) => {
            const selected = group.id === activeGroupId || routeGroup?.id === group.id;
            const isOpen = openMenuId === group.id;
            return (
              <DropdownMenu
                key={group.id}
                open={isOpen}
                onOpenChange={(open) => {
                  setOpenMenuId(open ? group.id : null);
                  if (open) {
                    setActiveGroupId(group.id);
                    try {
                      localStorage.setItem(STORAGE_KEY, group.id);
                    } catch {
                      /* ignore */
                    }
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    role="menuitem"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    className={`shrink-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
                      selected || isOpen
                        ? "border-gold text-gold bg-gold/5"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    {(() => {
                      const label = t(`navigation.${group.i18nKey}`);
                      return label.startsWith("navigation.") ? group.label : label;
                    })()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={0}
                  className="min-w-[14rem] max-h-[min(70vh,32rem)] overflow-y-auto p-1"
                >
                  {renderNodes(group.items)}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>

        {/* Operational Domain Switcher Pill */}
        <div className="hidden lg:flex items-center gap-1 border border-border/80 rounded-md p-0.5 bg-muted/30 text-[10px] shrink-0 no-print" id="operational-mode-switcher">
          <button
            type="button"
            onClick={() => handleModeSwitch("manufacturing_only")}
            className={`px-2 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              wfConfig.mode === "manufacturing_only"
                ? "bg-amber-500 text-black shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
            title="Switch to Strict Manufacturing Mode (Retail CRM hidden)"
          >
            <Factory className="h-3 w-3" /> Manufacturing
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("retail_only")}
            className={`px-2 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              wfConfig.mode === "retail_only"
                ? "bg-blue-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
            title="Switch to Strict Retail Showroom Mode (Manufacturing hidden)"
          >
            <ShoppingBag className="h-3 w-3" /> Retail
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("combined_commerce_manufacturing")}
            className={`px-2 py-0.5 rounded font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              wfConfig.mode === "combined_commerce_manufacturing"
                ? "bg-gold text-gold-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
            title="Combined Commerce + Manufacturing Suite"
          >
            <Sparkles className="h-3 w-3" /> Both
          </button>
        </div>
      </div>

      {/* Breadcrumb of open cascade path for current form */}
      {routeGroup ? (
        <div className="flex items-center gap-1 px-3 py-1 text-[10px] text-muted-foreground border-t border-border/50 overflow-x-auto scrollbar-none">
          <span className="font-semibold text-foreground/70 uppercase tracking-wide shrink-0">
            {(() => {
              const label = t(`navigation.${routeGroup.i18nKey}`);
              return label.startsWith("navigation.") ? routeGroup.label : label;
            })()}
          </span>
          {flatVisible
            .filter((item) => isItemActive(pathname, search, item, flatVisible))
            .slice(0, 1)
            .map((item) => (
              <span key={itemRouteKey(item)} className="flex items-center gap-1 min-w-0">
                <span aria-hidden>›</span>
                <Link
                  to={item.to!}
                  search={item.search}
                  className="truncate text-gold font-medium hover:underline"
                >
                  {itemLabel(item)}
                </Link>
              </span>
            ))}
        </div>
      ) : null}
    </div>
  );
}
