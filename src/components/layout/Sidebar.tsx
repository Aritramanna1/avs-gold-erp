import { Link, useRouterState } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-store";
import { Logo } from "@/components/ui/Logo";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  navigationGroups,
  itemRouteKey,
  collectNavLeaves,
  filterNavGroupsByPermission,
  isNavFolder,
  type NavGroupDef,
  type NavItemDef,
} from "@/lib/navigation-groups";
import { hasRoutePermission } from "@/lib/permissions";
import { useTerminology } from "@/lib/terminology-engine-store";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useSidebarKeyboard } from "@/hooks/use-sidebar-keyboard";
import { getNavShortcutHint, SIDEBAR_KEYBOARD_HINT } from "@/lib/nav-shortcut-hints";

export { navigationGroups, navigationItems } from "@/lib/navigation-items";

/** Bumped for final 9-group Retail vs Manufacturing separation. */
const STORAGE_KEY = "ornexa_sidebar_groups_v7";

interface SidebarProps {
  onOpenGoldRateEditor: () => void;
  className?: string;
  /** Dense Offline list — no gold-rate card chrome (rates live in header). */
  compact?: boolean;
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

function isItemActive(
  pathname: string,
  search: Record<string, unknown>,
  item: NavItemDef,
  visibleItems: NavItemDef[],
): boolean {
  if (!item.to) return false;
  const to = item.to;
  const matches =
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
  if (!matches) return false;
  if (item.search) {
    return Object.entries(item.search).every(([k, v]) => String(search[k] ?? "") === v);
  }
  const hasMoreSpecific = visibleItems.some(
    (candidate) =>
      candidate.to === to &&
      candidate.search &&
      Object.entries(candidate.search).every(([k, v]) => String(search[k] ?? "") === v),
  );
  if (hasMoreSpecific) return false;
  return !visibleItems.some(
    (candidate) =>
      !!candidate.to &&
      candidate.to !== to &&
      candidate.to.length > to.length &&
      (pathname === candidate.to || pathname.startsWith(`${candidate.to}/`)),
  );
}

function NavShortcutBadge({ hint }: { hint: string }) {
  return (
    <kbd className="hidden xl:inline-flex shrink-0 items-center rounded border border-sidebar-border/80 bg-sidebar-accent/50 px-1 py-0.5 font-mono text-[9px] leading-none text-muted-foreground group-hover:text-sidebar-foreground/90 group-focus-visible:text-gold">
      {hint}
    </kbd>
  );
}

export function Sidebar({
  onOpenGoldRateEditor,
  className = "",
  compact = false,
}: SidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({
    select: (s) => (s.location.search ?? {}) as Record<string, unknown>,
  });
  const { t } = useLanguage();
  const tTerm = useTerminology((s) => s.tTerm);
  const goldRatePerGramPaise = useSettings((s) => s.goldRatePerGramPaise);
  const firm = useSettings((s) => s.firm);
  const branding = useSettings((s) => s.branding);
  const role = useSettings((s) => s.currentUserRole);
  const navRef = useRef<HTMLElement>(null);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpenGroups);

  const filteredGroups = useMemo(
    () =>
      filterNavGroupsByPermission(navigationGroups, (to) => hasRoutePermission(role, to)),
    [role],
  );

  const flatVisibleItems = useMemo(
    () => filteredGroups.flatMap((g) => collectNavLeaves(g.items)),
    [filteredGroups],
  );

  /** Keyboard nav walks leaves; cascade folders stay click-to-expand in the tree UI. */
  const keyboardGroups = useMemo(
    () =>
      filteredGroups.map((g) => ({
        ...g,
        items: collectNavLeaves(g.items),
      })),
    [filteredGroups],
  );

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const { handleNavKeyDown, defaultOpenGroups, focused, setFocused } = useSidebarKeyboard({
    groups: keyboardGroups,
    openGroups,
    setOpenGroups,
    navRef,
  });

