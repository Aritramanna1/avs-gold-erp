import type { NavItemDef } from "@/lib/navigation-groups";
import { itemRouteKey } from "@/lib/navigation-groups";

/** Visible keyboard hints for high-traffic sidebar routes (matches shortcuts-store). */
const ROUTE_SHORTCUT_HINTS: Record<string, string> = {
  "/app": "Alt+H",
  "/billing": "Alt+B",
  "/billing/new": "Alt+N",
  "/orders": "Alt+O",
  "/stock": "Alt+S",
  "/workshop/gold-book": "Alt+W",
  "/workshop": "Alt+M",
  "/manufacturing": "Alt+J",
  "/conversion": "Alt+C",
  "/ledger": "Alt+G",
  "/expenses": "Alt+E",
  "/people": "Alt+P",
  "/reports": "Alt+R",
  "/control/accounts": "Alt+A",
  "/treasury/vouchers": "Alt+T",
  "/treasury/cash-book": "Alt+Shift+C",
};

export function getNavShortcutHint(item: NavItemDef): string | undefined {
  if (!item.to) return undefined;
  return ROUTE_SHORTCUT_HINTS[itemRouteKey(item)] ?? ROUTE_SHORTCUT_HINTS[item.to];
}

export const SIDEBAR_KEYBOARD_HINT =
  "↑↓ move · ←→ collapse · Enter open · Alt+[ focus menu · Ctrl+K search";
