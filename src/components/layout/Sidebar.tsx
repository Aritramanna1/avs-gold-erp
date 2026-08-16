import { Link, useRouterState } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-store";
import { Logo } from "@/components/ui/Logo";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useMemo, useState } from "react";
import {
  navigationGroups,
  itemRouteKey,
  type NavGroupDef,
  type NavItemDef,
} from "@/lib/navigation-groups";
import { hasRoutePermission } from "@/lib/permissions";
import { useTerminology } from "@/lib/terminology-engine-store";
import { ChevronDown } from "lucide-react";

export { navigationGroups, navigationItems } from "@/lib/navigation-items";

const STORAGE_KEY = "ornexa_sidebar_groups_v1";

interface SidebarProps {
  onOpenGoldRateEditor: () => void;
  className?: string;
}

function loadOpenGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function isItemActive(pathname: string, item: NavItemDef, visibleItems: NavItemDef[]): boolean {
  const matches =
    item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
  if (!matches) return false;
  return !visibleItems.some(
    (candidate) =>
      candidate.to !== item.to &&
      candidate.to.length > item.to.length &&
      (pathname === candidate.to || pathname.startsWith(`${candidate.to}/`)),
  );
}

export function Sidebar({ onOpenGoldRateEditor, className = "" }: SidebarProps) {
  const { t } = useLanguage();
  const tTerm = useTerminology((s) => s.tTerm);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const goldRatePerGramPaise = useSettings((s) => s.goldRatePerGramPaise);
  const goldRate24KPerGramPaise = useSettings((s) => s.goldRate24KPerGramPaise);
  const firm = useSettings((s) => s.firm);
  const branding = useSettings((s) => s.branding);
  const role = useSettings((s) => s.currentUserRole);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpenGroups);

  const filteredGroups = useMemo(() => {
    return navigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => hasRoutePermission(role, item.to)),
      }))
      .filter((group) => group.items.length > 0);
  }, [role]);

  const flatVisibleItems = useMemo(() => filteredGroups.flatMap((g) => g.items), [filteredGroups]);

  useEffect(() => {
    const activeGroup = filteredGroups.find((group) =>
      group.items.some((item) => isItemActive(pathname, item, flatVisibleItems)),
    );
    if (activeGroup && !openGroups[activeGroup.id]) {
      setOpenGroups((prev) => {
        const next = { ...prev, [activeGroup.id]: true };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, [pathname, filteredGroups, flatVisibleItems, openGroups]);

  function toggleGroup(group: NavGroupDef) {
    setOpenGroups((prev) => {
      const next = { ...prev, [group.id]: !prev[group.id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const shopInitials = firm?.shopName
    ? firm.shopName
        .split(" ")
        .filter(Boolean)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
    : "ERP";

  const formattedGoldRate =
    goldRatePerGramPaise > 0
      ? `Rs. ${(goldRatePerGramPaise / 100).toLocaleString("en-IN")}/g`
      : "NOT SET";

  const formattedGoldRate24 =
    goldRate24KPerGramPaise > 0
      ? `Rs. ${(goldRate24KPerGramPaise / 100).toLocaleString("en-IN")}/g`
      : "NOT SET";

  return (
    <aside
      data-tour="sidebar"
      className={`flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground ${className}`}
      id="app-sidebar-main"
    >
      <div className="flex flex-col border-b border-sidebar-border px-5 py-4" id="sidebar-branding">
        <div className="flex items-center gap-3">
          <Logo variant="svg" className="h-10 w-10 object-contain animate-fade-in" />
          <div className="min-w-0">
            <div className="font-serif text-lg leading-tight text-gold truncate">
              {branding.shortName || `${shopInitials} ERP`}
            </div>
            <div
              className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold truncate"
              title={firm?.shopName}
            >
              {firm?.shopName}
            </div>
          </div>
        </div>
      </div>

      <div
        className="px-4 py-3 mx-3 mt-3 rounded-md bg-sidebar-accent/40 border border-sidebar-border/60 hover:border-gold/30 transition-all group"
        id="sidebar-gold-widget"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            <span
              className={`h-1.5 w-1.5 rounded-full animate-pulse ${goldRatePerGramPaise > 0 ? "bg-success" : "bg-warning"}`}
            />
            {t("navigation.liveMetalRates")}
          </div>
          <button
            type="button"
            onClick={onOpenGoldRateEditor}
            className="text-[10px] text-gold hover:text-gold-light underline cursor-pointer bg-transparent border-0 p-0 font-medium focus:outline-none"
            id="sidebar-rate-update-action"
          >
            {t("navigation.update")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="bg-sidebar/50 p-2 rounded-lg border border-sidebar-border/30">
            <span className="text-[9px] text-muted-foreground block font-semibold">22K / 916</span>
            <span
              className={`font-serif text-xs font-semibold leading-tight ${goldRatePerGramPaise > 0 ? "text-gold" : "text-red-500 dark:text-red-400 underline animate-pulse"}`}
            >
              {formattedGoldRate}
            </span>
          </div>
          <div className="bg-sidebar/50 p-2 rounded-lg border border-sidebar-border/30">
            <span className="text-[9px] text-muted-foreground block font-semibold">24K Pure</span>
            <span
              className={`font-serif text-xs font-semibold leading-tight ${goldRate24KPerGramPaise > 0 ? "text-amber-500" : "text-red-500 dark:text-red-400 underline animate-pulse"}`}
            >
              {formattedGoldRate24}
            </span>
          </div>
        </div>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-2 py-3 space-y-1"
        id="sidebar-navigation"
        aria-label="ERP navigation"
      >
        {filteredGroups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroups[group.id] ?? group.id === "home";
          const groupActive = group.items.some((item) =>
            isItemActive(pathname, item, flatVisibleItems),
          );
          const singleItem = group.items.length === 1 ? group.items[0] : null;

          if (singleItem) {
            const Icon = singleItem.icon;
            const active = isItemActive(pathname, singleItem, flatVisibleItems);
            return (
              <Link
                key={group.id}
                to={singleItem.to}
                search={singleItem.search}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
                  active
                    ? "bg-sidebar-accent text-gold font-medium shadow-[inset_3px_0_0_0_#d4af37]"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? "text-gold" : "text-muted-foreground"}`}
                />
                <span className="min-w-0 flex-1 truncate">{singleItem.label}</span>
              </Link>
            );
          }

          return (
            <div key={group.id} className="rounded-lg">
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${
                  groupActive ? "text-gold" : "text-muted-foreground hover:text-sidebar-foreground"
                }`}
                aria-expanded={isOpen}
              >
                <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{group.label}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="mt-0.5 space-y-0.5 pl-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isItemActive(pathname, item, flatVisibleItems);
                    const termKey =
                      item.to === "/people" && item.search?.tab === "customers"
                        ? "party_customer"
                        : undefined;
                    const label = termKey ? tTerm(termKey, item.label) : item.label;
                    return (
                      <Link
                        key={itemRouteKey(item)}
                        to={item.to}
                        search={item.search}
                        aria-current={active ? "page" : undefined}
                        className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                          active
                            ? "bg-sidebar-accent text-gold font-medium shadow-[inset_3px_0_0_0_#d4af37]"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        }`}
                      >
                        <Icon
                          className={`h-3.5 w-3.5 shrink-0 ${active ? "text-gold" : "text-muted-foreground"}`}
                        />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div
        className="px-5 py-3 border-t border-sidebar-border text-[11px] text-muted-foreground/75 flex items-center justify-between"
        id="sidebar-info-footer"
      >
        <span>v1.0 | pilot</span>
        <div className="flex items-center gap-1.5 text-[10px] text-success font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-success inline-block animate-ping" />
          <span>{t("navigation.secureLogs")}</span>
        </div>
      </div>
    </aside>
  );
}
