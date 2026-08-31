/**
 * Customizable staff role templates — hook for Settings / User Management UI.
 */
import { useMemo } from "react";
import { useCustomizationHubPreferences } from "@/lib/customization-hub-preferences-store";
import { DEFAULT_STAFF_ROLE_TEMPLATES, type StaffRoleTemplate } from "@/lib/staff-role-types";

export type { StaffRoleTemplate } from "@/lib/staff-role-types";
export { DEFAULT_STAFF_ROLE_TEMPLATES } from "@/lib/staff-role-types";

export function useStaffRoleTemplates(): StaffRoleTemplate[] {
  const configured = useCustomizationHubPreferences((s) => s.staffRoles);
  const hydrated = useCustomizationHubPreferences((s) => s.hydrated);
  return useMemo(() => {
    if (!hydrated || !configured?.length) return DEFAULT_STAFF_ROLE_TEMPLATES;
    return configured;
  }, [configured, hydrated]);
}

export function staffRoleLabels(templates: StaffRoleTemplate[]): string[] {
  return templates.map((t) => t.label);
}

export function staffDepartments(templates: StaffRoleTemplate[]): string[] {
  const defaults = [
    "Management",
    "Retail Counter",
    "Manufacturing / Workshop",
    "Accounts & Finance",
    "CRM & Communications",
    "Administration",
  ];
  const fromTemplates = templates.map((t) => t.department).filter(Boolean) as string[];
  return [...new Set([...fromTemplates, ...defaults])];
}
