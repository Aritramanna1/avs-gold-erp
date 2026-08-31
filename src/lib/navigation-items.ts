/**
 * Flat navigation list derived from grouped navigation.
 * Prefer `navigationGroups` in Sidebar; this export remains for mobile search and legacy imports.
 */
import { flattenNavigationGroups } from "@/lib/navigation-groups";

export { navigationGroups, flattenNavigationGroups } from "@/lib/navigation-groups";
export type { NavGroupDef, NavItemDef } from "@/lib/navigation-groups";

/** Portal shortcuts, onboarding, and assistant are intentionally excluded from primary ERP nav. */
export const navigationItems = flattenNavigationGroups();
