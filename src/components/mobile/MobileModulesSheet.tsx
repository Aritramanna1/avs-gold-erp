import { useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Search, ChevronRight, LayoutGrid } from "lucide-react";
import {
  navigationGroups,
  itemRouteKey,
  collectNavLeaves,
  filterNavGroupsByPermission,
  isNavFolder,
  type NavItemDef,
} from "@/lib/navigation-groups";
import { splitNavItemsForDisclosure } from "@/lib/navigation-primary";
import { ProgressiveDisclosure } from "@/components/ui/progressive-disclosure";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/lib/settings-store";
import { hasRoutePermission } from "@/lib/permissions";
import { useRoles } from "@/lib/rbac";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";

export function useAuthorizedModuleGroups(query = "") {
  const storedRole = useSettings((s) => s.currentUserRole);
  const { roles } = useRoles();
  const role = storedRole || roles[0] || "Owner";

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const permitted = filterNavGroupsByPermission(navigationGroups, (to) =>
      hasRoutePermission(role, to),
    );
    return permitted
      .map((group) => {
        if (!q) return group;
        const leaves = collectNavLeaves(group.items).filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (item.to ?? "").toLowerCase().includes(q) ||
            group.label.toLowerCase().includes(q),
        );
        return { ...group, items: leaves };
      })
      .filter((group) => collectNavLeaves(group.items).length > 0);
  }, [query, role]);
}

/** Full ERP module directory — always lists authorized modules first. Search only filters. */
export function MobileModulesDirectory({
  onNavigate,
  searchable = true,
}: {
  onNavigate?: () => void;
  searchable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const groups = useAuthorizedModuleGroups(query);
  const total = groups.reduce((n, g) => n + collectNavLeaves(g.items).length, 0);
  const { t } = useLanguage();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({
    select: (s) => (s.location.search ?? {}) as Record<string, unknown>,
  });
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  function labelOf(item: NavItemDef): string {
    const translated = t(`navigation.${item.i18nKey}`);
    return translated.startsWith("navigation.") ? item.label : translated;
  }

  function renderModuleLink(item: NavItemDef) {
    if (!item.to) return null;
    const Icon = item.icon;
    return (
      <Link
        key={itemRouteKey(item)}
        to={item.to}
        search={item.search}
        onClick={onNavigate}
        className="flex items-center gap-2.5 min-h-[var(--touch-target)] rounded-sm px-2.5 py-2 border-b border-border/50 hover:bg-muted/60 active:bg-muted"
      >
        <Icon className="h-4 w-4 text-gold shrink-0" />
        <span className="flex-1 text-sm font-medium">{labelOf(item)}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    );
  }

  function renderNode(item: NavItemDef, flat: NavItemDef[]) {
    if (isNavFolder(item)) {
      const folderId = item.id ?? item.i18nKey;
      const leaves = collectNavLeaves(item.children ?? []);
      const active = leaves.some((leaf) => isItemActive(leaf, flat));
      const open = openFolders[folderId] ?? active;
      return (
        <div key={itemRouteKey(item)}>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 min-h-[var(--touch-target)] rounded-sm px-2.5 py-2 border-b border-border/50 text-left font-medium text-sm"
            aria-expanded={open}
            onClick={() => setOpenFolders((p) => ({ ...p, [folderId]: !open }))}
          >
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            />
            <span className="flex-1">{labelOf(item)}</span>
          </button>
          {open
            ? (item.children ?? []).map((child) => (
                <div key={itemRouteKey(child)} className="pl-3">
                  {renderNode(child, flat)}
                </div>
              ))
            : null}
        </div>
      );
    }
    return renderModuleLink(item);
  }

  function isItemActive(item: NavItemDef, flat: NavItemDef[]) {
    if (!item.to) return false;
    const matches =
      item.to === "/"
        ? pathname === "/"
        : pathname === item.to || pathname.startsWith(`${item.to}/`);
    if (!matches) return false;
    if (item.search) {
      return Object.entries(item.search).every(([k, v]) => String(search[k] ?? "") === v);
    }
    return !flat.some(
      (candidate) =>
        candidate.to &&
        candidate.to !== item.to &&
        candidate.to.length > item.to!.length &&
        (pathname === candidate.to || pathname.startsWith(`${candidate.to}/`)),
    );
  }

  const filtering = query.trim().length > 0;

  return (
    <div className="flex flex-col min-h-0">
      {searchable ? (
        <div className="relative px-1 pb-2">
          <Search className="absolute left-4 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter modules…"
            className="pl-9 min-h-[var(--touch-target)]"
            autoFocus={false}
            enterKeyHint="search"
            aria-label="Filter modules"
          />
        </div>
      ) : null}
      <nav className="flex-1 overflow-y-auto px-1 py-1" aria-label="ERP modules">
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground text-center">
            {query.trim()
              ? "No modules match that filter. Clear search to see every module."
              : "No modules available for this role."}
          </p>
        ) : (
          <>
            <p className="px-3 pb-2 text-[11px] text-muted-foreground">
              {total} module{total === 1 ? "" : "s"}
              {query.trim() ? " matching filter" : ""}
            </p>
            {groups.map((group) => {
              const flat = collectNavLeaves(group.items);
              const activeRouteKey = flat.find((item) => isItemActive(item, flat));
              const groupTitle = (() => {
                const label = t(`navigation.${group.i18nKey}`);
                return label.startsWith("navigation.") ? group.label : label;
              })();

              if (filtering) {
                const { primary, secondary } = splitNavItemsForDisclosure(
                  group.id,
                  group.items,
                  activeRouteKey ? itemRouteKey(activeRouteKey) : null,
                );
                return (
                  <div key={group.id} className="mb-3">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {groupTitle}
                    </p>
                    {primary.map((item) => renderModuleLink(item))}
                    {secondary.length > 0 ? (
                      <div className="px-2 pb-1">
                        <ProgressiveDisclosure
                          title={t("navigation.more_forms")}
                          hint={t("navigation.more_forms_hint")}
                          className="border-border/60"
                          defaultOpen={secondary.some((item) => isItemActive(item, flat))}
                        >
                          {secondary.map((item) => renderModuleLink(item))}
                        </ProgressiveDisclosure>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <div key={group.id} className="mb-3">
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {groupTitle}
                  </p>
                  {group.items.map((item) => renderNode(item, flat))}
                </div>
              );
            })}
          </>
        )}
      </nav>
    </div>
  );
}

/** Bottom-sheet wrapper used from account menu. More page renders the directory inline. */
export function MobileModulesSheet({
  triggerClassName,
  onNavigate,
}: {
  triggerClassName?: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  function closeAndNavigate() {
    setOpen(false);
    onNavigate?.();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className={
            triggerClassName ??
            "flex w-full items-center gap-3 min-h-[var(--touch-target)] rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium"
          }
        >
          <LayoutGrid className="h-4 w-4 text-gold" />
          <span className="flex-1 text-left">{t("mobile.allModules")}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[min(90vh,720px)] rounded-t-xl p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border shrink-0">
          <SheetTitle className="text-left font-serif">{t("mobile.allModules")}</SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Every authorized ERP module. Filter is optional.
          </p>
        </SheetHeader>
        <div className="flex-1 min-h-0 px-3 pt-3 pb-[max(1rem,var(--ornexa-inset-bottom))]">
          <MobileModulesDirectory onNavigate={closeAndNavigate} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
