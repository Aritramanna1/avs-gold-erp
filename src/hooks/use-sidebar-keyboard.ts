/**
 * Sidebar roving-focus keyboard navigation — ↑↓ items, ←→ groups, Enter to open.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { NavGroupDef, NavItemDef } from "@/lib/navigation-groups";
import { itemRouteKey } from "@/lib/navigation-groups";

export type SidebarFocusKind = "group" | "item";

export interface SidebarFocusTarget {
  kind: SidebarFocusKind;
  groupId: string;
  itemKey?: string;
}

interface UseSidebarKeyboardOptions {
  groups: NavGroupDef[];
  openGroups: Record<string, boolean>;
  setOpenGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  navRef: RefObject<HTMLElement | null>;
}

function buildFocusOrder(
  groups: NavGroupDef[],
  openGroups: Record<string, boolean>,
  defaultOpen: string[],
): SidebarFocusTarget[] {
  const order: SidebarFocusTarget[] = [];
  for (const group of groups) {
    const isOpen = openGroups[group.id] ?? defaultOpen.includes(group.id);
    if (group.items.length === 1) {
      order.push({ kind: "item", groupId: group.id, itemKey: itemRouteKey(group.items[0]) });
      continue;
    }
    order.push({ kind: "group", groupId: group.id });
    if (isOpen) {
      for (const item of group.items) {
        order.push({ kind: "item", groupId: group.id, itemKey: itemRouteKey(item) });
      }
    }
  }
  return order;
}

function focusDomTarget(target: SidebarFocusTarget): boolean {
  const sel =
    target.kind === "group"
      ? `[data-sidebar-focus="group"][data-group-id="${target.groupId}"]`
      : `[data-sidebar-focus="item"][data-item-key="${target.itemKey}"]`;
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return false;
  el.focus();
  el.scrollIntoView({ block: "nearest" });
  return true;
}

export function useSidebarKeyboard({
  groups,
  openGroups,
  setOpenGroups,
  navRef,
}: UseSidebarKeyboardOptions) {
  const navigate = useNavigate();
  const defaultOpen = useMemo(() => ["home", "billing", "transactions", "gold-stock"], []);
  const [focused, setFocused] = useState<SidebarFocusTarget | null>(null);
  const typeAheadRef = useRef({ buffer: "", ts: 0 });

  const focusOrder = useMemo(
    () => buildFocusOrder(groups, openGroups, defaultOpen),
    [groups, openGroups, defaultOpen],
  );

  const persistOpen = useCallback(
    (next: Record<string, boolean>) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("ornexa_sidebar_groups_v1", JSON.stringify(next));
      }
    },
    [],
  );

  const setGroupOpen = useCallback(
    (groupId: string, open: boolean) => {
      setOpenGroups((prev) => {
        const next = { ...prev, [groupId]: open };
        persistOpen(next);
        return next;
      });
    },
    [setOpenGroups, persistOpen],
  );

  const moveFocus = useCallback(
    (delta: number) => {
      if (focusOrder.length === 0) return;
      const currentIdx = focused
        ? focusOrder.findIndex(
            (t) =>
              t.kind === focused.kind &&
              t.groupId === focused.groupId &&
              t.itemKey === focused.itemKey,
          )
        : -1;
      const nextIdx =
        currentIdx < 0
          ? delta > 0
            ? 0
            : focusOrder.length - 1
          : (currentIdx + delta + focusOrder.length) % focusOrder.length;
      const next = focusOrder[nextIdx];
      setFocused(next);
      focusDomTarget(next);
    },
    [focusOrder, focused],
  );

  const navigateItem = useCallback(
    (item: NavItemDef) => {
      if (!item.to) return;
      void navigate({ to: item.to as "/", search: item.search as never });
    },
    [navigate],
  );

  const handleNavKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const focusAttr = target.getAttribute("data-sidebar-focus");
      if (!focusAttr) return;

      const groupId = target.getAttribute("data-group-id") ?? "";
      const itemKey = target.getAttribute("data-item-key") ?? undefined;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveFocus(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveFocus(-1);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        const first = focusOrder[0];
        if (first) {
          setFocused(first);
          focusDomTarget(first);
        }
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        const last = focusOrder[focusOrder.length - 1];
        if (last) {
          setFocused(last);
          focusDomTarget(last);
        }
        return;
      }

      if (focusAttr === "group") {
        if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setGroupOpen(groupId, true);
          const firstItem = groups.find((g) => g.id === groupId)?.items[0];
          if (firstItem) {
            const t: SidebarFocusTarget = {
              kind: "item",
              groupId,
              itemKey: itemRouteKey(firstItem),
            };
            setFocused(t);
            requestAnimationFrame(() => focusDomTarget(t));
          }
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setGroupOpen(groupId, false);
          return;
        }
      }

      if (focusAttr === "item" && e.key === "Enter") {
        e.preventDefault();
        const group = groups.find((g) => g.id === groupId);
        const item = group?.items.find((i) => itemRouteKey(i) === itemKey);
        if (item) navigateItem(item);
        return;
      }

      if (focusAttr === "item" && e.key === "ArrowLeft") {
        e.preventDefault();
        const t: SidebarFocusTarget = { kind: "group", groupId };
        setFocused(t);
        focusDomTarget(t);
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const now = Date.now();
        const ta = typeAheadRef.current;
        if (now - ta.ts > 800) ta.buffer = "";
        ta.buffer += e.key.toLowerCase();
        ta.ts = now;
        const match = focusOrder.find((t) => {
          if (t.kind !== "item" || !t.itemKey) return false;
          for (const g of groups) {
            const item = g.items.find((i) => itemRouteKey(i) === t.itemKey);
            if (!item) continue;
            const label = item.label.toLowerCase();
            return label.startsWith(ta.buffer);
          }
          return false;
        });
        if (match) {
          e.preventDefault();
          setFocused(match);
          focusDomTarget(match);
        }
      }
    },
    [focusOrder, groups, moveFocus, navigateItem, setGroupOpen],
  );

  useEffect(() => {
    function onFocusSidebar() {
      const first = focusOrder[0];
      if (!first) return;
      setFocused(first);
      requestAnimationFrame(() => focusDomTarget(first));
    }
    window.addEventListener("ornexa:focus-sidebar", onFocusSidebar);
    return () => window.removeEventListener("ornexa:focus-sidebar", onFocusSidebar);
  }, [focusOrder]);

  useEffect(() => {
    function onDocKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const nav = navRef.current;
      if (!nav) return;
      if (nav.contains(document.activeElement)) {
        (document.activeElement as HTMLElement)?.blur();
        setFocused(null);
      }
    }
    document.addEventListener("keydown", onDocKeyDown);
    return () => document.removeEventListener("keydown", onDocKeyDown);
  }, [navRef]);

  return {
    focused,
    setFocused,
    handleNavKeyDown,
    defaultOpenGroups: defaultOpen,
  };
}