  useEffect(() => {
    const activeGroup = filteredGroups.find((group) =>
      collectNavLeaves(group.items).some((item) =>
        isItemActive(pathname, search, item, flatVisibleItems),
      ),
    );
    if (!activeGroup) return;
    setOpenGroups((prev) => {
      if (prev[activeGroup.id]) return prev;
      const next = { ...prev, [activeGroup.id]: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [pathname, search, filteredGroups, flatVisibleItems]);

  function toggleGroup(group: NavGroupDef) {
    setOpenGroups((prev) => {
      const next = { ...prev, [group.id]: !prev[group.id] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
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
      translated.startsWith("navigation.") || translated === `navigation.${item.i18nKey}`
        ? item.label
        : translated;
    return termKey ? tTerm(termKey, raw) : raw;
  }

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar";

  function toggleFolder(folderId: string) {
    setOpenFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  }

  function renderNavNode(item: NavItemDef, groupId: string, depth: number) {
    if (isNavFolder(item)) {
      const folderId = item.id ?? item.i18nKey;
      const leaves = collectNavLeaves(item.children ?? []);
      const folderActive = leaves.some((leaf) =>
        isItemActive(pathname, search, leaf, flatVisibleItems),
      );
      const isOpen = openFolders[folderId] ?? folderActive;
      return (
        <div key={itemRouteKey(item)} className={depth > 0 ? "pl-2" : undefined}>
          <button
            type="button"
            className={`w-full flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors ${focusRing} ${
              folderActive
                ? "text-gold"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
            }`}
            aria-expanded={isOpen}
            onClick={() => toggleFolder(folderId)}
          >
            <ChevronRight
              className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{itemLabel(item)}</span>
          </button>
          {isOpen
            ? (item.children ?? []).map((child) => renderNavNode(child, groupId, depth + 1))
            : null}
        </div>
      );
    }

    if (!item.to) return null;
    const Icon = item.icon;
    const active = isItemActive(pathname, search, item, flatVisibleItems);
    const hint = getNavShortcutHint(item);
    const itemFocused = focused?.kind === "item" && focused.itemKey === itemRouteKey(item);
    return (
      <Link
        key={itemRouteKey(item)}
        to={item.to}
        search={item.search}
        tabIndex={0}
        data-sidebar-focus="item"
        data-group-id={groupId}
        data-item-key={itemRouteKey(item)}
        aria-current={active ? "page" : undefined}
        onFocus={() =>
          setFocused({
            kind: "item",
            groupId,
            itemKey: itemRouteKey(item),
          })
        }
        className={`group flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-[13px] transition-colors ${focusRing} ${
          depth > 0 ? "pl-6" : ""
        } ${
          active || itemFocused
            ? "bg-sidebar-accent text-gold font-medium shadow-[inset_2px_0_0_0_#d4af37]"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        }`}
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-gold" : "text-muted-foreground"}`} />
        <span className="min-w-0 flex-1 truncate">{itemLabel(item)}</span>
        {hint ? <NavShortcutBadge hint={hint} /> : null}
      </Link>
    );
  }

  const shopInitials = firm?.shopName
    ? firm.shopName
        .split(" ")
        .filter(Boolean)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
    : "ERP";

  return (
    <aside
      data-tour="sidebar"
      className={`flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground ${className}`}
      id="app-sidebar-main"
    >
      <div className="flex flex-col border-b border-sidebar-border px-4 py-3" id="sidebar-branding">
        <div className="flex items-center gap-3">
          <Logo variant="svg" className="h-9 w-9 object-contain" />
          <div className="min-w-0">
            <div className="font-serif text-base leading-tight text-gold truncate">
              {branding.shortName || `${shopInitials} ERP`}
            </div>
            <div
              className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold truncate"
              title={firm?.shopName}
            >
              {firm?.shopName}
            </div>
          </div>
        </div>
        {!compact ? (
          <button
            type="button"
            onClick={onOpenGoldRateEditor}
            className="mt-2 text-left text-[10px] text-gold hover:underline"
          >
            {t("navigation.liveMetalRates")}:{" "}
            {goldRatePerGramPaise > 0
              ? `Rs. ${(goldRatePerGramPaise / 100).toLocaleString("en-IN")}/g`
              : t("navigation.notSet")}
          </button>
        ) : null}
      </div>

      <nav
        ref={navRef}
        className="flex-1 overflow-y-auto px-1.5 py-2 space-y-0.5"
        id="sidebar-navigation"
        aria-label="Offline ERP menu"
        onKeyDown={handleNavKeyDown}
      >
        {filteredGroups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = openGroups[group.id] ?? defaultOpenGroups.includes(group.id);
          const leaves = collectNavLeaves(group.items);
          const groupActive = leaves.some((item) =>
            isItemActive(pathname, search, item, flatVisibleItems),
          );
          const singleLeaf = leaves.length === 1 && !group.items.some(isNavFolder) ? leaves[0] : null;
          const groupFocused = focused?.kind === "group" && focused.groupId === group.id;

          if (singleLeaf?.to) {
            const Icon = singleLeaf.icon;
            const active = isItemActive(pathname, search, singleLeaf, flatVisibleItems);
            const hint = getNavShortcutHint(singleLeaf);
            const itemFocused =
              focused?.kind === "item" && focused.itemKey === itemRouteKey(singleLeaf);
            return (
              <Link
                key={group.id}
                to={singleLeaf.to}
                search={singleLeaf.search}
                tabIndex={0}
                data-sidebar-focus="item"
                data-group-id={group.id}
                data-item-key={itemRouteKey(singleLeaf)}
                aria-current={active ? "page" : undefined}
                onFocus={() =>
                  setFocused({
                    kind: "item",
                    groupId: group.id,
                    itemKey: itemRouteKey(singleLeaf),
                  })
                }
                className={`group flex items-center gap-2 rounded-sm px-2.5 py-2 text-sm transition-colors ${focusRing} ${
                  active || itemFocused
                    ? "bg-sidebar-accent text-gold font-medium shadow-[inset_2px_0_0_0_#d4af37]"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? "text-gold" : "text-muted-foreground"}`}
                />
                <span className="min-w-0 flex-1 truncate">{itemLabel(singleLeaf)}</span>
                {hint ? <NavShortcutBadge hint={hint} /> : null}
              </Link>
            );
          }

          const groupTitle = (() => {
            const label = t(`navigation.${group.i18nKey}`);
            return label.startsWith("navigation.") ? group.label : label;
          })();

          return (
            <div key={group.id}>
              <button
                type="button"
                tabIndex={0}
                data-sidebar-focus="group"
                data-group-id={group.id}
                onClick={() => toggleGroup(group)}
                onFocus={() => setFocused({ kind: "group", groupId: group.id })}
                className={`w-full flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors ${focusRing} ${
                  groupActive || groupFocused
                    ? "text-gold bg-sidebar-accent/30"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/20"
                }`}
                aria-expanded={isOpen}
              >
                <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{groupTitle}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {isOpen ? (
                <div className="mt-0.5 space-y-0.5 pl-0.5" role="group">
                  {group.items.map((item) => renderNavNode(item, group.id, 0))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-2 border-t border-sidebar-border space-y-1" id="sidebar-keyboard-hint">
        <p className="text-[10px] leading-snug text-muted-foreground/90 font-mono">
          {SIDEBAR_KEYBOARD_HINT}
        </p>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground/75">
          <span>AVS ERP</span>
          <span className="text-[10px] text-success font-medium">{t("navigation.secureLogs")}</span>
        </div>
      </div>
    </aside>
  );
}
